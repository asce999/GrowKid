import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const env = process.env
const fail = (message) => {
  console.error(`GrowKid server cannot start: ${message}`)
  process.exit(1)
}

// Boot checks (plan B0): no fallback values, so a misconfigured server refuses to run.
if (!['development', 'test', 'production'].includes(env.NODE_ENV)) fail('NODE_ENV must be development, test or production')
if (!env.DATABASE_URL) fail('DATABASE_URL is not set')
if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) fail('JWT_SECRET must be at least 32 characters')
if (!env.TZ) fail('TZ is not set (A1: use Asia/Kolkata)')
try {
  new Intl.DateTimeFormat('en', { timeZone: env.TZ }) // Node silently falls back to UTC for an unknown zone
} catch {
  fail('TZ is not a valid time zone')
}
if (!/^\d+$/.test(env.PORT ?? '')) fail('PORT must be a number')
if (!path.isAbsolute(env.UPLOAD_DIR ?? '')) fail('UPLOAD_DIR must be an absolute path')
await mkdir(env.UPLOAD_DIR, { recursive: true })

// Imported only now, so app.js can rely on a checked environment.
const { default: app } = await import('./app.js')
const server = app.listen(Number(env.PORT), '127.0.0.1', (err) => {
  if (err) fail(`cannot listen (${err.code ?? 'error'})`)
  console.log(`GrowKid server listening on 127.0.0.1:${server.address().port}`)
})
