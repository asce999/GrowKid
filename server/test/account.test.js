import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import bcrypt from 'bcryptjs'
import { ZONES, listCountries, zoneOf } from '../src/countries.js'
import { db, lockChild } from '../src/db.js'
import { as, family, start } from './helpers.js'

let server
before(async () => {
  server = await start()
})
after(() => server.close())

const tag = () => randomUUID().replaceAll('-', '').slice(0, 10)
const GOOD = { name: 'Meera', email: 'meera@example.com', password: 'long-enough', country: 'IN' }
const invalid = (res, fields) => {
  assert.equal(res.status, 400)
  assert.deepEqual(res.body, { code: 'INVALID', fields })
}
const refused = (res, status, code) => {
  assert.equal(res.status, status)
  assert.deepEqual(res.body, { code })
}
/** Adds a child through the API and returns what was sent plus what came back. */
async function addChild(api, details = {}) {
  const sent = { name: 'Kid', username: `k${tag()}`, password: 'kid-pass-1', ...details }
  const res = await api.post('/children', sent)
  assert.equal(res.status, 201)
  return { ...sent, ...res.body }
}
const signedIn = async (identifier, password) => {
  const api = as(server.base)
  const res = await api.post('/session', { identifier, password })
  assert.equal(res.status, 200)
  return api
}

// ------------------------------------------------------------------ sign-up and sign-in

test('signUp makes a parent and signs them in; the cookie is HttpOnly, SameSite=Strict and Path=/api; no hash comes back', async () => {
  const api = as(server.base)
  const email = `Mixed-${tag()}@Example.com`
  const res = await api.post('/parents', { ...GOOD, name: '  Meera  ', email: `  ${email}  ` })
  assert.equal(res.status, 201)
  assert.deepEqual(res.body, { id: res.body.id, role: 'parent', name: 'Meera', email: email.toLowerCase() })
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith('growkid='))
  for (const flag of [/; HttpOnly/, /; SameSite=Strict/, /; Path=\/api/, /; Max-Age=604800/]) assert.match(cookie, flag)
  assert.doesNotMatch(cookie, /Secure/) // only in production
  assert.deepEqual((await api.get('/session')).body, res.body)
  const row = await db.user.findUnique({ where: { id: res.body.id } })
  assert.equal(row.email, email.toLowerCase())
  assert.equal(row.country, 'IN')
  assert.match(row.passwordHash, /^\$2[aby]\$12\$/)
})

test('signUp refuses each wrong field as INVALID, never 500', async () => {
  const cases = [
    [{ name: '' }, { name: 'required' }],
    [{ name: '   ' }, { name: 'required' }],
    [{ name: 'a'.repeat(61) }, { name: 'length' }],
    [{ name: 123 }, { name: 'required' }],
    [{ email: 'nope' }, { email: 'format' }],
    [{ email: 'a@b' }, { email: 'format' }],
    [{ email: `${'a'.repeat(250)}@example.com` }, { email: 'format' }],
    [{ email: 5 }, { email: 'format' }],
    [{ password: 'short' }, { password: 'short' }],
    [{ password: 'a'.repeat(73) }, { password: 'length' }],
    [{ password: 'é'.repeat(37) }, { password: 'length' }], // 74 bytes
    [{ password: ['long-enough'] }, { password: 'short' }],
    [{ country: undefined }, { country: 'required' }],
    [{ country: 'XX' }, { country: 'required' }],
    [{ country: 'in' }, { country: 'required' }],
    [{ country: '__proto__' }, { country: 'required' }],
    [{ country: ['IN'] }, { country: 'required' }],
    [{ name: '', email: 'x', password: '1', country: '' }, { name: 'required', email: 'format', password: 'short', country: 'required' }],
  ]
  for (const [change, fields] of cases) invalid(await as(server.base).post('/parents', { ...GOOD, ...change }), fields)
  invalid(await as(server.base).post('/parents'), { name: 'required', email: 'format', password: 'short', country: 'required' }) // no body at all
})

test('signUp: a taken email is EMAIL_TAKEN in any case; two at once give one 201 and one EMAIL_TAKEN (P2002)', async () => {
  const { email } = await family(server.base)
  refused(await as(server.base).post('/parents', { ...GOOD, email: email.toUpperCase() }), 409, 'EMAIL_TAKEN')
  const racing = `race-${tag()}@example.com`
  const both = await Promise.all([1, 2].map(() => as(server.base).post('/parents', { ...GOOD, email: racing })))
  assert.deepEqual(both.map((r) => r.status).sort(), [201, 409])
  assert.deepEqual(both.find((r) => r.status === 409).body, { code: 'EMAIL_TAKEN' })
})

