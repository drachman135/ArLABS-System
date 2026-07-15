import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

declare const process: any;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://dpthhttwmtgtbrsjtfcg.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGhodHR3bXRndGJyc2p0ZmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTA0NjUsImV4cCI6MjA5ODA4NjQ2NX0.kUHLK0QIVdCu0jAMq3zp8bxDpvg1g-9Mj5FrGoA1tB4';

// Helper to authenticate request (Admins only)
async function authenticateAdmin(req: any) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }

  const token = authHeader.split(' ')[1];
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: 'Invalid or expired session token', status: 401 };
  }

  // Check role in admins table
  const { data: admin, error: adminError } = await supabase
    .from('admins')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (admin && !adminError) {
    return { user, admin, supabase };
  }

  // Fallback check in users table
  const { data: dbUser, error: dbUserError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (dbUser && !dbUserError && ['admin', 'super_admin', 'staff'].includes(dbUser.role)) {
    return { user, admin: { role: dbUser.role }, supabase };
  }

  // Sandbox fallback: if admins table is empty
  const { count: adminCount, error: countError } = await supabase
    .from('admins')
    .select('*', { count: 'exact', head: true });

  if (!countError && adminCount === 0) {
    return { user, admin: { role: 'super_admin' }, supabase };
  }

  return { error: 'Forbidden: Admin access required', status: 403 };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ──────────────────────────────────────────────────────────────
// SCRAPING METHODS
// ──────────────────────────────────────────────────────────────
async function scrapeOpenFoodFacts(code: string) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,image_front_url`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ArLABS-AdminSystem - Node - Version 1.0' }
    });
    if (response.ok) {
      const res = await response.json();
      if (res.status === 1 && res.product) {
        return {
          source: 'Open Food Facts',
          barcode: code,
          nama_produk: res.product.product_name || null,
          brand: res.product.brands || null,
          image_url: res.product.image_front_url || null
        };
      }
    }
  } catch (err: any) {
    console.error("[OFF] Error:", err.message);
  }
  return null;
}

async function scrapeTokopedia(code: string) {
  const url = 'https://gql.tokopedia.com/graphql';
  const query = `
    query SearchProductQueryV4($params: String!) {
      ace_search_product_v4(params: $params) {
        data {
          products {
            name
            imageUrl
            __typename
          }
          __typename
        }
        __typename
      }
    }
  `;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://www.tokopedia.com',
        'Referer': `https://www.tokopedia.com/search?q=${code}`,
        'X-Version': '1'
      },
      body: JSON.stringify([
        {
          operationName: 'SearchProductQueryV4',
          variables: {
            params: `q=${code}&source=search&device=desktop&page=1&limit=3`
          },
          query: query
        }
      ])
    });

    if (response.ok) {
      const res = await response.json();
      const products = res[0]?.data?.ace_search_product_v4?.data?.products;
      if (products && products.length > 0) {
        return {
          source: 'Tokopedia',
          barcode: code,
          nama_produk: products[0].name,
          brand: null,
          image_url: products[0].imageUrl
        };
      }
    }
  } catch (err: any) {
    console.error("[Tokopedia] Error:", err.message);
  }
  return null;
}

async function scrapeShopee(code: string) {
  const url = `https://shopee.co.id/api/v4/search/search_items?keyword=${code}&limit=3&page_type=search`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `https://shopee.co.id/search?keyword=${code}`,
        'X-API-Source': 'pc',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8'
      }
    });

    if (response.ok) {
      const res = await response.json();
      const items = res.item_basic || res.items;
      if (items && items.length > 0) {
        const firstItem = items[0].item_basic || items[0];
        const imageUrl = firstItem.image ? `https://images.shopee.co.id/api/v4/client/asset_public/${firstItem.image}` : null;
        return {
          source: 'Shopee',
          barcode: code,
          nama_produk: firstItem.name,
          brand: firstItem.brand && firstItem.brand !== 'Tidak Ada Merk' ? firstItem.brand : null,
          image_url: imageUrl
        };
      }
    }
  } catch (err: any) {
    console.error("[Shopee] Error:", err.message);
  }
  return null;
}

