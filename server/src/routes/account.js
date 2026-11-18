import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { childAccountLimit, clear, findAccount, hash, issue, matches, only, ownChild, passwordLimit, paused, securityLog, signInAccountLimit, signInIpLimit, signInLimit, signUpLimit } from '../auth.js'
import { now } from '../clock.js'
import { listCountries, zoneOf } from '../countries.js'
import { db, readChildren } from '../db.js'
import { invalid, refuse, text } from '../errors.js'
import { NAMES, readProofFile, removeFiles } from '../files.js'
import { AVATAR_COLOURS, KEEP_PROOF_DAYS, PRIVACY_VERSION, cap, stickerList } from '../rules.js'
import { asChild, asReport, asRequest, asReward, asSuggestion, asUser } from '../shape.js'
import { base32, stepOf } from '../totp.js'
import { zipWriter } from '../zip.js'
import { asSeries } from './series.js'

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
const newRecoveryCode = () => base32(randomBytes(10)) // T5: 16 characters, 80 bits
const typedCode = (v) => text(v).toUpperCase().replace(/[^A-Z2-7]/g, '') // dashes, spaces and case do not matter
// T4 and T5: how long proof files are kept, and whether a recovery code exists (never the code or its hash)
const settings = ({ leaderboard, country, keepProofDays, recoveryHash }) => ({ leaderboard, country, keepProofDays, recovery: Boolean(recoveryHash) })

// ------------------------------------------------------------------ sessions

/** getSession: the user for this cookie, or null. */
account.get('/session', (req, res) => {
  res.json(req.user ? asUser(req.user) : null)
})

/**
 * signIn: a parent or moderator by email, a child by username. WRONG_DETAILS whether the account or the password is wrong. C6: a
 * paused family is PAUSED, and only after the right password, so the code tells a stranger nothing about the account. T1: a
 * moderator also needs the code from their authenticator app, asked for only after the right password: NEEDS_CODE when it is
 * missing, and NEEDS_CODE with fields.code 'wrong' when it does not match or was used already.
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
  if (user.role === 'moderator') {
    // T1: the password was right; now the code. Only then, so a wrong password never says a code is wanted.
    const { code } = req.body ?? {}
    if (code === undefined || code === '') refuse('NEEDS_CODE')
    const step = stepOf(user.totpSecret, code, user.totpLastStep)
    // conditional on the step still being unused: the same code sent twice at the same moment signs in once
    const used = step === null ? { count: 0 } : await db.user.updateMany({ where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] }, data: { totpLastStep: step } })
    if (used.count === 0) {
      securityLog('moderator-code-refused', req) // C9: a stolen password being tried shows here
      refuse('NEEDS_CODE', { code: 'wrong' })
    }
    securityLog('moderator-sign-in', req) // C9
  }
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

/**
 * signUp: a new parent and family, signed in. Rule 25: the country picks the family's time zone. A taken email surfaces as P2002 from
 * the unique insert. T5: the answer carries the parent's recovery code, the only time it leaves; only its hash is kept.
 */
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
  const recoveryCode = newRecoveryCode()
  const user = await db.user.create({
    data: { role: 'parent', name, email, country, passwordHash: await hash(password), recoveryHash: await hash(recoveryCode), createdAt: now(), ...consented() },
  })
  issue(res, user)
  res.status(201).json({ ...asUser(user), recoveryCode })
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

/** makeRecoveryCode (T5): a new code behind the password; the one before stops working. Shown once: only its hash is kept. */
account.post('/me/recovery', passwordLimit, async (req, res) => {
  const me = only(req, 'parent')
  if (!(await matches(text((req.body ?? {}).password), me.passwordHash))) refuse('WRONG_PASSWORD')
  const recoveryCode = newRecoveryCode()
  await db.user.update({ where: { id: me.id }, data: { recoveryHash: await hash(recoveryCode) } })
  res.json({ recoveryCode })
})

/**
 * resetPassword (T5): a parent's email, their recovery code and a new password. An unknown email, a child's username, an account with
 * no code and a wrong code are one answer, each after one real compare, so nothing says which it was. Everything about the account
 * (paused, the password's own rules) is checked only after the right code. The write is conditional on the code still being the
 * one checked, so two requests with one code change the password once. The code is hashed at a password's cost on purpose: an
 * unknown account is compared against DUMMY_HASH, which is cost 12, and a cheaper hash would let timing say which accounts have a code.
 */
// T5: the account is named by email, so the sign-in limits count it by email; an `identifier` sent beside it cannot pick the counter
const countByEmail = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') req.body.identifier = req.body.email
  next()
}
account.post('/recovery', countByEmail, signInIpLimit, signInLimit, signInAccountLimit, async (req, res) => {
  const body = req.body ?? {}
  const found = await findAccount(text(body.email).trim().toLowerCase())
  const parent = found?.role === 'parent' ? found : null
  if (!(await matches(typedCode(body.code), parent?.recoveryHash))) refuse('WRONG_DETAILS')
  if (paused(parent)) {
    securityLog('paused-recovery', req) // C9
    refuse('PAUSED')
  }
  const password = text(body.password)
  invalid({ password: passwordProblem(password, 8, personal(parent.name, localPart(parent.email))) })
  const { count } = await db.user.updateMany({
    where: { id: parent.id, recoveryHash: parent.recoveryHash },
    data: { passwordHash: await hash(password), tokenVersion: { increment: 1 }, recoveryHash: null },
  })
  if (count === 0) refuse('WRONG_DETAILS')
  securityLog('password-recovered', req) // C9
  res.status(204).end()
})

// ------------------------------------------------------------------ the child's own settings (K10, K11)

const withParent = { parent: { select: { country: true } } } // asUser reads the family's zone from it