test('a password of exactly 72 bytes works for sign-up and sign-in; 73 bytes never signs in', async () => {
  const password = 'p'.repeat(72)
  const mom = await family(server.base, { password })
  await signedIn(mom.email, password)
  refused(await as(server.base).post('/session', { identifier: mom.email, password: `${password}x` }), 401, 'WRONG_DETAILS')
})

test('signIn: a parent by email, a child by username, in any case; the User holds no secrets', async () => {
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  const parent = as(server.base)
  const res = await parent.post('/session', { identifier: `  ${mom.email.toUpperCase()}  `, password: mom.password })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { id: mom.user.id, role: 'parent', name: 'Test Parent', email: mom.email })
  assert.match(res.headers.getSetCookie().join(), /^growkid=/)
  const child = as(server.base)
  const own = await child.post('/session', { identifier: kid.username.toUpperCase(), password: kid.password })
  assert.equal(own.status, 200)
  assert.deepEqual(own.body, { id: kid.id, role: 'child', name: 'Kid', username: kid.username })
  assert.deepEqual((await child.get('/session')).body, own.body)
})

test('signIn: an unknown account and a wrong password are the same WRONG_DETAILS, with no cookie, and both cost a real compare', async () => {
  const mom = await family(server.base)
  const api = as(server.base)
  const tries = [
    { identifier: mom.email, password: 'not-the-password' },
    { identifier: `nobody-${tag()}@example.com`, password: mom.password },
    { identifier: 5, password: {} },
    {},
  ]
  for (const body of tries) {
    const started = Date.now()
    const res = await api.post('/session', body)
    refused(res, 401, 'WRONG_DETAILS')
    assert.deepEqual(res.headers.getSetCookie(), [])
    if (typeof body.password === 'string') assert.ok(Date.now() - started >= 100, 'bcrypt cost 12 takes far longer than this')
  }
  refused(await api.post('/session', { identifier: mom.email, password: `${mom.password}${'x'.repeat(70)}` }), 401, 'WRONG_DETAILS')
})

test('getSession is null when signed out; signOut clears the cookie on this device only', async () => {
  const mom = await family(server.base)
  const other = await signedIn(mom.email, mom.password)
  assert.equal((await as(server.base).get('/session')).body, null)
  const out = await mom.api.del('/session')
  assert.equal(out.status, 204)
  assert.match(out.headers.getSetCookie().find((c) => c.startsWith('growkid=;')), /Path=\/api/)
  assert.equal((await mom.api.get('/session')).body, null)
  assert.equal((await other.get('/session')).body.id, mom.user.id)
})

test('signIn is limited to 10 tries per address and identifier: the 11th is TOO_MANY, another identifier is not', async () => {
  const mom = await family(server.base)
  const api = as(server.base)
  const refusedPassword = 'x'.repeat(73) // refused without a hash, so the tries are quick
  for (let i = 0; i < 10; i++) refused(await api.post('/session', { identifier: mom.email, password: refusedPassword }), 401, 'WRONG_DETAILS')
  refused(await api.post('/session', { identifier: mom.email, password: mom.password }), 429, 'TOO_MANY') // even the right one
  refused(await api.post('/session', { identifier: `nobody-${tag()}@example.com`, password: refusedPassword }), 401, 'WRONG_DETAILS')
})

test('signIn also allows 50 failed tries per address across identifiers: the 51st is TOO_MANY', async () => {
  const api = as(server.base)
  const refusedPassword = 'x'.repeat(73)
  for (let i = 0; i < 50; i++) {
    refused(await api.post('/session', { identifier: `nobody-${i}-${tag()}@example.com`, password: refusedPassword }), 401, 'WRONG_DETAILS')
  }
  refused(await api.post('/session', { identifier: `nobody-${tag()}@example.com`, password: refusedPassword }), 429, 'TOO_MANY')
})

test('only failed sign-ins count: 12 correct ones to the same account from one address all answer 200', async () => {
  const mom = await family(server.base)
  const api = as(server.base)
  for (let i = 0; i < 12; i++) assert.equal((await api.post('/session', { identifier: mom.email, password: mom.password })).status, 200)
})

