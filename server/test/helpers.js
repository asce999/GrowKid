import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { db } from '../src/db.js'

/** Starts the real app on a free port. Returns the API base URL (ending in /api) and close(). */
export async function start() {
  const { default: app } = await import('../src/app.js')
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return {
    base: `http://127.0.0.1:${server.address().port}/api`,
    close: async () => {
      server.closeAllConnections()
      await new Promise((done) => server.close(done))
      await db.$disconnect()
    },
  }
}

/**
 * A client that keeps its cookie. Each call resolves to { status, headers, body }, body being the parsed JSON (undefined when empty).
 * Every client sends its own random address in X-Forwarded-For, so the rate limiters stay out of the way unless `ip` is shared on purpose.
 */
export function as(base, { ip, days } = {}) {
  const address = ip ?? Array.from({ length: 4 }, () => Math.floor(Math.random() * 254) + 1).join('.')
  let cookie = ''
  const send = async (method, path, body) => {
    const headers = { 'x-growkid': '1', 'x-forwarded-for': address }
    if (days !== undefined) headers['x-clock-days'] = String(days)
    if (cookie) headers.cookie = cookie
    if (body !== undefined) {
      headers['content-type'] = 'application/json'
      body = typeof body === 'string' ? body : JSON.stringify(body) // a string is sent as is, to test malformed JSON
    }
    const res = await fetch(base + path, { method, headers, body })
    for (const set of res.headers.getSetCookie()) {
      const pair = set.split(';')[0]
      cookie = pair.endsWith('=') ? '' : pair // a cleared cookie arrives empty
    }
    const raw = await res.text()
    return { status: res.status, headers: res.headers, body: raw ? JSON.parse(raw) : undefined }
  }
  return {
    get: (path) => send('GET', path),
    post: (path, body) => send('POST', path, body),
    put: (path, body) => send('PUT', path, body),
    patch: (path, body) => send('PATCH', path, body),
    del: (path) => send('DELETE', path),
  }
}

/** Signs up a parent with a unique email. Returns their client (already signed in), their user and the details they signed up with. */
export async function family(base, details = {}) {
  const parent = { name: 'Test Parent', email: `parent-${randomUUID()}@example.com`, password: 'parent-pass-1', country: 'IN', ...details }
  const api = as(base)
  const res = await api.post('/parents', parent)
  assert.equal(res.status, 201)
  return { api, user: res.body, ...parent }
}
