import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { who } from '../src/auth.js'
import { db } from '../src/db.js'
import { as, family, start } from './helpers.js'

let server
let api
before(async () => {
  server = await start()
  api = as(server.base)
})
after(() => server.close())

test('an unknown route is 404 JSON with helmet headers and no CORS headers', async () => {
  const res = await api.get('/nothing')
  assert.equal(res.status, 404)
  assert.deepEqual(res.body, { code: 'NOT_FOUND' })
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(res.headers.get('access-control-allow-origin'), null)
})

test('a non-GET request without X-GrowKid is 403 NOT_ALLOWED; a GET needs no header', async () => {
  const post = await fetch(`${server.base}/nothing`, { method: 'POST' })
  assert.equal(post.status, 403)
  assert.deepEqual(await post.json(), { code: 'NOT_ALLOWED' })
  const get = await fetch(`${server.base}/nothing`)
  assert.equal(get.status, 404)
})

test('malformed JSON is 400 INVALID', async () => {
  const res = await api.post('/nothing', '{"title":')
  assert.equal(res.status, 400)
  assert.deepEqual(res.body, { code: 'INVALID' })
})

test('the error handler: a foreign key that names a row gone meanwhile (P2003) and a bad percent-escape (URIError) are 404 NOT_FOUND, never 500', async () => {
  // P2003 needs a write that loses a race with a removal, which no test can time; so the handler (the last layer of the app) is called with the errors themselves
  const handler = (await import('../src/app.js')).default.router.stack.at(-1).handle
  for (const err of [Object.assign(new Error('Foreign key constraint violated'), { code: 'P2003' }), Object.assign(new Error('Record not found'), { code: 'P2025' }), new URIError('URI malformed')]) {
    const sent = []
    const res = { headersSent: false, status: (code) => (sent.push(code), res), json: (body) => (sent.push(body), res) }
    handler(err, { complete: true, method: 'PUT', path: '/' }, res, () => sent.push('next'))
    assert.deepEqual(sent, [404, { code: 'NOT_FOUND' }], err.message)
  }
})

test('a failure is logged without its message: a marker in a many-line error never reaches the log, the frames do (F7)', async () => {
  const handler = (await import('../src/app.js')).default.router.stack.at(-1).handle
  const marker = `secret-note-${randomUUID()}`
  // shaped like a Prisma error: several lines, quoting a value, with a code
  const err = Object.assign(new Error(`Invalid invocation:\n\n  title: "${marker}"\n  note: "${marker}"\nUnique constraint failed`), { name: 'PrismaClientKnownRequestError', code: 'P2099' })
  const logged = []
  const real = console.error
  console.error = (...parts) => logged.push(parts.join(' '))
  const sent = []
  try {
    const res = { headersSent: false, status: (code) => (sent.push(code), res), json: (body) => (sent.push(body), res) }
    handler(err, { complete: true, method: 'POST', path: '/api/tasks' }, res, () => sent.push('next'))
  } finally {
    console.error = real
  }
  assert.deepEqual(sent, [500, { code: 'SERVER' }])
  assert.equal(logged.length, 1)
  assert.equal(logged[0].includes(marker), false, 'the message stays out')
  assert.equal(logged[0].includes('Unique constraint'), false, 'every line of it')
  assert.match(logged[0], /^POST \/api\/tasks PrismaClientKnownRequestError P2099 \n\s+at /) // what happened and where, enough to find it
})

test('every /api answer says no-store: a JSON answer, a not-found and a refusal (F3)', async () => {
  const mom = await family(server.base)
  const answers = [
    await mom.api.get('/session'), // 200, with the parent in it
    await mom.api.get('/nothing'), // 404
    await as(server.base).get('/tasks'), // 401, signed out
    await fetch(`${server.base}/tasks`, { method: 'POST' }), // 403, refused by the CSRF check before anything else runs
  ]
  assert.deepEqual(answers.map((res) => res.status), [200, 404, 401, 403])
  for (const res of answers) assert.equal(res.headers.get('cache-control'), 'no-store', String(res.status))
  assert.equal((await mom.api.post('/me/delete', { password: mom.password })).status, 204)
})

test('a 30 kb body is 400 INVALID', async () => {
  const res = await api.post('/nothing', { pad: 'a'.repeat(30 * 1024) })
  assert.equal(res.status, 400)
  assert.deepEqual(res.body, { code: 'INVALID' })
})

test('who: a missing, garbled, unsigned, wrongly signed or unknown-user token is not signed in', async () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const claims = { sub: '00000000-0000-4000-8000-000000000000', v: 0 }
  const tokens = [
    undefined,
    'not-a-token',
    `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`, // alg: none
    jwt.sign(claims, 'x'.repeat(32), { algorithm: 'HS256' }), // another secret
    jwt.sign(claims, process.env.JWT_SECRET, { algorithm: 'HS256' }), // genuine, but no such user
  ]
  for (const token of tokens) {
    const req = { cookies: { growkid: token } }
    let called = 0
    await who(req, null, () => called++)
    assert.equal(req.user, null)
    assert.equal(called, 1)
  }
})