test('signUp is limited to 20 per address: the 21st is TOO_MANY', async () => {
  const api = as(server.base)
  for (let i = 0; i < 20; i++) assert.equal((await api.post('/parents', {})).status, 400)
  refused(await api.post('/parents', GOOD), 429, 'TOO_MANY')
  assert.equal((await family(server.base)).user.role, 'parent') // another address is fine
})

// ------------------------------------------------------------------ the parent

test('updateName trims, refuses an empty or long name, and is for parents only', async () => {
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  const res = await mom.api.patch('/me', { name: '  New Name ' })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { id: mom.user.id, role: 'parent', name: 'New Name', email: mom.email })
  for (const name of ['', '  ', 'a'.repeat(61), 5, undefined]) {
    invalid(await mom.api.patch('/me', { name }), { name: name !== undefined && typeof name === 'string' && name.length > 60 ? 'length' : 'required' })
  }
  refused(await (await signedIn(kid.username, kid.password)).patch('/me', { name: 'x' }), 403, 'NOT_ALLOWED')
  refused(await as(server.base).patch('/me', { name: 'x' }), 401, 'NOT_SIGNED_IN')
})

test('changePassword: WRONG_PASSWORD first, then INVALID next; success signs out every other device and not this one', async () => {
  const mom = await family(server.base)
  const other = await signedIn(mom.email, mom.password)
  assert.equal((await other.get('/children')).status, 200)
  refused(await mom.api.put('/me/password', { current: 'wrong-wrong', next: 'x' }), 403, 'WRONG_PASSWORD')
  refused(await mom.api.put('/me/password', { current: 5, next: 'brand-new-pass' }), 403, 'WRONG_PASSWORD')
  invalid(await mom.api.put('/me/password', { current: mom.password, next: 'short' }), { next: 'short' })
  invalid(await mom.api.put('/me/password', { current: mom.password, next: 'n'.repeat(73) }), { next: 'length' })
  invalid(await mom.api.put('/me/password', { current: mom.password }), { next: 'short' })

  const done = await mom.api.put('/me/password', { current: mom.password, next: 'brand-new-pass' })
  assert.equal(done.status, 204)
  assert.match(done.headers.getSetCookie().join(), /^growkid=[^;]+; /) // a fresh cookie for this device
  assert.equal((await mom.api.get('/children')).status, 200)
  refused(await other.get('/children'), 401, 'NOT_SIGNED_IN')
  assert.equal((await other.get('/session')).body, null)
  refused(await as(server.base).post('/session', { identifier: mom.email, password: mom.password }), 401, 'WRONG_DETAILS')
  await signedIn(mom.email, 'brand-new-pass')
})

test('changePassword from two devices at once: one 204 and one NOT_SIGNED_IN, because the write is conditional', async () => {
  const mom = await family(server.base)
  const other = await signedIn(mom.email, mom.password)
  const both = await Promise.all([mom.api, other].map((api, i) => api.put('/me/password', { current: mom.password, next: `new-pass-${i}-xx` })))
  assert.deepEqual(both.map((r) => r.status).sort(), [204, 401])
  assert.deepEqual(both.find((r) => r.status === 401).body, { code: 'NOT_SIGNED_IN' })
})

test('changePassword and deleteFamily share a limit of 10 tries per user; another user is not affected', async () => {
  const mom = await family(server.base)
  const neighbour = await family(server.base)
  for (let i = 0; i < 10; i++) {
    refused(await mom.api.put('/me/password', { current: 'x'.repeat(73), next: 'whatever-long' }), 403, 'WRONG_PASSWORD')
  }
  refused(await mom.api.put('/me/password', { current: mom.password, next: 'whatever-long' }), 429, 'TOO_MANY')
  refused(await mom.api.post('/me/delete', { password: mom.password }), 429, 'TOO_MANY')
  await signedIn(mom.email, mom.password) // nothing was deleted
  refused(await neighbour.api.put('/me/password', { current: 'x'.repeat(73), next: 'whatever-long' }), 403, 'WRONG_PASSWORD')
})

// ------------------------------------------------------------------ settings and countries

