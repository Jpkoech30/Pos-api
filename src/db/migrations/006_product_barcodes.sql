-- Multi-barcode support.
--
-- A single product can have several barcodes: single unit, multipack,
-- case. The existing products.barcode column stays as the "primary"
-- barcode for display and quick access. All barcodes also live in
-- product_barcodes, which is what lookups actually query.

CREATE TABLE IF NOT EXISTS product_barcodes (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  shop_id     INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  gtin        CHAR(14) NOT NULL,
  symbology   TEXT,
  unit_type   TEXT NOT NULL DEFAULT 'single',
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, gtin)
);

CREATE INDEX IF NOT EXISTS idx_product_barcodes_gtin
  ON product_barcodes(shop_id, gtin);

CREATE INDEX IF NOT EXISTS idx_product_barcodes_product
  ON product_barcodes(product_id);

-- Backfill: migrate existing products.barcode into the new table.
-- Zero-pads to 14 chars, marks as primary.
INSERT INTO product_barcodes (product_id, shop_id, gtin, symbology, unit_type, is_primary)
SELECT
  p.id,
  p.shop_id,
  LPAD(REGEXP_REPLACE(p.barcode, '[^0-9]', '', 'g'), 14, '0'),
  CASE LENGTH(REGEXP_REPLACE(p.barcode, '[^0-9]', '', 'g'))
    WHEN 8  THEN 'EAN-8'
    WHEN 12 THEN 'UPC-A'
    WHEN 13 THEN 'EAN-13'
    WHEN 14 THEN 'ITF-14'
    ELSE NULL
  END,
  'single',
  true
FROM products p
WHERE p.barcode IS NOT NULL
  AND p.shop_id IS NOT NULL
ON CONFLICT (shop_id, gtin) DO NOTHING;