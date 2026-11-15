import { readFileSync } from 'node:fs'
import { Router } from 'express'
import { childAccountLimit, clear, findAccount, hash, issue, matches, only, ownChild, passwordLimit, paused, securityLog, signInAccountLimit, signInIpLimit, signInLimit, signUpLimit } from '../auth.js'
import { now } from '../clock.js'
import { listCountries, zoneOf } from '../countries.js'
import { db } from '../db.js'
import { invalid, refuse, text } from '../errors.js'
import { removeFiles } from '../files.js'
import { PRIVACY_VERSION, cap } from '../rules.js'
import { asChild, asUser } from '../shape.js'

/** Accounts and the family (plan B1): sessions, sign-up, the parent's own settings and password, and the children. Ported from the stand-in removed in B4. */
export const account = Router()

// A3: names are 1 to 60 characters after trimming; passwords are at least `min` and at most 72 bytes (the bcrypt limit).
const nameProblem = (name) => (!name ? 'required' : name.length > 60 && 'length')
// Rule 27, L4: the 1,000 most common passwords (SecLists, see README.md), read once when the server starts.
const COMMON = new Set(readFileSync(new URL('../common-passwords.txt', import.meta.url), 'utf8').split(/\r?\n/)) // \r too: git on Windows may check the list out with CRLF
/** L4: what a person's password may not contain: each word of three or more letters in their name, and each `whole` (a username, the part of an email before the @) of three or more characters. */
const plain = (words) => words.normalize('NFKC').toLowerCase() // one spelling for a letter typed two ways
// \p{M}: the vowel signs and accents inside a word (मीरा, a decomposed José) are part of it, not a gap between words
const personal = (name, ...whole) => [...name.split(/[^\p{L}\p{M}]+/u), ...whole].map(plain).filter((part) => part.length >= 3)
/** A3 and L4: what is wrong with a new password, or false. `mine` is personal() for the person it is for. */
function passwordProblem(password, min, mine) {
  if (password.length < min) return 'short'
  if (Buffer.byteLength(password) > 72) return 'length'
  const lower = plain(password)
  if (COMMON.has(lower)) return 'common'
  return mine.some((part) => lower.includes(part)) && 'personal'
}
const localPart = (email) => (email ?? '').split('@')[0]
/** C8: what a consent records: when, and under which version of Safety and privacy. It records consent; it cannot verify who gave it. */
const consented = () => ({ consentAt: now(), consentVersion: PRIVACY_VERSION })
const settings = ({ leaderboard, country }) => ({ leaderboard, country })

// ------------------------------------------------------------------ sessions

/** getSession: the user for this cookie, or null. */
account.get('/session', (req, res) => {
  res.json(req.user ? asUser(req.user) : null)
})

/**
 * signIn: a parent or moderator by email, a child by username. WRONG_DETAILS whether the account or the password is wrong. C6: a
 * paused family is PAUSED, and only after the right password, so the code tells a stranger nothing about the account.
 */
account.post('/session', signInIpLimit, signInLimit, signInAccountLimit, async (req, res) => {
  const { identifier, password } = req.body ?? {}
  const typed = text(identifier).trim().toLowerCase()
  const user = await findAccount(typed)
  if (!(await matches(text(password), user?.passwordHash))) refuse('WRONG_DETAILS')
  if (paused(user)) {
    securityLog('paused-sign-in', req) // C9
    refuse('PAUSED')
  }
  if (user.role === 'moderator') securityLog('moderator-sign-in', req) // C9: a moderator's answer reaches children
  issue(res, user)
  res.json(asUser(user))
})

/**
 * signOut: ends the session on this device only. It needs no database, so app.js registers it before `who`: a device can sign
 * out while the database is down.
 */
export const signOut = (_req, res) => {
  clear(res)
  res.status(204).end()
}

