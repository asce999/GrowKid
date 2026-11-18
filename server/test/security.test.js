import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import jwt from 'jsonwebtoken'
import { who } from '../src/auth.js'
import { db } from '../src/db.js'
import { account } from '../src/routes/account.js'
import { family as familyRoutes } from '../src/routes/family.js'
import { reports } from '../src/routes/reports.js'
import { series } from '../src/routes/series.js'
import { tasks } from '../src/routes/tasks.js'
import { png } from './fixtures.js'
import { as, family, moderator, start } from './helpers.js'

let server
let api
before(async () => {
  server = await start()
  api = as(server.base)
})
const swept = [] // the families the sweeps make, erased before the server closes
after(async () => {
  await Promise.all(swept.map((mom) => mom.api.post('/me/delete', { password: mom.password })))
  await server.close()
})

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
    // genuine, but the user is named by something that is not text: never looked up, so never a 500
    ...[5, null, true, { id: claims.sub }, [claims.sub]].map((sub) => jwt.sign({ sub, v: 0 }, process.env.JWT_SECRET, { algorithm: 'HS256' })),
    jwt.sign('just text', process.env.JWT_SECRET, { algorithm: 'HS256' }), // genuine, and no claims at all
  ]
  for (const token of tokens) {
    const req = { cookies: { growkid: token } }
    let called = 0
    await who(req, null, () => called++)
    assert.equal(req.user, null)
    assert.equal(called, 1)
  }
  // cookie-parser turns a cookie that starts "j:" into an object: not a token either
  const req = { cookies: { growkid: { sub: claims.sub, v: 0 } } }
  await who(req, null, () => {})
  assert.equal(req.user, null)
})

test('a forged, tampered, stale or expired session cookie is not signed in; the genuine one is', async () => {
  const mom = await family(server.base)
  const dad = await family(server.base) // another family, whose id a forger would want
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
    'another user, signature kept': `${head}.${b64({ ...JSON.parse(Buffer.from(payload, 'base64url')), sub: dad.user.id })}.${signature}`,
    'signature changed': `${head}.${payload}.${flipped}`,
    'another secret': jwt.sign(claims, 'x'.repeat(32), { algorithm: 'HS256', expiresIn: '7d' }),
    'another algorithm, right secret': jwt.sign(claims, secret, { algorithm: 'HS384', expiresIn: '7d' }),
    expired: jwt.sign(claims, secret, { algorithm: 'HS256', expiresIn: -10 }),
    'the version as text': jwt.sign({ ...claims, v: '0' }, secret, { algorithm: 'HS256', expiresIn: '7d' }),
    'no version': jwt.sign({ sub: mom.user.id }, secret, { algorithm: 'HS256', expiresIn: '7d' }),
    'a cookie-parser object': `j:${JSON.stringify(claims)}`,
  }
  for (const [name, token] of Object.entries(forged)) assert.equal(await session(encodeURIComponent(token)), null, name)
  assert.equal((await session(encodeURIComponent(genuine)))?.id, mom.user.id) // the encoding above changes nothing for a real token

  // An older tokenVersion: the token above was genuine, and stops counting once the password change has raised the user to version 1.
  assert.equal((await mom.api.put('/me/password', { current: mom.password, next: 'another-pass-1' })).status, 204)
  assert.equal(await session(genuine), null, 'older tokenVersion')
  const renewed = jwt.sign({ ...claims, v: 1 }, secret, { algorithm: 'HS256', expiresIn: '7d' })
  assert.equal((await session(renewed))?.id, mom.user.id)
  assert.equal((await mom.api.post('/me/delete', { password: 'another-pass-1' })).status, 204)
  assert.equal((await dad.api.post('/me/delete', { password: dad.password })).status, 204)
})

// ------------------------------------------------------------------ every route, from the routers themselves (final plan Phase 9)

