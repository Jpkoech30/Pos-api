import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env');
}

// Cloud databases (Neon, Supabase) require SSL. Local doesn't.
const isLocal = process.env.DATABASE_URL.includes('localhost');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres error', err);
});

// Small helper — every query goes through this
export const query = (text, params) => pool.query(text, params);