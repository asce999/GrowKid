import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 127.0.0.1, not localhost: the server listens on IPv4 only, and localhost can resolve to ::1 first
  server: { proxy: { '/api': 'http://127.0.0.1:3000' } },
})
