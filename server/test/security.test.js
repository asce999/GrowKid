import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import jwt from 'jsonwebtoken'
import { who } from '../src/auth.js'
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
