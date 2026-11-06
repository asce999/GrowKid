import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { access, readdir } from 'node:fs/promises'
import path from 'node:path'
import { after, before, test } from 'node:test'
import bcrypt from 'bcryptjs'
import { zoneOf } from '../src/countries.js'
import { db } from '../src/db.js'
import { dayKey } from '../src/scoring.js'
import { mp4, png } from './fixtures.js'
import { as, family, start } from './helpers.js'

let server
let moderator
let moderatorId
const made = [] // every family this file makes, erased at the end so the upload folder ends empty
const reportIds = [] // every report it sends that can outlive its sender, removed at the end by id
before(async () => {
  server = await start()
  const email = `mod-${randomUUID()}@example.com`
  moderatorId = (await db.user.create({ data: { role: 'moderator', name: 'Mod', email, passwordHash: await bcrypt.hash('moderator-pass', 4) } })).id
  moderator = as(server.base)
  assert.equal((await moderator.post('/session', { identifier: email, password: 'moderator-pass' })).status, 200)
})
after(async () => {
  await Promise.all(made.map((mom) => mom.api.post('/me/delete', { password: mom.password }))) // a no-op for a family a test already erased
  await db.report.deleteMany({ where: { id: { in: reportIds } } }) // the unanswered ones a deleted sender leaves behind
  await db.user.deleteMany({ where: { id: moderatorId } })
  await server.close()
})

const DAY = 86_400_000
const INDIA = zoneOf('IN')
const refused = (res, status, code) => {
  assert.equal(res.status, status)
  assert.deepEqual(res.body, { code })
}
const invalid = (res, fields) => {
  assert.equal(res.status, 400)
  assert.deepEqual(res.body, { code: 'INVALID', fields })
}
/** The day this many days from now in a zone (calendar days, so independent of the code under test). */
const dayIn = (days, zone = INDIA) => dayKey(new Date(Date.now() + days * DAY), zone)

/** A client for this user with the server's clock moved by `days` (kept per user, so each offset signs in once). */
async function at(user, days = 0) {
  user.clients ??= new Map([[0, user.api]])
  if (!user.clients.has(days)) {
    const api = as(server.base, { days })
    assert.equal((await api.post('/session', { identifier: user.email ?? user.username, password: user.password })).status, 200)
    user.clients.set(days, api)
  }
  return user.clients.get(days)
}
async function addChild(mom, name = 'Kid') {
  const sent = { name, username: `k${randomUUID().slice(0, 8)}`, password: 'kid-pass-1' }
  const res = await mom.api.post('/children', sent)
  assert.equal(res.status, 201)
  const api = as(server.base)
  assert.equal((await api.post('/session', { identifier: sent.username, password: sent.password })).status, 200)
  return { ...res.body, password: sent.password, api }
}
/** A parent with children. */
async function household(names = ['Kid'], details) {
  const mom = await family(server.base, details)
  made.push(mom)
  const kids = []
  for (const name of names) kids.push(await addChild(mom, name))
  return { mom, kid: kids[0], kids }
}
/** A task the parent sets, the child answers with a note and the parent approves, all at the clock `days` from now. Returns the task id. */
async function approved(mom, kid, { days = 0, points = 20, seen = false, upload } = {}) {
  const parent = await at(mom, days)
  const child = await at(kid, days)
  const created = await parent.post('/tasks', {
    childId: kid.id, category: 'chores', title: 'Tidy the room', instructions: 'Floor clear, bed made.', points,
    dueAt: new Date(Date.now() + (days + 1) * DAY).toISOString(),
  })
  assert.equal(created.status, 201)
  const sent = await child.form(`/tasks/${created.body.id}/proofs`, { note: 'Done!' }, upload)
  assert.equal(sent.status, 201)
  const review = await parent.post(`/tasks/${created.body.id}/review`, { proofId: sent.body.proofs[0].id, result: 'approved' })
  assert.equal(review.status, 200)
  if (seen) assert.equal((await child.post('/tasks/seen', { taskIds: [created.body.id] })).status, 204)
  return created.body.id
}
/** A task with a proof waiting for review. */
async function sentProof(mom, kid, upload) {
  const created = await mom.api.post('/tasks', {
    childId: kid.id, category: 'study', title: 'Read a chapter', instructions: 'Chapter three.', points: 10, dueAt: new Date(Date.now() + DAY).toISOString(),
  })
  assert.equal(created.status, 201)
  assert.equal((await kid.api.form(`/tasks/${created.body.id}/proofs`, { note: 'Read it.' }, upload)).status, 201)
  return created.body.id
}
const reward = async (mom, title, cost) => (await mom.api.post('/rewards', { title, cost })).body

// ------------------------------------------------------------------ growth, stickers, progress

