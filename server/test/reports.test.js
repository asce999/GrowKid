import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { db } from '../src/db.js'
import { png } from './fixtures.js'
import { as, family, moderator as newModerator, start } from './helpers.js'

let server
let moderator
let moderatorId
const made = [] // every family this file makes, erased at the end so the upload folder ends empty
const reportIds = [] // every report it makes, removed at the end by id: an unanswered one outlives its sender
before(async () => {
  server = await start()
  ;({ id: moderatorId, api: moderator } = await newModerator(server.base)) // T1: signed in with a code
})
after(async () => {
  await Promise.all(made.map((mom) => mom.api.post('/me/delete', { password: mom.password }))) // a no-op for a family a test already erased
  await db.report.deleteMany({ where: { id: { in: reportIds } } })
  await db.moderatorAction.deleteMany({ where: { moderatorId } }) // T3: a test may; the app never does
  await db.user.deleteMany({ where: { id: moderatorId } })
  await server.close()
})

const DAY = 86_400_000
const refused = (res, status, code) => {
  assert.equal(res.status, status)
  // L2: a counted limit also says how many whole minutes are left
  if (code === 'TOO_MANY') return assert.ok(res.body.code === code && Number.isInteger(res.body.fields.minutes) && res.body.fields.minutes >= 1, JSON.stringify(res.body))
  assert.deepEqual(res.body, { code })
}
const invalid = (res, fields) => {
  assert.equal(res.status, 400)
  assert.deepEqual(res.body, { code: 'INVALID', fields })
}
const ITEM_KEYS = ['dueAt', 'instructions', 'notes', 'points', 'proofs', 'title']
/** Sends a report as this person and remembers its id for `after`. */
const sendReport = async (who, body) => {
  const res = await who.api.post('/reports', body)
  if (res.body?.id) reportIds.push(res.body.id)
  return res
}
/** The moderator's copy of one report, from the list of those waiting. */
const seenByModerator = async (id) => (await moderator.get('/reports')).body.reports.find((r) => r.id === id)

async function addChild(mom, name = 'Kid', ip) {
  const sent = { name, username: `k${randomUUID().slice(0, 8)}`, password: 'small-secret-1', consent: true }
  const res = await mom.api.post('/children', sent)
  assert.equal(res.status, 201)
  const api = as(server.base, { ip })
  assert.equal((await api.post('/session', { identifier: sent.username, password: sent.password })).status, 200)
  return { ...res.body, api }
}
async function household(name, ip) {
  const mom = await family(server.base)
  made.push(mom)
  return { mom, kid: await addChild(mom, name, ip) }
}
/**
 * A task whose proof was sent back with a note and sent again with a file and a note of the child's own: the parent's words, the
 * child's words and a file name all exist on it, and only the parent's words may travel with a report.
 */
async function worked(mom, kid) {
  const task = (await mom.api.post('/tasks', {
    childId: kid.id, category: 'study', title: 'Read a chapter', instructions: 'Chapter three, aloud.', points: 20, dueAt: new Date(Date.now() + DAY).toISOString(),
  })).body
  const first = await kid.api.form(`/tasks/${task.id}/proofs`, { note: 'CHILD-NOTE-ONE' })
  const back = await mom.api.post(`/tasks/${task.id}/review`, { proofId: first.body.proofs[0].id, result: 'sentBack', note: 'Read it again.' })
  assert.equal(back.status, 200)
  const second = await kid.api.form(`/tasks/${task.id}/proofs`, { note: 'CHILD-NOTE-TWO' }, { bytes: png(), name: 'me-reading.png' })
  assert.equal(second.status, 201)
  return task.id
}

