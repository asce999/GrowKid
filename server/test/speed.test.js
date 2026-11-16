import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { db } from '../src/db.js'
import { as, family, start } from './helpers.js'

/** Final plan Phase 4: the task list's window and the history (P2), and Today's one call (P1). */

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

/**
 * A family whose child has `old` tasks approved 40 days ago, plus two approved yesterday, one approved long ago whose result the
 * child has not seen, and three still open. Rows go in directly: 1,000 approvals through the API would take minutes.
 */
async function longHistory(old) {
  const mom = await family(server.base)
  made.push(mom)
  const login = { name: 'Asha', username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1' }
  const child = (await mom.api.post('/children', { ...login, consent: true })).body
  const kid = as(server.base)
  await kid.post('/session', { identifier: login.username, password: login.password })
  const now = Date.now()
  const rows = []
  const proofs = []
  const add = (title, { status = 'approved', reviewedDaysAgo, seen = true, dueDaysAgo }) => {
    const id = randomUUID()
    const due = new Date(now - dueDaysAgo * DAY)
    rows.push({ id, childId: child.id, category: 'chores', title, instructions: 'Done.', dueAt: due, points: 5, status, resultSeen: seen, createdAt: new Date(+due - DAY) })
    if (status === 'approved') {
      const reviewed = new Date(now - reviewedDaysAgo * DAY)
      proofs.push({ id: randomUUID(), taskId: id, sentAt: new Date(+reviewed - 3_600_000), late: false, result: 'approved', reviewBy: 'Test Parent', reviewedAt: reviewed })
    }
    return id
  }
  for (let i = 0; i < old; i++) add(`Old ${i}`, { reviewedDaysAgo: 40, dueDaysAgo: 41 + i / 1000 })
  const recent = [add('Yesterday A', { reviewedDaysAgo: 1, dueDaysAgo: 2 }), add('Yesterday B', { reviewedDaysAgo: 1, dueDaysAgo: 2.5 })]
  const unseen = add('Not seen yet', { reviewedDaysAgo: 60, seen: false, dueDaysAgo: 61 })
  const open = [1, 2, 3].map((n) => add(`Open ${n}`, { status: 'todo', dueDaysAgo: -n }))
  await db.task.createMany({ data: rows })
  await db.proof.createMany({ data: proofs })
  return { mom, kid, child, recent, unseen, open }
}

test('P2: with 1,000 tasks approved long ago, the task list holds only the window, for the parent and the child alike', async () => {
  const { mom, kid, recent, unseen, open } = await longHistory(1000)
  const expected = [unseen, ...recent.reverse(), ...open] // soonest due first: the oldest due is the unseen one
  for (const api of [mom.api, kid]) {
    const res = await api.get('/tasks')
    assert.equal(res.status, 200, JSON.stringify(res.body))
    const listed = res.body
    assert.deepEqual(listed.map((t) => t.id), expected)
  }
})

test('P1: GET /today answers the same window, the growth and the stickers in one call, and only to a child', async () => {
  const { mom, kid } = await longHistory(3)
  const today = await kid.get('/today')
  assert.equal(today.status, 200)
  assert.deepEqual(Object.keys(today.body).sort(), ['agreement', 'answers', 'growth', 'stickers', 'tasks']) // K2, K7: answers and the agreement too
  assert.deepEqual(today.body.tasks, (await kid.get('/tasks')).body) // inWindow and the query agree
  assert.deepEqual(today.body.growth, (await kid.get('/growth')).body)
  assert.deepEqual(today.body.stickers, (await kid.get('/stickers')).body)
  assert.equal(today.body.growth.points, 3 * 5 + 2 * 5 + 5) // every approval still counts, inside the window or not
  assert.equal((await mom.api.get('/today')).status, 403)
  assert.equal((await as(server.base).get('/today')).status, 401)
})

test('P2: GET /tasks/history pages through approved tasks, newest due first, 50 at most, never another family\'s', async () => {
  const { mom, kid } = await longHistory(120)
  const pages = []
  for (let offset = 0; ; offset += 50) {
    const page = (await kid.get(`/tasks/history?offset=${offset}`)).body
    pages.push(page.length)
    if (page.length < 50) break
  }
  assert.deepEqual(pages, [50, 50, 23]) // 120 old, 2 recent, 1 unseen: 123 approved
  const first = (await mom.api.get('/tasks/history?limit=5')).body
  assert.deepEqual(first.map((t) => t.title), ['Yesterday A', 'Yesterday B', 'Old 0', 'Old 1', 'Old 2'])
  assert.ok(first.every((t) => t.status === 'approved'))
  for (const query of ['?limit=500', '?limit=abc', '?offset=-1', '?limit=0']) {
    const page = (await kid.get(`/tasks/history${query}`)).body
    assert.ok(page.length >= 1 && page.length <= 50, query) // bad values fall back; the cap holds
  }
  const stranger = await family(server.base)
  made.push(stranger)
  assert.deepEqual((await stranger.api.get('/tasks/history')).body, [])
})
