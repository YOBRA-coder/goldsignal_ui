import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

let lastWarn = 0

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy) => {
          // Backend not running / restarting: answer with a clean JSON 503 (the app shows a banner and keeps
          // retrying) and print ONE friendly line instead of a stack trace per request.
          proxy.on('error', (err, req, res) => {
            if (Date.now() - lastWarn > 15000) {
              lastWarn = Date.now()
              console.warn('\n[goldsignal] Backend is not reachable on 127.0.0.1:8000 - start it with ./run_backend.sh (auto-restarts)\n')
            }
            if (res && !res.headersSent && res.writeHead) {
              res.writeHead(503, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ detail: { message: 'Backend offline: start it with ./run_backend.sh (port 8000)' } }))
            }
          })
        },
      },
    },
  },
})
