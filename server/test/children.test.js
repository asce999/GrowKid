import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { db } from '../src/db.js'
import { png } from './fixtures.js'
import { as, family, start } from './helpers.js'

// Final plan Phase 6, "Children want to come back": sitemap rules 3 (K1), 14 (K4, K5), 18 (K2, K3) and 29 (K6, K7).

let server
const made = []
before(async () => {
  server = await start()
})
after(async () => {
  await Promise.all(made.map((mom) => mom.api.post('/me/delete', { password: mom.password })))
  await server.close()
})

const DAY = 86_400_000
const refused = (res, status, code) => {
  assert.equal(res.status, status)
  assert.equal(res.body.code, code)
}

async function household(names = ['Kid']) {
  const mom = await family(server.base)
  made.push(mom)
  const kids = []
  for (const name of names) {
    const sent = { name, username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1', consent: true }
    const res = await mom.api.post('/children', sent)
    assert.equal(res.status, 201)
    const api = as(server.base)
    assert.equal((await api.post('/session', { identifier: sent.username, password: sent.password })).status, 200)
    kids.push({ ...res.body, api })
  }
  return { mom, kid: kids[0], kids }
}

/** A task set, proved (with a note, or a file) and approved; seen on Today when `seen`. Returns the task id. */
async function approved(mom, kid, { category = 'chores', seen = false, upload } = {}) {
  const created = await mom.api.post('/tasks', {
    childId: kid.id, category, title: 'Tidy the room', instructions: 'Floor clear.', points: 20, dueAt: new Date(Date.now() + DAY).toISOString(),
  })
  assert.equal(created.status, 201)
  const sent = await kid.api.form(`/tasks/${created.body.id}/proofs`, { note: 'Done!' }, upload)
  assert.equal(sent.status, 201)
  assert.equal((await mom.api.post(`/tasks/${created.body.id}/review`, { proofId: sent.body.proofs[0].id, result: 'approved', cheer: { kind: 'proud', line: '' } })).status, 200)
  if (seen) assert.equal((await kid.api.post('/tasks/seen', { taskIds: [created.body.id] })).status, 204)
  return created.body.id
}
const reward = async (mom, title, cost) => (await mom.api.post('/rewards', { title, cost })).body

test('K1 and K4: the kinds sticker names the kinds still missing, and growth has the child\'s own weeks and best week, from what they have been shown', async () => {
  const { mom, kid } = await household()
  await approved(mom, kid, { category: 'reading' })
  const kinds = async () => (await kid.api.get('/stickers')).body.find((s) => s.id === 'all-kinds')
  assert.deepEqual((await kinds()).missing, ['chores', 'study', 'reading', 'creative', 'outdoors', 'health']) // not yet shown on Today
  let growth = (await kid.api.get('/growth')).body
  assert.deepEqual([growth.weeks.length, growth.weeks.at(-1).tasks, growth.bestWeek], [6, 0, 0])

  const tasks = (await kid.api.get('/tasks')).body
  assert.equal((await kid.api.post('/tasks/seen', { taskIds: tasks.map((t) => t.id) })).status, 204)
  assert.deepEqual((await kinds()).missing, ['chores', 'study', 'creative', 'outdoors', 'health'])
  assert.equal((await kinds()).have, 1)
  growth = (await kid.api.get('/growth')).body
  assert.deepEqual([growth.weeks.at(-1).tasks, growth.weeks.at(-1).xp, growth.bestWeek], [1, 20, 1])
  const today = (await kid.api.get('/today')).body
  assert.deepEqual([today.growth.bestWeek, today.growth.weeks.length], [1, 6])
})

test('K2: an answer is new to the child until Today has shown it: counted, listed on Today, then marked seen on their own requests only', async () => {
  const { mom, kids: [aarav, diya] } = await household(['Aarav', 'Diya'])
  await approved(mom, aarav, { seen: true })
  const treat = await reward(mom, 'A treat', 10)
  const asked = (await aarav.api.post('/requests', { rewardId: treat.id })).body
  assert.deepEqual((await aarav.api.get('/counts')).body, { results: 0, answers: 0 }) // waiting is not an answer
  assert.equal((await mom.api.post(`/requests/${asked.id}/answer`, { result: 'given' })).status, 200)

  assert.deepEqual((await aarav.api.get('/counts')).body, { results: 0, answers: 1 })
  const today = (await aarav.api.get('/today')).body
  assert.deepEqual(today.answers.map((r) => [r.id, r.status]), [[asked.id, 'given']])
  assert.equal((await diya.api.post('/requests/seen', { ids: [asked.id] })).status, 204) // a sibling's ids change nothing
  assert.equal((await aarav.api.get('/counts')).body.answers, 1)
  refused(await aarav.api.post('/requests/seen', { ids: 'all' }), 400, 'INVALID')
  refused(await mom.api.post('/requests/seen', { ids: [asked.id] }), 403, 'NOT_ALLOWED')
  assert.equal((await aarav.api.post('/requests/seen', { ids: [asked.id] })).status, 204)
  assert.deepEqual([(await aarav.api.get('/counts')).body.answers, (await aarav.api.get('/today')).body.answers], [0, []])
})

test('K3: a savings goal is one of the family\'s rewards or none; deleting the reward or asking for it clears it', async () => {
  const { mom, kid } = await household()
  const stranger = await household()
  const bike = await reward(mom, 'A new bike bell', 500)
  const theirs = await reward(stranger.mom, 'Not ours', 10)
  assert.equal((await kid.api.get('/growth')).body.goal, null)
  assert.deepEqual((await kid.api.put('/goal', { rewardId: bike.id })).body, { goal: bike })
  assert.deepEqual((await kid.api.get('/growth')).body.goal, bike)
  assert.deepEqual((await kid.api.get('/today')).body.growth.goal, bike)
  refused(await kid.api.put('/goal', { rewardId: theirs.id }), 404, 'NOT_FOUND')
  refused(await kid.api.put('/goal', { rewardId: 42 }), 404, 'NOT_FOUND')
  refused(await mom.api.put('/goal', { rewardId: bike.id }), 403, 'NOT_ALLOWED')
  assert.deepEqual((await kid.api.put('/goal', { rewardId: null })).body, { goal: null })

  assert.equal((await kid.api.put('/goal', { rewardId: bike.id })).status, 200)
  assert.equal((await mom.api.del(`/rewards/${bike.id}`)).status, 204)
  assert.equal((await kid.api.get('/growth')).body.goal, null) // the database cleared it

  await approved(mom, kid, { seen: true })
  const sticker = await reward(mom, 'A sticker sheet', 20)
  assert.equal((await kid.api.put('/goal', { rewardId: sticker.id })).status, 200)
  assert.equal((await kid.api.post('/requests', { rewardId: sticker.id })).status, 201)
  assert.equal((await kid.api.get('/growth')).body.goal, null) // asked for: no longer a goal
})

test('K5: my proofs lists the child\'s approved photos once Today has shown them, newest first, and never a note-only proof', async () => {
  const { mom, kid } = await household()
  const photo = await approved(mom, kid, { upload: { bytes: png(), name: 'mine.png' } })
  await approved(mom, kid, { seen: true }) // a note alone has no file
  assert.deepEqual((await kid.api.get('/proofs/mine')).body, []) // the photo's approval is not yet shown
  assert.equal((await kid.api.post('/tasks/seen', { taskIds: [photo] })).status, 204)
  const [item, ...rest] = (await kid.api.get('/proofs/mine')).body
  assert.deepEqual(rest, [])
  assert.deepEqual([item.taskId, item.taskTitle, item.fileType, item.cheer], [photo, 'Tidy the room', 'image/png', { kind: 'proud', line: '' }])
  assert.equal(item.fileUrl, `/api/proofs/${item.id}/file`)
  assert.equal((await kid.api.get(`/proofs/${item.id}/file`)).status, 200)
  assert.deepEqual((await kid.api.get('/proofs/mine?offset=1')).body, [])
  assert.equal((await kid.api.get('/proofs/mine?limit=x&offset=-1')).body.length, 1) // a bad number is the default
  refused(await mom.api.get('/proofs/mine'), 403, 'NOT_ALLOWED')
  const other = await household()
  assert.deepEqual((await other.kid.api.get('/proofs/mine')).body, [])
})

test('K6: a child suggests ideas by id only, at most 3 waiting; the parent answers each once; nobody else can', async () => {
  const { mom, kid } = await household(['Diya'])
  const stranger = await household()
  refused(await kid.api.post('/suggestions', { ideaId: 'Not An Id!' }), 400, 'INVALID')
  refused(await kid.api.post('/suggestions', { ideaId: 'x'.repeat(41) }), 400, 'INVALID')
  refused(await kid.api.post('/suggestions', {}), 400, 'INVALID')
  refused(await mom.api.post('/suggestions', { ideaId: 'chores-1' }), 403, 'NOT_ALLOWED')
  const first = await kid.api.post('/suggestions', { ideaId: 'chores-1', title: 'ignored' })
  assert.equal(first.status, 201)
  assert.deepEqual(Object.keys(first.body).sort(), ['childId', 'childName', 'createdAt', 'id', 'ideaId'])
  const again = await kid.api.post('/suggestions', { ideaId: 'chores-1' })
  assert.deepEqual([again.status, again.body.id], [200, first.body.id]) // the same idea waiting is not a second one
  assert.equal((await kid.api.post('/suggestions', { ideaId: 'study-2' })).status, 201)
  assert.equal((await kid.api.post('/suggestions', { ideaId: 'gone-idea' })).status, 201)
  const over = await kid.api.post('/suggestions', { ideaId: 'health-1' })
  assert.deepEqual([over.status, over.body.code, over.body.fields], [409, 'QUOTA', { quota: 'suggestions' }])

  const list = (await mom.api.get('/suggestions')).body
  assert.deepEqual(list.map((s) => [s.ideaId, s.childName]), [['chores-1', 'Diya'], ['study-2', 'Diya'], ['gone-idea', 'Diya']])
  assert.equal((await kid.api.get('/suggestions')).body.length, 3)
  assert.deepEqual((await stranger.mom.api.get('/suggestions')).body, [])
  refused(await stranger.mom.api.post(`/suggestions/${first.body.id}/answer`, { result: 'declined' }), 404, 'NOT_FOUND')
  refused(await kid.api.post(`/suggestions/${first.body.id}/answer`, { result: 'declined' }), 403, 'NOT_ALLOWED')
  refused(await mom.api.post(`/suggestions/${first.body.id}/answer`, { result: 'maybe' }), 400, 'INVALID')
  assert.equal((await mom.api.post(`/suggestions/${first.body.id}/answer`, { result: 'accepted' })).status, 204)
  refused(await mom.api.post(`/suggestions/${first.body.id}/answer`, { result: 'declined' }), 409, 'REVIEWED')
  assert.equal((await kid.api.get('/suggestions')).body.length, 2) // answered ones leave both lists
  assert.equal((await kid.api.post('/suggestions', { ideaId: 'health-1' })).status, 201) // room again
})

test('K7: Today asks a child to agree to their series and the family\'s rewards; agreeing records it; the parent sees it and can ask again', async () => {
  const { mom, kid } = await household()
  const stranger = await household()
  assert.equal((await kid.api.get('/today')).body.agreement, null) // nothing to agree to yet
  const treat = await reward(mom, 'A treat', 30)
  assert.equal((await mom.api.post('/series', {
    childId: kid.id, category: 'chores', title: 'Feed the cat', instructions: 'One scoop.', points: 10, weekdays: 1 | 4, dueTime: '18:00',
  })).status, 201)
  const { agreement } = (await kid.api.get('/today')).body
  assert.deepEqual(agreement.rewards, [treat])
  assert.deepEqual(agreement.series.map((s) => [s.title, s.weekdays, s.dueTime, s.points]), [['Feed the cat', 5, '18:00', 10]])

  refused(await mom.api.post('/agree'), 403, 'NOT_ALLOWED')
  assert.equal((await kid.api.post('/agree')).status, 204)
  assert.deepEqual(Object.keys((await kid.api.get('/today')).body.agreement), ['agreedAt']) // the child still sees when, as the parent does
  const child = (await mom.api.get(`/children/${kid.id}`)).body
  assert.ok(Date.now() - new Date(child.agreedAt) < 60_000)

  refused(await stranger.mom.api.del(`/children/${kid.id}/agreement`), 404, 'NOT_FOUND')
  assert.equal((await mom.api.del(`/children/${kid.id}/agreement`)).status, 204)
  assert.equal('agreedAt' in (await mom.api.get(`/children/${kid.id}`)).body, false)
  assert.equal((await kid.api.get('/today')).body.agreement.rewards.length, 1)
})

test('K8: ten approved tasks of one kind earn that kind\'s star, with the kind\'s icon named; the chart has twenty', async () => {
  const { mom, kid } = await household()
  for (let i = 0; i < 10; i++) await approved(mom, kid, { category: 'health', seen: true })
  const list = (await kid.api.get('/stickers')).body
  assert.equal(list.length, 20)
  const health = list.find((s) => s.id === 'kind-health')
  assert.deepEqual([health.kind, health.shape, health.seen, typeof health.earnedAt], ['health', 'star', true, 'string'])
  assert.deepEqual(list.find((s) => s.id === 'kind-study').have, 0)

  // a child who had 10 before the kind stickers existed gets theirs with the next approval, of any kind
  await db.award.deleteMany({ where: { childId: kid.id, stickerId: 'kind-health' } })
  const next = await approved(mom, kid, { category: 'reading', seen: true })
  const caught = (await kid.api.get('/stickers')).body.find((s) => s.id === 'kind-health')
  assert.deepEqual([caught.taskId, caught.seen], [next, true])
})

test('K10 and K11: a child picks a badge from four colours and a sticker they have seen, sets sound, and the family sees the badge', async () => {
  const { mom, kids: [aarav, diya] } = await household(['Aarav', 'Diya'])
  await approved(mom, aarav) // first-task earned, not yet seen
  const badge = (body) => aarav.api.put('/me/avatar', body)
  refused(await badge({ colour: 'sun', stickerId: 'first-task' }), 400, 'INVALID') // not seen on Today yet
  const tasks = (await aarav.api.get('/tasks')).body
  assert.equal((await aarav.api.post('/tasks/seen', { taskIds: tasks.map((t) => t.id) })).status, 204)
  const wrong = await badge({ colour: 'pink', stickerId: 'tasks-50' })
  assert.deepEqual(wrong.body, { code: 'INVALID', fields: { colour: 'required', stickerId: 'required' } })
  refused(await badge({ colour: 'sun' }), 400, 'INVALID')
  refused(await mom.api.put('/me/avatar', { colour: 'sun', stickerId: 'first-task' }), 403, 'NOT_ALLOWED')
  const set = await badge({ colour: 'sun', stickerId: 'first-task' })
  assert.deepEqual(set.body.avatar, { colour: 'sun', stickerId: 'first-task', shape: 'seal' })
  assert.deepEqual((await aarav.api.get('/session')).body.avatar, set.body.avatar)
  assert.deepEqual((await mom.api.get('/children')).body.find((c) => c.id === aarav.id).avatar, set.body.avatar)
  assert.equal((await mom.api.put('/settings', { leaderboard: true })).status, 200)
  const board = (await diya.api.get('/leaderboard')).body
  assert.deepEqual(board.find((e) => e.name === 'Aarav').avatar, set.body.avatar)
  assert.equal('avatar' in board.find((e) => e.name === 'Diya'), false)
  assert.equal('avatar' in (await badge({ colour: null, stickerId: null })).body, false)

  assert.equal((await aarav.api.get('/session')).body.sound, true)
  refused(await aarav.api.put('/me/sound', { sound: 'off' }), 400, 'INVALID')
  assert.equal((await aarav.api.put('/me/sound', { sound: false })).body.sound, false)
  assert.equal((await aarav.api.get('/session')).body.sound, false)
  assert.equal('sound' in (await mom.api.get('/session')).body, false)
  refused(await mom.api.put('/me/sound', { sound: false }), 403, 'NOT_ALLOWED')
})