test('getGrowth, listGrowth, listStickers and getProgress: an approval the child has not seen is held back from the child, not from the parent', async () => {
  const { mom, kid } = await household()
  await approved(mom, kid)
  const growth = (await kid.api.get('/growth')).body
  assert.deepEqual([growth.points, growth.level, growth.xp, growth.balance, growth.quest, growth.questAwards], [20, 1, 20, 20, null, []])
  assert.deepEqual([growth.shown.points, growth.shown.balance, growth.shown.xp], [0, 0, 0]) // not yet shown on Today
  const first = async () => (await kid.api.get('/stickers')).body.find((s) => s.id === 'first-task')
  const before = await first()
  assert.deepEqual([before.seen, before.have, typeof before.earnedAt], [false, 0, 'string'])
  const tasks = (await kid.api.get('/tasks')).body
  assert.equal((await kid.api.post('/tasks/seen', { taskIds: tasks.map((t) => t.id) })).status, 204)
  const seen = await first()
  assert.equal(seen.seen, true)
  assert.equal('have' in seen, false)
  assert.equal((await kid.api.get('/growth')).body.shown.points, 20)

  const list = (await kid.api.get('/stickers')).body
  assert.equal(list.length, 14)
  assert.deepEqual([list.find((s) => s.id === 'tasks-10').have, 'earnedAt' in list.find((s) => s.id === 'tasks-10')], [1, false])

  const all = (await mom.api.get('/growth/children')).body
  assert.deepEqual(Object.keys(all), [kid.id])
  assert.deepEqual([all[kid.id].points, all[kid.id].shown.points], [20, 20])

  // sticker rows are read as recorded: one the tasks no longer earn stays
  await db.award.create({ data: { childId: kid.id, stickerId: 'tasks-50', earnedAt: new Date(), taskId: randomUUID(), taskTitle: 'A task since deleted' } })
  const progress = (await mom.api.get(`/children/${kid.id}/progress`)).body
  assert.deepEqual(progress.child, { id: kid.id, name: 'Kid', username: kid.username })
  assert.deepEqual([progress.points, progress.level, progress.weeks.length, progress.streak.days], [20, 1, 6, 1])
  assert.deepEqual(progress.counts, { approved: 1, waiting: 0, open: 0, overdue: 0 })
  assert.equal(progress.stickers.length, 14)
  assert.equal(progress.stickers.find((s) => s.id === 'tasks-50').taskTitle, 'A task since deleted')
  assert.equal('seen' in progress.stickers[0], false)
  assert.equal(progress.calendar.at(-1).state, 'done')
})

test('growth, stickers, progress and the leaderboard are for their own role and family', async () => {
  const { mom, kid } = await household()
  const stranger = await family(server.base)
  made.push(stranger)
  const anyone = as(server.base)
  for (const url of ['/growth', '/stickers', '/leaderboard', '/growth/children', `/children/${kid.id}/progress`]) refused(await anyone.get(url), 401, 'NOT_SIGNED_IN')
  for (const url of ['/growth', '/stickers', '/leaderboard']) {
    refused(await mom.api.get(url), 403, 'NOT_ALLOWED')
    refused(await moderator.get(url), 403, 'NOT_ALLOWED')
  }
  for (const url of ['/growth/children', `/children/${kid.id}/progress`, `/children/${kid.id}/rest-days`, '/counts/requests']) {
    refused(await kid.api.get(url), 403, 'NOT_ALLOWED')
    refused(await moderator.get(url), 403, 'NOT_ALLOWED')
  }
  refused(await stranger.api.get(`/children/${kid.id}/progress`), 404, 'NOT_FOUND')
  refused(await stranger.api.get(`/children/${kid.id}/rest-days`), 404, 'NOT_FOUND')
  assert.deepEqual((await stranger.api.get('/growth/children')).body, {}) // another family's children are not theirs
  refused(await mom.api.get('/children/%00/progress'), 404, 'NOT_FOUND') // a NUL in an id is just a child that does not exist
  refused(await mom.api.get('/children/%ZZ/progress'), 404, 'NOT_FOUND') // so is a bad percent-escape (Express 5's router throws a URIError for it)
  refused(await mom.api.get('/tasks/%ZZ'), 404, 'NOT_FOUND')
})

// ------------------------------------------------------------------ rewards and requests

