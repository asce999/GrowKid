import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { db } from '../src/db.js'
import { as, family, start } from './helpers.js'

const entry = fileURLToPath(new URL('../src/index.js', import.meta.url))
const boot = (changes) => spawnSync(process.execPath, [entry], { env: { ...process.env, ...changes }, encoding: 'utf8', timeout: 20_000 })

// Each case must exit 1 AND name its own variable, so a crash for another reason cannot pass.
const broken = [
  ['NODE_ENV unset', { NODE_ENV: undefined }, 'NODE_ENV'],
  ['NODE_ENV not one of the three', { NODE_ENV: 'staging' }, 'NODE_ENV'],
  ['DATABASE_URL unset', { DATABASE_URL: undefined }, 'DATABASE_URL'],
  ['JWT_SECRET unset', { JWT_SECRET: undefined }, 'JWT_SECRET'],
  ['JWT_SECRET under 32 characters', { JWT_SECRET: 'x'.repeat(31) }, 'JWT_SECRET'],
  ['TZ unset', { TZ: undefined }, 'TZ'],
  ['TZ not a real zone', { TZ: 'Nowhere/Nothing' }, 'TZ'],
  ['PORT unset', { PORT: undefined }, 'PORT'],
  ['PORT not a number', { PORT: 'abc' }, 'PORT'],
  ['UPLOAD_DIR unset', { UPLOAD_DIR: undefined }, 'UPLOAD_DIR'],
  ['UPLOAD_DIR relative', { UPLOAD_DIR: 'uploads' }, 'UPLOAD_DIR'],
]
for (const [name, changes, variable] of broken) {
  test(`boot exits 1 with ${name}`, () => {
    const run = boot(changes)
    assert.equal(run.status, 1)
    assert.match(run.stderr, new RegExp(variable))
  })
}

test('boot succeeds with a good environment (control for the cases above) and seeds no demo family', { timeout: 20_000 }, async () => {
  const users = await db.user.count()
  const child = spawn(process.execPath, [entry], { env: { ...process.env, PORT: '0' } })
  let out = ''
  const listening = new Promise((done, fail) => {
    child.stdout.on('data', (chunk) => /listening on 127\.0\.0\.1:\d+/.test((out += chunk)) && done())
    child.on('exit', (code) => fail(new Error(`exited with ${code}`)))
  })
  try {
    await listening
    assert.equal(await db.user.count(), users) // starting the server writes nothing: the demo family comes only from `npm run seed`
  } finally {
    child.kill()
  }
})

test('production mode: the session cookie is Secure, and an X-Clock-Days header moves nothing', { timeout: 30_000 }, async () => {
  const child = spawn(process.execPath, [entry], { env: { ...process.env, NODE_ENV: 'production', PORT: '0' } })
  let out = ''
  const listening = new Promise((done, fail) => {
    child.stdout.on('data', (chunk) => {
      const found = /listening on 127\.0\.0\.1:(\d+)/.exec((out += chunk))
      if (found) done(found[1])
    })
    child.on('exit', (code) => fail(new Error(`exited with ${code}`)))
  })
  let reportId
  const password = 'parent-pass-1'
  const parent = as(`http://127.0.0.1:${await listening}/api`, { days: 30 }) // asks for a month ahead on every request
  try {
    const signUp = await parent.post('/parents', { name: 'Prod Parent', email: `prod-${randomUUID()}@example.com`, password, country: 'IN' })
    assert.equal(signUp.status, 201)
    assert.ok(signUp.headers.getSetCookie().some((cookie) => /;\s*Secure(;|$)/i.test(cookie)), 'the cookie is Secure')
    const report = await parent.post('/reports', { details: 'Which day is it?' })
    assert.equal(report.status, 201)
    reportId = report.body.id
    assert.ok(Math.abs(new Date(report.body.sentAt) - Date.now()) < 5 * 60_000, 'the stored time is now, not 30 days ahead')
  } finally {
    await parent.post('/me/delete', { password }) // the family goes; its unanswered report is kept without a sender, so that goes by id
    if (reportId) await db.report.deleteMany({ where: { id: reportId } })
    child.kill()
  }
})

test('S11: families in India and the United States sending proof at the same instant near midnight land in different weeks', async () => {
  assert.equal(new Date(2026, 5, 1).getTimezoneOffset(), 0) // TZ=UTC in the env files, so a day that forgets its zone shows as the UTC day
  const DAY = 86_400_000
  const instant = new Date()
  instant.setUTCHours(19, 0, 0, 0) // a Sunday at 19:00 UTC: already Monday 00:30 in India, still Sunday afternoon in New York
  instant.setUTCDate(instant.getUTCDate() + ((7 - instant.getUTCDay()) % 7))
  if (instant <= Date.now()) instant.setUTCDate(instant.getUTCDate() + 7)
  const days = (instant - Date.now()) / DAY // the dev clock moves this far, on every request below
  const server = await start()
  const mothers = []
  try {
    const weekOf = async (country) => {
      const mom = await family(server.base, { country })
      mothers.push(mom)
      const username = `k${randomUUID().slice(0, 8)}`
      const child = await mom.api.post('/children', { name: 'Kid', username, password: 'kid-pass-1' })
      const parent = as(server.base, { days })
      await parent.post('/session', { identifier: mom.email, password: mom.password })
      const kid = as(server.base, { days })
      await kid.post('/session', { identifier: username, password: 'kid-pass-1' })
      await db.quest.create({ data: { childId: child.body.id, target: 1, bonus: 5, setAt: instant } })
      const task = await parent.post('/tasks', { childId: child.body.id, category: 'study', title: 'Read a page', instructions: 'Any page.', dueAt: new Date(+instant + DAY).toISOString(), points: 20 })
      const sent = await kid.form(`/tasks/${task.body.id}/proofs`, { note: 'read it' })
      const done = await parent.post(`/tasks/${task.body.id}/review`, { proofId: sent.body.proofs[0].id, result: 'approved' })
      assert.equal(done.status, 200)
      return (await db.questAward.findFirstOrThrow({ where: { childId: child.body.id } })).week
    }
    const monday = (offset) => new Date(+instant + offset * DAY).toISOString().slice(0, 10)
    assert.equal(await weekOf('IN'), monday(1)) // the proof was sent on Monday there
    assert.equal(await weekOf('US'), monday(-6)) // and on Sunday there: the week before
  } finally {
    await Promise.all(mothers.map((mom) => mom.api.post('/me/delete', { password: mom.password })))
    await server.close()
  }
})
