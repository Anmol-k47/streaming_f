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

// Fancode Live CDN
app.use('/proxy-fancode-flive', createProxyMiddleware({
  target: 'https://in-mc-flive.fancode.com',
  changeOrigin: true,
  secure: false,
  pathRewrite: { '^/proxy-fancode-flive': '' },
  headers: {
    'Origin': 'https://www.fancode.com',
    'Referer': 'https://www.fancode.com/'
  },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
  }
}));

// Fancode FDLIVE CDN
app.use('/proxy-fancode-fdlive', createProxyMiddleware({
  target: 'https://in-mc-fdlive.fancode.com',
  changeOrigin: true,
  secure: false,
  pathRewrite: { '^/proxy-fancode-fdlive': '' },
  headers: {
    'Origin': 'https://www.fancode.com',
    'Referer': 'https://www.fancode.com/'
  },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
  }
}));

// JioTV Live Proxy
app.use('/proxy-jiotv-live', createProxyMiddleware({
  target: 'https://jiotvmblive.cdn.jio.com',
  changeOrigin: true,
  secure: false,
  onProxyReq: (proxyReq, req, res) => {
    const rawPath = req.url.replace(/^\/proxy-jiotv-live/, '');
    proxyReq.path = rawPath; // prevents http-proxy from re-encoding layout /* layout hmac crashes layout layout
    proxyReq.removeHeader('origin');
    proxyReq.setHeader('Origin', 'https://www.jiotv.com');
    proxyReq.setHeader('Referer', 'https://www.jiotv.com/');
    proxyReq.setHeader('User-Agent', '@allinone_reborn');
  },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
  }
}));

// Sony Akamai Proxy
app.use('/proxy-sony-akamai', createProxyMiddleware({
  target: 'https://sonydaimenew.akamaized.net',
  changeOrigin: true,
  secure: false,
  onProxyReq: (proxyReq, req) => {
    const rawPath = req.url.replace(/^\/proxy-sony-akamai/, '');
    proxyReq.path = rawPath;
    proxyReq.removeHeader('origin');
    proxyReq.removeHeader('referer');
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0');
  },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,HEAD,OPTIONS,POST,PUT';
    
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      if (proxyRes.headers.location.includes('sonydaimenew.akamaized.net')) {
         proxyRes.headers.location = proxyRes.headers.location.replace('https://sonydaimenew.akamaized.net', '/proxy-sony-akamai');
      }
    }
  }
}));

// Sony Dish Proxy
app.use('/proxy-sony-dish', createProxyMiddleware({
  target: 'https://dishmt.slivcdn.com',
  changeOrigin: true,
  secure: false,
  onProxyReq: (proxyReq, req) => {
    const rawPath = req.url.replace(/^\/proxy-sony-dish/, '');
    proxyReq.path = rawPath;
    proxyReq.removeHeader('origin');
    proxyReq.removeHeader('referer');
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0');
  },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      if (proxyRes.headers.location.includes('dishmt.slivcdn.com')) {
         proxyRes.headers.location = proxyRes.headers.location.replace('https://dishmt.slivcdn.com', '/proxy-sony-dish');
      }
    }
  }
}));

// Serve static React files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback all routes to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => console.log(`Production proxy server listening on port ${PORT}`));
