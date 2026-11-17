import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rm, unlink } from 'node:fs/promises'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { crc32 } from 'node:zlib'
import bcrypt from 'bcryptjs'
import { db } from '../src/db.js'
import { removeOldProofFiles } from '../src/files.js'
import { STORAGE_BYTES } from '../src/rules.js'
import { mp4, png } from './fixtures.js'
import { as, family, moderator, start } from './helpers.js'

/** Final plan Phase 8: how long proof files are kept (T4), the recovery code (T5) and a copy of the family's data (T6). */

let server
const made = [] // every family this file makes, erased at the end so the upload folder ends empty
const reports = [] // an unanswered report outlives its sender, so they go by id
before(async () => {
  server = await start()
})
after(async () => {
  await Promise.all(made.map((mom) => mom.api.post('/me/delete', { password: mom.password })))
  await db.report.deleteMany({ where: { id: { in: reports } } })
  await server.close()
})

const DAY = 86_400_000
const FRESH = 'a brand new password 1'
const refused = (res, status, code) => assert.deepEqual([res.status, res.body], [status, { code }])
const tooMany = (res) => assert.deepEqual([res.status, res.body?.code], [429, 'TOO_MANY'])

async function household() {
  const mom = await family(server.base)
  made.push(mom)
  const login = { name: 'Asha', username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1' }
  const added = await mom.api.post('/children', { ...login, consent: true })
  assert.equal(added.status, 201)
  const kid = { ...added.body, ...login, api: as(server.base) }
  assert.equal((await kid.api.post('/session', { identifier: login.username, password: login.password })).status, 200)
  return { mom, kid }
}

/** A task the child sent proof for with each of `files` in turn, every attempt but the last sent back and the last approved, as the parent sees it. */
async function approved(mom, kid, files = [{ bytes: png(), name: 'a.png' }]) {
  const task = (await mom.api.post('/tasks', {
    childId: kid.id, category: 'chores', title: 'Water the plants', instructions: 'Every pot.', points: 20, dueAt: new Date(Date.now() + DAY).toISOString(),
  })).body
  for (const [i, file] of files.entries()) {
    const sent = await kid.api.form(`/tasks/${task.id}/proofs`, { note: `Try ${i + 1}` }, file)
    assert.equal(sent.status, 201)
    const proofId = sent.body.proofs.at(-1).id
    const last = i === files.length - 1
    const review = await mom.api.post(`/tasks/${task.id}/review`, last ? { proofId, result: 'approved' } : { proofId, result: 'sentBack', note: 'Once more.' })
    assert.equal(review.status, 200)
  }
  return (await mom.api.get(`/tasks/${task.id}`)).body
}

/** Moves a task's approval this many days (and a minute) into the past. */
const age = (task, days) => db.proof.updateMany({ where: { taskId: task.id, result: 'approved' }, data: { reviewedAt: new Date(Date.now() - days * DAY - 60_000) } })
const onDisk = async () => new Set(await readdir(process.env.UPLOAD_DIR))
/** A paused or reset parent was signed out; after() deletes the family through the parent's own client, so it signs in again. */
const signBackIn = async (mom, password = mom.password) => {
  mom.password = password
  assert.equal((await mom.api.post('/session', { identifier: mom.email, password })).status, 200)
}

// ------------------------------------------------------------------ T4, proof files are deleted after a while

test('T4: a file is deleted once its task\'s approval is older than the family keeps files, the earlier attempt\'s file goes with it, the proof says removed after how many days, and a newer task and another family\'s longer setting are left alone', async () => {
  const { mom, kid } = await household()
  const old = await approved(mom, kid, [{ bytes: png(), name: 'first.png' }, { bytes: png(), name: 'second.png' }])
  const fresh = await approved(mom, kid)
  const other = await household()
  assert.equal((await other.mom.api.put('/settings/keep-proof', { days: 365 })).status, 200)
  const theirs = await approved(other.mom, other.kid)
  await age(old, 91)
  await age(theirs, 91)
  await age(fresh, 89)
  const kept = [...fresh.proofs, ...theirs.proofs]
  assert.equal(old.proofs.length, 2)
  for (const proof of [...old.proofs, ...kept]) assert.ok((await onDisk()).has(proof.id))

  assert.ok((await removeOldProofFiles(new Date())) >= 2)
  const left = await onDisk()
  for (const proof of old.proofs) assert.equal(left.has(proof.id), false)
  for (const proof of kept) assert.equal(left.has(proof.id), true)
  for (const who of [mom.api, kid.api]) {
    const task = (await who.get(`/tasks/${old.id}`)).body // the parent and the child read the same
    assert.equal(task.status, 'approved')
    assert.deepEqual(task.proofs.map((p) => [p.note, p.fileUrl, p.removed?.afterDays]), [['Try 1', undefined, 91], ['Try 2', undefined, 91]])
    assert.deepEqual(task.proofs.map((p) => p.review.result), ['sentBack', 'approved']) // the review stays
    for (const proof of old.proofs) refused(await who.get(`/proofs/${proof.id}/file`), 404, 'NOT_FOUND')
    assert.equal((await who.get(`/proofs/${fresh.proofs[0].id}/file`)).status, 200)
  }
  assert.ok((await mom.api.get(`/tasks/${fresh.id}`)).body.proofs[0].fileUrl)
})

test('T4: a removed file frees its room in the quota and leaves My proofs, and a second run removes nothing', async () => {
  const { mom, kid } = await household()
  const old = await approved(mom, kid)
  assert.equal((await kid.api.post('/tasks/seen', { taskIds: [old.id] })).status, 204)
  const mine = async () => (await kid.api.get('/proofs/mine')).body.map((p) => p.id)
  assert.deepEqual(await mine(), [old.proofs[0].id])
  await db.proof.update({ where: { id: old.proofs[0].id }, data: { fileSize: STORAGE_BYTES - 1 } }) // as if it held all but a byte of the family's 2 GiB (the column is 32-bit)
  const next = (await mom.api.post('/tasks', {
    childId: kid.id, category: 'chores', title: 'Tidy the shelf', instructions: 'Books upright.', points: 20, dueAt: new Date(Date.now() + DAY).toISOString(),
  })).body
  const full = await kid.api.form(`/tasks/${next.id}/proofs`, {}, { bytes: png(), name: 'b.png' })
  assert.deepEqual([full.status, full.body], [409, { code: 'QUOTA', fields: { quota: 'storage' } }])

  await age(old, 91)
  assert.ok((await removeOldProofFiles(new Date())) >= 1)
  assert.equal(await removeOldProofFiles(new Date()), 0) // nothing old is left
  assert.deepEqual(await mine(), [])
  assert.equal((await kid.api.form(`/tasks/${next.id}/proofs`, {}, { bytes: png(), name: 'b.png' })).status, 201) // the room is free again
})

test('T4: a file that will not unlink stays unmarked', async () => {
  const { mom, kid } = await household()
  const old = await approved(mom, kid)
  const id = old.proofs[0].id
  const file = path.join(process.env.UPLOAD_DIR, id)
  await unlink(file)
  await mkdir(file) // a folder of the same name, which unlink refuses
  try {
    await age(old, 91)
    await removeOldProofFiles(new Date())
    assert.equal((await db.proof.findUniqueOrThrow({ where: { id } })).removedAt, null)
  } finally {
    await rm(file, { recursive: true, force: true })
  }
  await removeOldProofFiles(new Date()) // the next run finds the file gone, and marks it
  assert.notEqual((await db.proof.findUniqueOrThrow({ where: { id } })).removedAt, null)
})

test('T4: the setting is 30, 90 or 365 and nothing else, for a parent only; getSettings holds it', async () => {
  const { mom, kid } = await household()
  assert.equal((await mom.api.get('/settings')).body.keepProofDays, 90) // the start value
  for (const days of [30, 365, 90]) {
    const res = await mom.api.put('/settings/keep-proof', { days })
    assert.deepEqual([res.status, res.body.keepProofDays], [200, days])
    assert.equal((await mom.api.get('/settings')).body.keepProofDays, days)
  }
  for (const days of [0, 31, 89, 91, -30, 3650, 90.5, '90', null, undefined, [90]]) {
    const res = await mom.api.put('/settings/keep-proof', { days })
    assert.deepEqual([res.status, res.body], [400, { code: 'INVALID', fields: { days: 'required' } }], JSON.stringify(days))
  }
  refused(await kid.api.put('/settings/keep-proof', { days: 30 }), 403, 'NOT_ALLOWED')
  refused(await as(server.base).put('/settings/keep-proof', { days: 30 }), 401, 'NOT_SIGNED_IN')
  assert.equal((await mom.api.get('/settings')).body.keepProofDays, 90)
})

// ------------------------------------------------------------------ T5, a forgotten parent password

test('T5: sign-up answers with a recovery code once: 16 base32 characters, stored only as a hash, and never in the session or the settings', async () => {
  const mom = await family(server.base)
  made.push(mom)
  assert.match(mom.recoveryCode, /^[A-Z2-7]{16}$/)
  const row = await db.user.findUniqueOrThrow({ where: { id: mom.user.id } })
  assert.match(row.recoveryHash, /^\$2[aby]\$12\$/) // the cost a password has: a cheaper hash would let timing say which accounts have a code
  assert.equal(await bcrypt.compare(mom.recoveryCode, row.recoveryHash), true)
  const settings = (await mom.api.get('/settings')).body
  assert.equal(settings.recovery, true)
  const answers = [settings, (await mom.api.get('/session')).body, (await as(server.base).post('/session', { identifier: mom.email, password: mom.password })).body]
  for (const body of answers) for (const secret of [mom.recoveryCode, row.recoveryHash, 'recoveryHash']) assert.equal(JSON.stringify(body).includes(secret), false)
})

test('T5: the email, the code and a new password reset a forgotten password: the old password and every device stop, the new one signs in, and the code is used up', async () => {
  const { mom, kid } = await household()
  const elsewhere = as(server.base)
  assert.equal((await elsewhere.post('/session', { identifier: mom.email, password: mom.password })).status, 200)
  const res = await as(server.base).post('/recovery', { email: mom.email, code: mom.recoveryCode, password: FRESH })
  assert.deepEqual([res.status, res.body, res.headers.getSetCookie()], [204, undefined, []]) // it signs nobody in
  refused(await mom.api.get('/children'), 401, 'NOT_SIGNED_IN')
  refused(await elsewhere.get('/children'), 401, 'NOT_SIGNED_IN')
  refused(await as(server.base).post('/session', { identifier: mom.email, password: mom.password }), 401, 'WRONG_DETAILS')
  await signBackIn(mom, FRESH)
  assert.equal((await kid.api.get('/tasks')).status, 200) // the child's sign-in is not touched
  refused(await as(server.base).post('/recovery', { email: mom.email, code: mom.recoveryCode, password: 'another new password 2' }), 401, 'WRONG_DETAILS') // used up
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: mom.user.id } })).recoveryHash, null)
  assert.equal((await mom.api.get('/settings')).body.recovery, false)
})

