const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced SQL escaping that also strips newlines to prevent broken SQL formatting
function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  // Escape single quotes and remove any newlines/carriage returns
  const clean = val.toString().replace(/'/g, "''").replace(/[\r\n]+/g, " ");
  return `'${clean}'`;
}

async function fetchWithRetry(url, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ArLABS-AdminSystem - Node - Version 1.0 (contact: info@ardevlabs.com)'
        }
      });
      
      if (response.ok) {
        return response;
      }
      
      console.log(`[API] Received status ${response.status} for ${url}. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
    } catch (err) {
      console.log(`[API] Request failed: ${err.message}. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
    }
    await sleep(delay);
  }
  return null;
}

async function run() {
  const totalPages = 30; // Fetch up to 30 pages of products
  const products = [];
  const barcodesSeen = new Set();

  console.log(`Starting bulk import of Indonesian products (pages 1 to ${totalPages})...`);

  for (let page = 1; page <= totalPages; page++) {
    const url = `https://world.openfoodfacts.org/api/v2/search?countries_tags=indonesia&fields=code,product_name,brands,image_front_url&page_size=100&page=${page}`;
    console.log(`Fetching page ${page}...`);

    const response = await fetchWithRetry(url);
    if (!response) {
      console.error(`❌ Failed to retrieve page ${page} after multiple retries. Skipping.`);
      continue;
    }

    try {
      const data = await response.json();
      if (data.products && data.products.length > 0) {
        let pageCount = 0;
        for (const item of data.products) {
          if (!item.code || !item.product_name) continue;
          
          if (barcodesSeen.has(item.code)) continue;
          barcodesSeen.add(item.code);

          products.push({
            id: crypto.randomUUID(),
            sku: item.code,
            barcode: item.code,
            nama_produk: item.product_name.trim(),
            brand: item.brands ? item.brands.trim() : null,
            image_url: item.image_front_url || null
          });
          pageCount++;
        }
        console.log(`... Parsed ${pageCount} new unique products from page ${page}.`);
      } else {
        console.log(`No more products found on page ${page}. Ending fetch loop.`);
        break;
      }
    } catch (err) {
      console.error(`Error parsing JSON for page ${page}:`, err.message);
    }

    await sleep(1000);
  }

  console.log(`\nTotal unique products collected: ${products.length}`);

  if (products.length === 0) {
    console.log("No products collected. Exiting.");
    return;
  }

  console.log("Generating bulk insert SQL script...");
  const tempFile = 'temp_bulk_insert.sql';
  
  const chunkSize = 200;
  let sqlContent = '';
  
  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);
    
    sqlContent += `
      INSERT INTO public.daftar_produk (id, sku, barcode, nama_produk, brand, image_url) VALUES\n`;
      
    const valueStrings = chunk.map(p => {
      return `(${escapeSql(p.id)}, ${escapeSql(p.sku)}, ${escapeSql(p.barcode)}, ${escapeSql(p.nama_produk)}, ${escapeSql(p.brand)}, ${escapeSql(p.image_url)})`;
    });
    
    sqlContent += valueStrings.join(',\n') + '\nON CONFLICT (sku) DO NOTHING;\n';
  }

  fs.writeFileSync(tempFile, sqlContent, 'utf8');
  console.log(`SQL script written to ${tempFile}`);

  try {
    console.log("Executing SQL insert via Supabase CLI...");
    execSync(`supabase db query --linked -f ${tempFile}`, { stdio: 'inherit' });
    console.log("✅ Bulk insertion complete!");
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  } catch (dbErr) {
    console.error("❌ Database execution failed. SQL file is kept at temp_bulk_insert.sql for debugging.");
  }
}

run();
