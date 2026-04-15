const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Variables d'environnement
const KEY = process.env.ANTHROPIC_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const PORT = process.env.PORT || 3000;

// Vérifications importantes (évite les crash silencieux)
if (!DATABASE_URL) {
  console.error("DATABASE_URL manquant !");
  process.exit(1);
}

if (!KEY) {
  console.error("ANTHROPIC_API_KEY manquante !");
  process.exit(1);
}

// Connexion PostgreSQL (Railway)
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Initialisation DB
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

// Charger les items
async function loadItems() {
  const result = await pool.query(
    "SELECT data FROM items ORDER BY (data->>'createdAt') DESC"
  );
  return result.rows.map(r => r.data);
}

// Sauvegarder les items
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

// Lire le body
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
  });
}

// Serveur HTTP
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // GET items
  if (req.method === 'GET' && req.url === '/api/items') {
    try {
      const items = await loadItems();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(items));
    } catch (e) {
      console.error('loadItems:', e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST items
  if (req.method === 'POST' && req.url === '/api/items') {
    try {
      const body = await readBody(req);
      await saveItems(JSON.parse(body));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      console.error('saveItems:', e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST Claude (proxy sécurisé)
  if (req.method === 'POST' && req.url === '/api/claude') {
    try {
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
          res.writeHead(apiRes.statusCode, {
            'content-type': 'application/json'
          });
          res.end(data);
        });
      });

      r.on('error', e => {
        console.error('Claude API:', e.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      });

      r.write(buf);
      r.end();

    } catch (e) {
      console.error('Claude handler:', e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Servir index.html
  fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

// Lancement serveur après init DB
initDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(e => {
    console.error(' Erreur init DB:', e.message);
    process.exit(1);
  });