test('T5: a wrong code, an unknown email, a child\'s username and an account with no code are the same WRONG_DETAILS, and each costs a real compare', async () => {
  const { mom, kid } = await household()
  const none = await family(server.base)
  made.push(none)
  await db.user.update({ where: { id: none.user.id }, data: { recoveryHash: null } })
  const tries = [
    { email: mom.email, code: 'AAAAAAAAAAAAAAAA', password: FRESH },
    { email: `nobody-${randomUUID()}@example.com`, code: mom.recoveryCode, password: FRESH },
    { email: kid.username, code: mom.recoveryCode, password: FRESH },
    { email: none.email, code: none.recoveryCode, password: FRESH },
    { email: 5, code: {}, password: [] },
    {},
  ]
  for (const body of tries) {
    const started = Date.now()
    const res = await as(server.base).post('/recovery', body)
    assert.deepEqual([res.status, res.body, res.headers.getSetCookie()], [401, { code: 'WRONG_DETAILS' }, []], JSON.stringify(body))
    assert.ok(Date.now() - started >= 100, 'bcrypt cost 12 takes far longer than this')
  }
  for (const who of [mom, none]) assert.equal((await as(server.base).post('/session', { identifier: who.email, password: who.password })).status, 200) // nothing changed
})

test('T5: the code is read whatever its case, dashes or spaces', async () => {
  const shapes = [(c) => c.toLowerCase(), (c) => c.match(/.{4}/g).join('-'), (c) => ` ${c.match(/.{4}/g).join(' ')} `]
  for (const shape of shapes) {
    const mom = await family(server.base)
    made.push(mom)
    assert.equal((await as(server.base).post('/recovery', { email: ` ${mom.email.toUpperCase()} `, code: shape(mom.recoveryCode), password: FRESH })).status, 204)
    await signBackIn(mom, FRESH)
  }
})

