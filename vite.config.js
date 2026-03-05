import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Headers the stream server requires (Node.js proxy has no forbidden-header restriction)
const STREAM_HEADERS = {
  'Referer': 'https://allinonereborn.online/tatatv-web/',  // server validates this
  'Origin': 'https://allinonereborn.store',
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
    proxy: {
      // /tatatv-web/* → allinonereborn.store with injected Referer
      '/tatatv-web': {
        target: 'https://allinonereborn.store',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
        configure: (proxy) => {
          proxy.on('error', (err, req) => {
            console.error(`[Proxy ERROR] ${req.url}:`, err.message)
          })
        },
      },

      // /tatatv-json/* → allinonereborn.store/tatatv-web/
      '/tatatv-json': {
        target: 'https://allinonereborn.store',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/tatatv-json/, '/tatatv-web'),
      },

      // /zee5/* → allinonereborn.store/zee5/
      '/zee5': {
        target: 'https://allinonereborn.store',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
      },

      // /sony/* → allinonereborn.store/sony/
      '/sony': {
        target: 'https://allinonereborn.store',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
      },

      // /sony-new/* → allinonereborn.store/sony-new/
      '/sony-new': {
        target: 'https://allinonereborn.store',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
      },

      // /livtest3/* → allinonereborn.store/livtest3/
      '/livtest3': {
        target: 'https://allinonereborn.store',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
      },

      // /iptv-web/* → allinonereborn.store/iptv-web/
      '/iptv-web': {
        target: 'https://allinonereborn.store',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
      },

      // /fctest/* → allinonereborn.store/fctest/
      '/fctest': {
        target: 'https://allinonereborn.store',
        changeOrigin: true,
        secure: false,
        headers: STREAM_HEADERS,
      },
    },
  },
})



