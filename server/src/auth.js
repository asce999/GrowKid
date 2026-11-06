import bcrypt from 'bcryptjs'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import { db } from './db.js'
import { ApiError, refuse, text } from './errors.js'

// Section 7, Auth. ponytail: signing out clears the cookie but cannot revoke the token itself (a stolen copy lives until it expires or tokenVersion moves); a sessions table would, and the plan rules one out.
const COOKIE = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api' }
const WEEK = 7 * 86_400_000
const ROUNDS = 12
// A real hash of a throwaway value: an unknown account is compared against it, so it costs the same time as a wrong password.
const DUMMY_HASH = '$2b$12$uwA/NkntlxOss6vMgE7D2O1Jf6L5UHdEnRuuRmMzpEc85GEN6etdC'

/** Section 7, Auth: sets req.user from the cookie, or null. Only an HS256 token whose tokenVersion still matches counts. */
export async function who(req, _res, next) {
  req.user = null
  let claims = null
  try {
    claims = jwt.verify(req.cookies?.growkid, process.env.JWT_SECRET, { algorithms: ['HS256'], maxAge: '7d' })
  } catch {
    // missing, expired, tampered or unsigned token: just not signed in
  }
  if (typeof claims?.sub === 'string') {
    const user = await db.user.findUnique({ where: { id: claims.sub } })
    if (user && user.tokenVersion === claims.v) req.user = user
  }
  next()
}

/** Any signed-in user, or NOT_SIGNED_IN. */
export const signedIn = (req) => req.user ?? refuse('NOT_SIGNED_IN')

/** A signed-in user with this role, or NOT_SIGNED_IN / NOT_ALLOWED. */
export const only = (req, role) => {
  const user = signedIn(req)
  return user.role === role ? user : refuse('NOT_ALLOWED')
}

/** A child of the signed-in parent. Someone else's child does not exist as far as they can tell (NOT_FOUND). */
export async function ownChild(req, id) {
  const me = only(req, 'parent')
  // text(): a NUL in a URL's id (%00) would be refused by PostgreSQL as a 500; as a child that does not exist it is a 404
  return (await db.user.findFirst({ where: { id: text(id), role: 'child', parentId: me.id } })) ?? refuse('NOT_FOUND')
}

/** Starts a seven-day session on this device: the token carries the user's tokenVersion, so raising it later ends every device's. */
export function issue(res, user) {
  const token = jwt.sign({ sub: user.id, v: user.tokenVersion }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' })
  res.cookie('growkid', token, { ...COOKIE, maxAge: WEEK })
}

/** Ends the session on this device. */
export const clear = (res) => res.clearCookie('growkid', COOKIE)

/** bcrypt at cost 12. The caller has already refused a password over 72 bytes (A3). */
export const hash = (password) => bcrypt.hash(password, ROUNDS)

/**
 * Whether the typed password is this account's. With no hash (no such account) it still spends one compare, on the dummy.
 * A password over 72 bytes never matches, because bcrypt would silently read only its first 72.
 */
export async function matches(password, hashed) {
  if (Buffer.byteLength(password) > 72) return false
  const same = await bcrypt.compare(password, hashed ?? DUMMY_HASH)
  return same && hashed != null
}

const limit = (minutes, max, keyGenerator, options = {}) =>
  rateLimit({
    windowMs: minutes * 60_000,
    limit: max,
    keyGenerator,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError('TOO_MANY')),
    ...options,
  })

// Only failed sign-ins (a 401, status 400 or more) count: a school's many children signing in correctly from one address never fill these up.
const failedOnly = { skipSuccessfulRequests: true }

// ponytail: in-memory counters, so they restart with the server and are per process; fine for the one VM.
/** 50 failed sign-ins per 15 minutes for one address, whatever the identifier: stops one address guessing across many usernames. */
export const signInIpLimit = limit(15, 50, (req) => ipKeyGenerator(req.ip), failedOnly)
/** 10 failed sign-ins per 15 minutes for one address and one identifier, so one child's typos do not lock the rest of a school out. */
export const signInLimit = limit(
  15, 10, (req) => `${ipKeyGenerator(req.ip)}|${text(req.body?.identifier).trim().toLowerCase().slice(0, 100)}`, failedOnly,
)
/** 20 sign-ups per hour for one address. */
export const signUpLimit = limit(60, 20, (req) => ipKeyGenerator(req.ip))
/** 10 tries per 15 minutes for one user, counting change-password and delete-family together: both are ways to guess the password. */
export const passwordLimit = limit(15, 10, (req) => req.user?.id ?? ipKeyGenerator(req.ip))
/** 10 reports sent per hour for one user; refused tries do not count. A signed-out visitor falls back to the address. */
export const reportLimit = limit(60, 10, (req) => req.user?.id ?? ipKeyGenerator(req.ip), { skipFailedRequests: true })
