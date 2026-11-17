import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import bcrypt from 'bcryptjs'
import { ZONES, listCountries, zoneOf } from '../src/countries.js'
import { db, lockChild } from '../src/db.js'
import { codeAt, stepAt } from '../src/totp.js'
import { as, family, moderator, start } from './helpers.js'

let server
// Rows this file makes directly that no family deletion removes: the test database is never reset, so they go in after().
const made = { users: [], reports: [] }
before(async () => {
  server = await start()
})
after(async () => {
  await db.report.deleteMany({ where: { id: { in: made.reports } } })
  await db.user.deleteMany({ where: { id: { in: made.users } } })
  server.close()
})

const tag = () => randomUUID().replaceAll('-', '').slice(0, 10)
const GOOD = { name: 'Meera', email: 'meera@example.com', password: 'long-enough', country: 'IN', consent: true }
const invalid = (res, fields) => {
  assert.equal(res.status, 400)
  assert.deepEqual(res.body, { code: 'INVALID', fields })
}
const refused = (res, status, code) => {
  assert.equal(res.status, status)
  // L2: a counted limit also says how many whole minutes are left
  if (code === 'TOO_MANY') return assert.ok(res.body.code === code && Number.isInteger(res.body.fields.minutes) && res.body.fields.minutes >= 1, JSON.stringify(res.body))
  assert.deepEqual(res.body, { code })
}
/** Adds a child through the API and returns what was sent plus what came back. */
async function addChild(api, details = {}) {
  const sent = { name: 'Kid', username: `k${tag()}`, password: 'child-pass-1', consent: true, ...details }
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
  assert.deepEqual(res.body, { id: res.body.id, role: 'parent', name: 'Meera', email: email.toLowerCase(), zone: 'Asia/Kolkata', recoveryCode: res.body.recoveryCode })
  assert.match(res.body.recoveryCode, /^[A-Z2-7]{16}$/) // T5: shown this once
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith('growkid='))
  for (const flag of [/; HttpOnly/, /; SameSite=Strict/, /; Path=\/api/, /; Max-Age=604800/]) assert.match(cookie, flag)
  assert.doesNotMatch(cookie, /Secure/) // only in production
  const { recoveryCode: _shownOnce, ...user } = res.body
  assert.deepEqual((await api.get('/session')).body, user) // the code is never in the session
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
    [{ password: 'Football' }, { password: 'common' }], // L4
    [{ password: 'meera-is-here' }, { password: 'personal' }], // the name
    [{ email: 'zebra77@example.com', password: 'my-zebra77-pw' }, { password: 'personal' }], // the part of the email before the @
    [{ country: undefined }, { country: 'required' }],
    [{ country: 'XX' }, { country: 'required' }],
    [{ country: 'in' }, { country: 'required' }],
    [{ country: '__proto__' }, { country: 'required' }],
    [{ country: ['IN'] }, { country: 'required' }],
    [{ name: '', email: 'x', password: '1', country: '' }, { name: 'required', email: 'format', password: 'short', country: 'required' }],
  ]
  for (const [change, fields] of cases) invalid(await as(server.base).post('/parents', { ...GOOD, ...change }), fields)
  invalid(await as(server.base).post('/parents'), { name: 'required', email: 'format', password: 'short', country: 'required', consent: 'required' }) // no body at all
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
  assert.deepEqual(res.body, { id: mom.user.id, role: 'parent', name: 'Test Parent', email: mom.email, zone: 'Asia/Kolkata' })
  assert.match(res.headers.getSetCookie().join(), /^growkid=/)
  const child = as(server.base)
  const own = await child.post('/session', { identifier: kid.username.toUpperCase(), password: kid.password })
  assert.equal(own.status, 200)
  assert.deepEqual(own.body, { id: kid.id, role: 'child', name: 'Kid', username: kid.username, zone: 'Asia/Kolkata', sound: true }) // P13: a child's zone is the parent's; K11: sound on until turned off
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

