export function shapeOrder(row, items) {
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