import { defineConfig } from '@playwright/test'

// The loop test runs against the mode the demo runs in (sitemap rule 28, F6): the built client on `npm run preview` and the server
// on `npm start`. A server that is already up is reused, so it also runs beside `npm run dev` in server/.
// --host 127.0.0.1: without it Vite may listen on ::1 only, and the address below never answers.
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  workers: 1,
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:4173', actionTimeout: 10_000, navigationTimeout: 15_000 },
  webServer: [
    // signed out, /api/session answers 401, which counts as up
    { name: 'server', command: 'npm start', cwd: '../server', url: 'http://127.0.0.1:3000/api/session', reuseExistingServer: true },
    { name: 'client', command: 'npm run build && npm run preview -- --host 127.0.0.1 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
  ],
})
