import { pool, query } from './pool.js';
import { logStockMovement } from './products.js';

export const orderDb = {
  async create({
    shopId,
    staffId,
    shiftId = null,
    items,
    paymentMethod,
    vatRate = 0,
    taxInclusive = true,
    amountTendered = null,
    changeGiven = null,
    mpesaPhone = null,
    paymentStatus = 'completed',
    idempotencyKey = null,
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Idempotency: if this exact key was already used by this shop,
      // return the existing order instead of creating a duplicate.
      // This is what makes a retry after a timeout safe.
      if (idempotencyKey) {
        const { rows: existing } = await client.query(
          'SELECT * FROM orders WHERE shop_id = $1 AND idempotency_key = $2',
          [shopId, idempotencyKey],
        );
        if (existing[0]) {
          const { rows: existingItems } = await client.query(
            'SELECT * FROM order_items WHERE order_id = $1',
            [existing[0].id],
          );
          await client.query('COMMIT');
          return shapeOrder(existing[0], existingItems);
        }
      }

      const grossSubtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

      // Two pricing modes:
      //
      // taxInclusive (default in Kenya): the price the customer sees
      // already includes VAT. We back the VAT out of the total.
      //   vat = total × rate / (100 + rate)
      //   net = total − vat
      //
      // taxExclusive: prices are pre-tax, VAT is added on top.
      //   net = subtotal
      //   vat = net × rate / 100
      //   total = net + vat
      //
      // Non-VAT shops have vatRate = 0, so both paths collapse to
      // net = grossSubtotal, vat = 0, total = grossSubtotal.
      let netSubtotal, vatAmount, total;
      if (taxInclusive && vatRate > 0) {
        total = +grossSubtotal.toFixed(2);
        vatAmount = +(total * vatRate / (100 + vatRate)).toFixed(2);
        netSubtotal = +(total - vatAmount).toFixed(2);
      } else {
        netSubtotal = +grossSubtotal.toFixed(2);
        vatAmount = +(netSubtotal * vatRate / 100).toFixed(2);
        total = +(netSubtotal + vatAmount).toFixed(2);
      }

      const { rows: orderRows } = await client.query(
        `INSERT INTO orders
           (shop_id, staff_id, shift_id, subtotal, tax, total, payment_method,
            amount_tendered, change_given, mpesa_phone, payment_status,
            vat_rate, vat_amount, tax_inclusive, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          shopId, staffId, shiftId, netSubtotal, vatAmount, total, paymentMethod,
          amountTendered, changeGiven, mpesaPhone, paymentStatus,
          vatRate, vatAmount, taxInclusive, idempotencyKey,
        ],
      );
      const order = orderRows[0];

      const productIds = [...new Set(items.map((i) => i.productId))];
      const { rows: productRows } = await client.query(
        'SELECT id, cost_price FROM products WHERE id = ANY($1::int[]) AND shop_id = $2',
        [productIds, shopId],
      );
      const costMap = new Map(
        productRows.map((p) => [String(p.id), p.cost_price]),
      );

      for (const item of items) {
        const costPrice = costMap.has(String(item.productId))
          ? costMap.get(String(item.productId))
          : null;

        await client.query(
          `INSERT INTO order_items
             (order_id, product_id, name, price, cost_price, quantity)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [order.id, item.productId, item.name, item.price, costPrice, item.quantity],
        );

        await client.query(
          `UPDATE products SET stock = GREATEST(stock - $1, 0)
           WHERE id = $2 AND shop_id = $3`,
          [item.quantity, item.productId, shopId],
        );

        await logStockMovement(client, {
          shopId,
          productId: item.productId,
          change: -item.quantity,
          reason: 'sale',
          note: `Order #${order.id}`,
        });
      }

      const { rows: itemRows } = await client.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [order.id],
      );

      await client.query('COMMIT');
      return shapeOrder(order, itemRows);
    } catch (err) {
      await client.query('ROLLBACK');

      // Race condition: a concurrent request with the same key inserted
      // first and won the unique index. Return that order.
      if (err.code === '23505' && idempotencyKey) {
        const { rows } = await client.query(
          'SELECT * FROM orders WHERE shop_id = $1 AND idempotency_key = $2',
          [shopId, idempotencyKey],
        );
        if (rows[0]) {
          const { rows: items } = await client.query(
            'SELECT * FROM order_items WHERE order_id = $1',
            [rows[0].id],
          );
          return shapeOrder(rows[0], items);
        }
      }

      throw err;
    } finally {
      client.release();
    }
  },

  async list(shopId) {
    const { rows } = await query(
      `SELECT o.*, u.name AS staff_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.staff_id
       WHERE o.shop_id = $1
       ORDER BY o.created_at DESC`,
      [shopId],
    );
    const withItems = await Promise.all(
      rows.map(async (o) => {
        const { rows: items } = await query(
          'SELECT * FROM order_items WHERE order_id = $1',
          [o.id],
        );
        return shapeOrder(o, items);
      }),
    );
    const revenue = withItems.reduce((sum, o) => sum + o.total, 0);
    const pendingCount = withItems.filter(
      (o) => o.paymentStatus === 'pending',
    ).length;
    return {
      orders: withItems,
      stats: {
        count: withItems.length,
        revenue: +revenue.toFixed(2),
        pendingCount,
      },
    };
  },

  async findById(id, shopId) {
    const { rows } = await query(
      `SELECT o.*, u.name AS staff_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.staff_id
       WHERE o.id = $1 AND o.shop_id = $2`,
      [id, shopId],
    );
    if (!rows[0]) return null;
    const { rows: items } = await query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [id],
    );
    return shapeOrder(rows[0], items);
  },

  async setCheckoutRequestId(orderId, checkoutId, shopId) {
    await query(
      'UPDATE orders SET mpesa_checkout_request_id = $1 WHERE id = $2 AND shop_id = $3',
      [checkoutId, orderId, shopId],
    );
  },

  async findByCheckoutRequestId(checkoutId) {
    const { rows } = await query(
      'SELECT * FROM orders WHERE mpesa_checkout_request_id = $1',
      [checkoutId],
    );
    if (!rows[0]) return null;
    const { rows: items } = await query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [rows[0].id],
    );
    return shapeOrder(rows[0], items);
  },

  async completePayment(
    orderId,
    { paymentStatus, mpesaReceiptNumber, mpesaResultCode, mpesaResultDesc },
  ) {
    await query(
      `UPDATE orders
       SET payment_status = $1,
           mpesa_receipt_number = $2,
           mpesa_result_code = $3,
           mpesa_result_desc = $4
       WHERE id = $5`,
      [paymentStatus, mpesaReceiptNumber, mpesaResultCode, mpesaResultDesc, orderId],
    );
  },

  async cancelPending(orderId, shopId, reason = 'Cancelled') {
    const { rows } = await query(
      `UPDATE orders
       SET payment_status = 'failed',
           mpesa_result_desc = $1
       WHERE id = $2
         AND shop_id = $3
         AND payment_status = 'pending'
       RETURNING *`,
      [reason, orderId, shopId],
    );
    if (!rows[0]) return null;
    const { rows: items } = await query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [orderId],
    );
    return shapeOrder(rows[0], items);
  },

  async expireStalePending(timeoutMinutes = 2) {
    const { rowCount } = await query(
      `UPDATE orders
       SET payment_status = 'failed',
           mpesa_result_code = 1037,
           mpesa_result_desc = 'Timed out waiting for M-Pesa confirmation'
       WHERE payment_status = 'pending'
         AND payment_method = 'mpesa_stk'
         AND created_at < NOW() - ($1 || ' minutes')::interval`,
      [String(timeoutMinutes)],
    );
    return rowCount;
  },
};