test('rewards: a parent saves, edits and deletes their own; the family reads them cheapest first; wrong types are INVALID, never 500', async () => {
  const { mom, kid } = await household()
  const stranger = await family(server.base)
  made.push(stranger)
  const film = await mom.api.post('/rewards', { title: '  Film night ', cost: 100 })
  assert.equal(film.status, 201)
  assert.deepEqual(Object.keys(film.body).sort(), ['cost', 'id', 'title'])
  assert.equal(film.body.title, 'Film night')
  await reward(mom, 'Extra screen time', 50)
  const theirs = await reward(stranger, 'Another family', 10)
  assert.deepEqual((await kid.api.get('/rewards')).body.map((r) => r.title), ['Extra screen time', 'Film night'])
  const edited = await mom.api.post('/rewards', { id: film.body.id, title: 'Film night out', cost: 120 })
  assert.deepEqual([edited.status, edited.body], [200, { id: film.body.id, title: 'Film night out', cost: 120 }])
  assert.equal((await db.reward.findMany({ where: { parentId: mom.user.id } })).length, 2)
  for (const id of [theirs.id, 'nope', 123, true, ['x']]) refused(await mom.api.post('/rewards', { id, title: 'Anything', cost: 20 }), 404, 'NOT_FOUND') // an id that is not theirs, whatever its type
  for (const id of [undefined, null, '']) { // a missing or empty id makes a new reward
    const fresh = await mom.api.post('/rewards', { id, title: 'Anything', cost: 20 })
    assert.deepEqual([fresh.status, fresh.body.id === film.body.id, fresh.body.title], [201, false, 'Anything'])
    assert.equal((await mom.api.del(`/rewards/${fresh.body.id}`)).status, 204)
  }
  invalid(await mom.api.post('/rewards', { title: 'ab', cost: 5 }), { title: 'length', cost: 'range' })
  invalid(await mom.api.post('/rewards', { title: 123, cost: '50' }), { title: 'length', cost: 'range' })
  invalid(await mom.api.post('/rewards', { title: 'x'.repeat(61), cost: 15 }), { title: 'length', cost: 'range' })
  invalid(await mom.api.post('/rewards', { title: 'Fine title', cost: 1010 }), { cost: 'range' })
  const screened = await mom.api.post('/rewards', { title: 'A secret treat', cost: 20 })
  assert.deepEqual([screened.status, screened.body], [400, { code: 'SCREENED', fields: { word: 'secret' } }])
  refused(await kid.api.post('/rewards', { title: 'Anything', cost: 20 }), 403, 'NOT_ALLOWED')
  refused(await kid.api.del(`/rewards/${film.body.id}`), 403, 'NOT_ALLOWED')
  refused(await moderator.get('/rewards'), 403, 'NOT_ALLOWED')
  refused(await as(server.base).get('/rewards'), 401, 'NOT_SIGNED_IN')
  refused(await stranger.api.del(`/rewards/${film.body.id}`), 404, 'NOT_FOUND')
  assert.equal((await mom.api.del(`/rewards/${film.body.id}`)).status, 204)
  refused(await mom.api.del(`/rewards/${film.body.id}`), 404, 'NOT_FOUND')
  assert.deepEqual((await mom.api.get('/rewards')).body.map((r) => r.title), ['Extra screen time'])
})

test('requestReward and answerRequest (rules 17, 18): the child spends what they have been shown, a request holds its points, a decline gives them back, an answer lands once', async () => {
  const { mom, kid } = await household()
  const stranger = await family(server.base)
  made.push(stranger)
  const cheap = await reward(mom, 'Extra screen time', 50)
  const dear = await reward(mom, 'A day out', 1000)
  const theirs = await reward(stranger, 'Another family', 10)
  const taskId = await approved(mom, kid, { points: 100 })
  const ask = (rewardId) => kid.api.post('/requests', { rewardId })
  const balance = async () => (await kid.api.get('/growth')).body.shown.balance
  refused(await ask(cheap.id), 409, 'NOT_ENOUGH') // the 100 points have not been shown on Today yet
  assert.equal((await kid.api.post('/tasks/seen', { taskIds: [taskId] })).status, 204)
  assert.equal(await balance(), 100)
  refused(await ask(dear.id), 409, 'NOT_ENOUGH')
  refused(await ask(theirs.id), 404, 'NOT_FOUND') // another family's reward does not exist for this child
  refused(await ask(5), 404, 'NOT_FOUND')
  assert.equal(await db.rewardRequest.count({ where: { childId: kid.id } }), 0) // nothing was asked for
  const asked = await ask(cheap.id)
  assert.equal(asked.status, 201)
  assert.deepEqual(Object.keys(asked.body).sort(), ['childId', 'childName', 'cost', 'id', 'note', 'requestedAt', 'rewardId', 'status', 'title'])
  assert.deepEqual([asked.body.status, asked.body.childName, asked.body.title, asked.body.cost, asked.body.note], ['requested', 'Kid', 'Extra screen time', 50, ''])
  assert.equal(await balance(), 50) // its 50 points are held at once
  assert.equal((await mom.api.get('/counts/requests')).body, 1)
  assert.equal((await stranger.api.get('/counts/requests')).body, 0)
  const answer = (body, who = mom) => who.api.post(`/requests/${asked.body.id}/answer`, body)
  refused(await answer({ result: 'given' }, stranger), 404, 'NOT_FOUND') // a parent of another family cannot answer it
  refused(await answer({ result: 'given' }, { api: kid.api }), 403, 'NOT_ALLOWED')
  invalid(await answer({ result: 'maybe' }), { result: 'required' }) // only given or declined
  invalid(await answer({ result: 'declined', note: 'x'.repeat(201) }), { note: 'length' })
  const declined = await answer({ result: 'declined', note: '  Not before the weekend. ' })
  assert.equal(declined.status, 200)
  assert.deepEqual([declined.body.status, declined.body.note, declined.body.answer.by, typeof declined.body.answer.at], ['declined', 'Not before the weekend.', 'Test Parent', 'string'])
  assert.equal(await balance(), 100) // declining gives the points back
  refused(await answer({ result: 'given' }), 409, 'REVIEWED') // it is answered once
  refused(await answer({ result: 'maybe' }), 409, 'REVIEWED') // and a second answer is refused before it is read

  const second = (await ask(cheap.id)).body
  assert.equal((await mom.api.del(`/rewards/${cheap.id}`)).status, 204) // the request keeps its own copy of the title and cost
  const given = await mom.api.post(`/requests/${second.id}/answer`, { result: 'given', note: 'ignored for a gift' })
  assert.deepEqual([given.status, given.body.status, given.body.title, given.body.cost, given.body.note], [200, 'given', 'Extra screen time', 50, ''])
  assert.equal(await balance(), 50)
  assert.deepEqual((await kid.api.get('/requests')).body.map((r) => r.id), [second.id, asked.body.id]) // newest first
  assert.deepEqual((await mom.api.get('/requests')).body.map((r) => r.status), ['given', 'declined'])
  assert.deepEqual((await stranger.api.get('/requests')).body, [])
  refused(await moderator.get('/requests'), 403, 'NOT_ALLOWED')
  assert.equal((await mom.api.get('/counts/requests')).body, 0)
})

