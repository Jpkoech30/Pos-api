import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './src/routes/auth.js';
import usersRoutes from './src/routes/users.js';
import productsRoutes from './src/routes/products.js';
import ordersRoutes from './src/routes/orders.js';
import mpesaRoutes from './src/routes/mpesa.js';
import shopRoutes from './src/routes/shop.js';
import staffRoutes from './src/routes/staff.js';
import catalogRoutes from './src/routes/catalog.js';
import stockRoutes from './src/routes/stock.js';
import taxRoutes from './src/routes/tax.js';
import shiftsRoutes from './src/routes/shifts.js';
import { runMigrations } from './src/db/migrate.js';
import { seedProducts } from './src/db/seeds/products.js';
import { seedCatalog } from './src/db/seeds/catalog.js';
import { orderDb } from './src/db/orders.js';
import { STK_SWEEP_INTERVAL_MS, STK_TIMEOUT_MINUTES } from './src/config/constants.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.url}`);
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/products', productsRoutes);
app.use('/orders', ordersRoutes);
app.use('/mpesa', mpesaRoutes);
app.use('/shop', shopRoutes);
app.use('/staff', staffRoutes);
app.use('/catalog', catalogRoutes);
app.use('/stock', stockRoutes);
app.use('/tax', taxRoutes);
app.use('/shifts', shiftsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 4000;

function startStalePendingSweeper() {
  const INTERVAL_MS = STK_SWEEP_INTERVAL_MS;
  const TIMEOUT_MINUTES = STK_TIMEOUT_MINUTES;

  setInterval(async () => {
    try {
      const count = await orderDb.expireStalePending(TIMEOUT_MINUTES);
      if (count > 0) {
        console.log(`🧹 Expired ${count} stale pending order(s)`);
      }
    } catch (err) {
      console.error('Stale pending sweeper failed:', err.message);
    }
  }, INTERVAL_MS);

  console.log('✅ Stale pending sweeper running');
}

async function start() {
  try {
    await runMigrations();
    await seedCatalog();
    await seedProducts();
    startStalePendingSweeper();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();