import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import { who, writeLimit } from './auth.js'
import { setClockDays } from './clock.js'
import { ApiError, STATUS, refuse } from './errors.js'
import { account, signOut } from './routes/account.js'
import { family } from './routes/family.js'
import { reports } from './routes/reports.js'
import { series } from './routes/series.js'
import { tasks } from './routes/tasks.js'

/** The Express app, without listening: index.js listens, the tests listen on port 0. Order follows plan section 4. */
const app = express()
// One hop (sitemap rule 28, F1): req.ip is the last address in X-Forwarded-For, the one Vite's proxy appended (xfwd), never one the
// caller wrote ahead of it. Not 'loopback': the browser is on this computer, so its real address is loopback too, and Express would
// skip past it to a made-up one. Whoever calls this port directly, without the proxy, is on this machine and out of reach.
app.set('trust proxy', 1)

app.use(helmet())
// F3: no answer is kept by the browser, so pressing Back on a shared device never shows the last person's pages. Before the CSRF
// check, so a refusal carries it too.
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
app.use(express.json({ limit: '20kb' }))
app.use(cookieParser())

// CSRF (section 7): with SameSite=Strict and no CORS, a cross-site form cannot add this header.
app.use('/api', (req, _res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.get('x-growkid') !== '1') refuse('NOT_ALLOWED')
  next()
})

app.delete('/api/session', signOut) // before `who`, which reads the database

// ponytail: a global offset for one developer. Opt-in (F2): development is the only mode GrowKid runs in, so without DEV_CLOCK=1 any
// signed-in child could move every family's days. Never mounted in production. Only a request that carries the header moves it:
// a proof <img>, <video> or <a> carries none and must not put the clock back.
if (process.env.DEV_CLOCK === '1' && process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    const days = req.get('x-clock-days')
    if (days !== undefined) setClockDays(days)
    next()
  })
}

app.use(who)
app.use('/api', writeLimit) // L7, after `who` so it counts by user; DELETE /api/session is registered above and is never counted
app.use('/api', account)
app.use('/api', tasks)
app.use('/api', family)
app.use('/api', reports)
app.use('/api', series)

app.use((_req, res) => {
  res.status(404).json({ code: 'NOT_FOUND' })
})

// Four parameters: Express only treats a function with all four as the error handler.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)
  if (!req.complete) req.resume() // an early refusal of an upload still reaches the browser as its code
  if (err instanceof ApiError) {
    return res.status(STATUS[err.code] ?? 500).json({ code: err.code, fields: err.fields })
  }
  // multer: a file over the limit is its own code; any other limit or malformed upload is an unreadable proof
  if (err instanceof multer.MulterError) {
    const body = err.code === 'LIMIT_FILE_SIZE' ? { code: 'FILE_TOO_LARGE' } : { code: 'INVALID', fields: { proof: 'format' } }
    return res.status(STATUS[body.code]).json(body)
  }
  // Prisma P2002: the unique insert lost a race (or the email or username was simply taken)
  if (err.code === 'P2002') {
    const target = String(err.meta?.target) // ['email'], or the index name on some drivers
    const taken = target.includes('email') ? 'EMAIL_TAKEN' : target.includes('username') ? 'USERNAME_TAKEN' : null
    if (taken) return res.status(STATUS[taken]).json({ code: taken })
  }
  // Prisma P2025 (the row to update or delete went away after the handler found it) and P2003 (a write names a parent row that went
  // away meanwhile, such as a child removed or a family deleted): either way the thing asked about no longer exists
  if (err.code === 'P2025' || err.code === 'P2003') return res.status(404).json({ code: 'NOT_FOUND' })
  // Express 5's router throws this for a route parameter with a bad percent-escape (/children/%ZZ): no such id, so no such thing
  if (err instanceof URIError) return res.status(404).json({ code: 'NOT_FOUND' })
  // body-parser: malformed JSON, too large, wrong charset
  if (typeof err.type === 'string' && err.status >= 400 && err.status < 500) {
    return res.status(400).json({ code: 'INVALID' })
  }
  // Never the body, file names, notes or cookies: children's data. Nor err.message (F7), which opens the stack and can quote a task
  // title or a note, over several lines: only the "at ..." frames are kept.
  const frames = String(err.stack ?? '').split('\n').filter((line) => /^\s+at /.test(line)).join('\n')
  console.error(req.method, req.path, err.name, err.code ?? '', `\n${frames}`)
  res.status(500).json({ code: 'SERVER' })
})

export default app