test('T5: a guessable new password is INVALID only after the right code, and the code still works afterwards', async () => {
  const mom = await family(server.base)
  made.push(mom)
  refused(await as(server.base).post('/recovery', { email: mom.email, code: 'AAAAAAAAAAAAAAAA', password: 'password' }), 401, 'WRONG_DETAILS')
  for (const [password, why] of [['password', 'common'], ['short', 'short'], ['Test Parent rocks 1', 'personal'], ['x'.repeat(73), 'length']]) {
    const res = await as(server.base).post('/recovery', { email: mom.email, code: mom.recoveryCode, password })
    assert.deepEqual([res.status, res.body], [400, { code: 'INVALID', fields: { password: why } }], password)
  }
  assert.equal((await as(server.base).post('/session', { identifier: mom.email, password: mom.password })).status, 200) // nothing changed
  assert.equal((await as(server.base).post('/recovery', { email: mom.email, code: mom.recoveryCode, password: FRESH })).status, 204)
  await signBackIn(mom, FRESH)
})

test('T5: a parent makes a new code behind the password; the old one stops; settings say whether one exists', async () => {
  const { mom, kid } = await household()
  refused(await mom.api.post('/me/recovery', { password: 'not-the-password' }), 403, 'WRONG_PASSWORD')
  refused(await kid.api.post('/me/recovery', { password: mom.password }), 403, 'NOT_ALLOWED')
  refused(await as(server.base).post('/me/recovery', { password: mom.password }), 401, 'NOT_SIGNED_IN')
  await db.user.update({ where: { id: mom.user.id }, data: { recoveryHash: null } })
  assert.equal((await mom.api.get('/settings')).body.recovery, false)
  const first = await mom.api.post('/me/recovery', { password: mom.password })
  assert.equal(first.status, 200)
  assert.deepEqual(Object.keys(first.body), ['recoveryCode'])
  assert.match(first.body.recoveryCode, /^[A-Z2-7]{16}$/)
  assert.equal((await mom.api.get('/settings')).body.recovery, true)
  const second = (await mom.api.post('/me/recovery', { password: mom.password })).body.recoveryCode
  assert.notEqual(second, first.body.recoveryCode)
  refused(await as(server.base).post('/recovery', { email: mom.email, code: first.body.recoveryCode, password: FRESH }), 401, 'WRONG_DETAILS')
  assert.equal((await as(server.base).post('/recovery', { email: mom.email, code: second, password: FRESH })).status, 204)
  await signBackIn(mom, FRESH)
})

