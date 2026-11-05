import { Router } from 'express'
import { clear, hash, issue, matches, only, ownChild, passwordLimit, signInIpLimit, signInLimit, signUpLimit } from '../auth.js'
import { now } from '../clock.js'
import { listCountries, zoneOf } from '../countries.js'
import { db } from '../db.js'
import { invalid, refuse, text } from '../errors.js'
import { removeFiles } from '../files.js'
import { asChild, asUser } from '../shape.js'

/** Accounts and the family (plan B1): sessions, sign-up, the parent's own settings and password, and the children. Mirrors fake.js:186-318. */
export const account = Router()

// A3: names are 1 to 60 characters after trimming; passwords are at least `min` and at most 72 bytes (the bcrypt limit).
const nameProblem = (name) => (!name ? 'required' : name.length > 60 && 'length')
const passwordProblem = (password, min) => (password.length < min ? 'short' : Buffer.byteLength(password) > 72 && 'length')
const settings = ({ leaderboard, country }) => ({ leaderboard, country })

// ------------------------------------------------------------------ sessions

/** getSession: the user for this cookie, or null. */
account.get('/session', (req, res) => {
  res.json(req.user ? asUser(req.user) : null)
})

/** signIn: a parent or moderator by email, a child by username. WRONG_DETAILS whether the account or the password is wrong. */
account.post('/session', signInIpLimit, signInLimit, async (req, res) => {
  const { identifier, password } = req.body ?? {}
  const typed = text(identifier).trim().toLowerCase()
  const user = await db.user.findFirst({ where: { OR: [{ email: typed }, { username: typed }] } })
  if (!(await matches(text(password), user?.passwordHash))) refuse('WRONG_DETAILS')
  issue(res, user)
  res.json(asUser(user))
})

/** signOut: ends the session on this device only. */
account.delete('/session', (_req, res) => {
  clear(res)
  res.status(204).end()
})

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
    password: passwordProblem(password, 8),
    country: zoneOf(country) === undefined && 'required',
  })
  const user = await db.user.create({
    data: { role: 'parent', name, email, country, passwordHash: await hash(password), createdAt: now() },
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
  invalid({ next: passwordProblem(text(next), 8) })
  // Conditional on the tokenVersion this request was signed in with: 0 rows means another device changed the password first.
  const { count } = await db.user.updateMany({
    where: { id: me.id, tokenVersion: me.tokenVersion },
    data: { passwordHash: await hash(text(next)), tokenVersion: { increment: 1 } },
  })
  if (count === 0) refuse('NOT_SIGNED_IN')
  issue(res, { id: me.id, tokenVersion: me.tokenVersion + 1 })
  res.status(204).end()
})

/**
 * Removes these users and everything held for them (rule 16, fake.js:266-280). Their answered reports go; an unanswered one stays with
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
account.post('/children', async (req, res) => {
  const me = only(req, 'parent')
  const body = req.body ?? {}
  const name = text(body.name).trim()
  const username = text(body.username)
  const password = text(body.password)
  invalid({
    name: nameProblem(name),
    username: !/^[a-z0-9]{3,20}$/.test(username) && 'format',
    password: passwordProblem(password, 6),
  })
  const child = await db.user.create({
    data: { role: 'child', name, username, parentId: me.id, passwordHash: await hash(password), createdAt: now() },
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
account.put('/children/:id/password', async (req, res) => {
  const child = await ownChild(req, req.params.id)
  const password = text((req.body ?? {}).password)
  invalid({ password: passwordProblem(password, 6) })
  await db.user.update({ where: { id: child.id }, data: { passwordHash: await hash(password), tokenVersion: { increment: 1 } } })
  res.status(204).end()
})