test('a child\'s report about their task reaches the moderator as words only: no id, name, file or child\'s note; the parent never sees it', async () => {
  const { mom, kid } = await household('Kid')
  const taskId = await worked(mom, kid)
  const sent = await sendReport(kid, { details: '  Something felt wrong.  ', taskId })
  assert.equal(sent.status, 201)
  assert.deepEqual(Object.keys(sent.body).sort(), ['details', 'from', 'id', 'item', 'sentAt'])
  assert.deepEqual([sent.body.from, sent.body.details], ['child', 'Something felt wrong.'])
  assert.deepEqual(Object.keys(sent.body.item).sort(), ITEM_KEYS)
  assert.deepEqual([sent.body.item.title, sent.body.item.notes, sent.body.item.proofs], ['Read a chapter', ['Read it again.'], 2])

  const copy = await seenByModerator(sent.body.id)
  assert.deepEqual(copy, sent.body) // the moderator is given exactly that, sender still here
  const wording = JSON.stringify(copy)
  for (const leak of [kid.id, mom.user.id, taskId, 'Kid', 'Test Parent', 'CHILD-NOTE', 'me-reading', 'image/png']) assert.equal(wording.includes(leak), false, leak)
  assert.equal('byId' in copy, false)

  // the parent: nothing in their list, no reports page, and the child's report is not theirs
  assert.deepEqual((await mom.api.get('/reports/mine')).body, [])
  refused(await mom.api.get('/reports'), 403, 'NOT_ALLOWED')
  refused(await mom.api.post(`/reports/${sent.body.id}/resolve`, { note: 'x' }), 403, 'NOT_ALLOWED')
  assert.deepEqual((await kid.api.get('/reports/mine')).body, [sent.body])

  // a copy made at that moment: a later edit or delete of the task changes nothing
  assert.equal((await mom.api.del(`/tasks/${taskId}`)).status, 204)
  assert.deepEqual((await seenByModerator(sent.body.id)).item, sent.body.item)
})

test('a parent\'s report, a report from no task, and a task the sender cannot see: the task is left out without a word and the report still goes', async () => {
  const { mom, kid } = await household('Kid')
  const sibling = await addChild(mom, 'Sibling')
  const stranger = await household('Other')
  const own = await worked(mom, kid)
  const theirs = await worked(stranger.mom, stranger.kid)
  const parentReport = await sendReport(mom, { details: 'A question about this one.', taskId: own })
  assert.deepEqual([parentReport.status, parentReport.body.from, Object.keys(parentReport.body.item).sort()], [201, 'parent', ITEM_KEYS]) // a parent sees the family's tasks
  const plain = await sendReport(kid, { details: 'No task.' })
  assert.deepEqual([plain.status, 'item' in plain.body], [201, false])
  for (const taskId of [theirs, own, 'nope', 123, '', null]) {
    const who = taskId === own ? sibling : kid // a sibling's task, another family's, one that does not exist, the wrong type, none
    const res = await sendReport(who, { details: 'Sent anyway.', taskId })
    assert.deepEqual([res.status, 'item' in res.body], [201, false], String(taskId))
  }
  assert.equal(await db.report.count({ where: { byId: kid.id } }), 6)
  assert.equal(JSON.stringify(await seenByModerator(parentReport.body.id)).includes(mom.user.id), false)
})

test('sendReport: details are 1 to 1000 characters of text; a moderator cannot report; signed out is NOT_SIGNED_IN', async () => {
  const { kid } = await household('Kid')
  for (const details of [undefined, '', '   ', 123, null, ['x']]) invalid(await sendReport(kid, { details }), { details: 'required' })
  invalid(await sendReport(kid, { details: 'x'.repeat(1001) }), { details: 'length' })
  assert.equal((await sendReport(kid, { details: 'x'.repeat(1000) })).status, 201)
  assert.equal((await sendReport(kid, { details: 'Two\0 lines \ud800' })).status, 201) // a NUL or a lone surrogate is repaired, not a 500
  refused(await moderator.post('/reports', { details: 'Hello' }), 403, 'NOT_ALLOWED')
  refused(await as(server.base).post('/reports', { details: 'Hello' }), 401, 'NOT_SIGNED_IN')
  refused(await as(server.base).get('/reports/mine'), 401, 'NOT_SIGNED_IN')
})

