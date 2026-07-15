const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Check arguments
const args = process.argv.slice(2);
const barcode = args.find(arg => !arg.startsWith('--'));
const shouldSave = args.includes('--save');

if (!barcode) {
  console.log("Usage: node scripts/scrape_by_barcode.cjs <barcode> [--save]");
  process.exit(1);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ──────────────────────────────────────────────────────────────
// 1. OPEN FOOD FACTS SCRAPER
// ──────────────────────────────────────────────────────────────
async function scrapeOpenFoodFacts(code) {
  console.log("[OFF] Querying Open Food Facts...");
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
  } catch (err) {
    console.error("[OFF] Error:", err.message);
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// 2. TOKOPEDIA GRAPHQL SEARCH SCRAPER
// ──────────────────────────────────────────────────────────────
async function scrapeTokopedia(code) {
  console.log("[Tokopedia] Querying GraphQL API...");
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
        // Tokopedia products usually don't have separated brand field in search results,
        // but we can extract a likely brand or leave it null.
        const firstProd = products[0];
        return {
          source: 'Tokopedia',
          barcode: code,
          nama_produk: firstProd.name,
          brand: null, // Tokopedia does not expose separate brand in search list easily
          image_url: firstProd.imageUrl
        };
      }
    } else {
      console.log(`[Tokopedia] Response status: ${response.status}`);
    }
  } catch (err) {
    console.error("[Tokopedia] Error:", err.message);
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// 3. SHOPEE API SEARCH SCRAPER
// ──────────────────────────────────────────────────────────────
async function scrapeShopee(code) {
  console.log("[Shopee] Querying Search API...");
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
    } else {
      console.log(`[Shopee] Response status: ${response.status}`);
    }
  } catch (err) {
    console.error("[Shopee] Error:", err.message);
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// 4. KLIKINDOMARET SCRAPER
// ──────────────────────────────────────────────────────────────
async function scrapeKlikIndomaret(code) {
  console.log("[KlikIndomaret] Querying HTML search...");
  const url = `https://www.klikindomaret.com/search/?key=${code}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8'
      }
    });

    if (response.ok) {
      const html = await response.text();
      
      // Parse Next.js page state if present and not blocked
      if (!html.includes('challenge') && !html.includes('cloudflare')) {
        // Try regex match for product details in HTML
        // Indomaret class structure uses specific tags for product titles, e.g. class="title" or "item-title"
        // Let's search for image urls and product names
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
      } else {
        console.log("[KlikIndomaret] Blocked by Cloudflare/WAF challenge.");
      }
    }
  } catch (err) {
    console.error("[KlikIndomaret] Error:", err.message);
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// 5. ALFAGIFT SCRAPER
// ──────────────────────────────────────────────────────────────
async function scrapeAlfagift(code) {
  console.log("[Alfagift] Querying HTML search...");
  const url = `https://alfagift.id/search?q=${code}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8'
      }
    });

    if (response.ok) {
      const html = await response.text();
      if (!html.includes('challenge') && !html.includes('cloudflare')) {
        // Try regex match for product details in Alfagift HTML
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
      } else {
        console.log("[Alfagift] Blocked by Cloudflare/WAF challenge.");
      }
    }
  } catch (err) {
    console.error("[Alfagift] Error:", err.message);
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// UNIFIED SEARCH ENGINE (FALLBACK CHAIN)
// ──────────────────────────────────────────────────────────────
async function runScrape(code) {
  console.log(`\n==================================================`);
  console.log(`Starting Scraping Engine for Barcode: ${code}`);
  console.log(`==================================================`);

  // Fallback order:
  // 1. Open Food Facts (very fast, reliable)
  let result = await scrapeOpenFoodFacts(code);
  if (result) return result;

  // 2. Tokopedia GraphQL (highly reliable if bypasses bot control)
  await sleep(300);
  result = await scrapeTokopedia(code);
  if (result) return result;

  // 3. Shopee API Search
  await sleep(300);
  result = await scrapeShopee(code);
  if (result) return result;

  // 4. KlikIndomaret HTML Scrape
  await sleep(300);
  result = await scrapeKlikIndomaret(code);
  if (result) return result;

  // 5. Alfagift HTML Scrape
  await sleep(300);
  result = await scrapeAlfagift(code);
  if (result) return result;

  return null;
}

// Helper to escape SQL string values
function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  const clean = val.toString().replace(/'/g, "''");
  return `'${clean}'`;
}

// Run script
async function main() {
  const result = await runScrape(barcode);
  
  if (result) {
    console.log(`\n🎉 PRODUCT FOUND!`);
    console.log(`Source:      ${result.source}`);
    console.log(`Barcode/SKU: ${result.barcode}`);
    console.log(`Product Name:${result.nama_produk}`);
    console.log(`Brand:       ${result.brand || 'N/A'}`);
    console.log(`Image URL:   ${result.image_url || 'N/A'}`);

    if (shouldSave) {
      console.log(`\n💾 Attempting to save to Supabase Database...`);
      const { execSync } = require('child_process');
      
      const id = crypto.randomUUID();
      const sku = result.barcode;
      const barcodeVal = result.barcode;
      const nama = result.nama_produk;
      const brand = result.brand;
      const imageUrl = result.image_url;

      const sql = `
        INSERT INTO public.daftar_produk (id, sku, barcode, nama_produk, brand, image_url)
        VALUES (
          ${escapeSql(id)}, 
          ${escapeSql(sku)}, 
          ${escapeSql(barcodeVal)}, 
          ${escapeSql(nama)}, 
          ${escapeSql(brand)}, 
          ${escapeSql(imageUrl)}
        )
        ON CONFLICT (sku) 
        DO UPDATE SET 
          nama_produk = EXCLUDED.nama_produk,
          brand = COALESCE(EXCLUDED.brand, public.daftar_produk.brand),
          image_url = COALESCE(EXCLUDED.image_url, public.daftar_produk.image_url),
          updated_at = NOW();
      `;

      const tempFile = 'temp_insert.sql';
      fs.writeFileSync(tempFile, sql, 'utf8');

      try {
        console.log("Running insert SQL via Supabase CLI...");
        const output = execSync(`supabase db query --linked -f ${tempFile}`, { encoding: 'utf8' });
        console.log("Database Response:", output.trim());
        console.log("✅ Product successfully saved/updated in database!");
      } catch (dbErr) {
        console.error("❌ Failed to save product to database:", dbErr.message);
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    }
  } else {
    console.log(`\n❌ Product with Barcode ${barcode} was NOT found on any platform.`);
  }
}

main();
