import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

const STREAM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Connection': 'keep-alive'
};

// Common proxy for allinonereborn.store
const allInOneProxy = createProxyMiddleware({
  target: 'https://allinonereborn.store',
  changeOrigin: true,
  secure: false,
  onProxyReq: (proxyReq, req, res) => {
    // Inject general headers
    Object.entries(STREAM_HEADERS).forEach(([k, v]) => proxyReq.setHeader(k, v));
    
    // Inject specific Referers based on request URI
    if (req.originalUrl.includes('/tatatv-web/')) {
        proxyReq.setHeader('Referer', 'https://allinonereborn.online/tatatv-web/');
    } else if (req.originalUrl.includes('/zee5/')) {
        proxyReq.setHeader('Referer', 'https://allinonereborn.online/zee5/');
    } else if (req.originalUrl.includes('/fctest/')) {
        proxyReq.setHeader('Referer', 'https://allinonereborn.online/fctest/');
    } else if (req.originalUrl.includes('/iptv-web/')) {
        proxyReq.setHeader('Referer', 'https://allinonereborn.online/iptv-web/');
    } else if (req.originalUrl.includes('/jstrweb2/')) {
        proxyReq.setHeader('Referer', 'https://allinonereborn.online/jstrweb2/');
    } else if (req.originalUrl.includes('/sony/')) {
        proxyReq.setHeader('Referer', 'https://allinonereborn.online/sony/');
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Ensure CORS is open for continuous segments
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');

    // Rewrite HTTP 302 redirects to use Relative paths for absolute decryption keys loops
    if (proxyRes.headers.location) {
        if (proxyRes.headers.location.includes('allinonereborn.store') || proxyRes.headers.location.includes('allinonereborn.online')) {
             try {
                 const u = new URL(proxyRes.headers.location);
                 proxyRes.headers.location = u.pathname + u.search;
             } catch (e) {}
        }
    }
  }
});

// Mount proxies
app.use('/tatatv-web', allInOneProxy);
app.use('/fctest', allInOneProxy);
app.use('/zee5', allInOneProxy);
app.use('/jstrweb2', allInOneProxy);
app.use('/sony', allInOneProxy);
app.use('/iptv-web', allInOneProxy);

// Sony Akamai Proxy
app.use('/proxy-sony-akamai', createProxyMiddleware({
  target: 'https://sonydaimenew.akamaized.net',
  changeOrigin: true,
  headers: {
    'User-Agent': 'Mozilla/5.0'
  },
  pathRewrite: { '^/proxy-sony-akamai': '' },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
  }
}));

// JioTV Live Proxy
app.use('/proxy-jiotv-live', createProxyMiddleware({
  target: 'https://jiotvmblive.cdn.jio.com',
  changeOrigin: true,
  headers: {
    'User-Agent': 'Mozilla/5.0'
  },
  pathRewrite: { '^/proxy-jiotv-live': '' },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
  }
}));

// Serve static React files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback all routes to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => console.log(`Production proxy server listening on port ${PORT}`));