test('a made-up X-Forwarded-For does not dodge the limit: the tries are counted against the address the proxy appended (F1)', async () => {
  const mom = await family(server.base)
  const refusedPassword = 'x'.repeat(73)
  const madeUp = () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 254) + 1).join('.')
  // What Vite's proxy sends on (xfwd): whatever the caller wrote, then the address the request really came from. Loopback is the
  // case that matters, a browser on this computer, and the one that 'trust proxy: loopback' got wrong.
  for (const real of ['127.0.0.1', '::1', madeUp()]) {
    const identifier = `nobody-${tag()}@example.com` // the limit is per address and identifier, so each address gets its own
    const attempt = (password = refusedPassword) => as(server.base, { ip: `${madeUp()}, ${real}` }).post('/session', { identifier, password })
    for (let i = 0; i < 10; i++) refused(await attempt(), 401, 'WRONG_DETAILS')
    refused(await attempt(), 429, 'TOO_MANY') // an eleventh made-up address, the same real one
  }
  assert.equal((await mom.api.post('/me/delete', { password: mom.password })).status, 204)
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

test('signIn pauses one account after 30 failed tries in an hour, whatever the address, and says how many minutes are left (L1, L2)', async () => {
  const mom = await family(server.base)
  const neighbour = await family(server.base)
  const wrong = 'x'.repeat(73)
  // a new address every time, so neither of the limits that count by address is reached; the identifier is the same account however it is typed
  for (let i = 0; i < 30; i++) refused(await as(server.base).post('/session', { identifier: ` ${mom.email.toUpperCase()} `, password: wrong }), 401, 'WRONG_DETAILS')
  const paused = await as(server.base).post('/session', { identifier: mom.email, password: mom.password }) // even the right one
  assert.equal(paused.status, 429)
  assert.deepEqual(paused.body, { code: 'TOO_MANY', fields: { minutes: 60 } })
  await signedIn(neighbour.email, neighbour.password) // another account is not held up
  assert.equal((await mom.api.get('/children')).status, 200) // and a device already signed in stays so
})

// ------------------------------------------------------------------ the parent

