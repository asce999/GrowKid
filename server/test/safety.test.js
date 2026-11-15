import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import bcrypt from 'bcryptjs'
import { db } from '../src/db.js'
import { sweepOrphans } from '../src/files.js'
import { PRIVACY_VERSION } from '../src/rules.js'
import { pdf, png } from './fixtures.js'
import { as, family, start } from './helpers.js'

/** Final plan Phase 3: consent (C8), pausing a family (C6), screening every note (C7), the file headers (C2, C4), files left behind (C5) and the security log (C9). */

const root = fileURLToPath(new URL('..', import.meta.url))
const pauseFamily = (env, args = []) => spawnSync(process.execPath, ['scripts/pause-family.js', ...args], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 60_000 })

let server
const made = []
const reports = [] // a deleted family's unanswered reports are kept, so they go by id
before(async () => {
  server = await start()
})
after(async () => {
  await Promise.all(made.map((mom) => mom.api.post('/me/delete', { password: mom.password })))
  await db.report.deleteMany({ where: { id: { in: reports } } })
  await server.close()
})

const refused = (res, status, code, fields) => assert.deepEqual([res.status, res.body], [status, fields ? { code, fields } : { code }])
const DAY = 86_400_000

async function household() {
  const mom = await family(server.base)
  made.push(mom)
  const login = { name: 'Asha', username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1' }
  const added = await mom.api.post('/children', { ...login, consent: true })
  assert.equal(added.status, 201)
  const kid = as(server.base)
  assert.equal((await kid.post('/session', { identifier: login.username, password: login.password })).status, 200)
  return { mom, kid: { ...added.body, ...login, api: kid } }
}
const makeTask = async (mom, kid, points = 20) =>
  (await mom.api.post('/tasks', { childId: kid.id, category: 'chores', title: 'Tidy the room', instructions: 'Floor clear.', dueAt: new Date(Date.now() + 2 * DAY).toISOString(), points })).body
const inReview = async (mom, kid, upload) => {
  const task = await makeTask(mom, kid)
  const sent = await kid.api.form(`/tasks/${task.id}/proofs`, { note: 'Done' }, upload)
  assert.equal(sent.status, 201)
  return { id: task.id, proofId: sent.body.proofs.at(-1).id, proof: sent.body.proofs.at(-1) }
}

/** Runs `work` and returns every line it logged through console.warn and console.error, as well as letting them through. */
async function logged(work) {
  const lines = []
  const [warn, error] = [console.warn, console.error]
  console.warn = (...parts) => lines.push(parts.join(' '))
  console.error = (...parts) => lines.push(parts.join(' '))
  try {
    await work()
  } finally {
    ;[console.warn, console.error] = [warn, error]
  }
  return lines
}

// ------------------------------------------------------------------ C8, consent

test('C8: sign-up and adding a child are refused without the consent tick, and a tick stamps the time and the privacy version', async () => {
  const details = { name: 'Rani', email: `c-${randomUUID()}@example.com`, password: 'grown-up-pass-1', country: 'IN' }
  for (const consent of [undefined, false, 'true', 1]) {
    refused(await as(server.base).post('/parents', { ...details, consent }), 400, 'INVALID', { consent: 'required' })
  }
  assert.equal(await db.user.count({ where: { email: details.email } }), 0)
  const mom = await family(server.base, details)
  made.push(mom)
  const parent = await db.user.findUniqueOrThrow({ where: { email: details.email } })
  assert.equal(parent.consentVersion, PRIVACY_VERSION)
  assert.ok(Math.abs(parent.consentAt - Date.now()) < 60_000)

  const child = { name: 'Dev', username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1' }
  refused(await mom.api.post('/children', child), 400, 'INVALID', { consent: 'required' })
  assert.equal(await db.user.count({ where: { username: child.username } }), 0)
  assert.equal((await mom.api.post('/children', { ...child, consent: true })).status, 201)
  const row = await db.user.findUniqueOrThrow({ where: { username: child.username } })
  assert.deepEqual([row.consentVersion, Math.abs(row.consentAt - Date.now()) < 60_000], [PRIVACY_VERSION, true])
})

// ------------------------------------------------------------------ C6, pausing a family

test('C6: pause-family pauses the family of a report\'s sender: every device is signed out, sign-in is PAUSED, the rows stay, and unpausing restores it', async () => {
  const { mom, kid } = await household()
  const held = await inReview(mom, kid, { bytes: png(), name: 'a.png' })
  const report = await kid.api.post('/reports', { details: 'Something is wrong here' })
  assert.equal(report.status, 201)
  reports.push(report.body.id)

  const off = pauseFamily({ REPORT_ID: report.body.id, ACTION: 'pause' })
  assert.deepEqual([off.status, off.stdout, off.stderr], [0, 'paused\n', ''])
  refused(await mom.api.get('/children'), 401, 'NOT_SIGNED_IN') // signed out on this device
  refused(await kid.api.get('/tasks'), 401, 'NOT_SIGNED_IN')

  const lines = await logged(async () => {
    refused(await as(server.base).post('/session', { identifier: kid.username, password: kid.password }), 403, 'PAUSED')
    refused(await as(server.base).post('/session', { identifier: mom.email, password: mom.password }), 403, 'PAUSED')
  })
  refused(await as(server.base).post('/session', { identifier: kid.username, password: 'not-the-password' }), 401, 'WRONG_DETAILS') // PAUSED only after the right password
  assert.deepEqual(lines, ['security paused-sign-in POST /api/session', 'security paused-sign-in POST /api/session']) // C9
  // nothing was deleted or changed: the evidence stays
  const task = await db.task.findUniqueOrThrow({ where: { id: held.id }, include: { proofs: true } })
  assert.deepEqual([task.status, task.proofs.length, (await readdir(process.env.UPLOAD_DIR)).includes(held.proofId)], ['review', 1, true])

  const on = pauseFamily({ REPORT_ID: report.body.id, ACTION: 'unpause' })
  assert.deepEqual([on.status, on.stdout, on.stderr], [0, 'unpaused\n', ''])
  const back = as(server.base)
  assert.equal((await back.post('/session', { identifier: kid.username, password: kid.password })).status, 200)
  assert.equal((await back.get('/tasks')).body.length, 1)
  assert.equal((await mom.api.post('/session', { identifier: mom.email, password: mom.password })).status, 200)
})

test('C6: a child whose parent alone is paused counts as paused', async () => {
  const { mom, kid } = await household()
  await db.user.update({ where: { id: mom.user.id }, data: { pausedAt: new Date() } }) // as if the child had been added after the pause
  refused(await kid.api.get('/tasks'), 401, 'NOT_SIGNED_IN')
  refused(await as(server.base).post('/session', { identifier: kid.username, password: kid.password }), 403, 'PAUSED')
  await db.user.update({ where: { id: mom.user.id }, data: { pausedAt: null } })
  assert.equal((await kid.api.get('/tasks')).status, 200) // the cookie was never revoked here, only refused while paused
})

test('C6: pause-family refuses a missing action, an unknown report, argv, a deleted sender and a moderator\'s report, and changes nothing', async () => {
  const { mom, kid } = await household()
  const report = await mom.api.post('/reports', { details: 'A question' })
  reports.push(report.body.id)
  for (const [env, args, why] of [
    [{ REPORT_ID: report.body.id, ACTION: '' }, [], /ACTION to pause or unpause/],
    [{ REPORT_ID: report.body.id, ACTION: 'delete' }, [], /ACTION to pause or unpause/],
    [{ REPORT_ID: '', ACTION: '' }, [report.body.id, 'pause'], /REPORT_ID/], // argv is never read
    [{ REPORT_ID: randomUUID(), ACTION: 'pause' }, [], /no report has that id/],
  ]) {
    const out = pauseFamily(env, args)
    assert.deepEqual([out.status, out.stdout], [1, ''])
    assert.match(out.stderr, why)
  }
  assert.equal((await kid.api.get('/tasks')).status, 200) // still signed in: nothing was paused

  const gone = await family(server.base)
  const orphan = await gone.api.post('/reports', { details: 'Kept after the family goes' })
  reports.push(orphan.body.id)
  assert.equal((await gone.api.post('/me/delete', { password: gone.password })).status, 204)
  const none = pauseFamily({ REPORT_ID: orphan.body.id, ACTION: 'pause' })
  assert.deepEqual([none.status, none.stdout], [1, ''])
  assert.match(none.stderr, /sender of that report has been deleted/)

  const modEmail = `mod-${randomUUID()}@example.com`
  const mod = await db.user.create({ data: { role: 'moderator', name: 'Mod', email: modEmail, passwordHash: await bcrypt.hash('x', 4), createdAt: new Date() } })
  const theirs = await db.report.create({ data: { byId: mod.id, from: 'parent', details: 'odd', sentAt: new Date() } })
  const byMod = pauseFamily({ REPORT_ID: theirs.id, ACTION: 'pause' })
  assert.deepEqual([byMod.status, byMod.stdout], [1, ''])
  assert.match(byMod.stderr, /a moderator sent that report/)
  await db.report.delete({ where: { id: theirs.id } })
  await db.user.delete({ where: { id: mod.id } })
})

// ------------------------------------------------------------------ C7, every note a child reads is screened

test('C7: a cheer line, a send-back note and a decline note with a blocked word are SCREENED, and nothing changes', async () => {
  const { mom, kid } = await household()
  const held = await inReview(mom, kid)
  const answer = (body) => mom.api.post(`/tasks/${held.id}/review`, { proofId: held.proofId, ...body })
  refused(await answer({ result: 'approved', cheer: { kind: 'proud', line: 'Our little secret' } }), 400, 'SCREENED', { word: 'secret' })
  refused(await answer({ result: 'sentBack', note: 'Don’t tell Dad about this one' }), 400, 'SCREENED', { word: "don't tell" })
  assert.equal((await mom.api.get(`/tasks/${held.id}`)).body.status, 'review')
  assert.equal((await answer({ result: 'approved', cheer: { kind: 'proud', line: 'The secretary would be proud' } })).status, 200) // a whole word only

  await kid.api.post('/tasks/seen', { taskIds: [held.id] }) // the approval is shown, so its points can be spent
  const reward = await mom.api.post('/rewards', { title: 'Film night', cost: 10 })
  const request = await kid.api.post('/requests', { rewardId: reward.body.id })
  assert.equal(request.status, 201)
  refused(await mom.api.post(`/requests/${request.body.id}/answer`, { result: 'declined', note: 'Take a dare first' }), 400, 'SCREENED', { word: 'dare' })
  assert.equal((await db.rewardRequest.findUniqueOrThrow({ where: { id: request.body.id } })).status, 'requested')
  assert.equal((await mom.api.post(`/requests/${request.body.id}/answer`, { result: 'declined', note: 'Not this week' })).status, 200)
})

// ------------------------------------------------------------------ C2 and C4, how a file is sent back

test('C4: a proof file carries its own CSP and CORP; C2: a PDF stored before PDFs were dropped downloads as proof.pdf', async () => {
  const { mom, kid } = await household()
  const held = await inReview(mom, kid, { bytes: png(), name: 'a.png' })
  const photo = await mom.api.get(`/proofs/${held.proofId}/file`)
  assert.equal(photo.status, 200)
  assert.equal(photo.headers.get('content-security-policy'), "default-src 'none'; img-src 'self'; media-src 'self'; sandbox")
  assert.equal(photo.headers.get('cross-origin-resource-policy'), 'same-origin')
  assert.equal(photo.headers.get('content-disposition'), 'inline')

  const old = await makeTask(mom, kid)
  const id = randomUUID()
  await writeFile(path.join(process.env.UPLOAD_DIR, id), pdf(), { flag: 'wx' })
  await db.proof.create({ data: { id, taskId: old.id, fileName: 'homework.pdf', fileType: 'application/pdf', fileSize: pdf().length, sentAt: new Date(), late: false } })
  for (const viewer of [mom.api, kid.api]) {
    const doc = await viewer.get(`/proofs/${id}/file`)
    assert.equal(doc.status, 200)
    assert.equal(doc.headers.get('content-disposition'), 'attachment; filename="proof.pdf"')
    assert.equal(doc.headers.get('content-type'), 'application/pdf')
    assert.ok(doc.body.equals(pdf()))
  }
})

// ------------------------------------------------------------------ C5, files left behind

test('C5: sweepOrphans removes only settled id-shaped files that no proof with a file names, leaves every other file, and removes nothing when too many would go', async () => {
  const { mom, kid } = await household()
  const withFile = await inReview(mom, kid, { bytes: png(), name: 'a.png' })
  const noteOnly = await inReview(mom, kid) // a proof row with no file: its id on disk is an orphan
  const dir = await mkdtemp(path.join(tmpdir(), 'growkid-sweep-'))
  const old = new Date(Date.now() - 2 * 60 * 60_000) // two hours ago: settled
  const put = async (name, when = old) => {
    await writeFile(path.join(dir, name), 'x')
    await utimes(path.join(dir, name), when, when)
  }
  try {
    const stray = randomUUID()
    const fresh = randomUUID() // written a moment ago: perhaps still on its way to its row
    for (const name of [withFile.proofId, noteOnly.proofId, stray, 'notes.txt', `${randomUUID()}.jpg`]) await put(name)
    await put(fresh, new Date())
    await mkdir(path.join(dir, randomUUID())) // a folder is never touched
    assert.equal(await sweepOrphans(dir), 2)
    const left = await readdir(dir)
    assert.equal(left.length, 5)
    assert.ok(left.includes(withFile.proofId) && left.includes('notes.txt') && left.includes(fresh) && !left.includes(stray) && !left.includes(noteOnly.proofId))
    assert.equal(await sweepOrphans(dir), 0)

    // eleven at once is the wrong database, not a crash: nothing goes, and the log says so without a name
    const many = Array.from({ length: 11 }, () => randomUUID())
    for (const name of many) await put(name)
    let swept
    const lines = await logged(async () => {
      swept = await sweepOrphans(dir)
    })
    assert.equal(swept, 0)
    assert.equal((await readdir(dir)).filter((name) => many.includes(name)).length, 11)
    assert.deepEqual(lines.length, 1)
    assert.match(lines[0], /left 11 proof files .* wrong database/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

// ------------------------------------------------------------------ C9, the security log

test('C9: a limit that trips and a moderator signing in each log one line holding no email, username or address', async () => {
  const ip = '10.77.66.55'
  const email = `nobody-${randomUUID()}@example.com`
  const guesser = as(server.base, { ip })
  const lines = await logged(async () => {
    for (let i = 0; i < 10; i++) assert.equal((await guesser.post('/session', { identifier: email, password: 'wrong-guess' })).status, 401)
    for (let i = 0; i < 3; i++) assert.equal((await guesser.post('/session', { identifier: email, password: 'wrong-guess' })).status, 429)
  })
  assert.deepEqual(lines, ['security limit:sign-in POST /api/session']) // once per trip, however many tries follow

  const modEmail = `mod-${randomUUID()}@example.com`
  const mod = await db.user.create({ data: { role: 'moderator', name: 'Mod', email: modEmail, passwordHash: await bcrypt.hash('moderator-pass', 4), createdAt: new Date() } })
  try {
    const signIn = await logged(async () => assert.equal((await as(server.base, { ip }).post('/session', { identifier: modEmail, password: 'moderator-pass' })).status, 200))
    assert.deepEqual(signIn, ['security moderator-sign-in POST /api/session'])
    for (const line of [...lines, ...signIn]) for (const secret of [email, modEmail, ip, 'nobody', 'Mod']) assert.equal(line.includes(secret), false)
  } finally {
    await db.user.delete({ where: { id: mod.id } })
  }
})
