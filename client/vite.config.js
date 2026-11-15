import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// What the built app may load (sitemap rule 28, F6): its own files and nothing else. blob: and data: are for the proof a child has
// just picked and for small images the build inlines. No 'unsafe-inline': React sets styles through the DOM, which the policy allows.
const csp = [
  "default-src 'self'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // P5: no file in dist/assets over 200 kB (npm run check:size). React DOM and the router each get a file of their own, so no one
  // file holds both; they change rarely, so a browser keeps them while the app's own files change.
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-dom', test: /node_modules[\\/](react-dom|scheduler)[\\/]/ },
            { name: 'router', test: /node_modules[\\/](react-router|react-router-dom)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        // 127.0.0.1, not localhost: the server listens on IPv4 only, and localhost can resolve to ::1 first
        target: 'http://127.0.0.1:3000',
        // Appends the caller's real address to X-Forwarded-For. The server reads only that one (F1), so its limits by address
        // cannot be dodged with a made-up header.
        xfwd: true,
      },
    },
  },
  // `npm run preview` serves the built app, the mode the demo runs in. It proxies /api as above: preview.proxy defaults to server.proxy.
  preview: {
    headers: { 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' },
  },
})