test('T5: a paused family is refused as PAUSED, and wrong tries share the sign-in limits: the 11th from one address at one email is TOO_MANY', async () => {
  const { mom } = await household()
  await db.user.update({ where: { id: mom.user.id }, data: { pausedAt: new Date() } })
  refused(await as(server.base).post('/recovery', { email: mom.email, code: mom.recoveryCode, password: FRESH }), 403, 'PAUSED')
  refused(await as(server.base).post('/recovery', { email: mom.email, code: 'AAAAAAAAAAAAAAAA', password: FRESH }), 401, 'WRONG_DETAILS') // PAUSED only after the right code
  await db.user.update({ where: { id: mom.user.id }, data: { pausedAt: null } })
  assert.equal(await bcrypt.compare(mom.recoveryCode, (await db.user.findUniqueOrThrow({ where: { id: mom.user.id } })).recoveryHash), true) // not used up

  const guesser = as(server.base, { ip: '10.88.77.66' })
  // a new `identifier` with every try must not give each one a fresh counter: they count by the email
  for (let i = 0; i < 10; i++) refused(await guesser.post('/recovery', { email: mom.email, identifier: randomUUID(), code: 'AAAAAAAAAAAAAAAA', password: FRESH }), 401, 'WRONG_DETAILS')
  tooMany(await guesser.post('/recovery', { email: mom.email, code: mom.recoveryCode, password: FRESH }))
  tooMany(await guesser.post('/session', { identifier: mom.email, password: mom.password })) // one count with signing in
  assert.equal((await as(server.base).post('/recovery', { email: mom.email, code: mom.recoveryCode, password: FRESH })).status, 204) // another address is not held up
  await signBackIn(mom, FRESH)
})

