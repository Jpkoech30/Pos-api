-- Global catalog of common Kenyan FMCG products.
-- Used to suggest details when a shop adds a new product.
-- Not shop-scoped — shared reference data.

CREATE TABLE IF NOT EXISTS product_catalog (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  brand           TEXT,
  manufacturer    TEXT,
  supplier        TEXT,
  category        TEXT NOT NULL,
  unit            TEXT,
  suggested_price NUMERIC(10,2),
  suggested_cost  NUMERIC(10,2),
  typical_barcode TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_name_lower
  ON product_catalog (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_catalog_brand_lower
  ON product_catalog (LOWER(COALESCE(brand, '')));
CREATE INDEX IF NOT EXISTS idx_catalog_category
  ON product_catalog (category);