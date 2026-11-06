import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdir } from 'node:fs/promises'
import { db } from '../src/db.js'

/** Starts the real app on a free port. Returns the API base URL (ending in /api) and close(). */
export async function start() {
  await mkdir(process.env.UPLOAD_DIR, { recursive: true }) // index.js does this at boot; the tests start app.js directly
  // GET /reports gives the moderator the oldest 200 waiting reports, and every run leaves some behind (a deleted family's unanswered
  // reports are kept), so each file starts with none waiting. Only ever in a database named *_test.
  assert.match(decodeURIComponent(new URL(process.env.DATABASE_URL).pathname), /_test$/)
  await db.report.deleteMany({ where: { resolvedAt: null } })
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
 * A client that keeps its cookie. Each call resolves to { status, headers, body }, body being the parsed JSON (undefined when empty, a Buffer for a file).
 * Every client sends its own random address in X-Forwarded-For, so the rate limiters stay out of the way unless `ip` is shared on purpose.
 */
export function as(base, { ip, days } = {}) {
  const address = ip ?? Array.from({ length: 4 }, () => Math.floor(Math.random() * 254) + 1).join('.')
  let cookie = ''
  const send = async (method, path, body, extra) => {
    // the server keeps the last clock offset it was told (a proof <img> carries none), so every request here names its own: 0 by default
    const headers = { 'x-growkid': '1', 'x-forwarded-for': address, 'x-clock-days': String(days ?? 0), ...extra }
    if (cookie) headers.cookie = cookie
    if (body !== undefined && !(body instanceof FormData)) {
      headers['content-type'] ??= 'application/json'
      body = typeof body === 'string' ? body : JSON.stringify(body) // a string is sent as is, to test malformed JSON
    }
    const res = await fetch(base + path, { method, headers, body })
    for (const set of res.headers.getSetCookie()) {
      const pair = set.split(';')[0]
      cookie = pair.endsWith('=') ? '' : pair // a cleared cookie arrives empty
    }
    const raw = Buffer.from(await res.arrayBuffer())
    const json = res.headers.get('content-type')?.includes('json') // anything else (a proof file) comes back as bytes
    return { status: res.status, headers: res.headers, body: raw.length ? (json ? JSON.parse(raw) : raw) : undefined }
  }
  return {
    get: (path, extra) => send('GET', path, undefined, extra), // extra: more request headers, such as Range
    post: (path, body, extra) => send('POST', path, body, extra),
    put: (path, body, extra) => send('PUT', path, body, extra),
    patch: (path, body) => send('PATCH', path, body),
    del: (path) => send('DELETE', path),
    /** A multipart POST: text fields, and optionally one file { bytes, name, field } (field defaults to 'file'). */
    form: (path, fields = {}, file) => {
      const body = new FormData()
      for (const [name, value] of Object.entries(fields)) body.set(name, value)
      if (file) body.set(file.field ?? 'file', new Blob([file.bytes]), file.name)
      return send('POST', path, body)
    },
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
