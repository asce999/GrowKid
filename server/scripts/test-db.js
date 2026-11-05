// Runs before every `npm test` (pretest). Brings the test database up to date, and refuses any other database.
// ponytail: the test DB is never reset (Prisma blocks reset inside AI agents); tests make their own data. Reset it by hand in your own terminal if it drifts.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const url = process.env.DATABASE_URL

// an unreadable DATABASE_URL is refused below; never print it (it holds the password)
const name = URL.canParse(url) ? decodeURIComponent(new URL(url).pathname.slice(1)) : ''
if (!name.endsWith('_test')) {
  console.error('test-db: refusing to run, DATABASE_URL does not name a database ending in _test')
  process.exit(1)
}

// DATABASE_URL comes from .env.test through the inherited environment, and Prisma's own .env loading never overrides a variable that is already set.
const prisma = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url))
const run = spawnSync(process.execPath, [prisma, 'migrate', 'deploy'], {
  cwd: root,
  stdio: 'inherit',
  timeout: 60_000,
})
process.exit(run.status ?? 1)