test('settings: getSettings holds leaderboard and country; setLeaderboard needs a boolean; setCountry changes what getSettings returns', async () => {
  const mom = await family(server.base, { country: 'GB' })
  assert.deepEqual((await mom.api.get('/settings')).body, { leaderboard: false, country: 'GB' })
  assert.deepEqual((await mom.api.put('/settings', { leaderboard: true })).body, { leaderboard: true, country: 'GB' })
  for (const leaderboard of ['true', 1, null, undefined]) invalid(await mom.api.put('/settings', { leaderboard }), { leaderboard: 'required' })
  for (const country of ['XX', 'us', 5, undefined, '__proto__']) invalid(await mom.api.put('/settings/country', { country }), { country: 'required' })
  assert.deepEqual((await mom.api.get('/settings')).body, { leaderboard: true, country: 'GB' })
  const changed = await mom.api.put('/settings/country', { country: 'US' })
  assert.deepEqual(changed.body, { leaderboard: true, country: 'US' })
  assert.deepEqual((await mom.api.get('/settings')).body, { leaderboard: true, country: 'US' })
  assert.equal((await db.user.findUnique({ where: { id: mom.user.id } })).country, 'US')
})

test('listCountries needs no sign-in, holds India, is sorted by name; zoneOf and every zone are real', async () => {
  const res = await as(server.base).get('/countries')
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.find((c) => c.code === 'IN'), { code: 'IN', name: 'India', zone: 'Asia/Kolkata' })
  assert.deepEqual(res.body, listCountries)
  assert.deepEqual(res.body.map((c) => c.name), res.body.map((c) => c.name).sort((a, b) => a.localeCompare(b)))
  assert.equal(res.body.length, Object.keys(ZONES).length)
  assert.ok(!('AQ' in ZONES) && !('UM' in ZONES))
  assert.equal(zoneOf('US'), 'America/New_York')
  assert.equal(zoneOf('XX'), undefined)
  assert.equal(zoneOf('__proto__'), undefined)
  const capitals = {
    US: 'America/New_York', CA: 'America/Toronto', AU: 'Australia/Sydney', RU: 'Europe/Moscow', BR: 'America/Sao_Paulo',
    MX: 'America/Mexico_City', ID: 'Asia/Jakarta', KZ: 'Asia/Almaty', MN: 'Asia/Ulaanbaatar', CD: 'Africa/Kinshasa',
    CL: 'America/Santiago', EC: 'America/Guayaquil', ES: 'Europe/Madrid', PT: 'Europe/Lisbon', NZ: 'Pacific/Auckland',
    KI: 'Pacific/Tarawa', FM: 'Pacific/Pohnpei', GL: 'America/Nuuk', UA: 'Europe/Kyiv', PF: 'Pacific/Tahiti',
    PG: 'Pacific/Port_Moresby', CN: 'Asia/Shanghai',
  }
  for (const [code, zone] of Object.entries(capitals)) assert.equal(ZONES[code], zone, code)
  for (const [code, zone] of Object.entries(ZONES)) {
    assert.match(code, /^[A-Z]{2}$/)
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: zone }), `${code} ${zone}`)
  }
})

// ------------------------------------------------------------------ children

test('addChild, listChildren, getChild and renameChild: shapes, order and refusals', async () => {
  const mom = await family(server.base)
  const first = await addChild(mom.api, { name: '  Aarav ' })
  const second = await addChild(mom.api, { name: 'Diya' })
  assert.deepEqual(Object.keys(first).sort(), ['id', 'name', 'password', 'username']) // the password is only what we sent
  assert.equal(first.name, 'Aarav')
  const list = await mom.api.get('/children')
  assert.deepEqual(list.body, [
    { id: first.id, name: 'Aarav', username: first.username },
    { id: second.id, name: 'Diya', username: second.username },
  ])
  assert.deepEqual((await mom.api.get(`/children/${second.id}`)).body, list.body[1])
  assert.deepEqual((await mom.api.patch(`/children/${first.id}`, { name: ' Aarav J ' })).body, { id: first.id, name: 'Aarav J', username: first.username })
  for (const name of ['', 'a'.repeat(61), 5]) invalid(await mom.api.patch(`/children/${first.id}`, { name }), { name: name === 'a'.repeat(61) ? 'length' : 'required' })

  const cases = [
    [{ name: '' }, { name: 'required' }],
    [{ name: 'a'.repeat(61) }, { name: 'length' }],
    [{ username: 'ab' }, { username: 'format' }],
    [{ username: 'a'.repeat(21) }, { username: 'format' }],
    [{ username: 'Abc' }, { username: 'format' }],
    [{ username: 'ab_c' }, { username: 'format' }],
    [{ username: ' abc' }, { username: 'format' }],
    [{ username: 123 }, { username: 'format' }],
    [{ password: 'short' }, { password: 'short' }],
    [{ password: 'p'.repeat(73) }, { password: 'length' }],
    [{ password: 9 }, { password: 'short' }],
  ]
  for (const [change, fields] of cases) {
    invalid(await mom.api.post('/children', { name: 'Kid', username: `k${tag()}`, password: 'kid-pass-1', ...change }), fields)
  }
  invalid(await mom.api.post('/children'), { name: 'required', username: 'format', password: 'short' })
  assert.equal((await mom.api.get('/children')).body.length, 2)
})

