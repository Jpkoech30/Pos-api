export function shapeProduct(row) {
  return {
    id: String(row.id),
    name: row.name,
    price: Number(row.price),
    costPrice: row.cost_price != null ? Number(row.cost_price) : null,
    category: row.category,
    supplier: row.supplier ?? null,
    manufacturer: row.manufacturer ?? null,
    sku: row.sku,
    barcode: row.barcode,
    stock: row.stock,
    barcodeCount: row.barcode_count != null ? Number(row.barcode_count) : undefined,
  };
}