test('two reward requests at once that together exceed the balance give exactly one success; two answers at once give one 200 and one REVIEWED', async () => {
  const { mom, kid } = await household()
  const sixty = await reward(mom, 'Sixty points', 60)
  await approved(mom, kid, { points: 100, seen: true })
  const both = await Promise.all([kid.api.post('/requests', { rewardId: sixty.id }), kid.api.post('/requests', { rewardId: sixty.id })])
  assert.deepEqual(both.map((r) => r.status).sort(), [201, 409])
  assert.deepEqual(both.find((r) => r.status === 409).body, { code: 'NOT_ENOUGH' })
  assert.equal(await db.rewardRequest.count({ where: { childId: kid.id } }), 1)
  const id = both.find((r) => r.status === 201).body.id
  const answers = await Promise.all([mom.api.post(`/requests/${id}/answer`, { result: 'given' }), mom.api.post(`/requests/${id}/answer`, { result: 'declined', note: 'No' })])
  assert.deepEqual(answers.map((r) => r.status).sort(), [200, 409])
  assert.deepEqual(answers.find((r) => r.status === 409).body, { code: 'REVIEWED' })
})

// ------------------------------------------------------------------ quests

test('setQuest (rule 19): every wrong field is named, a quest already reached is "done", the surprise is screened, a stranger gets NOT_FOUND, and only no body at all removes it', async () => {
  const { mom, kid } = await household()
  const stranger = await family(server.base)
  made.push(stranger)
  const put = (body, who = mom) => who.api.put(`/children/${kid.id}/quest`, body)
  invalid(await put({ target: 1, bonus: 12, surprise: 'x'.repeat(81) }), { target: 'range', bonus: 'range', surprise: 'length' })
  invalid(await put({ target: '3', bonus: '50' }), { target: 'range', bonus: 'range' })
  invalid(await put({ target: 21, bonus: 205 }), { target: 'range', bonus: 'range' })
  invalid(await put({ target: 3, bonus: 50, surprise: 7 }), { surprise: 'length' })
  invalid(await put({ target: 3.5, bonus: 50 }), { target: 'range' })
  invalid(await put([1]), { target: 'range', bonus: 'range' })
  invalid(await put({}), { target: 'range', bonus: 'range' })
  for (const lone of ['"a lone string"', '5', 'null']) { // sent as is: valid JSON, but not an object, which the strict parser refuses
    const res = await put(lone)
    assert.deepEqual([res.status, res.body], [400, { code: 'INVALID' }], lone)
  }
  const screened = await put({ target: 3, bonus: 50, surprise: 'a DARE' })
  assert.deepEqual([screened.status, screened.body], [400, { code: 'SCREENED', fields: { word: 'dare' } }])
  assert.equal(await db.quest.count({ where: { childId: kid.id } }), 0)
  const set = await put({ target: 3, bonus: 50, surprise: '  Ice cream  ' })
  assert.deepEqual([set.status, set.body], [200, { target: 3, bonus: 50, surprise: 'Ice cream' }])
  assert.deepEqual((await put({ target: 4, bonus: 60, surprise: '   ' })).body, { target: 4, bonus: 60, surprise: null }) // an empty surprise means none
  const row = await db.quest.findUniqueOrThrow({ where: { childId: kid.id } })
  assert.deepEqual([row.target, row.bonus, row.surprise], [4, 60, null])
  refused(await put({ target: 3, bonus: 50 }, stranger), 404, 'NOT_FOUND')
  refused(await put({ target: 3, bonus: 50 }, { api: kid.api }), 403, 'NOT_ALLOWED')
  refused(await put({ target: 3, bonus: 50 }, { api: moderator }), 403, 'NOT_ALLOWED')
  assert.equal(await db.quest.count({ where: { childId: kid.id } }), 1) // none of that changed it
  // only a request with no body at all removes it: anything that has a Content-Type goes through the field checks and the quest stays
  const text = await mom.api.put(`/children/${kid.id}/quest`, JSON.stringify({ target: 3, bonus: 50 }), { 'content-type': 'text/plain' })
  invalid(text, { target: 'range', bonus: 'range' })
  const empty = await mom.api.put(`/children/${kid.id}/quest`, '', { 'content-type': 'application/json' })
  invalid(empty, { target: 'range', bonus: 'range' })
  assert.equal(await db.quest.count({ where: { childId: kid.id } }), 1)
  assert.equal((await put(undefined)).body, null) // no body, no Content-Type: removed
  assert.equal(await db.quest.count({ where: { childId: kid.id } }), 0)
  await put({ target: 3, bonus: 50 })

  await approved(mom, kid)
  await approved(mom, kid)
  invalid(await put({ target: 2, bonus: 10 }), { target: 'done' }) // two approved this week: it would show as full and never pay
  assert.equal((await put({ target: 3, bonus: 10 })).status, 200)
})

test('a quest is completed by the approval that reaches it, and its surprise opens for the child only once they have seen it; a later change to the quest stays sealed', async () => {
  const { mom, kid } = await household()
  const seen = async (...ids) => assert.equal((await kid.api.post('/tasks/seen', { taskIds: ids })).status, 204)
  assert.equal((await mom.api.put(`/children/${kid.id}/quest`, { target: 2, bonus: 40, surprise: 'Ice cream' })).status, 200)
  const growth = async () => (await kid.api.get('/growth')).body
  let child = await growth()
  assert.deepEqual([child.quest.target, child.quest.done, child.quest.completed, child.quest.sealed, child.quest.surprise], [2, 0, false, true, null])
  assert.equal(JSON.stringify([child, (await kid.api.get('/stickers')).body, (await kid.api.get('/rewards')).body]).includes('Ice cream'), false)
  assert.equal((await mom.api.get('/growth/children')).body[kid.id].quest.surprise, 'Ice cream') // a parent always reads it

  const one = await approved(mom, kid)
  await seen(one)
  child = await growth()
  assert.deepEqual([child.quest.done, child.quest.completed, child.questAwards.length], [1, false, 0])
  const two = await approved(mom, kid) // reaches the target; not yet shown
  child = await growth()
  assert.deepEqual([child.quest.completed, child.quest.surprise, child.shown.quest.completed, child.shown.quest.surprise], [true, null, false, null])
  assert.deepEqual([child.questAwards.length, child.questAwards[0].seen, child.questAwards[0].surprise, child.questAwards[0].taskId], [1, false, 'Ice cream', two]) // what Today's reward moment plays
  assert.deepEqual([child.points, child.balance, child.shown.points, child.shown.balance], [40, 80, 20, 20]) // the bonus waits with the approval
  assert.equal(await db.questAward.count({ where: { childId: kid.id } }), 1)
  assert.equal((await db.quest.findUniqueOrThrow({ where: { childId: kid.id } })).surprise, null) // opened now
  assert.equal((await db.award.findUnique({ where: { childId_stickerId: { childId: kid.id, stickerId: 'quest-1' } } }))?.taskId, two)
  await seen(two)
  child = await growth()
  assert.deepEqual([child.quest.completed, child.quest.surprise, child.quest.sealed, child.shown.quest.surprise, child.shown.balance], [true, 'Ice cream', false, 'Ice cream', 80])

  // changed after this week's quest was completed: that is for a later week, and nothing of it opens early
  assert.equal((await mom.api.put(`/children/${kid.id}/quest`, { target: 5, bonus: 20, surprise: 'Next week plan' })).status, 200)
  child = await growth()
  assert.deepEqual([child.quest.target, child.quest.bonus, child.quest.surprise, child.shown.quest.surprise], [2, 40, 'Ice cream', 'Ice cream'])
  assert.equal(JSON.stringify(child).includes('Next week plan'), false)
  assert.equal((await mom.api.get('/growth/children')).body[kid.id].quest.surprise, 'Next week plan')
})

// ------------------------------------------------------------------ rest days

test('rest days (rule 21): a real day within 7 days back and 90 ahead, set or cleared, newest list back; a day that is not a day is INVALID', async () => {
  const { mom, kid } = await household()
  const stranger = await family(server.base)
  made.push(stranger)
  const rest = (day, on = true, who = mom) => who.api.post(`/children/${kid.id}/rest-days`, { day, rest: on })
  const today = dayIn(0)
  const listed = async () => (await mom.api.get(`/children/${kid.id}/rest-days`)).body
  for (const day of ['2026-02-31', '2026-13-01', '2026-2-3', '', 'tomorrow', 20261101, null, undefined, [today]]) invalid(await rest(day), { day: 'range' })
  invalid(await rest(today, 'yes'), { rest: 'required' })
  invalid(await rest(dayIn(-8)), { day: 'range' })
  invalid(await rest(dayIn(91)), { day: 'range' })
  assert.deepEqual((await rest(dayIn(90))).body, [dayIn(90)])
  assert.deepEqual((await rest(dayIn(-7))).body, [dayIn(-7), dayIn(90)]) // oldest first
  assert.deepEqual((await rest(dayIn(-7))).body, [dayIn(-7), dayIn(90)]) // setting it twice is the same as once
  assert.deepEqual((await rest(dayIn(90), false)).body, [dayIn(-7)])
  assert.deepEqual(await listed(), [dayIn(-7)])
  assert.equal(await db.restDay.count({ where: { childId: kid.id } }), 1)
  refused(await rest(today, true, stranger), 404, 'NOT_FOUND')
  refused(await rest(today, true, { api: kid.api }), 403, 'NOT_ALLOWED')
  // rows older than 7 days stay in the database and still count, but are no longer listed
  await db.restDay.create({ data: { childId: kid.id, day: dayIn(-30) } })
  assert.deepEqual(await listed(), [dayIn(-7)])
})

test('a rest day keeps the streak: a missed day stops it, and setting that day as a rest day lets it carry on (the clock header moves the days)', async () => {
  const { mom, kid } = await household()
  await approved(mom, kid, { days: -4, seen: true }) // a day done
  const parentThen = await at(mom, -3)
  const missed = await parentThen.post('/tasks', { // due the day after: two days ago, never answered
    childId: kid.id, category: 'study', title: 'Never sent', instructions: 'This one was missed.', points: 10, dueAt: new Date(Date.now() - 2 * DAY).toISOString(),
  })
  assert.equal(missed.status, 201)
  await approved(mom, kid, { days: -1, seen: true }) // a day done
  const streak = async () => (await kid.api.get('/growth')).body.streak
  const before = await streak()
  assert.deepEqual([before.days, before.best], [1, 1]) // the missed day stopped it
  assert.equal(before.week[4].state, 'missed') // two days ago is the fifth mark of seven, today the last
  const day = dayIn(-2)
  assert.deepEqual((await mom.api.post(`/children/${kid.id}/rest-days`, { day, rest: true })).body, [day])
  const after = await streak()
  assert.deepEqual([after.days, after.best, after.week[4].state], [2, 2, 'rest'])
  const stickers = (await kid.api.get('/stickers')).body
  assert.equal(stickers.find((s) => s.id === 'streak-3').have, 2)
  await mom.api.post(`/children/${kid.id}/rest-days`, { day, rest: false })
  assert.equal((await streak()).days, 1)
})

test('days follow the family\'s zone (rule 25): the same rest day is allowed in one zone and refused in another, and a list drops it with the zone', async () => {
  const { mom, kid } = await household()
  const [apia, pagoPago] = [zoneOf('WS'), zoneOf('AS')] // a day apart for the whole of every day (+13 hours and -11 hours)
  assert.notEqual(dayIn(0, apia), dayIn(0, pagoPago))
  const rest = (day) => mom.api.post(`/children/${kid.id}/rest-days`, { day, rest: true })
  const country = async (code) => assert.equal((await mom.api.put('/settings/country', { country: code })).status, 200)

  // India's own edges, whatever the hour: 7 days back and 90 ahead of India's today, not of the server's
  assert.equal((await rest(dayIn(90))).status, 200)
  assert.equal((await rest(dayIn(-7))).status, 200)
  invalid(await rest(dayIn(91)), { day: 'range' })
  invalid(await rest(dayIn(-8)), { day: 'range' })

  await country('WS')
  assert.equal((await rest(dayIn(90, apia))).status, 200) // 90 days ahead of Samoa's today ...
  await country('AS')
  invalid(await rest(dayIn(90, apia)), { day: 'range' }) // ... is 91 ahead of American Samoa's
  assert.equal((await rest(dayIn(-7, pagoPago))).status, 200) // 7 back there is 8 back in Samoa
  const listed = async () => (await mom.api.get(`/children/${kid.id}/rest-days`)).body
  assert.equal((await listed()).includes(dayIn(-7, pagoPago)), true)
  await country('WS')
  invalid(await rest(dayIn(-7, pagoPago)), { day: 'range' })
  assert.equal((await listed()).includes(dayIn(-7, pagoPago)), false) // no longer one a parent can still change; it stays and counts
  assert.equal(await db.restDay.count({ where: { childId: kid.id, day: dayIn(-7, pagoPago) } }), 1)
})

// ------------------------------------------------------------------ the leaderboard

test('getLeaderboard (rule 23): null when off or with one child; otherwise this week\'s approvals each child has been shown, most first, then by name', async () => {
  const { mom, kids: [zed] } = await household(['Zed'])
  const leaderboard = async (who) => (await who.api.get('/leaderboard')).body
  const turn = async (on) => assert.equal((await mom.api.put('/settings', { leaderboard: on })).status, 200)
  await turn(true)
  assert.equal(await leaderboard(zed), null) // one child
  const amy = await addChild(mom, 'Amy')
  await turn(false)
  assert.equal(await leaderboard(zed), null) // off
  await turn(true)
  assert.deepEqual(await leaderboard(zed), [{ name: 'Amy', tasks: 0, you: false }, { name: 'Zed', tasks: 0, you: true }]) // equal: by name
  const id = await approved(mom, zed) // approved, but Zed has not seen it
  assert.deepEqual((await leaderboard(amy)).map((e) => e.tasks), [0, 0])
  assert.deepEqual((await leaderboard(zed)).map((e) => e.tasks), [0, 0])
  assert.equal((await zed.api.post('/tasks/seen', { taskIds: [id] })).status, 204)
  assert.deepEqual(await leaderboard(amy), [{ name: 'Zed', tasks: 1, you: false }, { name: 'Amy', tasks: 0, you: true }])
  assert.deepEqual((await leaderboard(zed)).map((e) => e.you), [true, false])
  const outsider = await household(['Outsider'])
  assert.equal(await leaderboard(outsider.kid), null) // another family has its own setting and its own children
  refused(await mom.api.get('/leaderboard'), 403, 'NOT_ALLOWED')
})

test('the leaderboard\'s week follows the family\'s zone (rule 25): the same Sunday approval is last week in Samoa and this week in American Samoa', async () => {
  const { mom, kids: [asha] } = await household(['Asha', 'Bo'])
  assert.equal((await mom.api.put('/settings', { leaderboard: true })).status, 200)
  const [apia, pagoPago] = [zoneOf('WS'), zoneOf('AS')]
  // the first day, counting from today, that is a Sunday in Samoa (and so a Saturday in American Samoa)
  const sunday = [0, 1, 2, 3, 4, 5, 6].find((d) => new Date(dayIn(d, apia)).getUTCDay() === 0)
  assert.equal(new Date(dayIn(sunday, pagoPago)).getUTCDay(), 6)
  await approved(mom, asha, { days: sunday, seen: true })
  const monday = await at(asha, sunday + 1) // read a day later: Monday in Samoa, Sunday in American Samoa
  const tasksOf = async () => (await monday.get('/leaderboard')).body.map((e) => [e.name, e.tasks])
  assert.equal((await mom.api.put('/settings/country', { country: 'WS' })).status, 200)
  assert.deepEqual(await tasksOf(), [['Asha', 0], ['Bo', 0]]) // a new week in Samoa
  assert.equal((await mom.api.put('/settings/country', { country: 'AS' })).status, 200)
  assert.deepEqual(await tasksOf(), [['Asha', 1], ['Bo', 0]]) // the same week in American Samoa
})

// ------------------------------------------------------------------ deleting a family (rule 16)

const FAMILY_TABLES = (users, tasks, proofs) => ({
  user: { id: { in: users } },
  task: { id: { in: tasks } },
  proof: { id: { in: proofs } },
  award: { childId: { in: users } },
  quest: { childId: { in: users } },
  questAward: { childId: { in: users } },
  restDay: { childId: { in: users } },
  reward: { parentId: { in: users } },
  rewardRequest: { OR: [{ childId: { in: users } }, { parentId: { in: users } }] },
})

test('deleting a family removes every row of theirs and every proof file, keeps unanswered reports with byId null, and deletes answered ones', async () => {
  const { mom, kids: [aarav, diya] } = await household(['Aarav', 'Diya'])
  const other = await household(['Other'])
  // every kind of row: files through the real upload route, a completed quest, awards, a rest day, rewards, requests and four reports
  assert.equal((await mom.api.put(`/children/${aarav.id}/quest`, { target: 2, bonus: 40, surprise: 'Ice cream' })).status, 200)
  const done = await approved(mom, aarav, { seen: true, upload: { bytes: png(), name: 'first.png' } })
  await approved(mom, aarav, { seen: true })
  await sentProof(mom, aarav, { bytes: mp4(), name: 'clip.mp4' })
  await sentProof(mom, diya)
  await mom.api.post(`/children/${diya.id}/rest-days`, { day: dayIn(1), rest: true })
  const cheap = await reward(mom, 'Extra screen time', 10)
  assert.equal((await aarav.api.post('/requests', { rewardId: cheap.id })).status, 201)
  const report = async (who, details, taskId) => {
    const { id } = (await who.api.post('/reports', { details, taskId })).body
    reportIds.push(id)
    return id
  }
  const kept = [await report(aarav, 'Something felt wrong.', done), await report(mom, 'A question for you.')]
  const gone = [await report(mom, 'Another question.'), await report(diya, 'Please look at this.')]
  for (const id of gone) assert.equal((await moderator.post(`/reports/${id}/resolve`, { note: 'Looked at it.' })).status, 200)

  const users = [mom.user.id, aarav.id, diya.id]
  const tasks = (await db.task.findMany({ where: { childId: { in: users } }, select: { id: true } })).map((t) => t.id)
  const proofs = await db.proof.findMany({ where: { taskId: { in: tasks } } })
  const files = proofs.filter((p) => p.fileType).map((p) => p.id)
  const where = FAMILY_TABLES(users, tasks, proofs.map((p) => p.id))
  for (const [model, filter] of Object.entries(where)) assert.ok((await db[model].count({ where: filter })) > 0, `${model} has rows to delete`)
  assert.equal(files.length, 2)
  for (const id of files) await access(path.join(process.env.UPLOAD_DIR, id)) // on disk now

  assert.equal((await mom.api.post('/me/delete', { password: mom.password })).status, 204)
  for (const [model, filter] of Object.entries(where)) assert.equal(await db[model].count({ where: filter }), 0, `${model} still has rows`)
  const left = await readdir(process.env.UPLOAD_DIR)
  for (const id of files) assert.equal(left.includes(id), false) // the files are gone
  for (const id of gone) assert.equal(await db.report.count({ where: { id } }), 0) // answered: deleted
  for (const id of kept) {
    const row = await db.report.findUniqueOrThrow({ where: { id } })
    assert.equal(row.byId, null) // unanswered: kept, holding no id of theirs
    assert.equal(row.resolvedAt, null)
  }
  assert.equal((await mom.api.get('/session')).body, null) // the old cookie is nobody
  assert.equal((await db.user.count({ where: { id: { in: [other.mom.user.id, other.kid.id] } } })), 2) // another family is untouched

  // the moderator still sees both, told that nobody is left to read an answer, with nothing that leads back
  const list = (await moderator.get('/reports')).body.filter((r) => kept.includes(r.id))
  assert.deepEqual(list.map((r) => r.senderGone), [true, true])
  const text = JSON.stringify(list)
  for (const secret of [...users, ...tasks, ...proofs.map((p) => p.id), 'Aarav', 'Diya', 'Test Parent', 'first.png', 'clip.mp4', 'Done!']) assert.equal(text.includes(secret), false, secret)
  assert.deepEqual(Object.keys(list.find((r) => r.item).item).sort(), ['dueAt', 'instructions', 'notes', 'points', 'proofs', 'title'])
})

test('removing one child removes their rows and files, keeps their unanswered report without a name, and leaves the rest of the family', async () => {
  const { mom, kids: [aarav, diya] } = await household(['Aarav', 'Diya'])
  await approved(mom, aarav, { seen: true, upload: { bytes: png(), name: 'first.png' } })
  const diyaTask = await sentProof(mom, diya)
  const proofs = await db.proof.findMany({ where: { task: { childId: aarav.id } } })
  const reported = (await aarav.api.post('/reports', { details: 'Something felt wrong.' })).body.id
  const answered = (await diya.api.post('/reports', { details: 'Please look.' })).body.id
  reportIds.push(reported, answered)
  assert.equal((await moderator.post(`/reports/${answered}/resolve`, { note: 'Done.' })).status, 200)
  assert.equal((await mom.api.del(`/children/${aarav.id}`)).status, 204)
  assert.equal(await db.task.count({ where: { childId: aarav.id } }), 0)
  assert.equal(await db.award.count({ where: { childId: aarav.id } }), 0)
  assert.equal((await readdir(process.env.UPLOAD_DIR)).includes(proofs[0].id), false)
  assert.equal((await db.report.findUniqueOrThrow({ where: { id: reported } })).byId, null)
  assert.equal((await db.report.findUniqueOrThrow({ where: { id: answered } })).byId, diya.id) // Diya's own, untouched
  assert.equal(await db.task.count({ where: { id: diyaTask } }), 1)
  assert.equal((await mom.api.get('/children')).body.length, 1)
})
