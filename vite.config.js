import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Headers the stream server requires (Node.js proxy has no forbidden-header restriction)
const STREAM_HEADERS = {
  'Referer': 'https://allinonereborn.online/tatatv-web/',  // server validates this
  'Origin': 'https://allinonereborn.online',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0',
}

export default defineConfig({
  plugins: [react()],
  define: { global: 'globalThis' },
  optimizeDeps: { include: ['hls.js', 'shaka-player'] },
  server: {
    host: '0.0.0.0', // Exposes the server to Render's network
    port: process.env.PORT || 5173, // Binds to the port Render provides
    allowedHosts: true, // Disables Vite's DNS rebinding protection for Render URLs
    proxy: {
      // /tatatv-web/* → allinonereborn.online with injected Referer
      '/tatatv-web': {
        target: 'https://allinonereborn.online',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
        proxyTimeout: 60000,
        timeout: 60000,
        xfwd: true,
        configure: (proxy) => {
          proxy.on('error', (err, req) => {
            console.error(`[Proxy ERROR] ${req.url}:`, err.message)
          })
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Disable buffering to stream video chunks directly to the client instantly
            proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
          })
        },
      },

      // /tatatv-json/* → allinonereborn.online/tatatv-web/
      '/tatatv-json': {
        target: 'https://allinonereborn.online',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/tatatv-json/, '/tatatv-web'),
      },

      // /zee5/* → allinonereborn.online/zee5/
      '/zee5': {
        target: 'https://allinonereborn.online',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
      },

      // /sony/* → allinonereborn.online/sony/
      '/sony': {
        target: 'https://allinonereborn.online',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
      },

      // /sony-new/* → allinonereborn.online/sony-new/
      '/sony-new': {
        target: 'https://allinonereborn.online',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
      },

      // /livtest3/* → allinonereborn.online/livtest3/
      '/livtest3': {
        target: 'https://allinonereborn.online',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
      },

      // /iptv-web/* → allinonereborn.online/iptv-web/
      '/iptv-web': {
        target: 'https://allinonereborn.online',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
      },

      // /fctest/* → allinonereborn.online/fctest/
      '/fctest': {
        target: 'https://allinonereborn.online',
        changeOrigin: true,
        secure: false,
        headers: {
          ...STREAM_HEADERS,
          'Referer': 'https://allinonereborn.online/fcww/player_india.html'
        },
      },

      // /amit/* → allinonereborn.online/amit/
      '/amit': {
        target: 'https://allinonereborn.online',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
      },

      // /jstrweb2/* → allinonereborn.online/jstrweb2/
      '/jstrweb2': {
        target: 'https://allinonereborn.online',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
      },

      // Proxy for Fancode Live CDN
      '/proxy-fancode-flive': {
        target: 'https://in-mc-flive.fancode.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy-fancode-flive/, ''),
        headers: {
          'Origin': 'https://www.fancode.com',
          'Referer': 'https://www.fancode.com/'
        },
        configure: (proxy) => {
          proxy.on('error', (err, req) => console.error(`[Proxy ERROR] ${req.url}:`, err.message))
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
          })
        },
      },

      // Proxy for Fancode FDLIVE CDN
      '/proxy-fancode-fdlive': {
        target: 'https://in-mc-fdlive.fancode.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy-fancode-fdlive/, ''),
        headers: {
          'Origin': 'https://www.fancode.com',
          'Referer': 'https://www.fancode.com/'
        },
        configure: (proxy) => {
          proxy.on('error', (err, req) => console.error(`[Proxy ERROR] ${req.url}:`, err.message))
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
          })
        },
      },

      // Proxy for Fancode PLIVE CDN
      '/proxy-fancode-plive': {
        target: 'https://in-mc-plive.fancode.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy-fancode-plive/, ''),
        headers: {
          'Origin': 'https://www.fancode.com',
          'Referer': 'https://www.fancode.com/'
        },
        configure: (proxy) => {
          proxy.on('error', (err, req) => console.error(`[Proxy ERROR] ${req.url}:`, err.message))
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
          })
        },
      },

      // Proxy for JioTV Playlist Live CDN
      '/proxy-jiotv-pllive': {
        target: 'https://jiotvpllive.cdn.jio.com',
        changeOrigin: true,
        secure: false,
        headers: {
          'Origin': 'https://www.jiotv.com',
          'Referer': 'https://www.jiotv.com/',
          'User-Agent': '@allinone_reborn',
          'Accept': '*/*'
        },
        configure: (proxy) => {
          proxy.on('error', (err, req) => console.error(`[JioTV Proxy ERROR] ${req.url}:`, err.message))

          proxy.on('proxyReq', (proxyReq, req, res) => {
            const rawPath = req.url.replace(/^\/proxy-jiotv-pllive/, '');
            proxyReq.path = rawPath;
            proxyReq.removeHeader('origin');
            proxyReq.setHeader('Origin', 'https://www.jiotv.com');
            proxyReq.setHeader('Referer', 'https://www.jiotv.com/');
            proxyReq.setHeader('User-Agent', '@allinone_reborn');
          });

          proxy.on('proxyRes', (proxyRes, req) => {
            proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
          })
        },
      },

      // Proxy for JioTV Live CDN
      '/proxy-jiotv-live': {
        target: 'https://jiotvmblive.cdn.jio.com',
        changeOrigin: true,
        secure: false,
        headers: {
          'Origin': 'https://www.jiotv.com',
          'Referer': 'https://www.jiotv.com/',
          'User-Agent': '@allinone_reborn',
          'Accept': '*/*'
        },
        configure: (proxy) => {
          proxy.on('error', (err, req) => console.error(`[JioTV Proxy ERROR] ${req.url}:`, err.message))

          proxy.on('proxyReq', (proxyReq, req, res) => {
            // CRITICAL: http-proxy re-encodes the URL, turning acl=/* into acl=/%2A,
            // which breaks the HMAC token signature → 403 "hmac check failed".
            // We must manually set the raw path from the original request.
            const rawPath = req.url.replace(/^\/proxy-jiotv-live/, '');
            proxyReq.path = rawPath;
            console.log(`[JioTV Proxy] Forwarding raw path: ${rawPath.substring(0, 100)}...`);

            // Ensure correct origin headers
            proxyReq.removeHeader('origin');
            proxyReq.setHeader('Origin', 'https://www.jiotv.com');
            proxyReq.setHeader('Referer', 'https://www.jiotv.com/');
            proxyReq.setHeader('User-Agent', '@allinone_reborn');
          });

          proxy.on('proxyRes', (proxyRes, req) => {
            console.log(`[JioTV Proxy] Response: ${proxyRes.statusCode} for ${req.url.substring(0, 80)}`);
            proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
          })
        },
      },

      // Proxy for SonyLIV Akamai Events
      '/proxy-sony-akamai': {
        target: 'https://sonydaimenew.akamaized.net',
        changeOrigin: true,
        secure: false,
        headers: {
          'Origin': 'https://www.sonyliv.com',
          'Referer': 'https://www.sonyliv.com/',
        },
        configure: (proxy) => {
          proxy.on('error', (err, req) => console.error(`[Sony Proxy ERROR] ${req.url}:`, err.message))

          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Need to set path manually to prevent encodeURI dropping necessary special characters in params
            const rawPath = req.url.replace(/^\/proxy-sony-akamai/, '');
            proxyReq.path = rawPath;
            
            // Remove origin and referer to bypass strict origin checks on segments/keys
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0'); 
          });

          proxy.on('proxyRes', (proxyRes, req, res) => {
            proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,HEAD,OPTIONS,POST,PUT';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
            
            // Intercept redirects to keep them within the proxy
            if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
              const loc = proxyRes.headers.location;
              if (loc.includes('sonydaimenew.akamaized.net')) {
                proxyRes.headers.location = loc.replace('https://sonydaimenew.akamaized.net', '/proxy-sony-akamai');
              }
            }
          })
        },
      },

      // Proxy for SonyLIV Dish CDN
      '/proxy-sony-dish': {
        target: 'https://dishmt.slivcdn.com',
        changeOrigin: true,
        secure: false,
        headers: {
          'Origin': 'https://www.sonyliv.com',
          'Referer': 'https://www.sonyliv.com/',
        },
        configure: (proxy) => {
          proxy.on('error', (err, req) => console.error(`[Sony Dish Proxy ERROR] ${req.url}:`, err.message))

          proxy.on('proxyReq', (proxyReq, req, res) => {
            const rawPath = req.url.replace(/^\/proxy-sony-dish/, '');
            proxyReq.path = rawPath;
            
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0'); 
          });

          proxy.on('proxyRes', (proxyRes, req, res) => {
            proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,HEAD,OPTIONS,POST,PUT';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
            
            // Intercept redirects
            if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
              const loc = proxyRes.headers.location;
              if (loc.includes('dishmt.slivcdn.com')) {
                proxyRes.headers.location = loc.replace('https://dishmt.slivcdn.com', '/proxy-sony-dish');
              }
            }
          })
        },
      },

      // Proxy for JioTV Catchup/Images CDN
      '/proxy-jiotv-catchup': {
        target: 'https://jiotv.catchup.cdn.jio.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy-jiotv-catchup/, ''),
        headers: {
          'Origin': 'https://www.jiotv.com',
          'Referer': 'https://www.jiotv.com/',
          'User-Agent': '@allinone_reborn'
        },
        configure: (proxy) => {
          proxy.on('error', (err, req) => console.error(`[Proxy ERROR] ${req.url}:`, err.message))
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['Cache-Control'] = 'public, max-age=31536000';
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
          })
        },
      },

      // Route for the provided live.m3u8 match to bypass CORS
      '/live.m3u8': {
        target: 'https://sfsfs.valverdeae7.workers.dev',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, req) => {
            console.error(`[Proxy ERROR] ${req.url}:`, err.message)
          })
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Remove headers that might cause CORS issues on the target server
            proxyReq.removeHeader('Origin');
            proxyReq.removeHeader('Referer');
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Force CORS headers on the response to the browser
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'X-Requested-With, content-type, Authorization';
            // Disable buffering to stream video chunks directly to the client instantly
            proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
          })
        },
      },
    },
  },
})



