import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { who } from './auth.js'
import { setClockDays } from './clock.js'
import { ApiError, STATUS, refuse } from './errors.js'
import { account } from './routes/account.js'

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

// ponytail: a global offset for one developer; never mounted in production.
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    setClockDays(req.get('x-clock-days'))
    next()
  })
}

app.use(who)
app.use('/api', account)

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
  // Prisma P2002: the unique insert lost a race (or the email or username was simply taken)
  if (err.code === 'P2002') {
    const target = String(err.meta?.target) // ['email'], or the index name on some drivers
    const taken = target.includes('email') ? 'EMAIL_TAKEN' : target.includes('username') ? 'USERNAME_TAKEN' : null
    if (taken) return res.status(STATUS[taken]).json({ code: taken })
  }
  // Prisma P2025: the row to update or delete went away after the handler found it
  if (err.code === 'P2025') return res.status(404).json({ code: 'NOT_FOUND' })
  // body-parser: malformed JSON, too large, wrong charset
  if (typeof err.type === 'string' && err.status >= 400 && err.status < 500) {
    return res.status(400).json({ code: 'INVALID' })
  }
  console.error(req.method, req.path, err.stack) // never the body, file names, notes or cookies: children's data
  res.status(500).json({ code: 'SERVER' })
})

export default app
