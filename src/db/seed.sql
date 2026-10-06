-- Seed data for the products table.
-- Safe to run on every boot: ON CONFLICT (sku) DO NOTHING skips existing rows.

INSERT INTO products (name, price, category, sku, barcode, stock) VALUES
  ('Espresso',         2.50, 'Coffee',   'COF-001', '1111111111111', 999),
  ('Cappuccino',       3.75, 'Coffee',   'COF-002', '2222222222222', 999),
  ('Latte',            4.00, 'Coffee',   'COF-003', '3333333333333', 999),
  ('Cold Brew',        4.50, 'Coffee',   'COF-004', '4444444444444', 999),
  ('Croissant',        3.25, 'Pastry',   'PAS-001', '5555555555555', 50),
  ('Blueberry Muffin', 3.50, 'Pastry',   'PAS-002', '6666666666666', 40),
  ('Bagel',            2.75, 'Pastry',   'PAS-003', '7777777777777', 60),
  ('Turkey Sandwich',  8.50, 'Sandwich', 'SAN-001', '8888888888888', 25),
  ('Veggie Wrap',      7.95, 'Sandwich', 'SAN-002', '9999999999999', 20),
  ('Caesar Salad',     9.50, 'Salad',    'SAL-001', '1010101010101', 15),
  ('Orange Juice',     3.25, 'Drink',    'DRK-001', '1212121212121', 100),
  ('Bottled Water',    1.75, 'Drink',    'DRK-002', '1313131313131', 200)
ON CONFLICT (sku) DO NOTHING;