test('listMyReports: only your own, newest first, each with the moderator\'s answer once there is one; a moderator has none', async () => {
  const { mom, kid } = await household('Kid')
  const first = (await sendReport(kid, { details: 'First.' })).body
  await sendReport(kid, { details: 'Second.' })
  await sendReport(mom, { details: 'The parent\'s.' })
  assert.deepEqual((await kid.api.get('/reports/mine')).body.map((r) => r.details), ['Second.', 'First.'])
  assert.deepEqual((await mom.api.get('/reports/mine')).body.map((r) => r.details), ['The parent\'s.'])
  assert.deepEqual((await moderator.get('/reports/mine')).body, [])
  assert.ok(await seenByModerator(first.id)) // waiting: on the moderator's list
  const answered = await moderator.post(`/reports/${first.id}/resolve`, { note: '  Thank you for telling us.  ' })
  assert.equal(answered.status, 200)
  assert.deepEqual([answered.body.resolution.note, typeof answered.body.resolution.at, 'senderGone' in answered.body], ['Thank you for telling us.', 'string', false])
  assert.deepEqual((await kid.api.get('/reports/mine')).body.map((r) => [r.details, r.resolution?.note]), [['Second.', undefined], ['First.', 'Thank you for telling us.']])
  assert.equal(await seenByModerator(first.id), undefined) // answered: no longer on the moderator's list, but kept for the sender to read
  assert.equal((await db.report.findUniqueOrThrow({ where: { id: first.id } })).resolutionNote, 'Thank you for telling us.')
})

test('resolveReport: only the moderator; NOT_FOUND, then LOCKED, then the note is checked; two answers at once land once', async () => {
  const { kid } = await household('Kid')
  const report = (await sendReport(kid, { details: 'Please look.' })).body
  const resolve = (id, note, who = moderator) => who.post(`/reports/${id}/resolve`, { note })
  refused(await resolve(report.id, 'x', kid.api), 403, 'NOT_ALLOWED')
  refused(await resolve(report.id, 'x', as(server.base)), 401, 'NOT_SIGNED_IN')
  refused(await resolve('nope', 'x'), 404, 'NOT_FOUND')
  refused(await resolve(randomUUID(), 'x'), 404, 'NOT_FOUND')
  invalid(await resolve(report.id, ''), { note: 'required' })
  invalid(await resolve(report.id, '   '), { note: 'required' })
  invalid(await resolve(report.id, 'x'.repeat(501)), { note: 'length' })
  invalid(await resolve(report.id, 42), { note: 'required' })
  const both = await Promise.all([resolve(report.id, 'One.'), resolve(report.id, 'Two.')])
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 409])
  assert.deepEqual(both.find((r) => r.status === 409).body, { code: 'LOCKED' })
  refused(await resolve(report.id, 'Three.'), 409, 'LOCKED')
  refused(await resolve(report.id, ''), 409, 'LOCKED') // LOCKED comes before the note is read
})

test('a kept report whose sender was deleted says senderGone to the moderator, and answering it deletes it; an answered one goes with its sender', async () => {
  const { mom, kid } = await household('Kid')
  const orphan = (await sendReport(kid, { details: 'Something felt wrong.' })).body
  const answered = (await sendReport(kid, { details: 'Already answered.' })).body
  assert.equal((await moderator.post(`/reports/${answered.id}/resolve`, { note: 'Done.' })).status, 200)
  assert.equal((await mom.api.del(`/children/${kid.id}`)).status, 204)
  assert.equal(await db.report.count({ where: { id: answered.id } }), 0) // answered: gone with its sender
  const kept = await db.report.findUniqueOrThrow({ where: { id: orphan.id } })
  assert.deepEqual([kept.byId, kept.from, kept.details], [null, 'child', 'Something felt wrong.'])
  const copy = await seenByModerator(orphan.id)
  assert.equal(copy.senderGone, true)
  assert.equal('byId' in copy, false)
  assert.equal(JSON.stringify(copy).includes(kid.id), false)
  const done = await moderator.post(`/reports/${orphan.id}/resolve`, { note: 'We looked at it.' })
  assert.equal(done.status, 200)
  assert.deepEqual([done.body.senderGone, done.body.resolution.note, done.body.details], [true, 'We looked at it.', 'Something felt wrong.'])
  assert.equal(await seenByModerator(orphan.id), undefined) // nobody is left to read the answer, so it goes
  assert.equal(await db.report.count({ where: { id: orphan.id } }), 0)
  refused(await moderator.post(`/reports/${orphan.id}/resolve`, { note: 'Again.' }), 404, 'NOT_FOUND')
})

