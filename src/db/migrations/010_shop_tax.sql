-- Per-shop tax configuration.
--
-- Most Kenyan kiosks are not VAT-registered (turnover under KES 5M).
-- They pay Turnover Tax (1.5% of gross sales) instead. Their customer
-- receipts should NOT show VAT.
--
-- VAT-registered shops (turnover >= KES 5M) charge 16% VAT and must
-- show it on receipts. Kenyan law assumes displayed prices are
-- VAT-inclusive by default.

ALTER TABLE shops ADD COLUMN IF NOT EXISTS vat_registered BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 16.00;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS prices_include_vat BOOLEAN NOT NULL DEFAULT true;

-- Snapshot the shop's tax config onto each order so historical
-- receipts remain correct even if the owner changes their setting later.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN;