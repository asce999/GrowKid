import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { gzipSync } from 'node:zlib'
import { db } from '../src/db.js'
import { STORAGE_BYTES } from '../src/rules.js'
import { png } from './fixtures.js'
import { as, family, moderator, start } from './helpers.js'

/** Final plan Phase 9, item 2: the attack pass. Each attack here was tried against the running app; the test keeps it failed. */

let server
const made = [] // every family this file makes, erased at the end
before(async () => {
  server = await start()
})
after(async () => {
  await Promise.all(made.map((mom) => mom.api.post('/me/delete', { password: mom.password })))
  await server.close()
})

const due = () => new Date(Date.now() + 2 * 86_400_000).toISOString()
const taskOf = (child, more) => ({ childId: child.id, category: 'chores', title: 'Tidy the room', instructions: 'Floor clear.', dueAt: due(), points: 20, ...more })
/** The answer's status must be `expected`; '4xx' takes any refusal. Returns the body. */
const is = async (expected, label, sending) => {
  const res = await sending
  if (expected === '4xx') assert.ok(res.status >= 400 && res.status < 500, `${label}: ${res.status}`)
  else assert.equal(res.status, expected, label)
  return res.body
}

/** A parent and one child, each signed in on their own client. */
async function household() {
  const mom = await family(server.base)
  made.push(mom)
  const login = { name: 'Asha', username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1' }
  const child = await is(201, 'add a child', mom.api.post('/children', { ...login, consent: true }))
  const kid = as(server.base)
  await is(200, 'the child signs in', kid.post('/session', { identifier: login.username, password: login.password }))
  return { mom, kid, child }
}
/** A task of this household with a note sent as proof, waiting for review. */
async function inReview({ mom, kid, child }, more) {
  const task = await is(201, 'task', mom.api.post('/tasks', taskOf(child, more)))
  const sent = await is(201, 'proof', kid.form(`/tasks/${task.id}/proofs`, { note: 'Done' }))
  return { id: task.id, proofId: sent.proofs.at(-1).id }
}

// ------------------------------------------------------------------ requests

test('a form-encoded, text/plain or multipart body is read as no body, never as fields, and never a 500', async () => {
  const { mom, child } = await household()
  const visitor = as(server.base)
  for (const type of ['application/x-www-form-urlencoded', 'text/plain', 'multipart/form-data; boundary=x']) {
    const header = { 'content-type': type }
    // the three types a form on another site can send: the right details in them sign nobody in
    const form = `identifier=${encodeURIComponent(mom.email)}&password=${encodeURIComponent(mom.password)}`
    assert.deepEqual(await is(401, type, visitor.post('/session', form, header)), { code: 'WRONG_DETAILS' })
    assert.deepEqual(await is(401, type, visitor.post('/session', JSON.stringify({ identifier: mom.email, password: mom.password }), header)), { code: 'WRONG_DETAILS' })
    const signUp = JSON.stringify({ name: 'Form Parent', email: `form-${randomUUID()}@example.com`, password: 'grown-up-pass-1', country: 'IN', consent: true })
    assert.equal((await is(400, type, visitor.post('/parents', signUp, header))).code, 'INVALID')
    assert.deepEqual(await is(404, type, mom.api.post('/tasks', JSON.stringify(taskOf(child)), header)), { code: 'NOT_FOUND' }) // no childId was read
    assert.equal((await is(400, type, mom.api.put('/settings', JSON.stringify({ leaderboard: true }), header))).code, 'INVALID')
    assert.equal((await is(400, type, mom.api.put(`/children/${child.id}/quest`, JSON.stringify({ target: 2, bonus: 10 }), header))).code, 'INVALID') // a typed body never removes a quest
  }
  assert.equal((await mom.api.get('/settings')).body.leaderboard, false)
  assert.deepEqual((await mom.api.get('/tasks')).body, [])
})

test('__proto__ and constructor in a body change no object and no row', async () => {
  const { mom, child } = await household()
  const evil = '"__proto__":{"role":"moderator","status":"approved","polluted":true},"constructor":{"prototype":{"polluted":true}}'
  const email = `proto-${randomUUID()}@example.com`
  const visitor = as(server.base)
  await is(201, 'sign-up', visitor.post('/parents', `{"name":"Proto Parent","email":"${email}","password":"grown-up-pass-1","country":"IN","consent":true,${evil}}`))
  made.push({ api: visitor, password: 'grown-up-pass-1' })
  const parent = await db.user.findUniqueOrThrow({ where: { email } })
  assert.deepEqual([parent.role, parent.tokenVersion, parent.pausedAt, parent.parentId], ['parent', 0, null, null])
  const task = await is(201, 'task', mom.api.post('/tasks', `{"childId":"${child.id}","category":"chores","title":"Tidy the room","instructions":"Floor clear.","dueAt":"${due()}","points":20,${evil}}`))
  assert.equal((await db.task.findUniqueOrThrow({ where: { id: task.id } })).status, 'todo')
  await is(404, 'only the attack', mom.api.post('/tasks', `{${evil}}`)) // every field is missing, so no child is named
  await is(401, 'a body that is a list', visitor.post('/session', `[{${evil}}]`))
  // the app runs in this process, so a polluted prototype would show here
  assert.equal({}.polluted, undefined)
  assert.equal({}.role, undefined)
  assert.equal(Object.hasOwn(Object.prototype, 'polluted'), false)
})

test('a body that unpacks or nests far past the limit is refused, never a 500', async () => {
  const headers = { 'x-growkid': '1', 'content-type': 'application/json', 'content-encoding': 'gzip' }
  const bomb = gzipSync(Buffer.alloc(8 * 1024 * 1024, 0x20)) // 8 MB of spaces, a few kB packed
  assert.ok(bomb.length < 20 * 1024, 'under the limit as sent')
  const res = await fetch(`${server.base}/session`, { method: 'POST', headers, body: bomb })
  assert.deepEqual([res.status, await res.json()], [400, { code: 'INVALID' }])
  const deep = `${'['.repeat(9_000)}${']'.repeat(9_000)}` // 18 kB of nesting
  await is('4xx', 'deep nesting', as(server.base).post('/session', deep))
  await is('4xx', 'deep nesting in a field', as(server.base).post('/session', `{"identifier":${deep},"password":${deep}}`))
})

const DIRTY = 'ab\u0000cd\ud800ef' // a NUL and a lone surrogate: PostgreSQL refuses the first, Prisma the second
const CLEAN = 'abcd�ef' // what errors.js text() makes of it

test('a NUL and a lone surrogate in any text field or id are never a 500, and no NUL is stored', async () => {
  const home = await household()
  const { mom, kid, child } = home
  const mod = await moderator(server.base)
  try {
    // accounts
    const visitor = as(server.base)
    const signedUp = await is(201, 'sign-up', visitor.post('/parents', { name: DIRTY, email: `dirty-${randomUUID()}\u0000@example.com`, password: 'grown-up-pass-1', country: 'IN', consent: true }))
    made.push({ api: visitor, password: 'grown-up-pass-1' })
    assert.equal(signedUp.name, CLEAN)
    await is(400, 'sign-up, every field', as(server.base).post('/parents', { name: DIRTY, email: DIRTY, password: DIRTY, country: DIRTY, consent: DIRTY }))
    await is(401, 'sign-in', as(server.base).post('/session', { identifier: DIRTY, password: DIRTY }))
    await is(403, 'change password', mom.api.put('/me/password', { current: DIRTY, next: DIRTY }))
    await is(400, 'country', mom.api.put('/settings/country', { country: DIRTY }))
    await is(400, 'leaderboard', mom.api.put('/settings', { leaderboard: DIRTY }))
    await is(400, "a child's username", mom.api.post('/children', { name: 'Kid', username: DIRTY, password: 'child-pass-1', consent: true }))
    assert.equal((await is(201, "a child's name", mom.api.post('/children', { name: DIRTY, username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1', consent: true }))).name, CLEAN)
    assert.equal((await is(200, 'rename a child', mom.api.patch(`/children/${child.id}`, { name: DIRTY }))).name, CLEAN)
    await is(400, "a child's new password", mom.api.put(`/children/${child.id}/password`, { password: DIRTY }))
    await is(400, 'rest day', mom.api.post(`/children/${child.id}/rest-days`, { day: DIRTY, rest: true }))
    // tasks, series, rewards, the quest
    const words = { title: DIRTY, instructions: DIRTY, doneLooksLike: DIRTY }
    const task = await is(201, 'task', mom.api.post('/tasks', taskOf(child, words)))
    assert.deepEqual([task.title, task.instructions, task.doneLooksLike], [CLEAN, CLEAN, CLEAN])
    await is(200, 'edit a task', mom.api.put(`/tasks/${task.id}`, taskOf(child, words)))
    await is(404, "a task's child", mom.api.post('/tasks', taskOf({ id: DIRTY })))
    await is(400, "a task's kind and time", mom.api.post('/tasks', taskOf(child, { category: DIRTY, dueAt: DIRTY })))
    await is(201, 'series', mom.api.post('/series', { ...taskOf(child, words), weekdays: 127, dueTime: '23:59' }))
    await is(400, "a series' time", mom.api.post('/series', { ...taskOf(child), weekdays: 127, dueTime: DIRTY }))
    const reward = await is(201, 'reward', mom.api.post('/rewards', { title: DIRTY, cost: 10 }))
    assert.equal(reward.title, CLEAN)
    await is(404, "a reward's id", mom.api.post('/rewards', { id: DIRTY, title: 'Pick the film', cost: 10 }))
    assert.equal((await is(200, 'quest', mom.api.put(`/children/${child.id}/quest`, { target: 5, bonus: 10, surprise: DIRTY }))).surprise, CLEAN)
    // proof and review
    const earned = await inReview(home)
    const approved = await is(200, 'a cheer', mom.api.post(`/tasks/${earned.id}/review`, { proofId: earned.proofId, result: 'approved', cheer: { kind: 'proud', line: DIRTY } }))
    assert.equal(approved.proofs.at(-1).review.cheer.line, CLEAN)
    await is(204, 'results seen', kid.post('/tasks/seen', { taskIds: [earned.id, DIRTY] }))
    const open = await is(201, 'task', mom.api.post('/tasks', taskOf(child)))
    const sent = await is(201, "a proof's note", kid.form(`/tasks/${open.id}/proofs`, { note: DIRTY }))
    assert.equal(sent.proofs.at(-1).note, CLEAN)
    const back = await is(200, 'a send-back note', mom.api.post(`/tasks/${open.id}/review`, { proofId: sent.proofs.at(-1).id, result: 'sentBack', note: DIRTY }))
    assert.equal(back.proofs.at(-1).review.note, CLEAN)
    await is(409, "a review's proof id", mom.api.post(`/tasks/${open.id}/review`, { proofId: DIRTY, result: 'approved' }))
    // the child's own writes
    await is(404, "a request's reward", kid.post('/requests', { rewardId: DIRTY }))
    const request = await is(201, 'request', kid.post('/requests', { rewardId: reward.id }))
    assert.equal((await is(200, 'a decline note', mom.api.post(`/requests/${request.id}/answer`, { result: 'declined', note: DIRTY }))).note, CLEAN)
    await is(204, 'answers seen', kid.post('/requests/seen', { ids: [request.id, DIRTY] })) // F1: this id was a 500 until Phase 9
    await is(404, 'goal', kid.put('/goal', { rewardId: DIRTY }))
    await is(404, 'pin', kid.put('/pin', { taskId: DIRTY }))
    await is(400, 'suggestion', kid.post('/suggestions', { ideaId: DIRTY }))
    await is(400, 'badge', kid.put('/me/avatar', { colour: DIRTY, stickerId: DIRTY }))
    // reports
    const report = await is(201, 'report', kid.post('/reports', { details: DIRTY, taskId: DIRTY }))
    assert.equal(report.details, CLEAN)
    assert.equal((await is(200, "a moderator's answer", mod.api.post(`/reports/${report.id}/resolve`, { note: DIRTY }))).resolution.note, CLEAN)
    // query strings
    await is(200, 'history paging', mom.api.get('/tasks/history?offset=%00&limit=%ED%A0%80'))
    await is(200, 'my proofs paging', kid.get('/proofs/mine?offset=%00&limit=a%00b'))
    // Phase 8's routes
    await is(401, 'recovery', as(server.base).post('/recovery', { email: DIRTY, code: DIRTY, password: DIRTY }))
    await is(403, 'a new recovery code', mom.api.post('/me/recovery', { password: DIRTY }))
    await is(403, 'export', mom.api.post('/me/export', { password: DIRTY }))
    await is(400, 'keep proof', mom.api.put('/settings/keep-proof', { days: DIRTY }))

    const ours = { OR: [{ id: mom.user.id }, { parentId: mom.user.id }] }
    const stored = await Promise.all([
      db.user.findMany({ where: ours }),
      db.task.findMany({ where: { child: { parentId: mom.user.id } }, include: { proofs: true } }),
      db.taskSeries.findMany({ where: { child: { parentId: mom.user.id } } }),
      db.reward.findMany({ where: { parentId: mom.user.id } }),
      db.rewardRequest.findMany({ where: { parentId: mom.user.id } }),
      db.quest.findMany({ where: { child: { parentId: mom.user.id } } }),
      db.report.findMany({ where: { by: ours } }),
    ])
    assert.equal(JSON.stringify(stored).includes('\\u0000'), false, 'no NUL in any row')
    assert.equal(JSON.stringify(stored).includes(CLEAN.slice(0, 4)), true, 'and the rows read are the ones written')
  } finally {
    await db.moderatorAction.deleteMany({ where: { moderatorId: mod.id } })
    await db.user.delete({ where: { id: mod.id } })
  }
})

// ------------------------------------------------------------------ role and field

test('no write takes a field it does not name: a role, a status, a version, a pause, a family, a hash, a time or a result sent in a body is never stored', async () => {
  const home = await household()
  const other = await household()
  const { mom, kid, child } = home
  const long = '2020-01-01T00:00:00.000Z'
  const recent = (at) => at > new Date('2026-01-01')
  const EXTRA = {
    id: randomUUID(), role: 'moderator', status: 'approved', tokenVersion: 99, pausedAt: long, parentId: other.mom.user.id, passwordHash: 'x', totpSecret: 'x',
    totpLastStep: 1, recoveryHash: 'x', consentAt: long, consentVersion: 'x', keepProofDays: 365, agreedAt: long, avatar: 'navy:first-task', goalRewardId: randomUUID(),
    createdAt: long, resultSeen: false, pinned: true, seriesId: randomUUID(), seriesDay: '2020-01-01', removedAt: long, reviewBy: 'Someone Else', reviewedAt: long,
    late: true, answeredBy: 'Someone Else', answeredAt: long, answerSeen: true, byId: other.mom.user.id, from: 'child', resolvedAt: long, resolutionNote: 'x', sentAt: long,
  }
  const user = (id) => db.user.findUniqueOrThrow({ where: { id } })

  // sign-up
  const visitor = as(server.base)
  const email = `extra-${randomUUID()}@example.com`
  await is(201, 'sign-up', visitor.post('/parents', { ...EXTRA, name: 'Extra Parent', email, password: 'grown-up-pass-1', country: 'IN', consent: true, leaderboard: true }))
  made.push({ api: visitor, password: 'grown-up-pass-1' })
  const signedUp = await db.user.findUniqueOrThrow({ where: { email } })
  assert.deepEqual(
    [signedUp.role, signedUp.tokenVersion, signedUp.pausedAt, signedUp.parentId, signedUp.leaderboard, signedUp.avatar, signedUp.goalRewardId, signedUp.agreedAt, signedUp.totpSecret ?? null, signedUp.keepProofDays ?? 90],
    ['parent', 0, null, null, false, null, null, null, null, 90],
  )
  assert.notEqual(signedUp.id, EXTRA.id)
  assert.match(signedUp.passwordHash, /^\$2/)
  assert.notEqual(signedUp.recoveryHash, 'x')
  assert.ok(recent(signedUp.consentAt) && recent(signedUp.createdAt) && signedUp.consentVersion !== 'x')

  // the parent's own row: only the field each route names moves
  const parent = await user(mom.user.id)
  await is(200, 'name', mom.api.patch('/me', { ...EXTRA, name: 'New Name', email: `x-${email}`, username: 'changed1', country: 'US', leaderboard: true }))
  assert.deepEqual(await user(mom.user.id), { ...parent, name: 'New Name' })
  await is(200, 'leaderboard', mom.api.put('/settings', { ...EXTRA, leaderboard: true, country: 'US', name: 'Other' }))
  await is(200, 'country', mom.api.put('/settings/country', { ...EXTRA, country: 'US', leaderboard: false, name: 'Other' }))
  assert.deepEqual(await user(mom.user.id), { ...parent, name: 'New Name', leaderboard: true, country: 'US' })

  // a child's row
  const added = await is(201, 'add a child', mom.api.post('/children', { ...EXTRA, name: 'Second', username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1', consent: true }))
  const second = await user(added.id)
  assert.deepEqual([second.role, second.parentId, second.tokenVersion, second.pausedAt, second.avatar, second.agreedAt, second.goalRewardId], ['child', mom.user.id, 0, null, null, null, null])
  assert.ok(added.id !== EXTRA.id && recent(second.consentAt) && recent(second.createdAt))
  const first = await user(child.id)
  await is(200, 'rename a child', mom.api.patch(`/children/${child.id}`, { ...EXTRA, name: 'Renamed', username: 'changed1' }))
  await is(200, 'sound', kid.put('/me/sound', { ...EXTRA, sound: false, name: 'Hacker' }))
  assert.deepEqual(await user(child.id), { ...first, name: 'Renamed', sound: false })

  // a task, its proof and its review
  const task = await is(201, 'task', mom.api.post('/tasks', { ...EXTRA, ...taskOf(child) }))
  await is(200, 'edit a task', mom.api.put(`/tasks/${task.id}`, { ...EXTRA, ...taskOf(child, { title: 'Edited' }) }))
  const row = await db.task.findUniqueOrThrow({ where: { id: task.id } })
  assert.deepEqual([row.status, row.resultSeen, row.pinned, row.seriesId, row.seriesDay, row.childId, row.title], ['todo', true, false, null, null, child.id, 'Edited'])
  assert.ok(task.id !== EXTRA.id && recent(row.createdAt))
  const sent = await is(201, 'proof', kid.form(`/tasks/${task.id}/proofs`, { note: 'Done', result: 'approved' }))
  const proofId = sent.proofs.at(-1).id
  const proof = await db.proof.findUniqueOrThrow({ where: { id: proofId } })
  assert.deepEqual([proof.result, proof.reviewBy, proof.reviewedAt, proof.late], [null, null, null, false])
  await is(200, 'review', mom.api.post(`/tasks/${task.id}/review`, { ...EXTRA, proofId, result: 'approved', points: 100 }))
  const reviewed = await db.proof.findUniqueOrThrow({ where: { id: proofId } })
  assert.ok(reviewed.reviewBy === 'New Name' && recent(reviewed.reviewedAt))
  assert.equal((await db.task.findUniqueOrThrow({ where: { id: task.id } })).points, 20)
  await is(204, 'results seen', kid.post('/tasks/seen', { ...EXTRA, taskIds: [task.id] }))

  // a series and the quest
  const series = await is(201, 'series', mom.api.post('/series', { ...EXTRA, ...taskOf(child), weekdays: 1, dueTime: '23:59' }))
  await is(200, 'edit a series', mom.api.put(`/series/${series.id}`, { ...EXTRA, ...taskOf(added), weekdays: 1, dueTime: '23:59' })) // the child cannot change
  const seriesRow = await db.taskSeries.findUniqueOrThrow({ where: { id: series.id } })
  assert.ok(seriesRow.childId === child.id && series.id !== EXTRA.id && recent(seriesRow.createdAt))
  await is(200, 'quest', mom.api.put(`/children/${child.id}/quest`, { ...EXTRA, childId: added.id, setAt: long, target: 5, bonus: 10 }))
  const quest = await db.quest.findUniqueOrThrow({ where: { childId: child.id } })
  assert.ok(recent(quest.setAt))
  assert.equal(await db.quest.count({ where: { childId: added.id } }), 0)

  // a reward, a request and its answer
  const { id: _id, ...noId } = EXTRA // a reward's own `id` means "change that one"
  const reward = await is(201, 'reward', mom.api.post('/rewards', { ...noId, title: 'Pick the film', cost: 10 }))
  const rewardRow = await db.reward.findUniqueOrThrow({ where: { id: reward.id } })
  assert.ok(rewardRow.parentId === mom.user.id && recent(rewardRow.createdAt))
  const request = await is(201, 'request', kid.post('/requests', { ...EXTRA, rewardId: reward.id, cost: 0, title: 'Free', childId: added.id }))
  const asked = await db.rewardRequest.findUniqueOrThrow({ where: { id: request.id } })
  assert.deepEqual([asked.status, asked.cost, asked.title, asked.childId, asked.parentId, asked.answeredBy, asked.answerSeen], ['requested', 10, 'Pick the film', child.id, mom.user.id, null, true])
  assert.ok(request.id !== EXTRA.id && recent(asked.requestedAt))
  await is(200, 'answer', mom.api.post(`/requests/${request.id}/answer`, { ...EXTRA, result: 'given', note: 'kept only for a decline' }))
  const answered = await db.rewardRequest.findUniqueOrThrow({ where: { id: request.id } })
  assert.deepEqual([answered.status, answered.note, answered.answeredBy, answered.answerSeen, answered.cost], ['given', '', 'New Name', false, 10])
  assert.ok(recent(answered.answeredAt))

  // a report
  const report = await is(201, 'report', mom.api.post('/reports', { ...EXTRA, details: 'Something is wrong.', item: { title: 'made up' } }))
  try {
    const sentReport = await db.report.findUniqueOrThrow({ where: { id: report.id } })
    assert.deepEqual([sentReport.byId, sentReport.from, sentReport.resolvedAt, sentReport.resolutionNote, sentReport.item], [mom.user.id, 'parent', null, null, null])
    assert.ok(report.id !== EXTRA.id && recent(sentReport.sentAt))
  } finally {
    await db.report.deleteMany({ where: { id: report.id } }) // an unanswered report outlives its family
  }
})

// ------------------------------------------------------------------ races

test('two uploads at once at the edge of the quota: both may land, and the family is over by no more than the files in flight', async () => {
  const { mom, kid, child } = await household()
  const login = { name: 'Bela', username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1' }
  const sister = await is(201, 'a second child', mom.api.post('/children', { ...login, consent: true })) // one upload at a time per child (L8), so the race needs two
  const sis = as(server.base)
  await is(200, 'she signs in', sis.post('/session', { identifier: login.username, password: login.password }))
  const [mine, hers, held, later] = await Promise.all([child, sister, child, child].map((who) => is(201, 'task', mom.api.post('/tasks', taskOf(who)))))
  const picture = png()
  // a row that says the family holds all of its 2 GiB but the room for one picture: only the size is counted, so no file is behind it
  await db.proof.create({ data: { id: randomUUID(), taskId: held.id, fileType: 'video/mp4', fileSize: STORAGE_BYTES - picture.length, sentAt: new Date(), late: false } })
  const file = { bytes: picture, name: 'p.png' }
  const answers = await Promise.all([kid.form(`/tasks/${mine.id}/proofs`, {}, file), sis.form(`/tasks/${hers.id}/proofs`, {}, file)])
  for (const res of answers) assert.ok(res.status === 201 || (res.status === 409 && res.body.fields.quota === 'storage'), `${res.status}`)
  const landed = answers.filter((res) => res.status === 201).length
  assert.ok(landed >= 1, 'one always fits')
  const total = async () => (await db.proof.aggregate({ _sum: { fileSize: true }, where: { task: { child: { parentId: mom.user.id } } } }))._sum.fileSize
  assert.equal(await total(), STORAGE_BYTES + (landed - 1) * picture.length) // over by the second file at most
  // once the race is over the quota holds again
  const after = await kid.form(`/tasks/${later.id}/proofs`, {}, file)
  assert.deepEqual([after.status, after.body], [409, { code: 'QUOTA', fields: { quota: 'storage' } }])
})