test('a forged, tampered, stale or expired session cookie is not signed in; the genuine one is', async () => {
  const mom = await family(server.base)
  const session = async (token) => (await fetch(`${server.base}/session`, { headers: { cookie: `growkid=${token}` } })).json()
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const claims = { sub: mom.user.id, v: 0 }
  const secret = process.env.JWT_SECRET
  const genuine = jwt.sign(claims, secret, { algorithm: 'HS256', expiresIn: '7d' })
  assert.equal((await session(genuine))?.id, mom.user.id)

  const [head, payload, signature] = genuine.split('.')
  const flipped = signature.slice(0, 10) + (signature[10] === 'A' ? 'B' : 'A') + signature.slice(11)
  const forged = {
    'alg none': `${b64({ alg: 'none', typ: 'JWT' })}.${payload}.`,
    'alg none, signature kept': `${b64({ alg: 'none', typ: 'JWT' })}.${payload}.${signature}`,
    'payload changed, signature kept': `${head}.${b64({ ...claims, v: 1 })}.${signature}`,
    'signature changed': `${head}.${payload}.${flipped}`,
    'another secret': jwt.sign(claims, 'x'.repeat(32), { algorithm: 'HS256', expiresIn: '7d' }),
    'another algorithm, right secret': jwt.sign(claims, secret, { algorithm: 'HS384', expiresIn: '7d' }),
    expired: jwt.sign(claims, secret, { algorithm: 'HS256', expiresIn: -10 }),
  }
  for (const [name, token] of Object.entries(forged)) assert.equal(await session(token), null, name)

  // An older tokenVersion: the token above was genuine, and stops counting once the password change has raised the user to version 1.
  assert.equal((await mom.api.put('/me/password', { current: mom.password, next: 'another-pass-1' })).status, 204)
  assert.equal(await session(genuine), null, 'older tokenVersion')
  const renewed = jwt.sign({ ...claims, v: 1 }, secret, { algorithm: 'HS256', expiresIn: '7d' })
  assert.equal((await session(renewed))?.id, mom.user.id)
})

test('a moderator gets nothing outside reports: every other route is NOT_ALLOWED to them and NOT_SIGNED_IN to a visitor', async () => {
  const email = `mod-${randomUUID()}@example.com`
  const { id: moderatorId } = await db.user.create({ data: { role: 'moderator', name: 'Mod', email, passwordHash: await bcrypt.hash('moderator-pass', 4) } })
  try {
    const moderator = as(server.base)
    assert.equal((await moderator.post('/session', { identifier: email, password: 'moderator-pass' })).status, 200)
    const x = randomUUID() // an id of nothing: the role is refused before the thing is looked for
    const routes = [
      ['get', '/tasks'], ['get', `/tasks/${x}`], ['get', `/proofs/${x}/file`], ['get', '/counts'], ['get', '/today'], ['get', '/tasks/history'], ['get', '/series'], ['post', '/series'], ['put', `/series/${x}`], ['del', `/series/${x}`],
      ['get', '/children'], ['get', `/children/${x}`], ['get', `/children/${x}/progress`], ['get', `/children/${x}/rest-days`],
      ['get', '/growth'], ['get', '/growth/children'], ['get', '/stickers'], ['get', '/leaderboard'], ['get', '/rewards'], ['get', '/requests'], ['get', '/settings'],
      ['post', '/tasks'], ['post', `/tasks/${x}/proofs`], ['post', `/tasks/${x}/review`], ['post', '/tasks/seen'], ['post', '/children'], ['post', `/children/${x}/rest-days`],
      ['post', '/rewards'], ['post', '/requests'], ['post', `/requests/${x}/answer`], ['post', '/me/delete'], ['post', '/reports'], ['post', '/me/sessions/end'], ['post', `/children/${x}/sessions/end`],
      ['put', `/tasks/${x}`], ['put', '/pin'], ['put', `/children/${x}/password`], ['put', `/children/${x}/quest`], ['put', '/me/password'], ['put', '/settings'], ['put', '/settings/country'],
      ['patch', '/me'], ['patch', `/children/${x}`], ['del', `/tasks/${x}`], ['del', `/children/${x}`], ['del', `/rewards/${x}`],
    ]
    for (const [method, path] of routes) {
      for (const [visitor, status, code] of [[moderator, 403, 'NOT_ALLOWED'], [api, 401, 'NOT_SIGNED_IN']]) {
        const res = await visitor[method](path)
        assert.deepEqual([res.status, res.body], [status, { code }], `${method} ${path}`)
      }
    }
    // what a moderator may do: read and answer reports, and read their own (none)
    assert.equal((await moderator.get('/reports')).status, 200)
    assert.deepEqual((await moderator.get('/reports/mine')).body, [])
  } finally {
    await db.user.delete({ where: { id: moderatorId } })
  }
})
