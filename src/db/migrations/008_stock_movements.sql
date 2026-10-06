-- Every stock change gets logged here: sales, restocks, corrections,
-- damage, returns. Gives an audit trail per product.

CREATE TABLE IF NOT EXISTS stock_movements (
  id           SERIAL PRIMARY KEY,
  shop_id      INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  change       INTEGER NOT NULL,
  reason       TEXT NOT NULL,       -- 'sale' | 'restock' | 'correction' | 'damage' | 'return'
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product
  ON stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_shop
  ON stock_movements(shop_id, created_at DESC);