test('updateName trims, refuses an empty or long name, and is for parents only', async () => {
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  const res = await mom.api.patch('/me', { name: '  New Name ' })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { id: mom.user.id, role: 'parent', name: 'New Name', email: mom.email, zone: 'Asia/Kolkata' })
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
  invalid(await mom.api.put('/me/password', { current: mom.password, next: '12345678' }), { next: 'common' }) // L4
  invalid(await mom.api.put('/me/password', { current: mom.password, next: 'a-Parent-pass' }), { next: 'personal' })
  invalid(await mom.api.put('/me/password', { current: mom.password, next: `${mom.email.split('@')[0]}!` }), { next: 'personal' })

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

test('settings: getSettings holds leaderboard, country, how long proof files are kept and whether there is a recovery code; setLeaderboard needs a boolean; setCountry changes what getSettings returns', async () => {
  const mom = await family(server.base, { country: 'GB' })
  assert.deepEqual((await mom.api.get('/settings')).body, { leaderboard: false, country: 'GB', keepProofDays: 90, recovery: true })
  assert.deepEqual((await mom.api.put('/settings', { leaderboard: true })).body, { leaderboard: true, country: 'GB', keepProofDays: 90, recovery: true })
  for (const leaderboard of ['true', 1, null, undefined]) invalid(await mom.api.put('/settings', { leaderboard }), { leaderboard: 'required' })
  for (const country of ['XX', 'us', 5, undefined, '__proto__']) invalid(await mom.api.put('/settings/country', { country }), { country: 'required' })
  assert.deepEqual((await mom.api.get('/settings')).body, { leaderboard: true, country: 'GB', keepProofDays: 90, recovery: true })
  const changed = await mom.api.put('/settings/country', { country: 'US' })
  assert.deepEqual(changed.body, { leaderboard: true, country: 'US', keepProofDays: 90, recovery: true })
  assert.deepEqual((await mom.api.get('/settings')).body, { leaderboard: true, country: 'US', keepProofDays: 90, recovery: true })
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

test('endOtherSessions signs out every other device and keeps this one; two at once land once; the password is unchanged (L5)', async () => {
  const mom = await family(server.base)
  const other = await signedIn(mom.email, mom.password)
  const done = await mom.api.post('/me/sessions/end')
  assert.equal(done.status, 204)
  assert.match(done.headers.getSetCookie().join(), /^growkid=[^;]+; /) // a fresh cookie for this device
  assert.equal((await mom.api.get('/children')).status, 200)
  refused(await other.get('/children'), 401, 'NOT_SIGNED_IN')
  const again = await signedIn(mom.email, mom.password) // the same password signs in again
  const both = await Promise.all([mom.api, again].map((api) => api.post('/me/sessions/end')))
  assert.deepEqual(both.map((r) => r.status).sort(), [204, 401])
  const kid = await addChild(both[0].status === 204 ? mom.api : again)
  refused(await (await signedIn(kid.username, kid.password)).post('/me/sessions/end'), 403, 'NOT_ALLOWED')
  refused(await as(server.base).post('/me/sessions/end'), 401, 'NOT_SIGNED_IN')
})

// ------------------------------------------------------------------ children

test("endChildSessions signs the child out on every device; the password still works; another family's child is NOT_FOUND (L5)", async () => {
  const mom = await family(server.base)
  const stranger = await family(server.base)
  const kid = await addChild(mom.api)
  const devices = [await signedIn(kid.username, kid.password), await signedIn(kid.username, kid.password)]
  refused(await stranger.api.post(`/children/${kid.id}/sessions/end`), 404, 'NOT_FOUND')
  refused(await devices[0].post(`/children/${kid.id}/sessions/end`), 403, 'NOT_ALLOWED')
  assert.equal((await devices[0].get('/session')).body.id, kid.id) // refusals changed nothing
  assert.equal((await mom.api.post(`/children/${kid.id}/sessions/end`)).status, 204)
  for (const device of devices) assert.equal((await device.get('/session')).body, null)
  await signedIn(kid.username, kid.password)
  assert.equal((await mom.api.get('/children')).status, 200) // the parent stays signed in
})

test("adding a child and resetting a child's password share a limit of 20 an hour for one parent (L3)", async () => {
  const mom = await family(server.base)
  const neighbour = await family(server.base)
  const kid = await addChild(mom.api) // the first of the 20
  for (let i = 0; i < 10; i++) assert.equal((await mom.api.post('/children', {})).status, 400) // refused tries count: each one could test a username
  for (let i = 0; i < 9; i++) assert.equal((await mom.api.put(`/children/${kid.id}/password`, {})).status, 400)
  refused(await mom.api.post('/children', { consent: true, name: 'Late', username: `k${tag()}`, password: 'child-pass-1' }), 429, 'TOO_MANY')
  refused(await mom.api.put(`/children/${kid.id}/password`, { password: 'another-pass-2' }), 429, 'TOO_MANY')
  await signedIn(kid.username, kid.password) // nothing was reset
  await addChild(neighbour.api) // another parent is not held up
})

test('a family holds at most 10 children and 50 rewards: one more is QUOTA, naming the cap (L6)', async () => {
  const mom = await family(server.base)
  const passwordHash = await bcrypt.hash('x', 4)
  await db.user.createMany({ data: Array.from({ length: 10 }, (_, i) => ({ role: 'child', name: `Child ${i}`, username: `c${i}${tag()}`, parentId: mom.user.id, passwordHash })) })
  const eleventh = await mom.api.post('/children', { consent: true, name: 'Eleventh', username: `k${tag()}`, password: 'child-pass-1' })
  assert.deepEqual([eleventh.status, eleventh.body], [409, { code: 'QUOTA', fields: { quota: 'children' } }])
  assert.equal((await mom.api.get('/children')).body.length, 10)
  invalid(await mom.api.post('/children', { consent: true, name: '', username: `k${tag()}`, password: 'child-pass-1' }), { name: 'required' }) // a wrong field is still said first

  await db.reward.createMany({ data: Array.from({ length: 50 }, (_, i) => ({ parentId: mom.user.id, title: `Reward ${i}`, cost: 10, createdAt: new Date() })) })
  const reward = await mom.api.post('/rewards', { title: 'One too many', cost: 10 })
  assert.deepEqual([reward.status, reward.body], [409, { code: 'QUOTA', fields: { quota: 'rewards' } }])
  const [held] = (await mom.api.get('/rewards')).body
  assert.equal((await mom.api.post('/rewards', { id: held.id, title: 'Changed', cost: 20 })).status, 200) // changing one adds none
  assert.equal((await mom.api.post('/me/delete', { password: mom.password })).status, 204)
})

test('one user can make 120 changes a minute, and one address when signed out; reading and signing out are never counted (L7)', async () => {
  const mom = await family(server.base)
  const neighbour = await family(server.base)
  for (let i = 0; i < 120; i++) assert.equal((await mom.api.patch('/me', {})).status, 400) // refused ones count too
  const paused = await mom.api.patch('/me', { name: 'Late' })
  assert.deepEqual([paused.status, paused.body], [429, { code: 'TOO_MANY', fields: { minutes: 1 } }])
  assert.equal((await mom.api.get('/session')).body.name, 'Test Parent')
  assert.equal((await neighbour.api.patch('/me', { name: 'Neighbour' })).status, 200)
  assert.equal((await mom.api.del('/session')).status, 204)

  const visitor = as(server.base)
  for (let i = 0; i < 120; i++) assert.equal((await visitor.post('/nothing')).status, 404)
  refused(await visitor.post('/nothing'), 429, 'TOO_MANY')
  assert.equal((await visitor.get('/nothing')).status, 404)
})

test('addChild, listChildren, getChild and renameChild: shapes, order and refusals', async () => {
  const mom = await family(server.base)
  const first = await addChild(mom.api, { name: '  Aarav ' })
  const second = await addChild(mom.api, { name: 'Diya' })
  assert.deepEqual(Object.keys(first).sort(), ['consent', 'id', 'name', 'password', 'username']) // the password and the consent are only what we sent
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
    [{ password: 'seven77' }, { password: 'short' }], // L4: a child's password is 8 or more
    [{ password: 'p'.repeat(73) }, { password: 'length' }],
    [{ password: 9 }, { password: 'short' }],
    [{ password: 'PassWord' }, { password: 'common' }], // L4: one of the 1,000 most common, in any capitals
    [{ name: 'Aarav Rao', password: 'aarav-2015' }, { password: 'personal' }], // a word of the name
    [{ name: 'Aarav Rao', password: 'x-RAO-2015' }, { password: 'personal' }],
    [{ name: 'मीरा', password: 'मीरा12345' }, { password: 'personal' }], // a name whose letters carry vowel signs is still one word
    [{ name: 'José Diaz', password: 'josé-2015-x' }, { password: 'personal' }], // the same letter, typed two ways
    [{ username: 'tiger55', password: 'my-tiger55-pw' }, { password: 'personal' }], // the username
  ]
  const other = await family(server.base) // a second parent takes half: one may try 20 an hour (L3)
  for (const [i, [change, fields]] of cases.entries()) {
    invalid(await (i % 2 ? other : mom).api.post('/children', { consent: true, name: 'Kid', username: `k${tag()}`, password: 'child-pass-1', ...change }), fields)
  }
  invalid(await mom.api.post('/children'), { name: 'required', username: 'format', password: 'short', consent: 'required' })
  assert.equal((await mom.api.get('/children')).body.length, 2)
  await addChild(mom.api, { name: 'Jo Li', password: 'jo-li-pass' }) // a word of one or two letters is not held against the password
})

test('addChild: a taken username is USERNAME_TAKEN, across families too; two at once give one 201 and one 409 (P2002)', async () => {
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  const stranger = await family(server.base)
  refused(await stranger.api.post('/children', { consent: true, name: 'Copy', username: kid.username, password: 'child-pass-1' }), 409, 'USERNAME_TAKEN')
  const racing = `r${tag()}`
  const both = await Promise.all([1, 2].map(() => mom.api.post('/children', { consent: true, name: 'Kid', username: racing, password: 'child-pass-1' })))
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
  invalid(await mom.api.put(`/children/${kid.id}/password`, { password: 'abcdefg' }), { password: 'short' })
  invalid(await mom.api.put(`/children/${kid.id}/password`, { password: 'password' }), { password: 'common' })
  invalid(await mom.api.put(`/children/${kid.id}/password`, { password: 'the-kid-pass' }), { password: 'personal' })
  invalid(await mom.api.put(`/children/${kid.id}/password`, { password: `${kid.username}-pass` }), { password: 'personal' })
  invalid(await mom.api.put(`/children/${kid.id}/password`, { password: 'p'.repeat(73) }), { password: 'length' })
  assert.equal((await device.get('/session')).body.id, kid.id) // refusals changed nothing
  const done = await mom.api.put(`/children/${kid.id}/password`, { password: 'new-child-pass' })
  assert.equal(done.status, 204)
  assert.equal((await device.get('/session')).body, null)
  refused(await as(server.base).post('/session', { identifier: kid.username, password: kid.password }), 401, 'WRONG_DETAILS')
  await signedIn(kid.username, 'new-child-pass')
  assert.equal((await mom.api.get('/children')).status, 200) // the parent stays signed in
})

test('every parent route refuses a signed-out visitor, a child and a moderator', async () => {
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  const mod = await moderator(server.base)
  made.users.push(mod.id)
  assert.equal((await mod.api.get('/session')).body.role, 'moderator')
  const routes = [
    ['post', '/me/sessions/end'], ['post', '/children/x/sessions/end'],
    ['get', '/children'], ['post', '/children', {}], ['get', '/children/x'], ['patch', '/children/x', {}], ['del', '/children/x'],
    ['put', '/children/x/password', {}], ['patch', '/me', {}], ['put', '/me/password', {}], ['post', '/me/delete', {}],
    ['get', '/settings'], ['put', '/settings', {}], ['put', '/settings/country', {}],
    ['put', '/settings/keep-proof', {}], ['post', '/me/recovery', {}], ['post', '/me/export', {}], // Phase 8: T4, T5, T6
  ]
  const visitors = [
    [as(server.base), 401, 'NOT_SIGNED_IN'],
    [await signedIn(kid.username, kid.password), 403, 'NOT_ALLOWED'],
    [mod.api, 403, 'NOT_ALLOWED'],
  ]
  for (const [api, status, code] of visitors) {
    for (const [method, route, body] of routes) refused(await api[method](route, body), status, code)
  }
})

// ------------------------------------------------------------------ T1, the moderator's second step

/** A six-digit code that is none of the three the server would take right now. */
const notNear = (secret) => {
  const near = [-1, 0, 1].map((d) => codeAt(secret, stepAt() + d))
  return ['000000', '111111', '222222', '333333'].find((code) => !near.includes(code))
}

test('T1: a moderator with the right password and no code gets NEEDS_CODE and no cookie; a wrong code is NEEDS_CODE with code wrong; the right code signs in; a wrong password never asks for a code', async () => {
  const mod = await moderator(server.base)
  made.users.push(mod.id)
  await db.user.update({ where: { id: mod.id }, data: { totpLastStep: null } }) // the helper's own sign-in used this step
  const api = as(server.base)
  const details = { identifier: mod.email, password: mod.password }
  for (const extra of [{}, { code: '' }]) {
    const none = await api.post('/session', { ...details, ...extra })
    assert.deepEqual([none.status, none.body, none.headers.getSetCookie()], [401, { code: 'NEEDS_CODE' }, []])
  }
  const wrong = await api.post('/session', { ...details, code: notNear(mod.secret) })
  assert.deepEqual([wrong.status, wrong.body, wrong.headers.getSetCookie()], [401, { code: 'NEEDS_CODE', fields: { code: 'wrong' } }, []])
  const right = await api.post('/session', { ...details, code: codeAt(mod.secret, stepAt()) })
  assert.equal(right.status, 200)
  assert.deepEqual(right.body, { id: mod.id, role: 'moderator', name: 'Mod', email: mod.email }) // no secret, no step
  assert.equal((await api.get('/reports')).status, 200)
  for (const code of [undefined, '', codeAt(mod.secret, stepAt())]) {
    refused(await as(server.base).post('/session', { identifier: mod.email, password: 'not-the-password', code }), 401, 'WRONG_DETAILS')
  }
})

test('T1: a code signs in once: the same code again is refused, and the same code sent twice at once gives one 200', async () => {
  const mod = await moderator(server.base)
  made.users.push(mod.id)
  await db.user.update({ where: { id: mod.id }, data: { totpLastStep: null } })
  const details = { identifier: mod.email, password: mod.password, code: codeAt(mod.secret, stepAt()) }
  assert.equal((await as(server.base).post('/session', details)).status, 200)
  const again = await as(server.base).post('/session', details)
  assert.deepEqual([again.status, again.body], [401, { code: 'NEEDS_CODE', fields: { code: 'wrong' } }])
  await db.user.update({ where: { id: mod.id }, data: { totpLastStep: null } })
  const both = await Promise.all([1, 2].map(() => as(server.base).post('/session', { ...details, code: codeAt(mod.secret, stepAt()) })))
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 401])
  assert.deepEqual(both.find((r) => r.status === 401).body, { code: 'NEEDS_CODE', fields: { code: 'wrong' } })
})