test('answering a report while its sender is deleted never leaves an answered report without a sender', async () => {
  const { mom } = await household('Kid')
  for (let round = 0; round < 4; round++) {
    const kid = await addChild(mom, `Child ${round}`)
    const report = (await sendReport(kid, { details: 'Racing.' })).body
    const [answer, removal] = await Promise.all([moderator.post(`/reports/${report.id}/resolve`, { note: 'Answer.' }), mom.api.del(`/children/${kid.id}`)])
    assert.equal(answer.status, 200)
    assert.equal(removal.status, 204)
    assert.equal(await db.report.count({ where: { id: report.id } }), 0, `round ${round}`) // answered by the end: the sender was deleted, so it goes
  }
})

test('two answers at once to a report with no sender give one 200; the other finds it answered or already gone', async () => {
  for (let round = 0; round < 6; round++) {
    const orphan = await db.report.create({ data: { byId: null, from: 'child', details: 'Kept.', sentAt: new Date() } })
    reportIds.push(orphan.id)
    const both = await Promise.all([moderator.post(`/reports/${orphan.id}/resolve`, { note: 'One.' }), moderator.post(`/reports/${orphan.id}/resolve`, { note: 'Two.' })])
    const [won, lost] = both.sort((a, b) => a.status - b.status)
    assert.deepEqual([won.status, won.body.senderGone], [200, true])
    assert.ok([404, 409].includes(lost.status) && ['NOT_FOUND', 'LOCKED'].includes(lost.body.code), `round ${round}`)
    assert.equal(await db.report.count({ where: { id: orphan.id } }), 0)
  }
})

test('the 11th report from one user within the hour is refused TOO_MANY; another user is not held up, and nothing was stored for the 11th', async () => {
  const ip = '203.0.113.7' // both children send from one address, so a limit per address would hold the second one up too
  const { kid } = await household('Kid', ip)
  const other = await household('Other', ip)
  for (let n = 1; n <= 10; n++) assert.equal((await sendReport(kid, { details: `Report ${n}.` })).status, 201, `report ${n}`)
  refused(await sendReport(kid, { details: 'Report 11.' }), 429, 'TOO_MANY')
  assert.equal(await db.report.count({ where: { byId: kid.id } }), 10)
  assert.equal((await sendReport(other.kid, { details: 'Mine.' })).status, 201) // the count is per user, not per address or per family
})

test('refused reports do not count toward the limit: 10 refused as INVALID, and a valid one still goes', async () => {
  const { kid } = await household('Kid')
  for (let n = 1; n <= 10; n++) invalid(await sendReport(kid, { details: '' }), { details: 'required' })
  assert.equal((await sendReport(kid, { details: 'Now a real one.' })).status, 201)
})

