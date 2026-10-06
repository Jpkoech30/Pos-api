-- Profit tracking
--
-- cost_price on products: what the kiosk paid for one unit.
--   Nullable — existing products won't have it. Products without cost
--   are excluded from profit totals rather than treated as 0 cost.
--
-- cost_price on order_items: a snapshot of the product's cost at the
--   time of sale. This is critical. If we joined to products.cost_price
--   instead, historical profit would change every time the owner
--   updates a buying price. The snapshot locks in the number.

ALTER TABLE products    ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2);