async function scrapeKlikIndomaret(code: string) {
  const url = `https://www.klikindomaret.com/search/?key=${code}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9'
      }
    });

    if (response.ok) {
      const html = await response.text();
      if (!html.includes('challenge') && !html.includes('cloudflare')) {
        const nameMatch = html.match(/<div class="title"[^>]*>([\s\S]*?)<\/div>/i) || 
                          html.match(/<span class="item-title"[^>]*>([\s\S]*?)<\/span>/i);
        const imageMatch = html.match(/<img class="lazy"[^>]*src="([^"]+)"/i) ||
                           html.match(/<img[^>]*class="[^"]*img-responsive[^"]*"[^>]*src="([^"]+)"/i);
        if (nameMatch) {
          return {
            source: 'KlikIndomaret',
            barcode: code,
            nama_produk: nameMatch[1].replace(/<[^>]*>/g, '').trim(),
            brand: null,
            image_url: imageMatch ? imageMatch[1] : null
          };
        }
      }
    }
  } catch (err: any) {
    console.error("[KlikIndomaret] Error:", err.message);
  }
  return null;
}

async function scrapeAlfagift(code: string) {
  const url = `https://alfagift.id/search?q=${code}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9'
      }
    });

    if (response.ok) {
      const html = await response.text();
      if (!html.includes('challenge') && !html.includes('cloudflare')) {
        const nameMatch = html.match(/<h2 class="[^"]*product-name[^"]*"[^>]*>([\s\S]*?)<\/h2>/i) ||
                          html.match(/<div class="[^"]*product-title[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        const imageMatch = html.match(/<img class="[^"]*product-image[^"]*"[^>]*src="([^"]+)"/i);
        if (nameMatch) {
          return {
            source: 'Alfagift',
            barcode: code,
            nama_produk: nameMatch[1].replace(/<[^>]*>/g, '').trim(),
            brand: null,
            image_url: imageMatch ? imageMatch[1] : null
          };
        }
      }
    }
  } catch (err: any) {
    console.error("[Alfagift] Error:", err.message);
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// SERVERLESS HANDLER
// ──────────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(455 || 405).json({ success: false, error: 'Method not allowed' });
  }

  // 1. Authenticate Admin
  const auth = await authenticateAdmin(req);
  if (auth.error) {
    return res.status(auth.status || 401).json({ success: false, error: auth.error });
  }

  const { barcode, save } = req.query;

  if (!barcode) {
    return res.status(400).json({ success: false, error: 'Query parameter "barcode" is required' });
  }

  console.log(`API scraping query received for barcode: ${barcode}`);

  // Fallback scraping chain
  let product = await scrapeOpenFoodFacts(barcode);
  if (!product) {
    await sleep(200);
    product = await scrapeTokopedia(barcode);
  }
  if (!product) {
    await sleep(200);
    product = await scrapeShopee(barcode);
  }
  if (!product) {
    await sleep(200);
    product = await scrapeKlikIndomaret(barcode);
  }
  if (!product) {
    await sleep(200);
    product = await scrapeAlfagift(barcode);
  }

  if (!product) {
    return res.status(404).json({
      success: false,
      error: `Product with barcode ${barcode} not found on any platform.`
    });
  }

  // Save/Update in database if requested
  if (save === 'true') {
    try {
      const { data, error } = await auth.supabase
        .from('daftar_produk')
        .upsert({
          id: crypto.randomUUID(),
          sku: barcode,
          barcode: barcode,
          nama_produk: product.nama_produk,
          brand: product.brand,
          image_url: product.image_url,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'sku'
        })
        .select();

      if (error) {
        throw new Error(error.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Product successfully scraped and saved to database.',
        source: product.source,
        data: data[0]
      });
    } catch (dbErr: any) {
      console.error("Database save error:", dbErr);
      return res.status(500).json({
        success: false,
        error: `Failed to save product to database: ${dbErr.message}`,
        scrapedData: product
      });
    }
  }

  return res.status(200).json({
    success: true,
    data: product
  });
}