test('a request with no body at all gets the normal refusal, never a 500 (Express 5 leaves req.body undefined)', async () => {
  const { mom, kid } = await household('Kid')
  const task = (await mom.api.post('/tasks', {
    childId: kid.id, category: 'study', title: 'Read a chapter', instructions: 'Chapter three.', points: 20, dueAt: new Date(Date.now() + DAY).toISOString(),
  })).body
  const cheap = (await mom.api.post('/rewards', { title: 'Extra time', cost: 10 })).body
  const report = (await sendReport(kid, { details: 'Please look.' })).body
  const bare = [
    [as(server.base), 'post', '/session'], [as(server.base), 'post', '/parents'],
    [mom.api, 'patch', '/me'], [mom.api, 'put', '/me/password'], [mom.api, 'put', '/settings'], [mom.api, 'put', '/settings/country'],
    [mom.api, 'post', '/children'], [mom.api, 'patch', `/children/${kid.id}`], [mom.api, 'put', `/children/${kid.id}/password`],
    [mom.api, 'post', `/children/${kid.id}/rest-days`], [mom.api, 'post', '/tasks'], [mom.api, 'put', `/tasks/${task.id}`],
    [mom.api, 'post', `/tasks/${task.id}/review`], [mom.api, 'post', '/rewards'], [mom.api, 'post', '/reports'],
    [kid.api, 'post', '/tasks/seen'], [kid.api, 'put', '/pin'], [kid.api, 'post', '/requests'], [kid.api, 'post', '/reports'],
    [moderator, 'post', `/reports/${report.id}/resolve`],
  ]
  for (const [client, method, url] of bare) {
    const res = await client[method](url)
    assert.ok(res.status >= 400 && res.status < 500, `${method} ${url} gave ${res.status}`)
  }
  // answering needs a request to exist, and deleting the family goes last
  const request = await db.rewardRequest.create({ data: { childId: kid.id, parentId: mom.user.id, rewardId: cheap.id, title: cheap.title, cost: cheap.cost, requestedAt: new Date() } })
  assert.equal((await mom.api.post(`/requests/${request.id}/answer`)).status, 400)
  assert.equal((await mom.api.post('/me/delete')).status, 403)
})

// ------------------------------------------------------------------ T2, pausing from the moderator's page

const pauseIt = (id, action = 'pause', who = moderator) => who.post(`/reports/${id}/${action}`)
/** A paused parent was signed out; after() deletes the family through the parent's own client, so it signs in again. */
const signBackIn = async (mom) => assert.equal((await mom.api.post('/session', { identifier: mom.email, password: mom.password })).status, 200)
const KID_PASSWORD = 'small-secret-1' // addChild's

test('T2: a moderator pauses and unpauses the family of a report\'s sender: every device is signed out, sign-in is PAUSED, the report says paused and names nobody, nothing is deleted, and unpausing restores sign-in', async () => {
  const { mom, kid } = await household('Kid')
  const task = (await mom.api.post('/tasks', {
    childId: kid.id, category: 'study', title: 'Read a chapter', instructions: 'Chapter three.', points: 20, dueAt: new Date(Date.now() + DAY).toISOString(),
  })).body
  const report = (await sendReport(kid, { details: 'Please look.', taskId: task.id })).body
  const paused = await pauseIt(report.id)
  assert.equal(paused.status, 200)
  assert.equal(paused.body.paused, true)
  for (const key of Object.keys(paused.body)) assert.ok(['id', 'from', 'details', 'sentAt', 'item', 'paused'].includes(key), key)
  for (const secret of [kid.id, kid.username, mom.user.id, mom.email, 'Kid', 'Test Parent']) assert.equal(JSON.stringify(paused.body).includes(secret), false, secret)
  refused(await mom.api.get('/children'), 401, 'NOT_SIGNED_IN') // signed out on every device
  refused(await kid.api.get('/tasks'), 401, 'NOT_SIGNED_IN')
  refused(await as(server.base).post('/session', { identifier: mom.email, password: mom.password }), 403, 'PAUSED')
  refused(await as(server.base).post('/session', { identifier: kid.username, password: KID_PASSWORD }), 403, 'PAUSED')
  assert.equal((await seenByModerator(report.id)).paused, true)
  // nothing of theirs is deleted or changed
  const row = await db.task.findUniqueOrThrow({ where: { id: task.id } })
  assert.deepEqual([row.status, row.title, await db.user.count({ where: { id: { in: [mom.user.id, kid.id] } } })], ['todo', 'Read a chapter', 2])

  const back = await pauseIt(report.id, 'unpause')
  assert.equal(back.status, 200)
  assert.equal('paused' in back.body, false)
  assert.equal((await seenByModerator(report.id)).paused, undefined)
  await signBackIn(mom)
  assert.equal((await as(server.base).post('/session', { identifier: kid.username, password: KID_PASSWORD })).status, 200)
  // a page out of date unpauses again: nobody is signed out
  assert.equal((await pauseIt(report.id, 'unpause')).status, 200)
  assert.equal((await mom.api.get('/children')).status, 200)
})

