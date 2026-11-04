// server.js - Universal production server entry point
// Compatible with: Hostinger (hPanel Node.js), cPanel (Application Manager / Passenger),
// ShardCloud, Render, Railway, Netlify, Docker, PM2 and VPS environments.

const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const fs = require('fs');

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';
const dev = process.env.NODE_ENV !== 'production';

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch {}
}

// Check if standalone server exists
const standaloneServerPath = path.join(__dirname, '.next', 'standalone', 'server.js');

if (fs.existsSync(standaloneServerPath) && process.env.USE_STANDALONE === 'true') {
  require(standaloneServerPath);
} else {
  const next = require('next');
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request:', req.url, err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }).listen(port, hostname, () => {
      console.log(`> Norma Jurídica running on http://${hostname}:${port} (NODE_ENV: ${process.env.NODE_ENV || 'production'})`);
    });
  }).catch((err) => {
    console.error('Failed to start Next.js application:', err);
    process.exit(1);
  });
}
