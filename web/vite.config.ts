import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 0.0.0.0 → o dev server aparece na LAN (marcar o hábito pelo celular).
    // Descubra o IP com `hostname -I` → http://192.168.x.x:5173
    host: true,
    port: 5173,
    proxy: {
      // O front sempre chama `/api/...` (mesma origem, sem CORS no browser);
      // o Vite encaminha pra API Fastify em :3000 e tira o prefixo `/api`.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