test('T2: pause and unpause are the moderator\'s alone; an unknown report and one whose sender is gone are NOT_FOUND', async () => {
  const { mom, kid } = await household('Kid')
  const report = (await sendReport(kid, { details: 'Please look.' })).body
  for (const action of ['pause', 'unpause']) {
    refused(await pauseIt(report.id, action, mom.api), 403, 'NOT_ALLOWED')
    refused(await pauseIt(report.id, action, kid.api), 403, 'NOT_ALLOWED')
    refused(await pauseIt(report.id, action, as(server.base)), 401, 'NOT_SIGNED_IN')
    refused(await pauseIt(randomUUID(), action), 404, 'NOT_FOUND')
    refused(await pauseIt('nope', action), 404, 'NOT_FOUND')
  }
  assert.equal((await kid.api.get('/tasks')).status, 200) // nothing was paused
  const gone = await household('Gone')
  const orphan = (await sendReport(gone.kid, { details: 'Kept after the family goes.' })).body
  assert.equal((await gone.mom.api.post('/me/delete', { password: gone.mom.password })).status, 204)
  for (const action of ['pause', 'unpause']) refused(await pauseIt(orphan.id, action), 404, 'NOT_FOUND')
  const answered = (await sendReport(kid, { details: 'Answered already.' })).body
  assert.equal((await moderator.post(`/reports/${answered.id}/resolve`, { note: 'Done.' })).status, 200)
  for (const action of ['pause', 'unpause']) refused(await pauseIt(answered.id, action), 404, 'NOT_FOUND') // only a waiting report pauses
  assert.equal((await kid.api.get('/tasks')).status, 200)
  assert.equal(await db.moderatorAction.count({ where: { reportId: { in: [report.id, orphan.id] }, action: { not: 'answer' } } }), 0) // a refusal leaves no record
})

test('T2: a report cannot be answered while its family is paused (LOCKED), and can be once it is unpaused', async () => {
  const { mom, kid } = await household('Kid')
  const report = (await sendReport(kid, { details: 'Please look.' })).body
  assert.equal((await pauseIt(report.id)).status, 200)
  refused(await moderator.post(`/reports/${report.id}/resolve`, { note: 'An answer.' }), 409, 'LOCKED')
  assert.equal((await db.report.findUniqueOrThrow({ where: { id: report.id } })).resolvedAt, null)
  assert.equal((await pauseIt(report.id, 'unpause')).status, 200)
  const done = await moderator.post(`/reports/${report.id}/resolve`, { note: 'An answer.' })
  assert.deepEqual([done.status, done.body.resolution?.note], [200, 'An answer.'])
  await signBackIn(mom)
})

test('T2: both reports of one family say paused, whichever of them it was paused from', async () => {
  const { mom, kid } = await household('Kid')
  const fromKid = (await sendReport(kid, { details: 'From the child.' })).body
  const fromMom = (await sendReport(mom, { details: 'From the parent.' })).body
  const other = await household('Other')
  const unrelated = (await sendReport(other.kid, { details: 'Another family.' })).body
  const states = async () => Promise.all([fromKid, fromMom, unrelated].map(async ({ id }) => (await seenByModerator(id)).paused))
  for (const [from, to] of [[fromKid, fromMom], [fromMom, fromKid]]) {
    assert.equal((await pauseIt(from.id)).status, 200)
    assert.deepEqual(await states(), [true, true, undefined])
    assert.equal((await pauseIt(to.id, 'unpause')).status, 200) // unpaused from the other report
    assert.deepEqual(await states(), [undefined, undefined, undefined])
  }
  await signBackIn(mom)
})