test('addChild: a taken username is USERNAME_TAKEN, across families too; two at once give one 201 and one 409 (P2002)', async () => {
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  const stranger = await family(server.base)
  refused(await stranger.api.post('/children', { name: 'Copy', username: kid.username, password: 'kid-pass-1' }), 409, 'USERNAME_TAKEN')
  const racing = `r${tag()}`
  const both = await Promise.all([1, 2].map(() => mom.api.post('/children', { name: 'Kid', username: racing, password: 'kid-pass-1' })))
  assert.deepEqual(both.map((r) => r.status).sort(), [201, 409])
  assert.deepEqual(both.find((r) => r.status === 409).body, { code: 'USERNAME_TAKEN' })
})

test("another parent's child does not exist: get, rename, reset and remove are NOT_FOUND before anything is checked", async () => {
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  const stranger = await family(server.base)
  assert.deepEqual((await stranger.api.get('/children')).body, [])
  refused(await stranger.api.get(`/children/${kid.id}`), 404, 'NOT_FOUND')
  refused(await stranger.api.patch(`/children/${kid.id}`, { name: '' }), 404, 'NOT_FOUND')
  refused(await stranger.api.put(`/children/${kid.id}/password`, { password: '1' }), 404, 'NOT_FOUND')
  refused(await stranger.api.del(`/children/${kid.id}`), 404, 'NOT_FOUND')
  refused(await mom.api.get(`/children/${randomUUID()}`), 404, 'NOT_FOUND')
  refused(await mom.api.get(`/children/${encodeURIComponent('a b/../c')}`), 404, 'NOT_FOUND')
  refused(await mom.api.get(`/children/${mom.user.id}`), 404, 'NOT_FOUND') // a parent is not a child
  // untouched
  assert.equal((await mom.api.get(`/children/${kid.id}`)).body.name, 'Kid')
  await signedIn(kid.username, kid.password)
})

test('resetChildPassword: INVALID password, then 204; the old password and every device of the child stop working at once', async () => {
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  const device = await signedIn(kid.username, kid.password)
  assert.equal((await device.get('/session')).body.id, kid.id)
  invalid(await mom.api.put(`/children/${kid.id}/password`, { password: 'abc' }), { password: 'short' })
  invalid(await mom.api.put(`/children/${kid.id}/password`, { password: 'p'.repeat(73) }), { password: 'length' })
  assert.equal((await device.get('/session')).body.id, kid.id) // refusals changed nothing
  const done = await mom.api.put(`/children/${kid.id}/password`, { password: 'new-kid-pass' })
  assert.equal(done.status, 204)
  assert.equal((await device.get('/session')).body, null)
  refused(await as(server.base).post('/session', { identifier: kid.username, password: kid.password }), 401, 'WRONG_DETAILS')
  await signedIn(kid.username, 'new-kid-pass')
  assert.equal((await mom.api.get('/children')).status, 200) // the parent stays signed in
})

test('every parent route refuses a signed-out visitor, a child and a moderator', async () => {
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  const email = `mod-${tag()}@example.com`
  await db.user.create({ data: { role: 'moderator', name: 'Mod', email, passwordHash: await bcrypt.hash('moderator-pass', 4) } })
  const moderator = await signedIn(email, 'moderator-pass')
  assert.equal((await moderator.get('/session')).body.role, 'moderator')
  const routes = [
    ['get', '/children'], ['post', '/children', {}], ['get', '/children/x'], ['patch', '/children/x', {}], ['del', '/children/x'],
    ['put', '/children/x/password', {}], ['patch', '/me', {}], ['put', '/me/password', {}], ['post', '/me/delete', {}],
    ['get', '/settings'], ['put', '/settings', {}], ['put', '/settings/country', {}],
  ]
  const visitors = [
    [as(server.base), 401, 'NOT_SIGNED_IN'],
    [await signedIn(kid.username, kid.password), 403, 'NOT_ALLOWED'],
    [moderator, 403, 'NOT_ALLOWED'],
  ]
  for (const [api, status, code] of visitors) {
    for (const [method, route, body] of routes) refused(await api[method](route, body), status, code)
  }
})

