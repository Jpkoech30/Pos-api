import { pool, query } from './pool.js';
import { shapeShift, shapeReport } from '../serializers/shift.js';

export const shiftDb = {
  async findCurrent(shopId) {
    const { rows } = await query(
      `SELECT s.*, u.name AS staff_name
       FROM shifts s
       LEFT JOIN users u ON u.id = s.staff_id
       WHERE s.shop_id = $1 AND s.status = 'open'
       ORDER BY s.opened_at DESC
       LIMIT 1`,
      [shopId],
    );
    return rows[0] || null;
  },

  async findById(id, shopId) {
    const { rows } = await query(
      `SELECT s.*, u.name AS staff_name
       FROM shifts s
       LEFT JOIN users u ON u.id = s.staff_id
       WHERE s.id = $1 AND s.shop_id = $2`,
      [id, shopId],
    );
    return rows[0] || null;
  },

  async list(shopId, { limit = 50 } = {}) {
    const { rows } = await query(
      `SELECT s.*, u.name AS staff_name
       FROM shifts s
       LEFT JOIN users u ON u.id = s.staff_id
       WHERE s.shop_id = $1
       ORDER BY s.opened_at DESC
       LIMIT $2`,
      [shopId, limit],
    );
    return rows.map(shapeShift);
  },

  async open({ shopId, staffId, openingFloat = null }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: existingRows } = await client.query(
        `SELECT * FROM shifts
         WHERE shop_id = $1 AND status = 'open'
         FOR UPDATE`,
        [shopId],
      );
      const existing = existingRows[0];

      if (existing) {
        if (String(existing.staff_id) === String(staffId)) {
          await client.query('COMMIT');
          return shapeShift(existing);
        }
        await client.query(
          `UPDATE shifts
           SET status = 'closed',
               closed_at = NOW(),
               notes = COALESCE(notes || E'\n', '') || 'Auto-closed on staff change'
           WHERE id = $1`,
          [existing.id],
        );
      }

      const { rows } = await client.query(
        `INSERT INTO shifts (shop_id, staff_id, opening_float, status)
         VALUES ($1, $2, $3, 'open')
         RETURNING *`,
        [shopId, staffId, openingFloat],
      );
      await client.query('COMMIT');
      return shapeShift(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async close(id, shopId, { countedCash = null, notes = null } = {}) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: shiftRows } = await client.query(
        `SELECT * FROM shifts
         WHERE id = $1 AND shop_id = $2
         FOR UPDATE`,
        [id, shopId],
      );
      const shift = shiftRows[0];
      if (!shift) {
        await client.query('ROLLBACK');
        return null;
      }

      if (shift.status === 'closed') {
        const frozen = await client.query(
          'SELECT * FROM shift_reports WHERE shift_id = $1 AND shop_id = $2',
          [id, shopId],
        );
        await client.query('COMMIT');
        return {
          shift: shapeShift(shift),
          report: frozen.rows[0] ? shapeReport(frozen.rows[0]) : null,
        };
      }

      const { rows: aggRows } = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE payment_status = 'completed')::int AS order_count,
           COALESCE(SUM(total)    FILTER (WHERE payment_status = 'completed'), 0) AS gross_sales,
           COALESCE(SUM(subtotal) FILTER (WHERE payment_status = 'completed'), 0) AS net_sales,
           COALESCE(SUM(tax)      FILTER (WHERE payment_status = 'completed'), 0) AS vat_total,
           COALESCE(SUM(total) FILTER (WHERE payment_status = 'completed' AND payment_method = 'cash'), 0) AS cash_total,
           COALESCE(SUM(total) FILTER (WHERE payment_status = 'completed' AND payment_method = 'mpesa'), 0) AS mpesa_total,
           COALESCE(SUM(total) FILTER (WHERE payment_status = 'completed' AND payment_method = 'mpesa_stk'), 0) AS stk_total,
           COUNT(*) FILTER (WHERE payment_status = 'pending')::int AS pending_count
         FROM orders
         WHERE shift_id = $1`,
        [id],
      );
      const agg = aggRows[0];

      const openingFloat = Number(shift.opening_float || 0);
      const cashTotal = Number(agg.cash_total);
      const expectedCash = +(openingFloat + cashTotal).toFixed(2);
      const counted = countedCash != null ? Number(countedCash) : null;
      const variance = counted != null ? +(counted - expectedCash).toFixed(2) : null;

      const { rows: updatedRows } = await client.query(
        `UPDATE shifts
         SET status = 'closed',
             closed_at = NOW(),
             closing_counted = $1,
             notes = COALESCE($2, notes)
         WHERE id = $3
         RETURNING *`,
        [counted, notes, id],
      );

      const { rows: reportRows } = await client.query(
        `INSERT INTO shift_reports
           (shift_id, shop_id, order_count, gross_sales, net_sales, vat_total,
            cash_total, mpesa_total, stk_total, expected_cash,
            counted_cash, variance, pending_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (shift_id) DO NOTHING
         RETURNING *`,
        [
          id, shopId,
          agg.order_count,
          Number(agg.gross_sales), Number(agg.net_sales), Number(agg.vat_total),
          cashTotal, Number(agg.mpesa_total), Number(agg.stk_total),
          expectedCash, counted, variance, agg.pending_count,
        ],
      );

      await client.query('COMMIT');

      return {
        shift: shapeShift(updatedRows[0]),
        report: reportRows[0] ? shapeReport(reportRows[0]) : null,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getReport(shiftId, shopId) {
    const { rows } = await query(
      'SELECT * FROM shift_reports WHERE shift_id = $1 AND shop_id = $2',
      [shiftId, shopId],
    );
    return rows[0] ? shapeReport(rows[0]) : null;
  },
};