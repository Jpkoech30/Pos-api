-- Add composite unique constraints on products for multi-tenancy.
--
-- The original single-column UNIQUE (sku) and UNIQUE (barcode)
-- prevented two shops from ever using the same SKU or barcode.
-- With per-shop scoping, uniqueness must be per (shop_id, X).
--
-- The composite version is what schema.sql declares for fresh installs.
-- Existing installs need this migration because CREATE TABLE IF NOT EXISTS
-- skipped the change.

-- Drop the old single-column uniques if present.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key;

-- Add composite uniques, idempotently.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_shop_id_sku_key'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_shop_id_sku_key UNIQUE (shop_id, sku);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_shop_id_barcode_key'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_shop_id_barcode_key UNIQUE (shop_id, barcode);
  END IF;
END $$;