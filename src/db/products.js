import { pool, query } from './pool.js';

export const productDb = {
  async list(shopId) {
    const { rows } = await query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM product_barcodes pb WHERE pb.product_id = p.id) AS barcode_count
       FROM products p
       WHERE p.shop_id = $1
       ORDER BY p.name`,
      [shopId],
    );
    return rows;
  },

  async findById(id, shopId) {
    const { rows } = await query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM product_barcodes pb WHERE pb.product_id = p.id) AS barcode_count
       FROM products p
       WHERE p.id = $1 AND p.shop_id = $2`,
      [id, shopId],
    );
    return rows[0] || null;
  },

  async findByBarcode(barcode, shopId) {
    const { rows } = await query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM product_barcodes pb WHERE pb.product_id = p.id) AS barcode_count
       FROM products p
       WHERE p.shop_id = $1
         AND (p.barcode = $2 OR EXISTS (
           SELECT 1 FROM product_barcodes pb
           WHERE pb.product_id = p.id AND pb.gtin = $2
         ))
       LIMIT 1`,
      [shopId, barcode],
    );
    return rows[0] || null;
  },

  async findBarcodes(productId) {
    const { rows } = await query(
      `SELECT id, gtin, symbology, unit_type, is_primary
       FROM product_barcodes
       WHERE product_id = $1
       ORDER BY is_primary DESC, id`,
      [productId],
    );
    return rows;
  },

  async getMovements(productId, shopId, limit = 50) {
    const { rows } = await query(
      `SELECT sm.id, sm.change, sm.reason, sm.note, sm.created_at
       FROM stock_movements sm
       JOIN products p ON p.id = sm.product_id
       WHERE sm.product_id = $1 AND p.shop_id = $2
       ORDER BY sm.created_at DESC
       LIMIT $3`,
      [productId, shopId, limit],
    );
    return rows;
  },

  async getRecentActivity(shopId, limit = 20) {
    const { rows } = await query(
      `SELECT sm.id, sm.product_id, p.name AS product_name,
              sm.change, sm.reason, sm.note, sm.created_at
       FROM stock_movements sm
       JOIN products p ON p.id = sm.product_id
       WHERE p.shop_id = $1
       ORDER BY sm.created_at DESC
       LIMIT $2`,
      [shopId, limit],
    );
    return rows;
  },

  async create(shopId, {
    name, price, costPrice, category,
    supplier, manufacturer, sku, barcode, stock,
  }) {
    const { rows } = await query(
      `INSERT INTO products
         (shop_id, name, price, cost_price, category,
          supplier, manufacturer, sku, barcode, stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *,
         (SELECT COUNT(*) FROM product_barcodes pb WHERE pb.product_id = products.id) AS barcode_count`,
      [shopId, name, price, costPrice, category,
       supplier, manufacturer, sku, barcode, stock],
    );
    return rows[0];
  },

  async update(id, shopId, fields) {
    const allowed = {
      name: 'name',
      price: 'price',
      costPrice: 'cost_price',
      category: 'category',
      supplier: 'supplier',
      manufacturer: 'manufacturer',
      sku: 'sku',
      barcode: 'barcode',
      stock: 'stock',
    };

    const sets = [];
    const values = [];
    let i = 1;

    for (const [key, col] of Object.entries(allowed)) {
      if (fields[key] !== undefined) {
        sets.push(`${col} = $${i}`);
        values.push(fields[key]);
        i += 1;
      }
    }

    if (sets.length === 0) return this.findById(id, shopId);

    values.push(id, shopId);
    const { rows } = await query(
      `UPDATE products SET ${sets.join(', ')}
       WHERE id = $${i} AND shop_id = $${i + 1}
       RETURNING *,
         (SELECT COUNT(*) FROM product_barcodes pb WHERE pb.product_id = products.id) AS barcode_count`,
      values,
    );
    return rows[0] || null;
  },

  async adjustStock(id, shopId, { change, reason, note }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: productRows } = await client.query(
        `UPDATE products SET stock = GREATEST(stock + $1, 0)
         WHERE id = $2 AND shop_id = $3
         RETURNING *`,
        [change, id, shopId],
      );
      const product = productRows[0];
      if (!product) {
        await client.query('ROLLBACK');
        return null;
      }

      await logStockMovement(client, { shopId, productId: id, change, reason, note });

      await client.query('COMMIT');
      return product;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async remove(id, shopId) {
    const { rows } = await query(
      'DELETE FROM products WHERE id = $1 AND shop_id = $2 RETURNING *',
      [id, shopId],
    );
    return rows[0] || null;
  },
};

// Logged from within a transaction — pass the client in, not the pool.
export async function logStockMovement(client, {
  shopId, productId, change, reason, note = null,
}) {
  await client.query(
    `INSERT INTO stock_movements
       (shop_id, product_id, change, reason, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [shopId, productId, change, reason, note],
  );
}