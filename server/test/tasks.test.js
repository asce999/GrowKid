import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { syncBuiltinESMExports } from 'node:module'
import fsPromises, { readFile, readdir } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { after, before, mock, test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { db, loadChild, lockChild } from '../src/db.js'
import { hasRoom } from '../src/files.js'
import { uploadsInFlight } from '../src/routes/tasks.js'
import { stickers, weekKey } from '../src/scoring.js'
import { SECRET, box, brokenJpeg, chunk, jpeg, location, mp4, pdf, png, text, webm, webp, withRoute } from './fixtures.js'
import { as, family, moderator as newModerator, start } from './helpers.js'

let server
let moderator
let moderatorId
const made = [] // every family this file makes, erased at the end so the upload folder ends empty
before(async () => {
  server = await start()
  ;({ id: moderatorId, api: moderator } = await newModerator(server.base)) // T1: signed in with a code
})
const erase = (mom) => mom.api.post('/me/delete', { password: mom.password })
after(async () => {
  await Promise.all(made.map(erase)) // a no-op for a family a test already erased
  await db.user.deleteMany({ where: { id: moderatorId } })
  await server.close()
})

const DAY = 86_400_000
const dueIn = (days = 2) => new Date(Date.now() + days * DAY).toISOString()
const refused = (res, status, code) => {
  assert.equal(res.status, status)
  assert.deepEqual(res.body, { code })
}
const invalid = (res, fields) => {
  assert.equal(res.status, 400)
  assert.deepEqual(res.body, { code: 'INVALID', fields })
}
const kept = async () => (await readdir(process.env.UPLOAD_DIR)).sort()
const file = (bytes, name = 'proof.png', field) => ({ bytes, name, field })

/** A child of this parent, signed in on their own client (days moves that client's clock). */
async function addChild(mom, days) {
  const sent = { name: 'Kid', username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1', consent: true }
  const res = await mom.api.post('/children', sent)
  assert.equal(res.status, 201)
  const api = as(server.base, { days })
  assert.equal((await api.post('/session', { identifier: sent.username, password: sent.password })).status, 200)
  return { ...res.body, api }
}
/** A parent with one child. */
async function household(details) {
  const mom = await family(server.base, details)
  made.push(mom)
  return { mom, kid: await addChild(mom) }
}
const taskBody = (kid, more) => ({ childId: kid.id, category: 'chores', title: 'Tidy the room', instructions: 'Floor clear, bed made.', dueAt: dueIn(), points: 20, ...more })
async function makeTask(mom, kid, more) {
  const res = await mom.api.post('/tasks', taskBody(kid, more))
  assert.equal(res.status, 201)
  return res.body
}
const send = (kid, taskId, fields, upload) => kid.api.form(`/tasks/${taskId}/proofs`, fields, upload)
/** A task with proof waiting for review. Returns the id, the newest proof's id and what sendProof answered. */
async function inReview(mom, kid, more, fields = { note: 'Done!' }, upload) {
  const task = await makeTask(mom, kid, more)
  const sent = await send(kid, task.id, fields, upload)
  assert.equal(sent.status, 201)
  return { id: task.id, proofId: sent.body.proofs.at(-1).id, sent: sent.body }
}
const answer = (mom, held, body) => mom.api.post(`/tasks/${held.id}/review`, { proofId: held.proofId, ...body })
const approve = (mom, held, cheer) => answer(mom, held, { result: 'approved', cheer })
const sendBack = (mom, held, note) => answer(mom, held, { result: 'sentBack', note })

// ------------------------------------------------------------------ create, read, edit, delete

test('createTask: a task as index.js documents it, trimmed, 201; wrong types are INVALID and never 500', async () => {
  const { mom, kid } = await household()
  const res = await mom.api.post('/tasks', taskBody(kid, { title: '  Tidy the room  ', instructions: ' Floor clear. ' }))
  assert.equal(res.status, 201)
  const task = res.body
  assert.deepEqual(Object.keys(task).sort(), ['category', 'childId', 'childName', 'createdAt', 'doneLooksLike', 'dueAt', 'id', 'instructions', 'pinned', 'points', 'proofs', 'resultSeen', 'status', 'title'])
  assert.deepEqual(
    [task.childId, task.childName, task.title, task.instructions, task.status, task.proofs, task.resultSeen, task.pinned, task.points],
    [kid.id, 'Kid', 'Tidy the room', 'Floor clear.', 'todo', [], true, false, 20],
  )
  assert.ok(Math.abs(Date.parse(task.createdAt) - Date.now()) < 10_000)
  assert.equal(task.dueAt, new Date(task.dueAt).toISOString())

  invalid(await mom.api.post('/tasks', taskBody(kid, { points: '20' })), { points: 'range' })
  invalid(await mom.api.post('/tasks', taskBody(kid, { title: 123 })), { title: 'length' })
  invalid(await mom.api.post('/tasks', taskBody(kid, { instructions: ['x'], category: 7, dueAt: 5 })), { category: 'required', instructions: 'length', dueAt: 'past' })
  // PostgreSQL refuses a NUL and Prisma a lone surrogate: the shared text() removes the one and mends the other, and keeps the rest
  const mended = await mom.api.post('/tasks', taskBody(kid, { title: 'a\u0000b task', instructions: 'ok\ud800' }))
  assert.deepEqual([mended.status, mended.body.title, mended.body.instructions], [201, 'ab task', 'ok�'])
  invalid(await mom.api.post('/tasks', taskBody(kid, { title: '\u0000\u0000\u0000' })), { title: 'length' }) // nothing is left of it
  invalid(await mom.api.post('/children', { consent: true, name: '\u0000\u0000', username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1' }), { name: 'required' })
  refused(await mom.api.get(`/tasks/x\u0000y`), 404, 'NOT_FOUND')
  for (const [change, fields] of [
    [{ category: 'sport' }, { category: 'required' }],
    [{ title: 'ab' }, { title: 'length' }],
    [{ title: 'x'.repeat(81) }, { title: 'length' }],
    [{ instructions: '   ' }, { instructions: 'length' }],
    [{ instructions: 'x'.repeat(501) }, { instructions: 'length' }],
    [{ dueAt: 'tomorrow' }, { dueAt: 'past' }],
    [{ dueAt: '2020-01-01T10:00:00Z' }, { dueAt: 'past' }],
    [{ points: 22 }, { points: 'range' }],
    [{ points: 0 }, { points: 'range' }],
    [{ points: 105 }, { points: 'range' }],
    [{ points: 20.5 }, { points: 'range' }],
  ]) invalid(await mom.api.post('/tasks', taskBody(kid, change)), fields)
})

test('createTask: SCREENED names the word (a typographic apostrophe counts); INVALID is checked first; the child must be the parent\'s', async () => {
  const { mom, kid } = await household()
  const screened = await mom.api.post('/tasks', taskBody(kid, { title: 'Dare to read' }))
  assert.equal(screened.status, 400)
  assert.deepEqual(screened.body, { code: 'SCREENED', fields: { word: 'dare' } })
  assert.deepEqual((await mom.api.post('/tasks', taskBody(kid, { instructions: 'Don’t tell anyone' }))).body, { code: 'SCREENED', fields: { word: "don't tell" } })
  invalid(await mom.api.post('/tasks', taskBody(kid, { title: 'Secret', points: 3 })), { points: 'range' })

  const other = await household()
  refused(await mom.api.post('/tasks', taskBody(other.kid, { title: '' })), 404, 'NOT_FOUND') // ownership before validation
  refused(await mom.api.post('/tasks', taskBody({ id: randomUUID() })), 404, 'NOT_FOUND')
  refused(await mom.api.post('/tasks', taskBody({ id: 123 })), 404, 'NOT_FOUND')
  refused(await mom.api.post('/tasks'), 404, 'NOT_FOUND')
  for (const [api, status, code] of [[as(server.base), 401, 'NOT_SIGNED_IN'], [kid.api, 403, 'NOT_ALLOWED'], [moderator, 403, 'NOT_ALLOWED']]) {
    refused(await api.post('/tasks', taskBody(kid)), status, code)
  }
})

test('listTasks and getTask: a parent sees the family, a child their own, soonest due first then oldest; nobody else; no fileUrl in the list', async () => {
  const { mom, kid } = await household()
  const sibling = await addChild(mom)
  const same = dueIn(1)
  const later = await makeTask(mom, kid, { title: 'Later one', dueAt: dueIn(3) })
  const first = await makeTask(mom, kid, { title: 'First one', dueAt: same })
  const second = await makeTask(mom, sibling, { title: 'Second one', dueAt: same }) // same due time, created after
  const sent = await send(kid, first.id, { note: 'x' }, file(png()))
  assert.equal(sent.body.proofs[0].fileUrl, `/api/proofs/${sent.body.proofs[0].id}/file`)

  const all = await mom.api.get('/tasks')
  assert.deepEqual(all.body.map((t) => t.id), [first.id, second.id, later.id])
  assert.equal('fileUrl' in all.body[0].proofs[0], false)
  assert.deepEqual((await kid.api.get('/tasks')).body.map((t) => t.id), [first.id, later.id])
  assert.deepEqual((await sibling.api.get('/tasks')).body.map((t) => t.id), [second.id])
  const got = await mom.api.get(`/tasks/${first.id}`)
  assert.equal(got.status, 200)
  assert.equal(got.body.proofs[0].fileUrl, `/api/proofs/${sent.body.proofs[0].id}/file`)
  assert.equal((await kid.api.get(`/tasks/${first.id}`)).status, 200)

  const stranger = await household()
  assert.deepEqual((await stranger.mom.api.get('/tasks')).body, [])
  for (const api of [stranger.mom.api, stranger.kid.api, sibling.api]) refused(await api.get(`/tasks/${first.id}`), 404, 'NOT_FOUND')
  refused(await mom.api.get(`/tasks/${randomUUID()}`), 404, 'NOT_FOUND')
  for (const route of ['/tasks', `/tasks/${first.id}`]) {
    refused(await as(server.base).get(route), 401, 'NOT_SIGNED_IN')
    refused(await moderator.get(route), 403, 'NOT_ALLOWED')
  }
})

test('updateTask: editable until the first proof, then LOCKED; a past due time may stay as it is but not be moved to another past one', async () => {
  const { mom, kid } = await household()
  const sibling = await addChild(mom)
  const task = await makeTask(mom, kid, { dueAt: dueIn(1) })
  const edit = (api, id, more) => api.put(`/tasks/${id}`, taskBody(kid, { dueAt: task.dueAt, ...more }))

  const res = await edit(mom.api, task.id, { title: ' New title ', points: 50, childId: sibling.id })
  assert.equal(res.status, 200)
  assert.deepEqual([res.body.title, res.body.points, res.body.childId, res.body.childName, res.body.id, res.body.createdAt], ['New title', 50, sibling.id, 'Kid', task.id, task.createdAt])
  invalid(await edit(mom.api, task.id, { childId: kid.id, points: 22 }), { points: 'range' })
  assert.equal((await sibling.api.put('/pin', { taskId: task.id })).body[0].pinned, true)
  assert.equal((await edit(mom.api, task.id, { childId: sibling.id, title: 'Same child' })).body.pinned, true) // an edit alone keeps the pin
  assert.equal((await edit(mom.api, task.id, { childId: kid.id })).body.pinned, false) // moved to another child: that child's pin does not follow it

  const later = as(server.base, { days: 3 }) // the due time has passed
  assert.equal((await later.post('/session', { identifier: mom.email, password: mom.password })).status, 200)
  assert.equal((await edit(later, task.id, { title: 'Still allowed' })).status, 200)
  invalid(await edit(later, task.id, { dueAt: new Date(Date.parse(task.dueAt) + 3_600_000).toISOString() }), { dueAt: 'past' })

  await send(kid, task.id, { note: 'done' })
  refused(await edit(mom.api, task.id, { title: 'Too late' }), 409, 'LOCKED')
  const other = await household()
  refused(await edit(other.mom.api, task.id, {}), 404, 'NOT_FOUND')
  refused(await edit(kid.api, task.id, {}), 403, 'NOT_ALLOWED')
  refused(await edit(moderator, task.id, {}), 403, 'NOT_ALLOWED')
  refused(await edit(as(server.base), task.id, {}), 401, 'NOT_SIGNED_IN')
  const sentBack = await inReview(mom, kid)
  await sendBack(mom, sentBack, 'Again')
  refused(await edit(mom.api, sentBack.id, {}), 409, 'LOCKED') // a task that was sent back has had a proof
})

test('deleteTask: until it is approved; the proof files go with it; another family\'s is NOT_FOUND', async () => {
  const { mom, kid } = await household()
  const before = await kept()
  const todo = await makeTask(mom, kid)
  assert.equal((await mom.api.del(`/tasks/${todo.id}`)).status, 204)
  refused(await mom.api.get(`/tasks/${todo.id}`), 404, 'NOT_FOUND')
  refused(await mom.api.del(`/tasks/${todo.id}`), 404, 'NOT_FOUND')

  const withFile = await inReview(mom, kid, {}, { note: '' }, file(png()))
  const stored = withFile.proofId
  assert.deepEqual(await kept(), [...before, stored].sort())
  const stranger = await household()
  refused(await stranger.mom.api.del(`/tasks/${withFile.id}`), 404, 'NOT_FOUND')
  for (const api of [kid.api, moderator]) refused(await api.del(`/tasks/${withFile.id}`), 403, 'NOT_ALLOWED')
  refused(await as(server.base).del(`/tasks/${withFile.id}`), 401, 'NOT_SIGNED_IN')
  assert.equal((await mom.api.del(`/tasks/${withFile.id}`)).status, 204)
  assert.deepEqual(await kept(), before)
  assert.equal(await db.proof.count({ where: { taskId: withFile.id } }), 0)

  const approved = await inReview(mom, kid, {}, { note: '' }, file(png()))
  assert.equal((await approve(mom, approved)).status, 200)
  refused(await mom.api.del(`/tasks/${approved.id}`), 409, 'LOCKED')
  assert.deepEqual(await kept(), [...before, approved.proofId].sort()) // nothing was removed
  assert.equal((await mom.api.get(`/tasks/${approved.id}`)).status, 200)
})

// ------------------------------------------------------------------ sendProof

test('sendProof: INVALID needs a note or a file, a note is at most 500; LOCKED once sent; only the child\'s own task; late proof is marked', async () => {
  const { mom, kid } = await household()
  const task = await makeTask(mom, kid, { dueAt: dueIn(1) })
  invalid(await send(kid, task.id, {}), { proof: 'required' })
  invalid(await send(kid, task.id, { note: '   ' }), { proof: 'required' })
  invalid(await send(kid, task.id, { note: 'x'.repeat(501) }), { note: 'length' })
  invalid(await send(kid, task.id, { note: 'x'.repeat(501) }, file(png())), { note: 'length' })

  const res = await send(kid, task.id, { note: '  all done  ' })
  assert.equal(res.status, 201)
  assert.deepEqual([res.body.status, res.body.pinned, res.body.resultSeen, res.body.proofs.length], ['review', false, true, 1])
  const proof = res.body.proofs[0]
  assert.deepEqual(Object.keys(proof).sort(), ['id', 'late', 'note', 'sentAt'])
  assert.deepEqual([proof.note, proof.late], ['all done', false])
  assert.ok(Math.abs(Date.parse(proof.sentAt) - Date.now()) < 10_000)
  refused(await send(kid, task.id, { note: 'again' }), 409, 'LOCKED')

  const stranger = await household()
  const mine = await makeTask(mom, kid)
  refused(await send(stranger.kid, mine.id, { note: 'x' }), 404, 'NOT_FOUND')
  refused(await send(kid, randomUUID(), { note: 'x' }), 404, 'NOT_FOUND')
  for (const [api, status, code] of [[mom.api, 403, 'NOT_ALLOWED'], [moderator, 403, 'NOT_ALLOWED'], [as(server.base), 401, 'NOT_SIGNED_IN']]) {
    refused(await api.form(`/tasks/${mine.id}/proofs`, { note: 'x' }), status, code)
  }

  const lateKid = await addChild(mom, 2) // two days on: past the due time
  const lateTask = await makeTask(mom, lateKid, { dueAt: dueIn(1) })
  assert.equal((await send(lateKid, lateTask.id, { note: 'sorry' })).body.proofs[0].late, true)
})

test('sendProof: the type comes from the bytes, the file has no extension, the name comes from the type, and a PDF or anything else that is not a photo or video is FILE_TYPE', async () => {
  const { mom, kid } = await household()
  const before = await kept()
  const fine = await makeTask(mom, kid)
  const res = await send(kid, fine.id, { note: '' }, file(webm(), 'VID_20261105_0712.png')) // a WebM called .png, with the camera's date in its name
  assert.equal(res.status, 201)
  const proof = res.body.proofs[0]
  assert.deepEqual([proof.fileType, proof.fileName, proof.fileSize, proof.note], ['video/webm', 'video.webm', webm().length, '']) // C3: not the device's name
  assert.deepEqual(await kept(), [...before, proof.id].sort()) // named by the proof's id alone
  assert.ok((await readFile(path.join(process.env.UPLOAD_DIR, proof.id))).equals(webm()))

  const plain = await makeTask(mom, kid)
  refused(await send(kid, plain.id, {}, file(pdf(), 'homework.pdf')), 415, 'FILE_TYPE') // C2: no PDF
  refused(await send(kid, plain.id, {}, file(text(), 'photo.png')), 415, 'FILE_TYPE') // a text file called .png
  refused(await send(kid, plain.id, {}, file(Buffer.alloc(0), 'empty.png')), 415, 'FILE_TYPE')
  const big = Buffer.concat([png(), Buffer.alloc(25 * 1024 * 1024 + 1 - png().length)])
  refused(await send(kid, plain.id, {}, file(big)), 413, 'FILE_TOO_LARGE')
  const justRight = Buffer.concat([webm(), Buffer.alloc(25 * 1024 * 1024 - webm().length)])
  const exact = await send(kid, plain.id, {}, file(justRight, 'my <odd> name.webm'))
  assert.equal(exact.status, 201)
  assert.deepEqual([exact.body.proofs[0].fileSize, exact.body.proofs[0].fileName], [25 * 1024 * 1024, 'video.webm'])
  for (const [bytes, name] of [[jpeg(), 'photo.jpg'], [png(), 'photo.png'], [webp(), 'photo.webp'], [mp4(), 'video.mp4'], [mp4(undefined, 'qt  '), 'video.mov']]) {
    const named = await send(kid, (await makeTask(mom, kid)).id, {}, file(bytes, 'IMG_20261105_071233.bin'))
    assert.equal(named.body.proofs[0].fileName, name)
  }

  // other multipart shapes are INVALID, not 500
  const more = await makeTask(mom, kid)
  invalid(await send(kid, more.id, { note: 'a', two: 'b', three: 'c' }), { proof: 'format' }) // more than two text fields
  invalid(await send(kid, more.id, {}, file(png(), 'x.png', 'photo')), { proof: 'format' }) // the wrong field name
  invalid(await send(kid, more.id, { note: '\u0000\u0000' }), { proof: 'required' }) // nothing is left of it
  for (const [body, type] of [['garbage', 'multipart/form-data; boundary=xx'], ['--xx\r\nContent-Disposition: form-data; name="note"\r\n\r\nhello', 'multipart/form-data; boundary=xx'], ['x', 'multipart/form-data']]) {
    invalid(await kid.api.post(`/tasks/${more.id}/proofs`, body, { 'content-type': type }), { proof: 'format' }) // a body that is no readable form: not a 500
  }
  // A5: a sound file in an MP4 wrapper, or a picture sequence, is not a video
  refused(await send(kid, more.id, {}, file(mp4([], 'M4A ', 'soun'), 'song.m4a')), 415, 'FILE_TYPE')
  refused(await send(kid, more.id, {}, file(mp4([], 'avis', 'pict'), 'burst.avif')), 415, 'FILE_TYPE')
  // a NUL in the note does not cost the child the rest of it, with a file attached or not
  const withFile = await send(kid, more.id, { note: 'x\u0000y' }, file(png()))
  assert.deepEqual([withFile.status, withFile.body.proofs[0].note], [201, 'xy'])
  const noteOnly = await makeTask(mom, kid)
  assert.equal((await send(kid, noteOnly.id, { note: 'a\u0000b' })).body.proofs[0].note, 'ab')
  assert.deepEqual((await kept()).length, before.length + 8) // only the eight accepted files
})

test('a refused upload writes no file: another child\'s task, a task in review or approved, the wrong type, too large, not the child', async () => {
  const { mom, kid } = await household()
  const stranger = await household()
  const before = await kept()
  const open = await makeTask(mom, kid)
  const waiting = await inReview(mom, kid)
  const done = await inReview(mom, kid)
  await approve(mom, done)
  const attempts = [
    [stranger.kid, open.id, 404], [kid, waiting.id, 409], [kid, done.id, 409], [kid, open.id, 415, text()], [kid, open.id, 413, Buffer.alloc(25 * 1024 * 1024 + 1)],
    [{ api: mom.api }, open.id, 403], [{ api: moderator }, open.id, 403], [{ api: as(server.base) }, open.id, 401],
  ]
  for (const [who, taskId, status, bytes = png()] of attempts) assert.equal((await send(who, taskId, {}, file(bytes))).status, status)
  assert.deepEqual(await kept(), before)
})

test('a proof sent while the task is deleted meanwhile leaves no file behind', async () => {
  const { mom, kid } = await household()
  const task = await makeTask(mom, kid)
  const before = await kept()
  let release
  let locked
  const gate = new Promise((resolve) => (release = resolve))
  const holding = new Promise((resolve) => (locked = resolve))
  const meanwhile = db.$transaction(async (tx) => {
    await lockChild(tx, kid.id)
    locked()
    await gate
    await tx.task.delete({ where: { id: task.id } })
  })
  await holding
  const sending = send(kid, task.id, {}, file(png())) // passes the checks, writes the file, then waits for the lock
  await sleep(500)
  assert.equal((await kept()).length, before.length + 1)
  release()
  await meanwhile
  refused(await sending, 404, 'NOT_FOUND')
  assert.deepEqual(await kept(), before)
})

// ------------------------------------------------------------------ serving the file

test('the proof file is for the task\'s child and that child\'s parent only; headers, Range and the 404s', async () => {
  const { mom, kid } = await household()
  const sibling = await addChild(mom)
  const clip = mp4([])
  const held = await inReview(mom, kid, {}, {}, file(clip, 'clip.mp4'))
  const proof = held.sent.proofs[0]
  const url = proof.fileUrl.replace('/api', '')
  assert.deepEqual([proof.fileType, proof.fileSize], ['video/mp4', clip.length])

  for (const api of [mom.api, kid.api]) {
    const res = await api.get(url)
    assert.equal(res.status, 200)
    assert.ok(res.body.equals(clip))
    assert.equal(res.headers.get('content-type'), 'video/mp4')
    assert.equal(res.headers.get('content-disposition'), 'inline')
    assert.equal(res.headers.get('cache-control'), 'private, no-store')
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(res.headers.get('accept-ranges'), 'bytes')
  }
  const part = await kid.api.get(url, { range: 'bytes=4-11' })
  assert.deepEqual([part.status, part.headers.get('content-range'), part.body.length], [206, `bytes 4-11/${clip.length}`, 8])
  assert.ok(part.body.equals(clip.subarray(4, 12)))
  const past = await kid.api.get(url, { range: `bytes=${clip.length + 10}-` })
  assert.deepEqual([past.status, past.headers.get('content-range')], [416, `bytes */${clip.length}`])

  const stranger = await household()
  refused(await as(server.base).get(url), 401, 'NOT_SIGNED_IN')
  refused(await moderator.get(url), 403, 'NOT_ALLOWED')
  for (const api of [stranger.mom.api, stranger.kid.api, sibling.api]) refused(await api.get(url), 404, 'NOT_FOUND')
  refused(await mom.api.get(`/proofs/${randomUUID()}/file`), 404, 'NOT_FOUND')
  const noFile = await inReview(mom, kid)
  refused(await mom.api.get(`/proofs/${noFile.proofId}/file`), 404, 'NOT_FOUND') // a note-only proof has none
  await mom.api.del(`/tasks/${held.id}`)
  refused(await mom.api.get(url), 404, 'NOT_FOUND')
})

// ------------------------------------------------------------------ review

test('review: approve and send back, once; the answer carries the file address and the review as index.js documents it', async () => {
  const { mom, kid } = await household({ name: 'Meera' })
  const held = await inReview(mom, kid, { points: 30 }, { note: 'pic' }, file(png()))
  assert.equal((await kid.api.get('/counts')).body.results, 0)

  invalid(await answer(mom, held, { result: 'maybe' }), { result: 'required' })
  invalid(await answer(mom, held, {}), { result: 'required' })
  invalid(await answer(mom, held, { result: 'sentBack', note: '  ' }), { note: 'required' })
  invalid(await answer(mom, held, { result: 'sentBack', note: 'x'.repeat(301) }), { note: 'length' })
  invalid(await approve(mom, held, { kind: 'loud' }), { cheer: 'kind' })
  invalid(await approve(mom, held, { kind: 'proud', line: 'x'.repeat(121) }), { line: 'length' })
  invalid(await approve(mom, held, { line: 5 }), { line: 'length' })
  assert.equal((await mom.api.get(`/tasks/${held.id}`)).body.status, 'review') // none of those changed anything

  const back = await sendBack(mom, held, '  Show the whole room  ')
  assert.equal(back.status, 200)
  assert.deepEqual([back.body.status, back.body.resultSeen], ['sentBack', false])
  const { at, ...review } = back.body.proofs[0].review
  assert.deepEqual(review, { result: 'sentBack', note: 'Show the whole room', by: 'Meera' })
  assert.ok(Math.abs(Date.parse(at) - Date.now()) < 10_000)
  assert.equal(back.body.proofs[0].fileUrl, `/api/proofs/${held.proofId}/file`)
  refused(await sendBack(mom, held, 'again'), 409, 'REVIEWED')
  refused(await approve(mom, held), 409, 'REVIEWED')
  assert.equal((await kid.api.get('/counts')).body.results, 1)

  const resent = await send(kid, held.id, { note: 'better' }) // A9: the earlier result counts as seen
  assert.deepEqual([resent.body.status, resent.body.resultSeen, resent.body.proofs.length], ['review', true, 2])
  assert.equal((await kid.api.get('/counts')).body.results, 0)
  refused(await approve(mom, held), 409, 'REVIEWED') // the first proof is no longer the newest
  const newest = { id: held.id, proofId: resent.body.proofs[1].id }
  const ok = await approve(mom, newest)
  assert.equal(ok.status, 200)
  assert.deepEqual([ok.body.status, ok.body.resultSeen, ok.body.proofs[1].review.result, ok.body.proofs[1].review.note], ['approved', false, 'approved', ''])
  assert.equal('cheer' in ok.body.proofs[1].review, false)
  refused(await approve(mom, newest), 409, 'REVIEWED')
  refused(await sendBack(mom, newest, 'late'), 409, 'REVIEWED')
})

test('review: who may, the order of the checks, and a task with no proof', async () => {
  const { mom, kid } = await household()
  const stranger = await household()
  const held = await inReview(mom, kid)
  const body = { proofId: held.proofId, result: 'approved' }
  refused(await stranger.mom.api.post(`/tasks/${held.id}/review`, body), 404, 'NOT_FOUND')
  refused(await mom.api.post(`/tasks/${randomUUID()}/review`, { result: 'x' }), 404, 'NOT_FOUND') // not found before invalid
  for (const [api, status, code] of [[kid.api, 403, 'NOT_ALLOWED'], [moderator, 403, 'NOT_ALLOWED'], [as(server.base), 401, 'NOT_SIGNED_IN']]) {
    refused(await api.post(`/tasks/${held.id}/review`, body), status, code)
  }
  const fresh = await makeTask(mom, kid)
  refused(await mom.api.post(`/tasks/${fresh.id}/review`, { proofId: 'x', result: 'approved' }), 409, 'REVIEWED')
  refused(await mom.api.post(`/tasks/${held.id}/review`, { proofId: 5, result: 'approved' }), 409, 'REVIEWED')
  assert.equal((await mom.api.get(`/tasks/${held.id}`)).body.status, 'review')
})

test('review: a cheer is stored only when it has a kind or a line, and only with an approval', async () => {
  const { mom, kid } = await household()
  const cheerOf = async (cheer, send_ = false) => {
    const held = await inReview(mom, kid)
    const res = send_ ? await sendBack(mom, held, 'Redo') : await approve(mom, held, cheer)
    assert.equal(res.status, 200)
    return res.body.proofs[0].review.cheer
  }
  assert.deepEqual(await cheerOf({ kind: 'proud', line: '  Well done!  ' }), { kind: 'proud', line: 'Well done!' })
  assert.deepEqual(await cheerOf({ kind: 'kind' }), { kind: 'kind', line: '' })
  assert.deepEqual(await cheerOf({ line: 'Great' }), { kind: null, line: 'Great' })
  assert.equal(await cheerOf({ kind: null, line: '   ' }), undefined)
  assert.equal(await cheerOf({}), undefined)
  assert.equal(await cheerOf(undefined), undefined)
  assert.equal(await cheerOf('proud'), undefined)
  assert.equal(await cheerOf({ kind: 'proud', line: 'ignored' }, true), undefined) // sending back stores none
})

test('approving twice at once gives one 200 and one REVIEWED, and the points and stickers are given once', async () => {
  const { mom, kid } = await household()
  const held = await inReview(mom, kid)
  const both = await Promise.all([approve(mom, held), approve(mom, held)])
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 409])
  assert.deepEqual(both.find((r) => r.status === 409).body, { code: 'REVIEWED' })
  assert.deepEqual((await db.award.findMany({ where: { childId: kid.id } })).map((a) => a.stickerId), ['first-task'])
  const mixed = await inReview(mom, kid)
  const answers = await Promise.all([approve(mom, mixed), sendBack(mom, mixed, 'no')])
  assert.deepEqual(answers.map((r) => r.status).sort(), [200, 409])
})

test('the first approval records the first-task sticker with the approval\'s own time, and a later one does not move it', async () => {
  const { mom, kid } = await household()
  const first = await inReview(mom, kid, { title: 'First of all' })
  const res = await approve(mom, first)
  const at = res.body.proofs[0].review.at
  const row = async () => db.award.findUnique({ where: { childId_stickerId: { childId: kid.id, stickerId: 'first-task' } } })
  const award = await row()
  assert.deepEqual([award.earnedAt.toISOString(), award.taskId, award.taskTitle], [at, first.id, 'First of all'])
  await sleep(20)
  await approve(mom, await inReview(mom, kid, { title: 'Second' }))
  assert.equal((await row()).earnedAt.toISOString(), at)
  assert.equal(await db.award.count({ where: { childId: kid.id } }), 1)
  const sent = await inReview(mom, kid)
  await sendBack(mom, sent, 'redo')
  assert.equal(await db.award.count({ where: { childId: kid.id } }), 1) // sending back earns nothing
})

test('an approval that reaches the quest target completes the quest for the week the proof was sent in, and the quest sticker comes with it', async () => {
  const { mom, kid } = await household({ country: 'IN' })
  await db.quest.create({ data: { childId: kid.id, target: 2, bonus: 40, surprise: 'Ice cream', setAt: new Date() } })
  const one = await inReview(mom, kid)
  await approve(mom, one)
  assert.equal(await db.questAward.count({ where: { childId: kid.id } }), 0)
  const two = await inReview(mom, kid)
  const res = await approve(mom, two)
  const week = weekKey(res.body.proofs[0].sentAt, 'Asia/Kolkata')
  const award = await db.questAward.findUniqueOrThrow({ where: { childId_week: { childId: kid.id, week } } })
  assert.deepEqual([award.target, award.bonus, award.surprise, award.taskId, award.earnedAt.toISOString()], [2, 40, 'Ice cream', two.id, res.body.proofs[0].review.at])
  assert.equal((await db.quest.findUniqueOrThrow({ where: { childId: kid.id } })).surprise, null) // opened now
  assert.deepEqual((await db.award.findMany({ where: { childId: kid.id } })).map((a) => a.stickerId).sort(), ['first-task', 'quest-1'])
  const quest = await db.award.findUniqueOrThrow({ where: { childId_stickerId: { childId: kid.id, stickerId: 'quest-1' } } })
  assert.equal(quest.taskId, two.id) // earned by this same approval
  await approve(mom, await inReview(mom, kid)) // the week is completed once
  assert.equal(await db.questAward.count({ where: { childId: kid.id } }), 1)
})

// ------------------------------------------------------------------ results seen, pin, counts

test('markResultsSeen: the child\'s own listed tasks only; countNewResults and countProofsWaiting', async () => {
  const { mom, kid } = await household()
  const sibling = await addChild(mom)
  const a = await inReview(mom, kid)
  const b = await inReview(mom, kid)
  const c = await inReview(mom, sibling)
  assert.equal((await mom.api.get('/counts')).body.proofs, 3)
  for (const held of [a, b, c]) await approve(mom, held)
  assert.equal((await mom.api.get('/counts')).body.proofs, 0)
  assert.deepEqual([(await kid.api.get('/counts')).body.results, (await sibling.api.get('/counts')).body.results], [2, 1])

  const done = await kid.api.post('/tasks/seen', { taskIds: [a.id, c.id, randomUUID()] }) // c is the sibling's: not touched
  assert.equal(done.status, 204)
  assert.deepEqual([(await kid.api.get('/counts')).body.results, (await sibling.api.get('/counts')).body.results], [1, 1])
  assert.equal((await kid.api.get(`/tasks/${a.id}`)).body.resultSeen, true)
  assert.equal((await kid.api.get(`/tasks/${b.id}`)).body.resultSeen, false)
  assert.equal((await kid.api.post('/tasks/seen', { taskIds: [] })).status, 204)

  for (const taskIds of ['x', 5, null, [1], [null], [{}], Array.from({ length: 201 }, () => 'a')]) invalid(await kid.api.post('/tasks/seen', { taskIds }), { taskIds: 'format' })
  invalid(await kid.api.post('/tasks/seen'), { taskIds: 'format' })
  refused(await mom.api.post('/tasks/seen', { taskIds: [] }), 403, 'NOT_ALLOWED')
  refused(await as(server.base).post('/tasks/seen', { taskIds: [] }), 401, 'NOT_SIGNED_IN')
  assert.deepEqual((await mom.api.get('/counts')).body, { proofs: 0, requests: 0 }) // P3: a parent's shape
  assert.deepEqual(Object.keys((await kid.api.get('/counts')).body), ['results', 'answers']) // and a child's (K2: answers too)
  refused(await moderator.get('/counts'), 403, 'NOT_ALLOWED')
  refused(await as(server.base).get('/counts'), 401, 'NOT_SIGNED_IN')
  for (const old of ['/counts/proofs', '/counts/results', '/counts/requests']) refused(await mom.api.get(old), 404, 'NOT_FOUND') // gone
})

test('pinTask: one open task at a time, null clears it; sending proof and deleting the task end it', async () => {
  const { mom, kid } = await household()
  const [a, b, c] = [await makeTask(mom, kid), await makeTask(mom, kid), await makeTask(mom, kid)]
  const pinnedIn = (res) => res.body.filter((t) => t.pinned).map((t) => t.id)
  const first = await kid.api.put('/pin', { taskId: a.id })
  assert.equal(first.status, 200)
  assert.deepEqual(first.body.map((t) => t.id).sort(), [a.id, b.id, c.id].sort())
  assert.deepEqual(pinnedIn(first), [a.id])
  assert.deepEqual(pinnedIn(await kid.api.put('/pin', { taskId: b.id })), [b.id]) // replaces
  assert.equal((await mom.api.get('/tasks')).body.find((t) => t.id === b.id).pinned, true)
  assert.deepEqual(pinnedIn(await kid.api.put('/pin', { taskId: null })), [])

  await kid.api.put('/pin', { taskId: a.id })
  await send(kid, a.id, { note: 'x' }) // proof sent: the pin ends
  assert.deepEqual(pinnedIn(await kid.api.get('/tasks')), [])
  refused(await kid.api.put('/pin', { taskId: a.id }), 409, 'LOCKED') // in review
  await kid.api.put('/pin', { taskId: c.id })
  await mom.api.del(`/tasks/${c.id}`)
  assert.deepEqual(pinnedIn(await kid.api.get('/tasks')), [])
  await sendBack(mom, { id: a.id, proofId: (await mom.api.get(`/tasks/${a.id}`)).body.proofs[0].id }, 'again')
  assert.deepEqual(pinnedIn(await kid.api.put('/pin', { taskId: a.id })), [a.id]) // sent back is open again

  const stranger = await household()
  refused(await stranger.kid.api.put('/pin', { taskId: b.id }), 404, 'NOT_FOUND')
  refused(await kid.api.put('/pin', { taskId: randomUUID() }), 404, 'NOT_FOUND')
  refused(await kid.api.put('/pin', { taskId: 5 }), 404, 'NOT_FOUND')
  refused(await kid.api.put('/pin'), 404, 'NOT_FOUND')
  assert.deepEqual(pinnedIn(await kid.api.get('/tasks')), [a.id]) // the refusals changed nothing
  refused(await mom.api.put('/pin', { taskId: b.id }), 403, 'NOT_ALLOWED')
  refused(await moderator.put('/pin', { taskId: b.id }), 403, 'NOT_ALLOWED')
  refused(await as(server.base).put('/pin', { taskId: b.id }), 401, 'NOT_SIGNED_IN')
})

test('pinTask: a task the parent moves to a sibling meanwhile is not pinned for the sibling, and the unpinning is undone', async () => {
  const { mom, kid } = await household()
  const sibling = await addChild(mom)
  const [moving, staying] = [await makeTask(mom, kid), await makeTask(mom, kid)]
  await kid.api.put('/pin', { taskId: staying.id })
  let release
  let locked
  const gate = new Promise((resolve) => (release = resolve))
  const holding = new Promise((resolve) => (locked = resolve))
  const moving_ = db.$transaction(async (tx) => {
    await tx.task.update({ where: { id: moving.id }, data: { childId: sibling.id } }) // the parent's edit, not yet committed
    locked()
    await gate
  })
  await holding
  const pinning = kid.api.put('/pin', { taskId: moving.id }) // finds the task still the kid's, then waits for the edit
  await sleep(500)
  release()
  await moving_
  refused(await pinning, 404, 'NOT_FOUND')
  const pinned = async (api) => (await api.get('/tasks')).body.filter((t) => t.pinned).map((t) => t.id)
  assert.deepEqual(await pinned(sibling.api), []) // never pinned for the sibling
  assert.deepEqual(await pinned(kid.api), [staying.id]) // and the kid's own pin was not lost
})

// ------------------------------------------------------------------ A6: no location is stored

/** Sends this file as proof and returns the bytes that were stored. */
async function storedFrom(mom, kid, bytes, name) {
  const task = await makeTask(mom, kid)
  const res = await send(kid, task.id, {}, file(bytes, name))
  assert.equal(res.status, 201)
  const proof = res.body.proofs[0]
  const onDisk = await readFile(path.join(process.env.UPLOAD_DIR, proof.id))
  assert.equal(proof.fileSize, onDisk.length) // the stored length, not the sent one
  return onDisk
}

test('T7: an uploaded video with a GPS track is stored without the route', async () => {
  const { mom, kid } = await household()
  const original = withRoute()
  assert.equal(original.includes(SECRET), true)
  const stored = await storedFrom(mom, kid, original, 'GOPR0001.MP4')
  assert.deepEqual([stored.includes(SECRET), stored.includes('frames'), stored.length], [false, true, original.length])
})

test('A6: a JPEG is stored with no GPS and with its rotation; an MP4 with free for udta at the same size; a PNG without eXIf', async () => {
  const { mom, kid } = await household()
  const photo = await storedFrom(mom, kid, jpeg(6), 'IMG_0001.JPG')
  assert.equal(photo.includes(SECRET), false)
  assert.equal(photo.includes(Buffer.from([0x25, 0x88])), false) // the GPS tag
  const at = photo.indexOf('Exif\0\0') + 6
  assert.deepEqual([photo.readUInt16LE(at + 8), photo.readUInt16LE(at + 10), photo.readUInt16LE(at + 18)], [1, 0x0112, 6]) // one tag: orientation 6
  assert.equal(photo.includes('SCANDATA'), true)

  const video = mp4()
  const movie = await storedFrom(mom, kid, video, 'VID_0001.MP4')
  assert.equal(movie.length, video.length)
  const udta = video.indexOf('udta')
  assert.equal(movie.toString('latin1', udta, udta + 4), 'free')
  assert.equal(movie.includes(SECRET), false)
  assert.equal(movie.includes('udta'), false)

  // a second picture appended after the first one's EOI, with a GPS block of its own, and a video after a photo
  const doubled = await storedFrom(mom, kid, Buffer.concat([jpeg(1), jpeg(6)]), 'IMG_0002.JPG')
  assert.deepEqual([doubled.includes(SECRET), doubled.includes(Buffer.from([0x25, 0x88])), doubled.includes('Exif')], [false, false, false])
  assert.ok(doubled.includes('SCANDATA') && doubled.indexOf('SCANDATA') === doubled.lastIndexOf('SCANDATA')) // the one picture, once
  assert.equal(doubled.indexOf(Buffer.from([0xff, 0xd9])), doubled.length - 2) // it ends at the first EOI
  assert.equal((await storedFrom(mom, kid, Buffer.concat([jpeg(6), mp4()]), 'MVIMG_0003.JPG')).includes(SECRET), false)

  // udta, meta and uuid boxes at the top of an MP4 are blanked like the ones in moov
  const loose = Buffer.concat([mp4([]), location(), box('uuid', Buffer.from(`0123456789abcdef${SECRET}`))])
  const clip = await storedFrom(mom, kid, loose, 'VID_0002.MP4')
  assert.deepEqual([clip.length, clip.includes(SECRET), clip.includes('udta'), clip.includes('uuid')], [loose.length, false, false, false])

  const picture = await storedFrom(mom, kid, png(chunk('eXIf', Buffer.from(SECRET))), 'a.png')
  assert.equal(picture.includes('eXIf'), false)
  assert.equal(picture.includes(SECRET), false)
  assert.ok(picture.equals(png()))

  // C3: PNG's tIME goes; inside each track the udta and meta boxes are blanked; mvhd, tkhd and mdhd lose their times, in both versions
  const dated = await storedFrom(mom, kid, png(chunk('tIME', Buffer.from('07ea0b0f0c0000', 'hex'))), 'b.png')
  assert.ok(dated.equals(png()))
  const stamp = Buffer.from('dd2a7c00dd2a7c01', 'hex') // two 32-bit times
  const wide = Buffer.from('00000000dd2a7c0000000000dd2a7c01', 'hex') // two 64-bit times
  const head = (version, times, rest = 80) => Buffer.concat([Buffer.from([version, 0, 0, 0]), times, Buffer.alloc(rest)])
  const trak = box('trak', box('tkhd', head(1, wide)), box('mdia', box('mdhd', head(0, stamp, 12)), box('hdlr', Buffer.alloc(8), Buffer.from('vide'), Buffer.alloc(12))), box('udta', Buffer.from(SECRET)), box('meta', Buffer.from(SECRET)))
  const filmed = Buffer.concat([box('ftyp', Buffer.from('isom'), Buffer.alloc(4), Buffer.from('isom')), box('moov', box('mvhd', head(0, stamp)), trak), box('mdat', Buffer.from('frames'))])
  const quiet = await storedFrom(mom, kid, filmed, 'VID_0003.MP4')
  assert.deepEqual([quiet.length, quiet.includes(SECRET), quiet.includes('udta'), quiet.includes('meta')], [filmed.length, false, false, false])
  // every creation time (dd2a7c00) and modification time (dd2a7c01) is gone, in version 0 and version 1 alike; the frames are kept
  assert.deepEqual([quiet.includes(Buffer.from('dd2a7c00', 'hex')), quiet.includes(Buffer.from('dd2a7c01', 'hex')), quiet.includes('frames')], [false, false, true])
})

test('A6: a JPEG whose segment length runs past its end is FILE_TYPE and no file is written', async () => {
  const { mom, kid } = await household()
  const before = await kept()
  const task = await makeTask(mom, kid)
  refused(await send(kid, task.id, {}, file(brokenJpeg(), 'broken.jpg')), 415, 'FILE_TYPE')
  refused(await send(kid, task.id, {}, file(mp4([]).subarray(0, 30), 'cut.mp4')), 415, 'FILE_TYPE')
  assert.deepEqual(await kept(), before)
  assert.equal((await mom.api.get(`/tasks/${task.id}`)).body.status, 'todo') // the task still takes proof
})

// ------------------------------------------------------------------ the end

// ------------------------------------------------------------------ limits and caps (rule 27, L6 to L9)

const quota = (res, which) => assert.deepEqual([res.status, res.body], [409, { code: 'QUOTA', fields: { quota: which } }])

test("updateTask refuses another family's child as NOT_FOUND, and the task stays with its own child", async () => {
  const { mom, kid } = await household()
  const other = await household()
  const task = await makeTask(mom, kid)
  refused(await mom.api.put(`/tasks/${task.id}`, taskBody(other.kid, { title: 'Words from a stranger' })), 404, 'NOT_FOUND')
  const now = (await mom.api.get(`/tasks/${task.id}`)).body
  assert.deepEqual([now.childId, now.title], [kid.id, task.title])
  assert.deepEqual((await other.kid.api.get('/tasks')).body, []) // nothing reached the other family's child
})

test('a child holds at most 300 tasks that are not approved: one more is QUOTA, made new or moved from a sibling; approved ones do not count (L6)', async () => {
  const { mom, kid } = await household()
  const sibling = await addChild(mom)
  const row = (status) => ({ childId: kid.id, category: 'chores', title: 'Filler', instructions: 'x', dueAt: new Date(Date.now() + DAY), points: 5, status, createdAt: new Date() })
  await db.task.createMany({ data: [...Array.from({ length: 299 }, () => row('todo')), row('approved')] })
  const last = await makeTask(mom, kid) // the 300th that is not approved
  quota(await mom.api.post('/tasks', taskBody(kid)), 'tasks')
  invalid(await mom.api.post('/tasks', taskBody(kid, { points: 3 })), { points: 'range' }) // a wrong field is still said first
  const theirs = await makeTask(mom, sibling)
  quota(await mom.api.put(`/tasks/${theirs.id}`, taskBody(kid)), 'tasks')
  assert.equal((await mom.api.get(`/tasks/${theirs.id}`)).body.childId, sibling.id)
  assert.equal((await mom.api.put(`/tasks/${last.id}`, taskBody(kid, { title: 'Edited in place' }))).status, 200) // an edit that moves nothing
  assert.equal((await mom.api.del(`/tasks/${last.id}`)).status, 204)
  assert.equal((await mom.api.post('/tasks', taskBody(kid))).status, 201) // room again
})

test('a family holds at most 2 GiB of proof files: a file past it is QUOTA and writes nothing; a note alone is still taken (L6)', async () => {
  const { mom, kid } = await household()
  const neighbour = await household()
  const [first, second, third, held] = await Promise.all([1, 2, 3, 4].map(() => makeTask(mom, kid)))
  // a row that says the family holds all but 100 bytes of its 2 GiB: only the size is counted, so there is no file behind it
  await db.proof.create({ data: { id: randomUUID(), taskId: held.id, fileType: 'video/mp4', fileSize: 2 * 1024 ** 3 - 100, sentAt: new Date(), late: false } })
  const picture = png()
  assert.ok(picture.length < 100 && picture.length * 2 > 100) // one more fits, two do not
  assert.equal((await send(kid, first.id, {}, file(picture))).status, 201)
  const before = await kept()
  quota(await send(kid, second.id, {}, file(picture)), 'storage') // the sum is past what a 32-bit number holds, and is still added up
  assert.deepEqual(await kept(), before)
  assert.equal((await mom.api.get(`/tasks/${second.id}`)).body.status, 'todo')
  assert.equal((await send(kid, third.id, { note: 'No picture this time.' })).status, 201)
  const theirs = await makeTask(neighbour.mom, neighbour.kid)
  assert.equal((await send(neighbour.kid, theirs.id, {}, file(picture))).status, 201) // another family has its own 2 GiB
})

test('hasRoom: a floor no drive can meet is not met, and no floor at all is (L9)', async () => {
  assert.equal(await hasRoom(process.env.UPLOAD_DIR, 1, Number.MAX_SAFE_INTEGER), false)
  assert.equal(await hasRoom(process.env.UPLOAD_DIR, 1, 0), true)
})

test('a proof file is QUOTA with disk, and nothing is written, when the drive would be left with too little room (L9)', async (t) => {
  const { mom, kid } = await household()
  const task = await makeTask(mom, kid)
  const before = await kept()
  mock.method(fsPromises, 'statfs', async () => ({ bavail: 10, bsize: 4096 })) // a drive with 40 kB left
  syncBuiltinESMExports() // files.js imported statfs by name
  t.after(() => {
    mock.restoreAll()
    syncBuiltinESMExports()
  })
  quota(await send(kid, task.id, {}, file(png())), 'disk')
  assert.deepEqual(await kept(), before)
  assert.equal((await mom.api.get(`/tasks/${task.id}`)).body.status, 'todo')
  assert.equal((await send(kid, task.id, { note: 'A note needs no room.' })).status, 201)
})

test('a child can send 30 proofs an hour: the 31st is TOO_MANY and says how long to wait (L7)', async () => {
  const { kid } = await household()
  for (let i = 0; i < 30; i++) refused(await send(kid, randomUUID(), { note: 'x' }), 404, 'NOT_FOUND') // refused ones count too
  const paused = await send(kid, randomUUID(), { note: 'x' })
  assert.deepEqual([paused.status, paused.body], [429, { code: 'TOO_MANY', fields: { minutes: 60 } }])
})

/** Starts sending a proof file and stops part-way, holding the request open, as a slow upload does. Destroy it to end it. */
function slowUpload(kid, taskId) {
  const headers = { 'x-growkid': '1', 'x-clock-days': '0', cookie: kid.api.cookie(), 'content-type': 'multipart/form-data; boundary=x' }
  const req = http.request(`${server.base}/tasks/${taskId}/proofs`, { method: 'POST', headers })
  req.on('error', () => {}) // ended on purpose
  req.write('--x\r\ncontent-disposition: form-data; name="file"; filename="p.png"\r\n\r\n')
  return req
}

test('the server receives at most 4 proof files at once and 1 per child; a slot comes back when the upload ends, however it ends (L8)', async () => {
  const mom = await family(server.base)
  made.push(mom)
  const kids = []
  for (let i = 0; i < 5; i++) kids.push(await addChild(mom))
  const tasks = await Promise.all(kids.map((kid) => makeTask(mom, kid)))
  const spare = await makeTask(mom, kids[0])
  const open = kids.slice(0, 4).map((kid, i) => slowUpload(kid, tasks[i].id))
  // wait until the server has let all four in: a fixed pause was too short on a slow CI runner
  for (let i = 0; i < 200 && uploadsInFlight() < 4; i++) await sleep(50)
  assert.equal(uploadsInFlight(), 4)
  const busy = async (kid, task) => {
    const res = await send(kid, task.id, { note: 'Done!' })
    if (res.status === 429) assert.deepEqual(res.body, { code: 'TOO_MANY' }) // no minutes: it can be sent again straight away
    return res.status
  }
  assert.equal(await busy(kids[0], spare), 429) // this child is already sending one
  assert.equal(await busy(kids[4], tasks[4]), 429) // and all four slots are taken
  open[3].destroy() // the upload is cut off
  let status = 429
  for (let i = 0; i < 100 && status === 429; i++) {
    await sleep(100)
    status = await busy(kids[4], tasks[4])
  }
  assert.equal(status, 201) // the fifth child gets the slot that came back
  open.slice(0, 3).forEach((req) => req.destroy())
  status = 429
  for (let i = 0; i < 100 && status === 429; i++) {
    await sleep(100)
    status = await busy(kids[0], spare)
  }
  assert.equal(status, 201)
  assert.equal((await mom.api.get(`/tasks/${tasks[3].id}`)).body.status, 'todo') // the cut-off upload left nothing
})

test('an upload whose caller leaves at once takes no slot: the child can still send proof afterwards (L8)', async () => {
  const { mom, kid } = await household()
  const task = await makeTask(mom, kid)
  for (let round = 0; round < 8; round++) {
    const req = slowUpload(kid, task.id)
    await sleep(round) // gone before, while and just after the task is looked up
    req.destroy()
  }
  await sleep(300)
  assert.equal((await send(kid, task.id, { note: 'Still here.' })).status, 201)
})

test('an approval for a child with 2,000 approved tasks takes under a second, and records exactly the stickers a replay of every approval finds', async () => {
  const { mom, kid } = await household()
  const kinds = ['chores', 'study', 'reading', 'creative', 'outdoors', 'health']
  const old = Array.from({ length: 2000 }, (_, i) => ({ id: randomUUID(), at: new Date(Date.now() - (2 + (i % 500)) * DAY - i * 1000), category: kinds[i % 6] }))
  await db.task.createMany({
    data: old.map(({ id, at, category }) => ({ id, childId: kid.id, category, title: 'Old task', instructions: 'x', dueAt: at, points: 5, status: 'approved', createdAt: at })),
  })
  await db.proof.createMany({
    data: old.map(({ id, at }) => ({ id: randomUUID(), taskId: id, sentAt: at, late: false, result: 'approved', reviewBy: 'Test Parent', reviewedAt: at })),
  })
  const held = await inReview(mom, kid, { title: 'One more' })
  const began = performance.now()
  const res = await approve(mom, held)
  const took = performance.now() - began
  assert.equal(res.status, 200)
  // The goal is under a second on the project's own machine. A shared CI runner is several times slower, so it gets 3 s there:
  // still far below the old replay of every approval (13.8 s here), which is the regression this test exists to catch.
  const budget = process.env.CI ? 3000 : 1000
  assert.ok(took < budget, `the approval took ${Math.round(took)} ms`)
  const awards = await db.award.findMany({ where: { childId: kid.id } })
  assert.ok(awards.every((award) => award.taskId === held.id && award.taskTitle === 'One more')) // none was held before, so each came with this approval
  const { tasks: all } = await loadChild(db, kid.id) // every task: the list route holds only the window (P2)
  assert.equal(all.length, 2001)
  const replayed = stickers(all, { zone: 'Asia/Kolkata' }).filter((sticker) => sticker.earnedAt).map((sticker) => sticker.id)
  assert.deepEqual(awards.map((award) => award.stickerId).sort(), replayed.sort())
  assert.ok(replayed.includes('tasks-50') && replayed.includes('level-10') && replayed.includes('all-kinds'))
})

test('every family these tests made is erased with its files, and the upload folder ends empty', async () => {
  await Promise.all(made.map(erase))
  assert.deepEqual(await kept(), [])
})