test('T5: two resets at once with one code change the password once', async () => {
  const mom = await family(server.base)
  made.push(mom)
  const passwords = ['first new password 1', 'second new password 2']
  const both = await Promise.all(passwords.map((password) => as(server.base).post('/recovery', { email: mom.email, code: mom.recoveryCode, password })))
  assert.deepEqual(both.map((r) => r.status).sort(), [204, 401])
  const won = passwords[both.findIndex((r) => r.status === 204)]
  refused(await as(server.base).post('/session', { identifier: mom.email, password: passwords.find((p) => p !== won) }), 401, 'WRONG_DETAILS')
  await signBackIn(mom, won)
})

// ------------------------------------------------------------------ T6, a copy of the family's data

/** The entries of a stored-only zip, by name, each checked against its checksum. */
function unzip(b) {
  const end = b.length - 22
  assert.equal(b.readUInt32LE(end), 0x06054b50)
  const files = {}
  let at = b.readUInt32LE(end + 16)
  for (let i = 0; i < b.readUInt16LE(end + 10); i++) {
    assert.equal(b.readUInt32LE(at), 0x02014b50)
    const [size, nameLength, local] = [b.readUInt32LE(at + 24), b.readUInt16LE(at + 28), b.readUInt32LE(at + 42)]
    const name = b.toString('utf8', at + 46, at + 46 + nameLength)
    const data = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28)
    files[name] = b.subarray(data, data + size)
    assert.equal(crc32(files[name]), b.readUInt32LE(at + 16), name)
    at += 46 + nameLength + b.readUInt16LE(at + 30) + b.readUInt16LE(at + 32)
  }
  return files
}
const exported = async (mom) => {
  const res = await mom.api.post('/me/export', { password: mom.password })
  assert.equal(res.status, 200)
  return unzip(res.body)
}

test('T6: the export needs the password and is the parent\'s alone: a wrong password, a child, a moderator and a visitor are refused', async () => {
  const { mom, kid } = await household()
  const mod = await moderator(server.base)
  try {
    refused(await mom.api.post('/me/export', { password: 'not-the-password' }), 403, 'WRONG_PASSWORD')
    refused(await mom.api.post('/me/export', {}), 403, 'WRONG_PASSWORD')
    for (const [api, status, code] of [[kid.api, 403, 'NOT_ALLOWED'], [mod.api, 403, 'NOT_ALLOWED'], [as(server.base), 401, 'NOT_SIGNED_IN']]) {
      refused(await api.post('/me/export', { password: mom.password }), status, code)
    }
  } finally {
    await db.user.delete({ where: { id: mod.id } })
  }
})