/** setAvatar (K10): one of four colours and a sticker the child has earned and seen, or both null for none. */
account.put('/me/avatar', async (req, res) => {
  const me = only(req, 'child')
  const { colour, stickerId } = req.body ?? {}
  let avatar = null
  if (colour !== null || stickerId !== null) {
    const [snapshot] = await readChildren([me.id])
    const earned = stickerList(snapshot, now()).some((s) => s.id === stickerId && s.seen)
    invalid({ colour: !AVATAR_COLOURS.includes(colour) && 'required', stickerId: !earned && 'required' })
    avatar = `${colour}:${stickerId}`
  }
  res.json(asUser(await db.user.update({ where: { id: me.id }, data: { avatar }, include: withParent })))
})

/** setSound (K11): whether the reward moment may play its tones and vibration. */
account.put('/me/sound', async (req, res) => {
  const me = only(req, 'child')
  const { sound } = req.body ?? {}
  if (typeof sound !== 'boolean') refuse('INVALID', { sound: 'required' })
  res.json(asUser(await db.user.update({ where: { id: me.id }, data: { sound }, include: withParent })))
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
  }, { maxWait: 10_000, timeout: 60_000 }) // Prisma's 2 s and 5 s are too short for a family with years of tasks on a slow machine (P2028)
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

/** T6: the most proof files one export packs; a zip without zip64 holds 65,535 entries. Oldest first, and family.json says how many were left out. */
const MOST_EXPORT_FILES = 65_000
const extension = (type) => path.extname(NAMES[type] ?? 'proof.pdf') // a PDF stored before PDFs were dropped (C2)

/**
 * exportFamily (T6): a .zip of what this parent can already see. family.json, in the API's own shapes, and proofs/<id>.<ext> for each
 * proof file still kept, read and written one at a time, so memory holds one file. Never a hash or a secret; never a child's report
 * (rule 15) or a child's savings goal (K3), which are not the parent's to read. family.json goes last, so what it says about the
 * files is what was packed. If the caller leaves, or a write fails, the response is cut and the zip does not open.
 * ponytail: the browser holds the whole zip before saving it; a one-time download link would stream to disk if that ever matters.
 */
account.post('/me/export', passwordLimit, async (req, res) => {
  const me = only(req, 'parent')
  if (!(await matches(text((req.body ?? {}).password), me.passwordHash))) refuse('WRONG_PASSWORD')
  const oldestFirst = [{ createdAt: 'asc' }, { id: 'asc' }]
  const children = await db.user.findMany({ where: { parentId: me.id }, orderBy: oldestFirst })
  const ids = children.map((child) => child.id)
  const [snapshots, series, suggestions, rewards, requests, mine, files] = await Promise.all([
    readChildren(ids),
    db.taskSeries.findMany({ where: { childId: { in: ids } }, orderBy: oldestFirst }),
    db.suggestion.findMany({ where: { childId: { in: ids } }, include: { child: { select: { name: true } } }, orderBy: oldestFirst }),
    db.reward.findMany({ where: { parentId: me.id }, orderBy: oldestFirst }),
    db.rewardRequest.findMany({ where: { parentId: me.id }, include: { child: { select: { name: true } } }, orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }] }),
    db.report.findMany({ where: { byId: me.id }, orderBy: [{ sentAt: 'asc' }, { id: 'asc' }] }),
    db.proof.findMany({ where: { fileType: { not: null }, removedAt: null, task: { childId: { in: ids } } }, select: { id: true, fileType: true }, orderBy: [{ sentAt: 'asc' }, { id: 'asc' }] }),
  ])
  const stamp = ({ consentAt, consentVersion, createdAt }) => ({ consentAt: consentAt?.toISOString(), consentVersion: consentVersion ?? undefined, createdAt: createdAt.toISOString() })

  res.status(200).set({ 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="growkid-family.zip"' })
  // the callback's error on a caller who has gone is not documented, so a destroyed response stops the export first
  const write = (bytes) =>
    new Promise((done, fail) => {
      if (res.destroyed) return fail(new Error('gone'))
      res.write(bytes, (error) => (error ? fail(error) : done()))
    })
  try {
    const zip = zipWriter(write, now())
    let packed = 0
    for (const { id, fileType } of files.slice(0, MOST_EXPORT_FILES)) {
      const bytes = await readProofFile(id).catch(() => null) // a file that is missing is counted below, not fatal
      if (!bytes) continue
      await zip.add(`proofs/${id}${extension(fileType)}`, bytes)
      packed += 1
    }
    const family = {
      exportedAt: now().toISOString(),
      parent: { ...asUser(me), ...settings(me), ...stamp(me) },
      children: children.map((child, i) => ({
        ...asChild(child), ...stamp(child),
        tasks: snapshots[i].tasks, restDays: snapshots[i].rest, quest: snapshots[i].quest, questAwards: snapshots[i].questAwards, stickers: snapshots[i].awards,
      })),
      series: series.map(asSeries), suggestions: suggestions.map(asSuggestion), rewards: rewards.map(asReward), requests: requests.map(asRequest),
      reports: mine.map((row) => asReport(row)),
      files: { packed, notPacked: files.length - packed },
    }
    await zip.add('family.json', Buffer.from(JSON.stringify(family, null, 2)))
    await zip.end()
    res.end()
  } catch {
    res.destroy()
  }
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

/** setKeepProofDays (T4): how long a proof's file is kept after its task is approved: 30, 90 or 365 days. */
account.put('/settings/keep-proof', async (req, res) => {
  const me = only(req, 'parent')
  const { days } = req.body ?? {}
  if (!KEEP_PROOF_DAYS.includes(days)) refuse('INVALID', { days: 'required' })
  res.json(settings(await db.user.update({ where: { id: me.id }, data: { keepProofDays: days } })))
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
