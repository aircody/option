import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/longport': {
        target: 'https://openapi.longportapp.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/longport/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('[Proxy] Request:', req.method, req.url)
            console.log('[Proxy] Headers:', JSON.stringify(proxyReq.getHeaders(), null, 2))
          })
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('[Proxy] Response:', proxyRes.statusCode, req.url)
            console.log('[Proxy] Response Headers:', JSON.stringify(proxyRes.headers, null, 2))
          })
          proxy.on('error', (err, req, res) => {
            console.error('[Proxy] Error:', err.message)
            console.error('[Proxy] Error Stack:', err.stack)
          })
        },
      },
    },
  },
})