// ------------------------------------------------------------------ erasing (rule 16)

/** Rows in every table that holds something for this child, a proof file on disk, and four reports. Returns the ids to look for. */
async function hold(parent, child) {
  const at = new Date()
  await mkdir(process.env.UPLOAD_DIR, { recursive: true })
  const task = await db.task.create({ data: { childId: child.id, category: 'chores', title: 'T', instructions: 'I', dueAt: at, points: 20, createdAt: at } })
  const fileId = randomUUID()
  await writeFile(path.join(process.env.UPLOAD_DIR, fileId), 'x')
  await db.proof.create({ data: { id: fileId, taskId: task.id, fileName: 'a.png', fileType: 'image/png', fileSize: 1, sentAt: at, late: false } })
  await db.proof.create({ data: { id: randomUUID(), taskId: task.id, note: 'no file', sentAt: at, late: false } })
  await db.award.create({ data: { childId: child.id, stickerId: 'first', earnedAt: at, taskId: task.id, taskTitle: 'T' } })
  await db.quest.create({ data: { childId: child.id, target: 3, bonus: 50, setAt: at } })
  await db.questAward.create({ data: { childId: child.id, week: '2026-11-02', target: 3, bonus: 50, earnedAt: at, taskId: task.id, taskTitle: 'T' } })
  await db.restDay.create({ data: { childId: child.id, day: '2026-11-03' } })
  const reward = await db.reward.create({ data: { parentId: parent.id, title: 'R', cost: 50, createdAt: at } })
  await db.rewardRequest.create({ data: { childId: child.id, parentId: parent.id, rewardId: reward.id, title: 'R', cost: 50, requestedAt: at } })
  const report = async (byId, answered) =>
    (await db.report.create({
      data: { byId, from: byId === parent.id ? 'parent' : 'child', details: 'd', sentAt: at, resolvedAt: answered ? at : null, resolutionNote: answered ? 'ok' : null },
    })).id
  const reports = {
    parentAnswered: await report(parent.id, true), parentOpen: await report(parent.id, false),
    childAnswered: await report(child.id, true), childOpen: await report(child.id, false),
  }
  return { taskId: task.id, fileId, rewardId: reward.id, reports }
}

/** What is left of what hold() made, row by row. */
async function left(parent, child, held) {
  const ids = Object.values(held.reports)
  return {
    users: await db.user.count({ where: { id: { in: [parent.id, child.id] } } }),
    tasks: await db.task.count({ where: { childId: child.id } }),
    proofs: await db.proof.count({ where: { taskId: held.taskId } }),
    awards: await db.award.count({ where: { childId: child.id } }),
    quests: await db.quest.count({ where: { childId: child.id } }),
    questAwards: await db.questAward.count({ where: { childId: child.id } }),
    restDays: await db.restDay.count({ where: { childId: child.id } }),
    rewards: await db.reward.count({ where: { id: held.rewardId } }),
    requests: await db.rewardRequest.count({ where: { childId: child.id } }),
    reports: await db.report.count({ where: { id: { in: ids } } }),
    file: await access(path.join(process.env.UPLOAD_DIR, held.fileId)).then(() => 1, () => 0),
  }
}
const WHOLE = { users: 2, tasks: 1, proofs: 2, awards: 1, quests: 1, questAwards: 1, restDays: 1, rewards: 1, requests: 1, reports: 4, file: 1 }
const GONE = { users: 0, tasks: 0, proofs: 0, awards: 0, quests: 0, questAwards: 0, restDays: 0, rewards: 0, requests: 0, reports: 2, file: 0 }

/** The reports that are kept hold no sender; the others are gone. */
async function keptReports(held, ...names) {
  const rows = await db.report.findMany({ where: { id: { in: Object.values(held.reports) } } })
  assert.deepEqual(rows.map((r) => r.id).sort(), names.map((n) => held.reports[n]).sort())
  return rows
}