/** signUp: a new parent and family, signed in. Rule 25: the country picks the family's time zone. A taken email surfaces as P2002 from the unique insert. */
account.post('/parents', signUpLimit, async (req, res) => {
  const body = req.body ?? {}
  const name = text(body.name).trim()
  const email = text(body.email).trim().toLowerCase()
  const password = text(body.password)
  const country = text(body.country)
  invalid({
    name: nameProblem(name),
    email: !(email.length <= 254 && /^\S+@\S+\.\S+$/.test(email)) && 'format',
    password: passwordProblem(password, 8, personal(name, localPart(email))),
    country: zoneOf(country) === undefined && 'required',
    consent: body.consent !== true && 'required',
  })
  const user = await db.user.create({
    data: { role: 'parent', name, email, country, passwordHash: await hash(password), createdAt: now(), ...consented() },
  })
  issue(res, user)
  res.status(201).json(asUser(user))
})

/** listCountries (rule 25): every country with its time zone, sorted by name. Needs no sign-in: the sign-up form uses it. */
account.get('/countries', (_req, res) => {
  res.json(listCountries)
})

// ------------------------------------------------------------------ the parent

/** updateName */
account.patch('/me', async (req, res) => {
  const me = only(req, 'parent')
  const name = text((req.body ?? {}).name).trim()
  invalid({ name: nameProblem(name) })
  res.json(asUser(await db.user.update({ where: { id: me.id }, data: { name } })))
})

/** changePassword: signs out every other device (A2) and gives this one a fresh cookie. */
account.put('/me/password', passwordLimit, async (req, res) => {
  const me = only(req, 'parent')
  const { current, next } = req.body ?? {}
  if (!(await matches(text(current), me.passwordHash))) refuse('WRONG_PASSWORD')
  invalid({ next: passwordProblem(text(next), 8, personal(me.name, localPart(me.email))) })
  // Conditional on the tokenVersion this request was signed in with: 0 rows means another device changed the password first.
  const { count } = await db.user.updateMany({
    where: { id: me.id, tokenVersion: me.tokenVersion },
    data: { passwordHash: await hash(text(next)), tokenVersion: { increment: 1 } },
  })
  if (count === 0) refuse('NOT_SIGNED_IN')
  issue(res, { id: me.id, tokenVersion: me.tokenVersion + 1 })
  res.status(204).end()
})

/** endOtherSessions (rule 26, L5): every other device is signed out, and this one gets a fresh cookie. Conditional, as changePassword is. */
account.post('/me/sessions/end', async (req, res) => {
  const me = only(req, 'parent')
  const { count } = await db.user.updateMany({ where: { id: me.id, tokenVersion: me.tokenVersion }, data: { tokenVersion: { increment: 1 } } })
  if (count === 0) refuse('NOT_SIGNED_IN')
  issue(res, { id: me.id, tokenVersion: me.tokenVersion + 1 })
  res.status(204).end()
})

/**
 * Removes these users and everything held for them (rule 16). Their answered reports go; an unanswered one stays with
 * byId cleared by the database (SetNull); every other table follows by cascade. The proof files go last, once the rows are gone.
 * One transaction holds the users' row locks from the file list to the delete, so a proof sent meanwhile (B2's sendProof takes the
 * same lock through lockChild) either lands in the list or finds the child gone.
 */
