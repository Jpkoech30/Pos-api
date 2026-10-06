import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, '..', 'data', 'catalog.json');

export async function seedCatalog() {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM product_catalog');
  if (rows[0].n > 0) {
    console.log(`↷ Catalog already seeded (${rows[0].n} items)`);
    return;
  }

  const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
  const items = JSON.parse(raw);

  for (const item of items) {
    await query(
      `INSERT INTO product_catalog
         (name, brand, manufacturer, supplier, category, unit,
          suggested_price, suggested_cost, typical_barcode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        item.name,
        item.brand || null,
        item.manufacturer || null,
        item.supplier || null,
        item.category,
        item.unit || null,
        item.suggestedPrice || null,
        item.suggestedCost || null,
        item.typicalBarcode || null,
      ],
    );
  }

  console.log(`✅ Catalog seeded (${items.length} items)`);
}