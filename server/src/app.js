import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import { who } from './auth.js'
import { setClockDays } from './clock.js'
import { ApiError, STATUS, refuse } from './errors.js'
import { account, signOut } from './routes/account.js'
import { family } from './routes/family.js'
import { reports } from './routes/reports.js'
import { tasks } from './routes/tasks.js'

/** The Express app, without listening: index.js listens, the tests listen on port 0. Order follows plan section 4. */
const app = express()
app.set('trust proxy', 'loopback') // req.ip comes from X-Forwarded-For only when Caddy (or a test) sends it from loopback

app.use(helmet())
app.use(express.json({ limit: '20kb' }))
app.use(cookieParser())

// CSRF (section 7): with SameSite=Strict and no CORS, a cross-site form cannot add this header.
app.use('/api', (req, _res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.get('x-growkid') !== '1') refuse('NOT_ALLOWED')
  next()
})

app.delete('/api/session', signOut) // before `who`, which reads the database

// ponytail: a global offset for one developer; never mounted in production. Only a request that carries the header moves it:
// a proof <img>, <video> or <a> carries none and must not put the clock back.
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    const days = req.get('x-clock-days')
    if (days !== undefined) setClockDays(days)
    next()
  })
}

app.use(who)
app.use('/api', account)
app.use('/api', tasks)
app.use('/api', family)
app.use('/api', reports)

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
  console.error(req.method, req.path, err.stack) // never the body, file names, notes or cookies: children's data
  res.status(500).json({ code: 'SERVER' })
})

export default app
