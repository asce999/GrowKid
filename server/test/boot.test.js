import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
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
  // F8: never where a sync client would copy the proof files to another company
  ['UPLOAD_DIR inside the repository', { UPLOAD_DIR: fileURLToPath(new URL('../uploads', import.meta.url)) }, 'UPLOAD_DIR must be outside the repository'],
  ['UPLOAD_DIR the repository itself', { UPLOAD_DIR: fileURLToPath(new URL('../..', import.meta.url)) }, 'UPLOAD_DIR must be outside the repository'],
  ...['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial'].map((name) => [
    `UPLOAD_DIR inside the ${name} folder`,
    { [name]: path.join(tmpdir(), 'growkid-synced'), UPLOAD_DIR: path.join(tmpdir(), 'growkid-synced', 'deep', 'proofs') },
    'UPLOAD_DIR must not be inside a OneDrive folder',
  ]),
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

// The clock header is read only with DEV_CLOCK=1 outside production (F2). .env.test sets the switch, so each case here takes one away.
// Empty, not unset: Prisma's client loads server/.env for any variable the process lacks, so an unset DEV_CLOCK would take that file's.
const clockOff = [
  ['production mode: the session cookie is Secure, and an X-Clock-Days header moves nothing', { NODE_ENV: 'production' }, true],
  ['with DEV_CLOCK empty the X-Clock-Days header moves nothing, in test mode too', { DEV_CLOCK: '' }, false],
  ['DEV_CLOCK set to anything but 1 is off', { DEV_CLOCK: 'true' }, false],
]
for (const [name, changes, secure] of clockOff) test(name, { timeout: 30_000 }, async () => {
  const child = spawn(process.execPath, [entry], { env: { ...process.env, ...changes, PORT: '0' } })
  let out = ''
  const listening = new Promise((done, fail) => {
    child.stdout.on('data', (chunk) => {
      const found = /listening on 127\.0\.0\.1:(\d+)/.exec((out += chunk))
      if (found) done(found[1])
    })
    child.on('exit', (code) => fail(new Error(`exited with ${code}`)))
  })
  let reportId
  const password = 'grown-up-pass-1'
  const parent = as(`http://127.0.0.1:${await listening}/api`, { days: 30 }) // asks for a month ahead on every request
  try {
    const signUp = await parent.post('/parents', { name: 'Prod Parent', email: `prod-${randomUUID()}@example.com`, password, country: 'IN', consent: true })
    assert.equal(signUp.status, 201)
    assert.equal(signUp.headers.getSetCookie().some((cookie) => /;\s*Secure(;|$)/i.test(cookie)), secure, 'the cookie is Secure in production only')
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
      const child = await mom.api.post('/children', { consent: true, name: 'Kid', username, password: 'child-pass-1' })
      const parent = as(server.base, { days })
      await parent.post('/session', { identifier: mom.email, password: mom.password })
      const kid = as(server.base, { days })
      await kid.post('/session', { identifier: username, password: 'child-pass-1' })
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

test('a caller that never finishes its headers is cut off with 408 within 25 seconds, and an ordinary request is answered (N1)', { timeout: 45_000 }, async () => {
  const child = spawn(process.execPath, [entry], { env: { ...process.env, PORT: '0' } })
  let out = ''
  const listening = new Promise((done, fail) => {
    child.stdout.on('data', (chunk) => {
      const found = /listening on 127\.0\.0\.1:(\d+)/.exec((out += chunk))
      if (found) done(Number(found[1]))
    })
    child.on('exit', (code) => fail(new Error(`exited with ${code}`)))
  })
  try {
    const port = await listening
    const began = Date.now()
    const socket = net.connect(port, '127.0.0.1')
    socket.write('GET /api/session HTTP/1.1\r\nHost: x\r\n') // the headers never end
    let answer = ''
    socket.on('data', (chunk) => (answer += chunk))
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/session`)).status, 200) // meanwhile, a caller that does finish is served
    await once(socket, 'close')
    const seconds = (Date.now() - began) / 1000
    assert.match(answer, /^HTTP\/1\.1 408 /)
    assert.ok(seconds >= 14 && seconds < 25, `cut off after ${seconds} s`)
  } finally {
    child.kill()
  }
})
