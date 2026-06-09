const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS py_heats (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS py_shifts (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS py_hourly_logs (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS py_checklists (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS py_settings (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('DB tables ready');
}

app.get('/health', (req, res) => res.json({ ok: true, service: 'pyrolysis' }));

// ── HEATS ──
app.get('/heats', async (req, res) => {
  try { const { rows } = await pool.query('SELECT data FROM py_heats ORDER BY created_at DESC'); res.json(rows.map(r => r.data)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/heats', async (req, res) => {
  try {
    const heats = Array.isArray(req.body) ? req.body : [req.body];
    for (const h of heats) {
      if (!h.id) continue;
      await pool.query(`INSERT INTO py_heats(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2,updated_at=NOW()`, [h.id, JSON.stringify(h)]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/heats/:id', async (req, res) => {
  try { await pool.query('DELETE FROM py_heats WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SHIFTS ──
app.get('/shifts', async (req, res) => {
  try { const { rows } = await pool.query('SELECT data FROM py_shifts ORDER BY created_at DESC'); res.json(rows.map(r => r.data)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/shifts', async (req, res) => {
  try {
    const shifts = Array.isArray(req.body) ? req.body : [req.body];
    for (const s of shifts) {
      if (!s.id) continue;
      await pool.query(`INSERT INTO py_shifts(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2,updated_at=NOW()`, [s.id, JSON.stringify(s)]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/shifts/:id', async (req, res) => {
  try { await pool.query('DELETE FROM py_shifts WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── HOURLY LOGS ──
app.get('/hourly-logs', async (req, res) => {
  try { const { rows } = await pool.query('SELECT data FROM py_hourly_logs ORDER BY created_at DESC'); res.json(rows.map(r => r.data)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/hourly-logs', async (req, res) => {
  try {
    const logs = Array.isArray(req.body) ? req.body : [req.body];
    for (const l of logs) {
      if (!l.id) continue;
      await pool.query(`INSERT INTO py_hourly_logs(id,data) VALUES($1,$2) ON CONFLICT(id) DO NOTHING`, [l.id, JSON.stringify(l)]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/hourly-logs/:id', async (req, res) => {
  try { await pool.query('DELETE FROM py_hourly_logs WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CHECKLISTS ──
app.get('/checklists', async (req, res) => {
  try { const { rows } = await pool.query('SELECT data FROM py_checklists ORDER BY created_at DESC'); res.json(rows.map(r => r.data)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/checklists', async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    for (const c of items) {
      if (!c.id) continue;
      await pool.query(`INSERT INTO py_checklists(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2,updated_at=NOW()`, [c.id, JSON.stringify(c)]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SETTINGS ──
app.get('/settings', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, data FROM py_settings');
    const out = {}; rows.forEach(r => { out[r.key] = r.data; }); res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/settings', async (req, res) => {
  try {
    for (const [key, data] of Object.entries(req.body)) {
      await pool.query(`INSERT INTO py_settings(key,data) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET data=$2,updated_at=NOW()`, [key, JSON.stringify(data)]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── FULL SYNC ──
app.post('/sync', async (req, res) => {
  try {
    const { heats, shifts, hourlyLogs, checklists, settings } = req.body;
    if (heats?.length) for (const h of heats) {
      if (!h?.id) continue;
      await pool.query(`INSERT INTO py_heats(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2,updated_at=NOW()`, [h.id, JSON.stringify(h)]);
    }
    if (shifts?.length) for (const s of shifts) {
      if (!s?.id) continue;
      await pool.query(`INSERT INTO py_shifts(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2,updated_at=NOW()`, [s.id, JSON.stringify(s)]);
    }
    if (hourlyLogs?.length) for (const l of hourlyLogs) {
      if (!l?.id) continue;
      await pool.query(`INSERT INTO py_hourly_logs(id,data) VALUES($1,$2) ON CONFLICT(id) DO NOTHING`, [l.id, JSON.stringify(l)]);
    }
    if (checklists?.length) for (const c of checklists) {
      if (!c?.id) continue;
      await pool.query(`INSERT INTO py_checklists(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2,updated_at=NOW()`, [c.id, JSON.stringify(c)]);
    }
    if (settings && typeof settings === 'object') {
      for (const [key, data] of Object.entries(settings)) {
        if (data == null) continue;
        await pool.query(`INSERT INTO py_settings(key,data) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET data=$2,updated_at=NOW()`, [key, JSON.stringify(data)]);
      }
    }
    res.json({ ok: true });
  } catch (e) { console.error('POST /sync:', e.message); res.status(500).json({ error: e.message }); }
});

// ── FULL PULL ──
app.get('/pull', async (req, res) => {
  try {
    const [heats, shifts, logs, checks, settings] = await Promise.all([
      pool.query('SELECT data FROM py_heats ORDER BY created_at DESC'),
      pool.query('SELECT data FROM py_shifts ORDER BY created_at DESC'),
      pool.query('SELECT data FROM py_hourly_logs ORDER BY created_at DESC'),
      pool.query('SELECT data FROM py_checklists ORDER BY created_at DESC'),
      pool.query('SELECT key, data FROM py_settings'),
    ]);
    const settingsObj = {};
    settings.rows.forEach(r => { settingsObj[r.key] = r.data; });
    res.json({
      heats: heats.rows.map(r => r.data),
      shifts: shifts.rows.map(r => r.data),
      hourlyLogs: logs.rows.map(r => r.data),
      checklists: checks.rows.map(r => r.data),
      settings: settingsObj,
    });
  } catch (e) { console.error('GET /pull:', e.message); res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
initDB().then(() => {
  app.listen(PORT, () => console.log('Pyrolysis server running on port', PORT));
}).catch(e => { console.error('DB init failed:', e.message); process.exit(1); });
