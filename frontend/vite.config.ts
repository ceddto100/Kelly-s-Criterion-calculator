import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {allow:[fileURLToPath(new URL("..", import.meta.url))]},
    cors: true,
    port: 5173,
    proxy: {
      // Proxy API requests to backend during local development
      '/api/predictions': {target:process.env.MCP_SERVER_URL || 'http://127.0.0.1:3001',changeOrigin:true},
      '/mcp': {target:process.env.MCP_SERVER_URL || 'http://127.0.0.1:3001',changeOrigin:true},
      '/auth': {target:process.env.VITE_BACKEND_URL || 'http://localhost:3000',changeOrigin:true},
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