const ROUTES = [account, tasks, familyRoutes, reports, series].flatMap((router) =>
  router.stack.filter((layer) => layer.route).flatMap((layer) => Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`)),
)

/** Who may call each route: p a parent, c a child, m a moderator; 'public' needs no sign-in. Everyone else is refused before anything is looked up. */
const WHO = {
  'GET /session': 'public', 'POST /session': 'public', 'POST /parents': 'public', 'GET /countries': 'public',
  'POST /recovery': 'public', // Phase 8
  'PATCH /me': 'p', 'PUT /me/password': 'p', 'POST /me/sessions/end': 'p', 'POST /me/delete': 'p', 'GET /settings': 'p', 'PUT /settings': 'p', 'PUT /settings/country': 'p',
  'PUT /settings/keep-proof': 'p', 'POST /me/recovery': 'p', 'POST /me/export': 'p', // Phase 8
  'GET /children': 'p', 'POST /children': 'p', 'GET /children/:id': 'p', 'PATCH /children/:id': 'p', 'DELETE /children/:id': 'p', 'PUT /children/:id/password': 'p', 'POST /children/:id/sessions/end': 'p',
  'POST /tasks': 'p', 'PUT /tasks/:id': 'p', 'DELETE /tasks/:id': 'p', 'POST /tasks/:id/review': 'p', 'GET /growth/children': 'p', 'GET /children/:id/progress': 'p',
  'POST /rewards': 'p', 'DELETE /rewards/:id': 'p', 'POST /requests/:id/answer': 'p', 'DELETE /children/:id/agreement': 'p', 'POST /suggestions/:id/answer': 'p',
  'PUT /children/:id/quest': 'p', 'GET /children/:id/rest-days': 'p', 'POST /children/:id/rest-days': 'p', 'GET /series': 'p', 'POST /series': 'p', 'PUT /series/:id': 'p', 'DELETE /series/:id': 'p',
  'PUT /me/avatar': 'c', 'PUT /me/sound': 'c', 'POST /tasks/:id/proofs': 'c', 'GET /proofs/mine': 'c', 'POST /tasks/seen': 'c', 'PUT /pin': 'c', 'GET /growth': 'c', 'GET /today': 'c',
  'GET /stickers': 'c', 'GET /leaderboard': 'c', 'POST /requests': 'c', 'POST /requests/seen': 'c', 'PUT /goal': 'c', 'POST /agree': 'c', 'POST /suggestions': 'c',
  'GET /tasks': 'pc', 'GET /tasks/history': 'pc', 'GET /tasks/:id': 'pc', 'GET /proofs/:id/file': 'pc', 'GET /counts': 'pc', 'GET /rewards': 'pc', 'GET /requests': 'pc', 'GET /suggestions': 'pc',
  'POST /reports': 'pc', 'GET /reports/mine': 'pcm', 'GET /reports': 'm', 'POST /reports/:id/resolve': 'm',
  'POST /reports/:id/pause': 'm', 'POST /reports/:id/unpause': 'm', // Phase 8
}
/** What the :id in a path names, by how the path starts. The sweeps send an id of that kind. */
const OWNED = [['/children/', 'child'], ['/tasks/', 'task'], ['/proofs/', 'proof'], ['/rewards/', 'reward'], ['/requests/', 'request'], ['/series/', 'series'], ['/suggestions/', 'suggestion'], ['/reports/', 'report']]
const kindOf = (route) => OWNED.find(([prefix]) => route.split(' ')[1].startsWith(prefix))?.[1]
/** A route that checks its body before it looks the id up needs a body that passes, or the sweep would see INVALID, not NOT_FOUND. */
const BODIES = { 'POST /suggestions/:id/answer': { result: 'declined' } }
const VERB = { GET: 'get', POST: 'post', PUT: 'put', PATCH: 'patch', DELETE: 'del' }
const call = (who, route, id = randomUUID()) => {
  const [method, pattern] = route.split(' ')
  return who[VERB[method]](pattern.replace(':id', id), method === 'GET' || method === 'DELETE' ? undefined : BODIES[route])
}

/** A parent and one child, each signed in on their own client. */
async function household() {
  const mom = await family(server.base)
  swept.push(mom)
  return { mom, ...(await addChild(mom, 'Asha')) }
}
async function addChild(mom, name) {
  const login = { name, username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1' }
  const child = (await mom.api.post('/children', { ...login, consent: true })).body
  const kid = as(server.base)
  assert.equal((await kid.post('/session', { identifier: login.username, password: login.password })).status, 200)
  return { kid, child }
}

const due = () => new Date(Date.now() + 2 * 86_400_000).toISOString()
const taskFor = (child, title = 'Tidy the room') => ({ childId: child.id, category: 'chores', title, instructions: 'Floor clear.', dueAt: due(), points: 20 })
const made = async (sending) => {
  const res = await sending
  assert.ok(res.status === 200 || res.status === 201, `set-up: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}
/** One of everything a family holds, by the kind of id: an open task, an approved proof with a file, a reward, a request, a series, a suggestion, a report. */
async function everything({ mom, kid, child }) {
  const done = await made(mom.api.post('/tasks', taskFor(child)))
  const proof = (await made(kid.form(`/tasks/${done.id}/proofs`, { note: 'Done' }, { bytes: png(), name: 'p.png' }))).proofs.at(-1)
  await made(mom.api.post(`/tasks/${done.id}/review`, { proofId: proof.id, result: 'approved' }))
  assert.equal((await kid.post('/tasks/seen', { taskIds: [done.id] })).status, 204) // so the points can be spent
  const open = await made(mom.api.post('/tasks', taskFor(child, 'Water the plants')))
  const reward = await made(mom.api.post('/rewards', { title: 'Pick the film', cost: 10 }))
  const request = await made(kid.post('/requests', { rewardId: reward.id }))
  const repeating = await made(mom.api.post('/series', { ...taskFor(child, 'Feed the cat'), weekdays: 127, dueTime: '23:59' }))
  const suggestion = await made(kid.post('/suggestions', { ideaId: 'chores-2' }))
  const report = await made(mom.api.post('/reports', { details: 'A report of our own.' }))
  const ids = { child: child.id, task: open.id, proof: proof.id, reward: reward.id, request: request.id, series: repeating.id, suggestion: suggestion.id, report: report.id }
  for (const [kind, id] of Object.entries(ids)) assert.match(String(id), /^[0-9a-f-]{36}$/, kind)
  const state = async () => JSON.stringify(await Promise.all(['/children', '/tasks', '/rewards', '/requests', '/series', '/suggestions', '/settings', '/growth/children', `/tasks/${done.id}`, `/tasks/${open.id}`].map(async (path) => (await mom.api.get(path)).body)))
  return { ids, done, open, reward, request, proof, state }
}

test('every route is listed once, says who may call it, and says what its :id names', () => {
  assert.equal(new Set(ROUTES).size, ROUTES.length, 'no route twice')
  assert.deepEqual(ROUTES.filter((route) => !(route in WHO)), [], 'a route with no entry in WHO: say who may call it')
  assert.deepEqual(Object.keys(WHO).filter((route) => !ROUTES.includes(route)), [], 'an entry in WHO for a route that is gone')
  for (const [route, who] of Object.entries(WHO)) assert.match(who, /^(public|p?c?m?)$/, `${route}: who is 'public' or some of p, c and m`)
  for (const route of ROUTES.filter((r) => r.includes(':'))) {
    assert.match(route, /^\S+ [^:]*:id[^:]*$/, `${route}: a route has one parameter, named :id`)
    assert.ok(kindOf(route), `say in OWNED what the :id of ${route} names`)
  }
})

test('everyone a route is not for is refused before anything is looked up: a visitor NOT_SIGNED_IN, another role NOT_ALLOWED', async () => {
  const mod = await moderator(server.base)
  try {
    const { mom, kid } = await household()
    const callers = { p: mom.api, c: kid, m: mod.api }
    for (const [route, who] of Object.entries(WHO)) {
      if (who === 'public') continue
      const visitor = await call(as(server.base), route)
      assert.deepEqual([visitor.status, visitor.body], [401, { code: 'NOT_SIGNED_IN' }], `${route} signed out`)
      for (const [letter, caller] of Object.entries(callers)) {
        if (who.includes(letter)) continue
        const res = await call(caller, route)
        assert.deepEqual([res.status, res.body], [403, { code: 'NOT_ALLOWED' }], `${route} as ${letter}`)
      }
    }
  } finally {
    await db.moderatorAction.deleteMany({ where: { moderatorId: mod.id } })
    await db.user.delete({ where: { id: mod.id } })
  }
})

test("another family's ids are NOT_FOUND on every route that takes one, for a parent and for a child, and nothing of that family changes", async () => {
  const a = await household()
  const b = await household()
  const theirs = await everything(a)
  try {
    const before = await theirs.state()
    for (const route of ROUTES.filter((r) => r.includes(':id') && WHO[r] !== 'm')) {
      const answers = []
      for (const who of [b.mom.api, b.kid]) {
        const res = await call(who, route, theirs.ids[kindOf(route)])
        answers.push(`${res.status} ${res.body?.code}`)
      }
      assert.ok(answers.every((answer) => answer === '404 NOT_FOUND' || answer === '403 NOT_ALLOWED'), `${route}: ${answers}`)
      assert.ok(answers.includes('404 NOT_FOUND'), `${route}: the role it is for must not find it (${answers})`)
    }
    assert.equal(await theirs.state(), before, 'nothing of the first family changed')
    assert.equal((await a.kid.get(`/proofs/${theirs.proof.id}/file`)).status, 200)
  } finally {
    await db.report.deleteMany({ where: { id: theirs.ids.report } }) // an unanswered report outlives its family
  }
})

test("a brother's or sister's ids are NOT_FOUND to a child on every route a child may call with one, and in a body they change nothing", async () => {
  const home = await household()
  const sister = await addChild(home.mom, 'Bela')
  const hers = await everything({ mom: home.mom, ...sister })
  try {
    const before = await hers.state()
    for (const route of ROUTES.filter((r) => r.includes(':id') && WHO[r].includes('c'))) {
      const res = await call(home.kid, route, hers.ids[kindOf(route)])
      assert.deepEqual([res.status, res.body], [404, { code: 'NOT_FOUND' }], route)
    }
    const pin = await home.kid.put('/pin', { taskId: hers.open.id })
    assert.deepEqual([pin.status, pin.body], [404, { code: 'NOT_FOUND' }], 'pin')
    assert.equal((await home.kid.post('/tasks/seen', { taskIds: [hers.done.id, hers.open.id] })).status, 204)
    assert.equal((await home.kid.post('/requests/seen', { ids: [hers.request.id] })).status, 204)
    const report = await home.kid.post('/reports', { details: 'About my sister’s task.', taskId: hers.open.id })
    assert.deepEqual([report.status, report.body.item], [201, undefined]) // the report goes, without her task
    await db.report.deleteMany({ where: { id: report.body.id } })
    assert.equal(await hers.state(), before, 'nothing of hers changed')
    assert.deepEqual((await home.kid.get('/tasks')).body, [])
    assert.deepEqual((await home.kid.get('/requests')).body, [])
    assert.deepEqual((await home.kid.get('/proofs/mine')).body, [])
  } finally {
    await db.report.deleteMany({ where: { id: hers.ids.report } })
  }
})

test("an id in a body: another family's child, task, proof, reward and request are NOT_FOUND, or change nothing", async () => {
  const a = await household()
  const b = await household()
  const theirs = await everything(a)
  const sent = [theirs.ids.report]
  try {
    // two things of family A's that wait to be seen: an approval, and an answer to the request
    const unseen = await made(a.mom.api.post('/tasks', taskFor(a.child, 'Read a page')))
    const waiting = (await made(a.kid.form(`/tasks/${unseen.id}/proofs`, { note: 'Read it' }))).proofs.at(-1)
    await made(a.mom.api.post(`/tasks/${unseen.id}/review`, { proofId: waiting.id, result: 'approved' }))
    await made(a.mom.api.post(`/requests/${theirs.request.id}/answer`, { result: 'given' }))
    assert.deepEqual((await a.kid.get('/counts')).body, { results: 1, answers: 1 })
    // family B's own task in review, to answer with family A's proof id, and one to move
    const own = await made(b.mom.api.post('/tasks', taskFor(b.child)))
    await made(b.kid.form(`/tasks/${own.id}/proofs`, { note: 'Done' }))
    const moving = await made(b.mom.api.post('/tasks', taskFor(b.child, 'To move')))
    const before = await theirs.state()

    const refusals = [
      ['a task for their child', () => b.mom.api.post('/tasks', taskFor(a.child)), 404, 'NOT_FOUND'],
      ['a series for their child', () => b.mom.api.post('/series', { ...taskFor(a.child), weekdays: 127, dueTime: '23:59' }), 404, 'NOT_FOUND'],
      ['a task moved to their child', () => b.mom.api.put(`/tasks/${moving.id}`, taskFor(a.child)), 404, 'NOT_FOUND'],
      ['their reward, changed', () => b.mom.api.post('/rewards', { id: theirs.reward.id, title: 'Ours now', cost: 10 }), 404, 'NOT_FOUND'],
      ['their proof, approved through our task', () => b.mom.api.post(`/tasks/${own.id}/review`, { proofId: theirs.proof.id, result: 'approved' }), 409, 'REVIEWED'],
      ['their reward, asked for', () => b.kid.post('/requests', { rewardId: theirs.reward.id }), 404, 'NOT_FOUND'],
      ['their reward, as a goal', () => b.kid.put('/goal', { rewardId: theirs.reward.id }), 404, 'NOT_FOUND'],
      ['their task, pinned', () => b.kid.put('/pin', { taskId: theirs.open.id }), 404, 'NOT_FOUND'],
    ]
    for (const [label, send, status, code] of refusals) {
      const res = await send()
      assert.deepEqual([res.status, res.body], [status, { code }], label)
    }
    assert.equal((await b.kid.post('/tasks/seen', { taskIds: [unseen.id] })).status, 204)
    assert.equal((await b.kid.post('/requests/seen', { ids: [theirs.request.id] })).status, 204)
    for (const who of [b.mom.api, b.kid]) {
      const report = await who.post('/reports', { details: 'About a task that is not ours.', taskId: theirs.open.id })
      sent.push(report.body.id)
      assert.deepEqual([report.status, report.body.item], [201, undefined]) // the report goes, without their task
    }
    assert.deepEqual((await a.kid.get('/counts')).body, { results: 1, answers: 1 }, 'both still wait for their own child')
    assert.equal(await theirs.state(), before, 'nothing of the first family changed')
  } finally {
    await db.report.deleteMany({ where: { id: { in: sent } } })
  }
})

test('every write route refuses a request without the X-GrowKid header; an id that is a NUL, a lone surrogate, a path, far too long or badly escaped is never a 500', async () => {
  for (const route of ROUTES.filter((r) => !r.startsWith('GET '))) {
    const [method, pattern] = route.split(' ')
    const res = await fetch(`${server.base}${pattern.replace(':id', randomUUID())}`, { method })
    assert.deepEqual([res.status, await res.json()], [403, { code: 'NOT_ALLOWED' }], route)
  }
  for (const id of ['%00', '%ED%A0%80', '..%2F..%2F.env', 'a'.repeat(300), '%ZZ']) {
    const { mom, kid } = await household() // a family for each id, so no caller nears the limit of 120 writes a minute
    for (const route of ROUTES.filter((r) => r.includes(':id'))) {
      for (const who of [mom.api, kid]) {
        const res = await call(who, route, id)
        assert.ok(res.status >= 400 && res.status < 500 && res.status !== 429, `${route} with ${id}: ${res.status}`)
      }
    }
  }
})