// ------------------------------------------------------------------ T3, the moderator's record and a list with no hidden end

test('T3: answering, pausing and unpausing each leave one row: which moderator, which report, what and when', async () => {
  const { mom, kid } = await household('Kid')
  const report = (await sendReport(kid, { details: 'Please look.' })).body
  assert.equal((await pauseIt(report.id)).status, 200)
  assert.equal((await pauseIt(report.id, 'unpause')).status, 200)
  assert.equal((await moderator.post(`/reports/${report.id}/resolve`, { note: 'Answered.' })).status, 200)
  const rows = await db.moderatorAction.findMany({ where: { reportId: report.id } })
  assert.deepEqual(rows.map((row) => row.action).sort(), ['answer', 'pause', 'unpause'])
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), ['action', 'at', 'id', 'moderatorId', 'reportId']) // no words and no names
    assert.deepEqual([row.moderatorId, Math.abs(row.at - Date.now()) < 60_000], [moderatorId, true])
  }
  await signBackIn(mom)
})

test('T3: the list says how many wait and pages through them 200 at a time, oldest first', async () => {
  const ids = Array.from({ length: 205 }, () => randomUUID())
  reportIds.push(...ids)
  const first = Date.UTC(2001, 0, 1) // older than any other report waiting here, so these lead the list
  await db.report.createMany({ data: ids.map((id, i) => ({ id, byId: null, from: 'child', details: `Flood ${i}`, sentAt: new Date(first + i * 1000) })) })
  const total = await db.report.count({ where: { resolvedAt: null } })
  const page = async (offset) => (await moderator.get(`/reports?offset=${offset}`)).body
  const one = await page(0)
  assert.equal(one.waiting, total)
  assert.deepEqual(one.reports.map((r) => r.id), ids.slice(0, 200))
  const two = await page(200)
  assert.equal(two.waiting, total)
  assert.equal(two.reports.length, Math.min(200, total - 200))
  assert.deepEqual(two.reports.slice(0, 5).map((r) => r.id), ids.slice(200)) // the rest of the flood, then whatever else waits
  assert.deepEqual((await page('nonsense')).reports.map((r) => r.id), ids.slice(0, 200)) // anything but a whole number is the start
  await db.report.deleteMany({ where: { id: { in: ids } } })
  assert.equal((await moderator.get('/reports')).body.waiting, total - 205)
})

test('T3: deleting a family keeps the record of what the moderator did', async () => {
  const gone = await household('Gone')
  const report = (await sendReport(gone.kid, { details: 'Please look.' })).body
  assert.equal((await pauseIt(report.id)).status, 200)
  assert.equal((await pauseIt(report.id, 'unpause')).status, 200)
  await signBackIn(gone.mom)
  assert.equal((await gone.mom.api.post('/me/delete', { password: gone.mom.password })).status, 204)
  assert.equal(await db.moderatorAction.count({ where: { reportId: report.id } }), 2)
  // answering the kept report deletes the report, never its record
  assert.equal((await moderator.post(`/reports/${report.id}/resolve`, { note: 'Done.' })).status, 200)
  assert.equal(await db.report.count({ where: { id: report.id } }), 0)
  assert.deepEqual((await db.moderatorAction.findMany({ where: { reportId: report.id } })).map((row) => row.action).sort(), ['answer', 'pause', 'unpause'])
})

test('T3: no code changes or deletes the record', async () => {
  const writes = /moderatorAction\.(update|updateMany|delete|deleteMany|upsert)/
  const found = []
  let read = 0
  for (const dir of ['src', 'scripts']) {
    for (const entry of await readdir(fileURLToPath(new URL(`../${dir}/`, import.meta.url)), { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.js')) continue
      read += 1
      if (writes.test(await readFile(path.join(entry.parentPath, entry.name), 'utf8'))) found.push(entry.name)
    }
  }
  assert.ok(read > 10, `read ${read} files`)
  assert.deepEqual(found, [])
})