test('T6: the zip holds each kept proof file byte for byte and family.json with the family\'s tasks, rewards and settings', async () => {
  const { mom, kid } = await household()
  const photo = await approved(mom, kid)
  const video = await approved(mom, kid, [{ bytes: mp4([]), name: 'clip.mp4' }])
  assert.equal((await mom.api.post('/rewards', { title: 'Pick the film', cost: 20 })).status, 201)
  assert.equal((await mom.api.put('/settings/keep-proof', { days: 365 })).status, 200)
  const res = await mom.api.post('/me/export', { password: mom.password })
  assert.deepEqual([res.status, res.headers.get('content-type'), res.headers.get('content-disposition')], [200, 'application/zip', 'attachment; filename="growkid-family.zip"'])
  const files = unzip(res.body)
  assert.deepEqual(Object.keys(files).sort(), ['family.json', `proofs/${photo.proofs[0].id}.png`, `proofs/${video.proofs[0].id}.mp4`].sort())
  for (const [name, bytes] of Object.entries(files)) {
    if (name.startsWith('proofs/')) assert.equal(bytes.equals(await readFile(path.join(process.env.UPLOAD_DIR, path.parse(name).name))), true, name)
  }
  const data = JSON.parse(files['family.json'])
  assert.deepEqual([data.parent.email, data.parent.keepProofDays, data.parent.recovery], [mom.email, 365, true])
  assert.deepEqual(data.children.map((c) => c.username), [kid.username])
  assert.deepEqual(data.children[0].tasks.map((t) => t.id).sort(), [photo.id, video.id].sort())
  assert.deepEqual(data.children[0].tasks.find((t) => t.id === photo.id).proofs[0].review.result, 'approved')
  assert.deepEqual(data.rewards.map((r) => r.title), ['Pick the film'])
  assert.deepEqual(data.files, { packed: 2, notPacked: 0 })
})

test('T6: family.json holds no hash, secret or token, nothing of another family, no child\'s report and no child\'s savings goal', async () => {
  const { mom, kid } = await household()
  const reward = (await mom.api.post('/rewards', { title: 'Pick the film', cost: 20 })).body
  assert.equal((await kid.api.put('/goal', { rewardId: reward.id })).status, 200)
  for (const [who, details] of [[kid, 'CHILD-REPORT-MARKER'], [mom, 'PARENT-REPORT-MARKER']]) {
    const sent = await who.api.post('/reports', { details })
    assert.equal(sent.status, 201)
    reports.push(sent.body.id)
  }
  const other = await household()
  assert.equal((await other.mom.api.post('/tasks', {
    childId: other.kid.id, category: 'chores', title: 'OTHER-FAMILY-MARKER', instructions: 'Not yours.', points: 20, dueAt: new Date(Date.now() + DAY).toISOString(),
  })).status, 201)
  const text = (await exported(mom))['family.json'].toString()
  const row = await db.user.findUniqueOrThrow({ where: { id: mom.user.id } })
  for (const banned of ['passwordHash', 'recoveryHash', 'totpSecret', 'tokenVersion', 'goalRewardId', '"goal"', row.passwordHash, row.recoveryHash, mom.recoveryCode, 'CHILD-REPORT-MARKER', 'OTHER-FAMILY-MARKER', other.kid.username, other.mom.email]) {
    assert.equal(text.includes(banned), false, banned)
  }
  assert.equal(text.includes('PARENT-REPORT-MARKER'), true) // the parent's own report is theirs
})

test('T6: a file removed for age is left out, and its proof in family.json says removed', async () => {
  const { mom, kid } = await household()
  const old = await approved(mom, kid)
  const kept = await approved(mom, kid)
  await age(old, 91)
  await removeOldProofFiles(new Date())
  const files = await exported(mom)
  assert.deepEqual(Object.keys(files).filter((name) => name.startsWith('proofs/')), [`proofs/${kept.proofs[0].id}.png`])
  const data = JSON.parse(files['family.json'])
  assert.equal(data.children[0].tasks.find((t) => t.id === old.id).proofs[0].removed.afterDays, 91)
  assert.deepEqual(data.files, { packed: 1, notPacked: 0 })
})

test('T6: export tries share the password limit', async () => {
  const { mom, kid } = await household()
  for (let i = 0; i < 5; i++) refused(await mom.api.put('/me/password', { current: 'not-the-password', next: FRESH }), 403, 'WRONG_PASSWORD')
  for (let i = 0; i < 5; i++) refused(await mom.api.post('/me/export', { password: 'not-the-password' }), 403, 'WRONG_PASSWORD')
  tooMany(await mom.api.post('/me/export', { password: mom.password }))
  // the limit holds deleting too, so this family goes straight from the database
  made.splice(made.indexOf(mom), 1)
  await db.user.deleteMany({ where: { id: { in: [kid.id, mom.user.id] } } })
})
