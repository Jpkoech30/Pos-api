-- Products get supplier and manufacturer fields.
-- Populated automatically when a catalog suggestion is applied,
-- or manually by the owner.

ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier     TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer TEXT;

CREATE INDEX IF NOT EXISTS idx_products_supplier
  ON products(shop_id, supplier);