test('deleteFamily needs the password, then erases the family: every table, the files, answered reports; open reports stay with no sender', async () => {
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  const held = await hold(mom.user, kid)
  const neighbour = await family(server.base)
  const neighbourKid = await addChild(neighbour.api)
  const kept = await hold(neighbour.user, neighbourKid)

  refused(await mom.api.post('/me/delete', { password: 'wrong-password' }), 403, 'WRONG_PASSWORD')
  refused(await mom.api.post('/me/delete', {}), 403, 'WRONG_PASSWORD')
  refused(await (await signedIn(kid.username, kid.password)).post('/me/delete', { password: kid.password }), 403, 'NOT_ALLOWED')
  assert.deepEqual(await left(mom.user, kid, held), WHOLE)

  const done = await mom.api.post('/me/delete', { password: mom.password })
  assert.equal(done.status, 204)
  assert.match(done.headers.getSetCookie().find((c) => c.startsWith('growkid=;')), /Path=\/api/)
  assert.deepEqual(await left(mom.user, kid, held), GONE)
  for (const row of await keptReports(held, 'parentOpen', 'childOpen')) {
    assert.equal(row.byId, null)
    assert.equal(row.resolvedAt, null)
  }
  assert.equal((await mom.api.get('/session')).body, null)
  refused(await as(server.base).post('/session', { identifier: mom.email, password: mom.password }), 401, 'WRONG_DETAILS')
  refused(await as(server.base).post('/session', { identifier: kid.username, password: kid.password }), 401, 'WRONG_DETAILS')
  assert.deepEqual(await left(neighbour.user, neighbourKid, kept), WHOLE) // another family is untouched
})

test('removeChild erases one child the same way and leaves the parent, the other child and the family rewards', async () => {
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  const sibling = await addChild(mom.api)
  const device = await signedIn(kid.username, kid.password)
  const held = await hold(mom.user, kid)
  const siblingHeld = await hold(mom.user, sibling)

  assert.equal((await mom.api.del(`/children/${kid.id}`)).status, 204)
  assert.deepEqual(await left(mom.user, kid, held), { ...GONE, users: 1, rewards: 1, reports: 3 }) // the parent row and the reward stay, and so does the parent's open report
  for (const row of await keptReports(held, 'parentAnswered', 'parentOpen', 'childOpen')) {
    if (row.id === held.reports.childOpen) assert.equal(row.byId, null)
    else assert.equal(row.byId, mom.user.id)
  }
  assert.equal((await device.get('/session')).body, null)
  refused(await mom.api.get(`/children/${kid.id}`), 404, 'NOT_FOUND')
  assert.deepEqual((await mom.api.get('/children')).body, [{ id: sibling.id, name: 'Kid', username: sibling.username }])
  assert.deepEqual((await left(mom.user, sibling, siblingHeld)).tasks, 1)
})

test('a row that goes away between the lookup and the update is NOT_FOUND, never 500 (P2025)', async () => {
  await assert.rejects(db.user.update({ where: { id: randomUUID() }, data: { name: 'x' } }), { code: 'P2025' })
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  const resetting = mom.api.put(`/children/${kid.id}/password`, { password: 'new-kid-pass' }) // hashes for a quarter of a second before it writes
  await sleep(100)
  await db.user.delete({ where: { id: kid.id } })
  refused(await resetting, 404, 'NOT_FOUND')
})

test('erase waits for a transaction that holds the child row, so a proof sent meanwhile still has its file removed', async () => {
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  const held = await hold(mom.user, kid)
  const fileId = randomUUID()
  let release
  let locked
  const gate = new Promise((resolve) => (release = resolve))
  const holding = new Promise((resolve) => (locked = resolve))
  const sending = db.$transaction(async (tx) => {
    await lockChild(tx, kid.id) // what B2's sendProof does first
    await writeFile(path.join(process.env.UPLOAD_DIR, fileId), 'x')
    await tx.proof.create({ data: { id: fileId, taskId: held.taskId, fileName: 'late.png', fileType: 'image/png', fileSize: 1, sentAt: new Date(), late: false } })
    locked()
    await gate
  })
  await holding
  const deleting = mom.api.post('/me/delete', { password: mom.password })
  assert.equal(await Promise.race([deleting.then(() => 'done'), sleep(1000).then(() => 'waiting')]), 'waiting')
  release()
  await sending
  assert.equal((await deleting).status, 204)
  assert.equal(await access(path.join(process.env.UPLOAD_DIR, fileId)).then(() => 'left', () => 'gone'), 'gone')
  assert.equal(await db.proof.count({ where: { id: fileId } }), 0)
})
