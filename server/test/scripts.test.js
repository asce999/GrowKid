import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { db, loadChild } from '../src/db.js'
import { zoneOf } from '../src/countries.js'
import { dayKey } from '../src/scoring.js'
import { growthForChild, growthOf } from '../src/rules.js'
import { codeAt, stepAt } from '../src/totp.js'
import { demoAt, insertDemo } from '../prisma/seed.js'
import { as, family, start } from './helpers.js'

const root = fileURLToPath(new URL('..', import.meta.url))
/** Runs a script of server/ in its own process, with this process's environment (the test database) plus `env`. Never prints a value from it. */
const run = (script, env, args = []) => spawnSync(process.execPath, [script, ...args], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 120_000 })

let server
const emails = [] // moderators this file makes, removed at the end
before(async () => {
  server = await start()
})
after(async () => {
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await server.close()
})

// ------------------------------------------------------------------ the demo seed

test('the seed refuses outside development and refuses when any user exists, and writes nothing either way', async () => {
  const mom = await family(server.base) // so that this database certainly has a user
  const before = await db.user.count()
  for (const env of [{ NODE_ENV: 'production' }, { NODE_ENV: 'test' }, { NODE_ENV: '' }]) {
    const out = run('prisma/seed.js', env)
    assert.equal(out.status, 1, JSON.stringify(env))
    assert.match(out.stderr, /refusing, NODE_ENV is not development/)
  }
  const out = run('prisma/seed.js', { NODE_ENV: 'development' })
  assert.equal(out.status, 1)
  assert.match(out.stderr, /refusing, users already exist/)
  for (const text of [out.stdout, out.stderr]) assert.equal(text.includes(process.env.DATABASE_URL), false) // it prints nothing from the environment
  assert.equal(await db.user.count(), before)
  assert.equal(await db.user.count({ where: { email: 'meera@example.com' } }), 0)
  assert.equal((await mom.api.post('/me/delete', { password: mom.password })).status, 204)
})

class Rollback extends Error {}

test('the demo family the seed builds works under the rules: Asia/Kolkata hours, the cheer, stickers from the rules, a quest two to go (rolled back)', async () => {
  const zone = zoneOf('IN')
  const hourOf = (date) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
  assert.deepEqual([hourOf(demoAt(0, 18)), hourOf(demoAt(-3, 16.5)), hourOf(demoAt(2, 9))], ['18:00', '16:30', '09:00'])
  assert.equal(dayKey(demoAt(-1, 23), zone), dayKey(new Date(Date.now() - 86_400_000), zone)) // yesterday in India, though 17:30 UTC
  assert.equal(dayKey(demoAt(0, 0.5), zone), dayKey(new Date(), zone)) // half past midnight today there, which is the evening before in UTC

  await assert.rejects(
    db.$transaction(async (tx) => {
      const { counts, ids } = await insertDemo(tx)
      assert.deepEqual([counts.users, counts.tasks, counts.proofs, counts.rewards, counts.requests, counts.quests], [4, 8, 6, 3, 1, 1])
      const users = await tx.user.findMany({ where: { id: { in: Object.values(ids) } } })
      assert.deepEqual(users.map((u) => u.name).sort(), ['Aarav', 'Diya', 'Meera Joshi', 'Moderator'])
      assert.equal(users.find((u) => u.role === 'parent').country, 'IN')
      assert.ok(users.every((u) => /^[0-9a-f-]{36}$/.test(u.id) && u.passwordHash.startsWith('$2'))) // ids from the database, passwords hashed

      const aarav = await loadChild(tx, ids.aarav)
      assert.equal(aarav.zone, zone)
      const now = new Date()
      const growth = growthOf(aarav, now)
      assert.deepEqual([growth.points, growth.level, growth.streak.days], [120, 2, 5])
      assert.deepEqual([growth.shown.points, growth.shown.balance], [90, 40]) // the last approval (30) is not seen yet; the given request holds 50
      const cycling = aarav.tasks.find((t) => t.title === 'Cycle to the park and back')
      assert.deepEqual([cycling.resultSeen, cycling.proofs[0].review.cheer], [false, { kind: 'effort', line: 'Twenty minutes there and back is quick. Well done.' }])
      const drawing = aarav.tasks.find((t) => t.title.startsWith('Draw the view'))
      assert.deepEqual(drawing.proofs.map((p) => p.review.result), ['sentBack', 'approved'])
      assert.equal(hourOf(new Date(drawing.dueAt)), '18:00') // due at 6 pm in the family's zone
      assert.deepEqual(Object.keys(aarav.awards).sort(), ['first-task', 'level-2', 'streak-3'])
      assert.equal((await loadChild(tx, ids.diya)).tasks.length, 1)
      assert.equal(Object.keys((await loadChild(tx, ids.diya)).awards).length, 0)
      const quest = growthForChild(aarav, now).quest
      assert.deepEqual([quest.target - quest.done, quest.bonus, quest.sealed, quest.surprise], [2, 50, true, null]) // "2 to go", its surprise sealed from the child
      assert.equal((await tx.rewardRequest.findFirstOrThrow({ where: { childId: ids.aarav } })).status, 'given')
      throw new Rollback()
    }, { timeout: 60_000 }),
    Rollback,
  )
  assert.equal(await db.user.count({ where: { email: { in: ['meera@example.com', 'moderator@example.com'] } } }), 0) // nothing was kept
})

// ------------------------------------------------------------------ the moderator script (A4)