async function erase(userIds) {
  const proofIds = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "User" WHERE id = ANY(${userIds}) FOR UPDATE`
    const proofs = await tx.proof.findMany({
      where: { fileType: { not: null }, task: { childId: { in: userIds } } },
      select: { id: true },
    })
    await tx.report.deleteMany({ where: { byId: { in: userIds }, resolvedAt: { not: null } } })
    await tx.user.deleteMany({ where: { id: { in: userIds } } })
    return proofs.map((proof) => proof.id)
  })
  await removeFiles(proofIds)
}

/** deleteFamily: the parent and every child, for good. Their sessions end with their rows. */
account.post('/me/delete', passwordLimit, async (req, res) => {
  const me = only(req, 'parent')
  const { password } = req.body ?? {}
  if (!(await matches(text(password), me.passwordHash))) refuse('WRONG_PASSWORD')
  const children = await db.user.findMany({ where: { parentId: me.id }, select: { id: true } })
  await erase([me.id, ...children.map((child) => child.id)])
  clear(res)
  res.status(204).end()
})

/** getSettings */
account.get('/settings', (req, res) => {
  res.json(settings(only(req, 'parent')))
})

/** setLeaderboard (rule 23) */
account.put('/settings', async (req, res) => {
  const me = only(req, 'parent')
  const { leaderboard } = req.body ?? {}
  if (typeof leaderboard !== 'boolean') refuse('INVALID', { leaderboard: 'required' })
  res.json(settings(await db.user.update({ where: { id: me.id }, data: { leaderboard } })))
})

/** setCountry (S11): from now on the family's days follow this country's zone. */
account.put('/settings/country', async (req, res) => {
  const me = only(req, 'parent')
  const country = text((req.body ?? {}).country)
  if (zoneOf(country) === undefined) refuse('INVALID', { country: 'required' })
  res.json(settings(await db.user.update({ where: { id: me.id }, data: { country } })))
})

// ------------------------------------------------------------------ children

/** listChildren: the signed-in parent's, in the order they were added. */
account.get('/children', async (req, res) => {
  const me = only(req, 'parent')
  const children = await db.user.findMany({ where: { parentId: me.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
  res.json(children.map(asChild))
})

/** addChild: the username is 3 to 20 of a-z and 0-9, as typed (no lower-casing); a taken one surfaces as P2002. */
account.post('/children', childAccountLimit, async (req, res) => {
  const me = only(req, 'parent')
  const body = req.body ?? {}
  const name = text(body.name).trim()
  const username = text(body.username)
  const password = text(body.password)
  invalid({
    name: nameProblem(name),
    username: !/^[a-z0-9]{3,20}$/.test(username) && 'format',
    password: passwordProblem(password, 8, personal(name, username)),
    consent: body.consent !== true && 'required', // C8: the parent's tick for this child
  })
  cap('children', await db.user.count({ where: { parentId: me.id } }))
  const child = await db.user.create({
    data: { role: 'child', name, username, parentId: me.id, passwordHash: await hash(password), createdAt: now(), ...consented() },
  })
  res.status(201).json(asChild(child))
})

/** getChild */
account.get('/children/:id', async (req, res) => {
  res.json(asChild(await ownChild(req, req.params.id)))
})

/** renameChild */
account.patch('/children/:id', async (req, res) => {
  const child = await ownChild(req, req.params.id)
  const name = text((req.body ?? {}).name).trim()
  invalid({ name: nameProblem(name) })
  res.json(asChild(await db.user.update({ where: { id: child.id }, data: { name } })))
})

/** removeChild */
account.delete('/children/:id', async (req, res) => {
  const child = await ownChild(req, req.params.id)
  await erase([child.id])
  res.status(204).end()
})

/** resetChildPassword: the old password stops working at once, and so does any device the child was signed in on (A2). */
account.put('/children/:id/password', childAccountLimit, async (req, res) => {
  const child = await ownChild(req, req.params.id)
  const password = text((req.body ?? {}).password)
  invalid({ password: passwordProblem(password, 8, personal(child.name, child.username)) })
  await db.user.update({ where: { id: child.id }, data: { passwordHash: await hash(password), tokenVersion: { increment: 1 } } })
  res.status(204).end()
})

/** endChildSessions (rule 26, L5): the child is signed out on every device; the password stays. */
account.post('/children/:id/sessions/end', async (req, res) => {
  const child = await ownChild(req, req.params.id)
  await db.user.update({ where: { id: child.id }, data: { tokenVersion: { increment: 1 } } })
  res.status(204).end()
})