function shapeOrder(row, items) {
  const shapedItems = items.map((i) => ({
    productId: String(i.product_id),
    name: i.name,
    price: Number(i.price),
    costPrice: i.cost_price != null ? Number(i.cost_price) : null,
    quantity: i.quantity,
  }));

  const allHaveCost =
    shapedItems.length > 0 && shapedItems.every((i) => i.costPrice != null);
  let totalCost = null;
  let grossProfit = null;

  if (allHaveCost) {
    totalCost = +shapedItems
      .reduce((s, i) => s + i.costPrice * i.quantity, 0)
      .toFixed(2);
    grossProfit = +(Number(row.subtotal) - totalCost).toFixed(2);
  }

  return {
    id: String(row.id),
    shopId: row.shop_id != null ? String(row.shop_id) : null,
    shiftId: row.shift_id != null ? String(row.shift_id) : null,
    staffId: row.staff_id,
    staffName: row.staff_name ?? null,
    items: shapedItems,
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    total: Number(row.total),
    vatRate: row.vat_rate != null ? Number(row.vat_rate) : 0,
    vatAmount:
      row.vat_amount != null ? Number(row.vat_amount) : Number(row.tax ?? 0),
    taxInclusive: row.tax_inclusive !== false,
    totalCost,
    grossProfit,
    paymentMethod: row.payment_method,
    amountTendered:
      row.amount_tendered != null ? Number(row.amount_tendered) : null,
    changeGiven: row.change_given != null ? Number(row.change_given) : null,
    mpesaPhone: row.mpesa_phone ?? null,
    paymentStatus: row.payment_status || 'completed',
    mpesaReceiptNumber: row.mpesa_receipt_number ?? null,
    mpesaResultCode: row.mpesa_result_code ?? null,
    mpesaResultDesc: row.mpesa_result_desc ?? null,
    createdAt: row.created_at,
  };
}