import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { db } from '../src/db.js'
import { dayKey } from '../src/scoring.js'
import { as, family, start } from './helpers.js'

/** Final plan Phase 5: repeating tasks (sitemap rule 9, H1 to H3) and "what done looks like" (H5). */

let server
const made = []
before(async () => {
  server = await start()
})
after(async () => {
  await Promise.all(made.map((mom) => mom.api.post('/me/delete', { password: mom.password })))
  await server.close()
})

const refused = (res, status, code, fields) => assert.deepEqual([res.status, res.body], [status, fields ? { code, fields } : { code }])
const ALL_WEEK = 127
const today = () => dayKey(new Date(), 'Asia/Kolkata') // the families here are in India

async function household() {
  const mom = await family(server.base)
  made.push(mom)
  const login = { name: 'Asha', username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1' }
  const child = (await mom.api.post('/children', { ...login, consent: true })).body
  const kid = as(server.base)
  await kid.post('/session', { identifier: login.username, password: login.password })
  return { mom, kid, child }
}
const body = (child, more) => ({ childId: child.id, category: 'chores', title: 'Feed the cat', instructions: 'Half a scoop.', doneLooksLike: 'The bowl is full.', points: 10, weekdays: ALL_WEEK, dueTime: '23:59', ...more })
const fromSeries = (id) => db.task.findMany({ where: { seriesId: id } })

test('H2: a series makes exactly one task for today, however many loads race, due at its time in the family\'s zone', async () => {
  const { mom, kid, child } = await household()
  const made = await mom.api.post('/series', body(child))
  assert.equal(made.status, 201)
  assert.deepEqual(Object.keys(made.body).sort(), ['active', 'category', 'childId', 'doneLooksLike', 'dueTime', 'id', 'instructions', 'points', 'title', 'weekdays'])
  await Promise.all([...Array(6)].flatMap(() => [mom.api.get('/tasks'), kid.get('/tasks'), kid.get('/today')]))
  const tasks = await fromSeries(made.body.id)
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].seriesDay, today())
  assert.equal(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }).format(tasks[0].dueAt), '23:59')
  const listed = (await kid.get('/tasks')).body.find((t) => t.seriesId === made.body.id)
  assert.deepEqual([listed.title, listed.doneLooksLike, listed.status], ['Feed the cat', 'The bowl is full.', 'todo'])
})

test('H2: no task today when today is not one of its weekdays, or its time had passed when it was made; tomorrow it makes one', async () => {
  const { mom, kid, child } = await household()
  const [y, m, d] = today().split('-').map(Number)
  const todayBit = 1 << ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7)
  const otherDays = await mom.api.post('/series', body(child, { weekdays: ALL_WEEK & ~todayBit }))
  const passed = await mom.api.post('/series', body(child, { dueTime: '00:00' })) // midnight has gone by today
  await kid.get('/tasks')
  assert.equal((await fromSeries(otherDays.body.id)).length, 0)
  assert.equal((await fromSeries(passed.body.id)).length, 0)
  await as(server.base, { days: 1 }).get('/session') // the server's clock moves a day for the next request that asks (DEV_CLOCK)
  const tomorrow = as(server.base, { days: 1 })
  await tomorrow.post('/session', { identifier: (await db.user.findUniqueOrThrow({ where: { id: child.id } })).username, password: 'child-pass-1' })
  await tomorrow.get('/tasks')
  assert.equal((await fromSeries(passed.body.id)).length, 1) // the next day it runs
  assert.equal((await fromSeries(otherDays.body.id)).length, 1) // tomorrow is one of its days
})

test('H3: a change touches only the tasks made after it; stopping keeps every task it made', async () => {
  const { mom, kid, child } = await household()
  const made = await mom.api.post('/series', body(child))
  await kid.get('/tasks')
  const changed = await mom.api.put(`/series/${made.body.id}`, body(child, { title: 'Feed the dog', points: 20 }))
  assert.deepEqual([changed.status, changed.body.title, changed.body.points], [200, 'Feed the dog', 20])
  const [first] = await fromSeries(made.body.id)
  assert.deepEqual([first.title, first.points], ['Feed the cat', 10]) // already made: unchanged
  assert.equal((await mom.api.del(`/series/${made.body.id}`)).status, 204)
  const kept = await db.task.findUniqueOrThrow({ where: { id: first.id } })
  assert.equal(kept.seriesId, null)
  assert.deepEqual((await mom.api.get('/series')).body, [])
})

test('H1: a series is checked and screened as a task is, for the parent\'s own child, at most 20 per child', async () => {
  const { mom, kid, child } = await household()
  const stranger = await household()
  refused(await mom.api.post('/series', body(child, { weekdays: 0 })), 400, 'INVALID', { weekdays: 'range' })
  refused(await mom.api.post('/series', body(child, { weekdays: 128, dueTime: '24:00', points: 7 })), 400, 'INVALID', { weekdays: 'range', dueTime: 'format', points: 'range' })
  refused(await mom.api.post('/series', body(child, { doneLooksLike: 'x'.repeat(201) })), 400, 'INVALID', { doneLooksLike: 'length' })
  refused(await mom.api.post('/series', body(child, { doneLooksLike: 'our secret' })), 400, 'SCREENED', { word: 'secret' })
  refused(await mom.api.post('/series', body(stranger.child)), 404, 'NOT_FOUND')
  refused(await kid.post('/series', body(child)), 403, 'NOT_ALLOWED')
  refused(await stranger.mom.api.put(`/series/${(await mom.api.post('/series', body(child))).body.id}`, body(child)), 404, 'NOT_FOUND')
  for (let i = 0; i < 19; i++) assert.equal((await mom.api.post('/series', body(child, { weekdays: 1 }))).status, 201)
  refused(await mom.api.post('/series', body(child)), 409, 'QUOTA', { quota: 'series' })
  assert.equal((await stranger.mom.api.get('/series')).body.length, 0) // never another family's
})

test('H5: a task carries what done looks like, up to 200 characters, screened', async () => {
  const { mom, child } = await household()
  const task = { childId: child.id, category: 'study', title: 'Read a page', instructions: 'Any page.', dueAt: new Date(Date.now() + 86_400_000).toISOString(), points: 20 }
  const plain = await mom.api.post('/tasks', task)
  assert.equal(plain.body.doneLooksLike, '') // optional
  const shown = await mom.api.post('/tasks', { ...task, doneLooksLike: '  A photo of the page.  ' })
  assert.equal(shown.body.doneLooksLike, 'A photo of the page.')
  refused(await mom.api.post('/tasks', { ...task, doneLooksLike: 'x'.repeat(201) }), 400, 'INVALID', { doneLooksLike: 'length' })
  refused(await mom.api.post('/tasks', { ...task, doneLooksLike: 'take a dare' }), 400, 'SCREENED', { word: 'dare' })
})
