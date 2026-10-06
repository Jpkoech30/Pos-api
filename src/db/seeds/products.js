import { query } from '../pool.js';

const PRODUCTS = [
  { name: 'Espresso',         price: 2.50, costPrice: 0.80, category: 'Coffee',   sku: 'COF-001', barcode: '1111111111111', stock: 999 },
  { name: 'Cappuccino',       price: 3.75, costPrice: 1.10, category: 'Coffee',   sku: 'COF-002', barcode: '2222222222222', stock: 999 },
  { name: 'Latte',            price: 4.00, costPrice: 1.20, category: 'Coffee',   sku: 'COF-003', barcode: '3333333333333', stock: 999 },
  { name: 'Cold Brew',        price: 4.50, costPrice: 1.30, category: 'Coffee',   sku: 'COF-004', barcode: '4444444444444', stock: 999 },
  { name: 'Croissant',        price: 3.25, costPrice: 1.80, category: 'Pastry',   sku: 'PAS-001', barcode: '5555555555555', stock: 50  },
  { name: 'Blueberry Muffin', price: 3.50, costPrice: 2.00, category: 'Pastry',   sku: 'PAS-002', barcode: '6666666666666', stock: 40  },
  { name: 'Bagel',            price: 2.75, costPrice: 1.40, category: 'Pastry',   sku: 'PAS-003', barcode: '7777777777777', stock: 60  },
  { name: 'Turkey Sandwich',  price: 8.50, costPrice: 5.00, category: 'Sandwich', sku: 'SAN-001', barcode: '8888888888888', stock: 25  },
  { name: 'Veggie Wrap',      price: 7.95, costPrice: 4.50, category: 'Sandwich', sku: 'SAN-002', barcode: '9999999999999', stock: 20  },
  { name: 'Caesar Salad',     price: 9.50, costPrice: 5.50, category: 'Salad',    sku: 'SAL-001', barcode: '1010101010101', stock: 15  },
  { name: 'Orange Juice',     price: 3.25, costPrice: 1.80, category: 'Drink',    sku: 'DRK-001', barcode: '1212121212121', stock: 100 },
  { name: 'Bottled Water',    price: 1.75, costPrice: 0.80, category: 'Drink',    sku: 'DRK-002', barcode: '1313131313131', stock: 200 },
];

// Seeds products for one shop. Safe to call for a specific shop;
// skips products that already exist for that shop.
export async function seedProductsForShop(shopId) {
  let created = 0;

  for (const p of PRODUCTS) {
    const { rowCount } = await query(
      `INSERT INTO products
         (shop_id, name, price, cost_price, category, sku, barcode, stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (shop_id, sku) DO NOTHING`,
      [shopId, p.name, p.price, p.costPrice, p.category, p.sku, p.barcode, p.stock],
    );
    created += rowCount;
  }

  console.log(`✅ Seeded ${created} products for shop ${shopId}`);
}

// Called at boot. Seeds only if exactly one shop exists (single-tenant install).
// Multi-shop installs seed per shop via seedProductsForShop.
export async function seedProducts() {
  const { rows } = await query('SELECT id, name FROM shops ORDER BY id LIMIT 2');
  if (rows.length === 0) {
    console.log('↷ No shops yet — skipping seed');
    return;
  }
  if (rows.length > 1) {
    console.log('↷ Multiple shops — skipping auto-seed');
    return;
  }
  await seedProductsForShop(rows[0].id);
}