import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = process.env.PORT || 10000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({ ok: true, database: 'connected', now: result.rows[0].now });
  } catch (error) {
    console.error('Database connection failed:', error);
    res.status(500).json({ ok: false, database: 'connection_failed' });
  }
});

app.get('/api/db/tables', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    res.json({ ok: true, tables: result.rows.map(row => row.table_name) });
  } catch (error) {
    console.error('Table inspection failed:', error);
    res.status(500).json({ ok: false, error: 'Could not inspect database' });
  }
});

app.listen(port, () => console.log(`GoldDust API listening on port ${port}`));
