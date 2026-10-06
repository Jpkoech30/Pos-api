import { pool, query } from './pool.js';
import { normalizeGtin, gtinSymbology } from '../utils/gtin.js';

export async function logStockMovement(client, {
  shopId, productId, change, reason, note = null,
}) {
  const q = client ? client.query.bind(client) : query;
  await q(
    `INSERT INTO stock_movements (shop_id, product_id, change, reason, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [shopId, productId, change, reason, note],
  );
}

export const productDb = {
  async list(shopId) {
    const { rows } = await query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM product_barcodes pb
               WHERE pb.product_id = p.id) AS barcode_count
       FROM products p
       WHERE p.shop_id = $1
       ORDER BY p.category, p.name`,
      [shopId],
    );
    return rows;
  },

  async findById(id, shopId) {
    const { rows } = await query(
      'SELECT * FROM products WHERE id = $1 AND shop_id = $2',
      [id, shopId],
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

  async findByBarcode(barcode, shopId) {
    const gtin = normalizeGtin(barcode);
    if (!gtin) return null;

    const { rows } = await query(
      `SELECT p.*, pb.gtin AS matched_gtin, pb.unit_type AS matched_unit
       FROM product_barcodes pb
       JOIN products p ON p.id = pb.product_id
       WHERE pb.gtin = $1 AND pb.shop_id = $2
       LIMIT 1`,
      [gtin, shopId],
    );
    return rows[0] || null;
  },

  async create(shopId, {
    name, price, costPrice, category,
    supplier, manufacturer,
    sku, barcode, stock,
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO products
           (shop_id, name, price, cost_price, category,
            supplier, manufacturer, sku, barcode, stock)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          shopId, name, price, costPrice, category,
          supplier, manufacturer, sku, barcode, stock,
        ],
      );
      const product = rows[0];

      if (stock > 0) {
        await logStockMovement(client, {
          shopId,
          productId: product.id,
          change: stock,
          reason: 'opening',
          note: 'Initial stock',
        });
      }

      if (barcode) {
        await this._insertBarcode(client, {
          productId: product.id,
          shopId,
          barcode,
          isPrimary: true,
        });
      }

      await client.query('COMMIT');
      return product;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async update(id, shopId, {
    name, price, costPrice, category,
    supplier, manufacturer,
    sku, barcode, stock,
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const before = await client.query(
        'SELECT stock FROM products WHERE id = $1 AND shop_id = $2',
        [id, shopId],
      );
      if (!before.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      const prevStock = Number(before.rows[0].stock);

      const { rows } = await client.query(
        `UPDATE products
         SET name         = COALESCE($1, name),
             price        = COALESCE($2, price),
             cost_price   = COALESCE($3, cost_price),
             category     = COALESCE($4, category),
             supplier     = $5,
             manufacturer = $6,
             sku          = $7,
             barcode      = $8,
             stock        = COALESCE($9, stock)
         WHERE id = $10 AND shop_id = $11
         RETURNING *`,
        [
          name === undefined ? null : name,
          price === undefined ? null : price,
          costPrice === undefined ? null : costPrice,
          category === undefined ? null : category,
          supplier === undefined ? null : supplier,
          manufacturer === undefined ? null : manufacturer,
          sku === undefined ? null : sku,
          barcode === undefined ? null : barcode,
          stock === undefined ? null : stock,
          id,
          shopId,
        ],
      );
      const product = rows[0];

      if (stock !== undefined && Number(stock) !== prevStock) {
        await logStockMovement(client, {
          shopId,
          productId: id,
          change: Number(stock) - prevStock,
          reason: 'correction',
          note: 'Edited from product form',
        });
      }

      if (barcode !== undefined) {
        await client.query(
          'DELETE FROM product_barcodes WHERE product_id = $1 AND is_primary = true',
          [id],
        );
        if (barcode) {
          await this._insertBarcode(client, {
            productId: id,
            shopId,
            barcode,
            isPrimary: true,
          });
        }
      }

      await client.query('COMMIT');
      return product;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async adjustStock(id, shopId, { change, reason, note }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const before = await client.query(
        'SELECT stock FROM products WHERE id = $1 AND shop_id = $2 FOR UPDATE',
        [id, shopId],
      );
      if (!before.rows[0]) {
        await client.query('ROLLBACK');
        throw new Error('Product not found');
      }

      const current = Number(before.rows[0].stock);
      const next = Math.max(0, current + change);

      const { rows } = await client.query(
        'UPDATE products SET stock = $1 WHERE id = $2 AND shop_id = $3 RETURNING *',
        [next, id, shopId],
      );

      await logStockMovement(client, {
        shopId,
        productId: id,
        change: next - current,
        reason,
        note,
      });

      await client.query('COMMIT');
      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async remove(id, shopId) {
    const { rows } = await query(
      'DELETE FROM products WHERE id = $1 AND shop_id = $2 RETURNING id',
      [id, shopId],
    );
    return rows[0] || null;
  },

  async getCostsByIds(ids, shopId) {
    const { rows } = await query(
      'SELECT id, cost_price FROM products WHERE id = ANY($1::int[]) AND shop_id = $2',
      [ids, shopId],
    );
    return rows;
  },

  async getMovements(productId, shopId, limit = 50) {
    const { rows } = await query(
      `SELECT id, change, reason, note, created_at
       FROM stock_movements
       WHERE product_id = $1 AND shop_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [productId, shopId, limit],
    );
    return rows;
  },

  async getRecentActivity(shopId, limit = 20) {
    const { rows } = await query(
      `SELECT sm.id, sm.change, sm.reason, sm.note, sm.created_at,
              p.id AS product_id, p.name AS product_name
       FROM stock_movements sm
       JOIN products p ON p.id = sm.product_id
       WHERE sm.shop_id = $1
       ORDER BY sm.created_at DESC
       LIMIT $2`,
      [shopId, limit],
    );
    return rows;
  },

  async _insertBarcode(client, { productId, shopId, barcode, isPrimary }) {
    const gtin = normalizeGtin(barcode);
    if (!gtin) return;
    try {
      await client.query(
        `INSERT INTO product_barcodes
           (product_id, shop_id, gtin, symbology, unit_type, is_primary)
         VALUES ($1, $2, $3, $4, 'single', $5)
         ON CONFLICT (shop_id, gtin) DO NOTHING`,
        [productId, shopId, gtin, gtinSymbology(barcode), isPrimary],
      );
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  },
};