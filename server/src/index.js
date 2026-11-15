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
if (!env.TZ) fail('TZ is not set (use UTC: a family day follows its country, not this)')
try {
  new Intl.DateTimeFormat('en', { timeZone: env.TZ }) // Node silently falls back to UTC for an unknown zone
} catch {
  fail('TZ is not a valid time zone')
}
if (!/^\d+$/.test(env.PORT ?? '')) fail('PORT must be a number')
if (!path.isAbsolute(env.UPLOAD_DIR ?? '')) fail('UPLOAD_DIR must be an absolute path')
// F8: proof files are children's photos, and a synced folder is copied to another company's servers. The repository counts too:
// it is where a careless path lands, and it may itself be synced.
const within = (parent) => {
  const rest = path.relative(path.resolve(parent), path.resolve(env.UPLOAD_DIR))
  return rest !== '..' && !rest.startsWith(`..${path.sep}`) && !path.isAbsolute(rest) // '' is the folder itself; absolute is another drive
}
if (within(path.join(import.meta.dirname, '..', '..'))) fail('UPLOAD_DIR must be outside the repository')
if ([env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial].some((folder) => folder && within(folder))) {
  fail('UPLOAD_DIR must not be inside a OneDrive folder, which is copied to another company')
}
await mkdir(env.UPLOAD_DIR, { recursive: true })

// Imported only now, so app.js can rely on a checked environment.
const { default: app } = await import('./app.js')
// C5: before any upload can start, so a file being written is never taken for one left behind. Only the count is logged.
const { sweepOrphans } = await import('./files.js')
const swept = await sweepOrphans().catch((error) => console.error(`GrowKid could not check the upload folder for files left behind (${error.code ?? error.name})`)) // housekeeping: the server still starts
if (swept) console.log(`GrowKid removed ${swept} proof file${swept === 1 ? '' : 's'} that no proof names`)
const server = app.listen(Number(env.PORT), '127.0.0.1', (err) => {
  if (err) fail(`cannot listen (${err.code ?? 'error'})`)
  console.log(`GrowKid server listening on 127.0.0.1:${server.address().port}`)
})
