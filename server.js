const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 3000;

// PostgreSQL connection (Railway injecte DATABASE_URL automatiquement)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Créer la table si elle n'existe pas
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('DB initialisée');
}

async function loadItems() {
  const res = await pool.query('SELECT data FROM items ORDER BY (data->>\'createdAt\') DESC');
  return res.rows.map(r => r.data);
}

async function saveItems(items) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM items');
    for (const item of items) {
      await client.query(
        'INSERT INTO items (id, data) VALUES ($1, $2)',
        [String(item.id), JSON.stringify(item)]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // GET items
  if (req.method === 'GET' && req.url === '/api/items') {
    try {
      const items = await loadItems();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(items));
    } catch (e) {
      console.error('loadItems error:', e.message);
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST save items
  if (req.method === 'POST' && req.url === '/api/items') {
    try {
      const body = await readBody(req);
      await saveItems(JSON.parse(body));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e) {
      console.error('saveItems error:', e.message);
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST Claude proxy (la clé API reste côté serveur)
  if (req.method === 'POST' && req.url === '/api/claude') {
    const body = await readBody(req);
    const buf = Buffer.from(body, 'utf8');
    const r = https.request({
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
        'content-length': buf.length
      }
    }, (apiRes) => {
      let data = '';
      apiRes.on('data', c => data += c);
      apiRes.on('end', () => {
        res.writeHead(apiRes.statusCode, { 'content-type': 'application/json' });
        res.end(data);
      });
    });
    r.on('error', e => { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); });
    r.write(buf); r.end();
    return;
  }

  // Servir index.html
  fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

initDB().then(() => {
  server.listen(PORT, () => console.log('Running on port ' + PORT));
}).catch(e => {
  console.error('Erreur init DB:', e.message);
  process.exit(1);
});