test('the moderator script creates, then updates, a moderator from the environment, prints the authenticator link once, removes one, and refuses a short password, argv, and another kind of account', async () => {
  const email = `Moderator-${randomUUID()}@Example.com`
  const lower = email.toLowerCase()
  emails.push(lower)
  const first = 'a long first password'
  const second = 'a long second password'
  const created = run('scripts/moderator.js', { MODERATOR_EMAIL: email, MODERATOR_PASSWORD: first })
  const [line, link, ...more] = created.stdout.trim().split(/\r?\n/)
  assert.deepEqual([created.status, line, more, created.stderr], [0, 'created', [], ''])
  assert.match(link, /^otpauth:\/\/totp\/GrowKid:.+\?secret=[A-Z2-7]{32}&issuer=GrowKid&algorithm=SHA1&digits=6&period=30$/) // T1
  const secret = new URL(link).searchParams.get('secret')
  const row = await db.user.findUniqueOrThrow({ where: { email: lower } })
  assert.deepEqual([row.role, row.name, row.tokenVersion, row.totpSecret], ['moderator', 'Moderator', 0, secret])

  /** A sign-in with a code from `key`. A code works once, so the step is freed first, as the test helper does. */
  const signIn = async (password, key = secret, api = as(server.base)) => {
    await db.user.update({ where: { email: lower }, data: { totpLastStep: null } })
    return { api, res: await api.post('/session', { identifier: email, password, code: codeAt(key, stepAt()) }) }
  }
  const { api, res } = await signIn(first)
  assert.equal(res.status, 200)
  assert.equal((await api.get('/reports')).status, 200)
  const updated = run('scripts/moderator.js', { MODERATOR_EMAIL: email, MODERATOR_PASSWORD: second })
  assert.deepEqual([updated.status, updated.stdout.trim(), updated.stderr], [0, 'updated', '']) // no link: the secret stays
  assert.equal((await api.get('/reports')).status, 401) // the change signed the old session out
  assert.equal((await signIn(first)).res.status, 401)
  assert.equal((await signIn(second)).res.status, 200) // the same secret still works
  assert.equal(await db.user.count({ where: { email: lower } }), 1)

  // T1: MODERATOR_TOTP=new prints a new link, and the old secret's code no longer signs in; anything else is refused
  const renewed = run('scripts/moderator.js', { MODERATOR_EMAIL: email, MODERATOR_PASSWORD: second, MODERATOR_TOTP: 'new' })
  const [again, newLink] = renewed.stdout.trim().split(/\r?\n/)
  assert.deepEqual([renewed.status, again, renewed.stderr], [0, 'updated', ''])
  const renewedSecret = new URL(newLink).searchParams.get('secret')
  assert.notEqual(renewedSecret, secret)
  const old = (await signIn(second)).res
  assert.deepEqual([old.status, old.body], [401, { code: 'NEEDS_CODE', fields: { code: 'wrong' } }])
  assert.equal((await signIn(second, renewedSecret)).res.status, 200)
  const later = run('scripts/moderator.js', { MODERATOR_EMAIL: email, MODERATOR_PASSWORD: second, MODERATOR_TOTP: 'later' })
  assert.deepEqual([later.status, later.stdout], [1, ''])
  assert.match(later.stderr, /MODERATOR_TOTP must be new or left out/)

  for (const [env, why] of [[{ MODERATOR_EMAIL: email, MODERATOR_PASSWORD: 'x'.repeat(19) }, 'short: 19 of the 20 characters'], [{ MODERATOR_EMAIL: 'not an email', MODERATOR_PASSWORD: second }, 'email'], [{ MODERATOR_EMAIL: email, MODERATOR_PASSWORD: 'x'.repeat(73) }, 'long']]) {
    const out = run('scripts/moderator.js', env)
    assert.deepEqual([out.status, out.stdout], [1, ''], why)
    assert.equal(out.stderr.includes(second), false)
  }
  // argv is never read: with the values on the command line and none in the environment it has nothing to go on
  const fresh = `argv-${randomUUID()}@example.com`
  const argv = run('scripts/moderator.js', { MODERATOR_EMAIL: '', MODERATOR_PASSWORD: '' }, [fresh, 'an argv password here'])
  assert.equal(argv.status, 1)
  assert.equal(await db.user.count({ where: { email: fresh } }), 0)

  // a parent's address is not a moderator's to change
  const mom = await family(server.base)
  const other = run('scripts/moderator.js', { MODERATOR_EMAIL: mom.email, MODERATOR_PASSWORD: second })
  assert.deepEqual([other.status, other.stdout], [1, ''])
  assert.match(other.stderr, /another kind of account/)
  // T1: MODERATOR_REMOVE=1 needs no password, and removes only a moderator
  const notMine = run('scripts/moderator.js', { MODERATOR_EMAIL: mom.email, MODERATOR_PASSWORD: '', MODERATOR_REMOVE: '1' })
  assert.deepEqual([notMine.status, notMine.stdout], [1, ''])
  assert.match(notMine.stderr, /no moderator has that address/)
  assert.equal((await as(server.base).post('/session', { identifier: mom.email, password: mom.password })).status, 200) // untouched
  assert.equal((await mom.api.post('/me/delete', { password: mom.password })).status, 204)
  const removed = run('scripts/moderator.js', { MODERATOR_EMAIL: email, MODERATOR_PASSWORD: '', MODERATOR_REMOVE: '1' })
  assert.deepEqual([removed.status, removed.stdout.trim(), removed.stderr], [0, 'removed', ''])
  assert.equal(await db.user.count({ where: { email: lower } }), 0)
})
