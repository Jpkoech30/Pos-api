export function shapeShift(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    staffId: row.staff_id,
    staffName: row.staff_name ?? null,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openingFloat: row.opening_float != null ? Number(row.opening_float) : null,
    closingCounted: row.closing_counted != null ? Number(row.closing_counted) : null,
    status: row.status,
    notes: row.notes ?? null,
  };
}

export function shapeReport(row) {
  if (!row) return null;
  return {
    shiftId: String(row.shift_id),
    shopId: String(row.shop_id),
    orderCount: row.order_count,
    grossSales: Number(row.gross_sales),
    netSales: Number(row.net_sales),
    vatTotal: Number(row.vat_total),
    cashTotal: Number(row.cash_total),
    mpesaTotal: Number(row.mpesa_total),
    stkTotal: Number(row.stk_total),
    expectedCash: Number(row.expected_cash),
    countedCash: row.counted_cash != null ? Number(row.counted_cash) : null,
    variance: row.variance != null ? Number(row.variance) : null,
    pendingCount: row.pending_count,
    createdAt: row.created_at,
  };
}