test('T1: a moderator with no secret cannot sign in, and a parent or a child is never asked for a code', async () => {
  const mod = await moderator(server.base)
  made.users.push(mod.id)
  await db.user.update({ where: { id: mod.id }, data: { totpSecret: null, totpLastStep: null } })
  const details = { identifier: mod.email, password: mod.password }
  refused(await as(server.base).post('/session', details), 401, 'NEEDS_CODE')
  const old = await as(server.base).post('/session', { ...details, code: codeAt(mod.secret, stepAt()) })
  assert.deepEqual([old.status, old.body], [401, { code: 'NEEDS_CODE', fields: { code: 'wrong' } }])
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  for (const { identifier, password } of [{ identifier: mom.email, password: mom.password }, { identifier: kid.username, password: kid.password }]) {
    assert.equal((await as(server.base).post('/session', { identifier, password })).status, 200)
    assert.equal((await as(server.base).post('/session', { identifier, password, code: '000000' })).status, 200) // a code they send is not read
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
  made.reports.push(...Object.values(reports))
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
  assert.equal((await neighbour.api.post('/me/delete', { password: neighbour.password })).status, 204) // and its file does not stay in the test folder
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
  assert.equal((await mom.api.post('/me/delete', { password: mom.password })).status, 204) // the sibling's file does not stay in the test folder
})

test('a row that goes away between the lookup and the update is NOT_FOUND, never 500 (P2025)', async () => {
  await assert.rejects(db.user.update({ where: { id: randomUUID() }, data: { name: 'x' } }), { code: 'P2025' })
  const mom = await family(server.base)
  const kid = await addChild(mom.api)
  const resetting = mom.api.put(`/children/${kid.id}/password`, { password: 'new-child-pass' }) // hashes for a quarter of a second before it writes
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
