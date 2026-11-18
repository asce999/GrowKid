import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'
import { only, ownChild, proofLimit, signedIn } from '../auth.js'
import { now } from '../clock.js'
import { db, loadChild, lockChild, taskWith } from '../db.js'
import { ApiError, invalid, refuse, text } from '../errors.js'
import { NAMES, hasRoom, removeFiles, saveFile, sendProofFile, sniff, strip } from '../files.js'
import { CHEER_KINDS, FREE_BYTES, MAX_FILE_BYTES, OPEN, STORAGE_BYTES, cap, checkTask, screen } from '../rules.js'
import { questCompletedBy, reached } from '../scoring.js'
import { asTask } from '../shape.js'
import { childrenOf, makeDueTasks } from './series.js'

/** Tasks, proof, review and files (plan B2). Ported from the stand-in removed in B4. */
export const tasks = Router()

/** Which tasks this user may see: a parent's whole family, or a child's own. A moderator sees none. */
export function visible(req) {
  const me = signedIn(req)
  if (me.role === 'child') return { childId: me.id }
  if (me.role !== 'parent') refuse('NOT_ALLOWED')
  return { child: { parentId: me.id } }
}

/** A whole number from a query string, or the fallback. */
export const number = (value, fallback) => (/^\d{1,6}$/.test(value ?? '') ? Number(value) : fallback)

/** One task this user may see, with its proofs, or NOT_FOUND. */
const visibleTask = async (req, id) =>
  (await db.task.findFirst({ where: { id: text(id), ...visible(req) }, include: taskWith })) ?? refuse('NOT_FOUND')

const DAY = 86_400_000
/** P2: how long an approved task stays in the task list after its approval. */
const WINDOW_DAYS = 30
const soonestFirst = [{ dueAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]

/**
 * P2, the task list's window, as a query: not approved yet, or a result the child has not seen, or approved in the last 30 days.
 * inWindow below is the same rule over a task already loaded; a test holds the two together.
 */
const windowWhere = (time) => ({
  OR: [{ status: { not: 'approved' } }, { resultSeen: false }, { proofs: { some: { result: 'approved', reviewedAt: { gte: new Date(+time - WINDOW_DAYS * DAY) } } } }],
})
/** P2 over a task as asTask gives it. */
export const inWindow = (task, time) =>
  task.status !== 'approved' || !task.resultSeen || task.proofs.some((p) => p.review?.result === 'approved' && new Date(p.review.at) >= +time - WINDOW_DAYS * DAY)
/** The order the task list is in, soonest due first, for tasks already loaded. */
export const bySoonest = (a, b) => a.dueAt.localeCompare(b.dueAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)

/** The tasks this user may see in the window (P2), soonest due first, as listTasks gives them (proofs without fileUrl). */
async function list(req) {
  const rows = await db.task.findMany({ where: { AND: [visible(req), windowWhere(now())] }, include: taskWith, orderBy: soonestFirst })
  return rows.map((row) => asTask(row))
}

/** L6: how many of a child's tasks are not approved yet, which is what the task cap counts. */
const unapproved = (childId) => db.task.count({ where: { childId, status: { not: 'approved' } } })

/** Why a conditional write on a task matched nothing: the task is gone, or no longer the sender's (NOT_FOUND); or no longer in the status the write needed (LOCKED). */
const whyNot = async (client, where) => ((await client.task.count({ where })) ? 'LOCKED' : 'NOT_FOUND')

// ------------------------------------------------------------------ tasks

/** listTasks (P2): the window, not the whole history. H2: today's tasks from repeating series are made first. */
tasks.get('/tasks', async (req, res) => {
  visible(req) // the role check, before anything is made
  await makeDueTasks(await childrenOf(req))
  res.json(await list(req))
})

/** listHistory (P2, P8): approved tasks this user may see, newest due first, `limit` (1 to 50, default 50) from `offset`. Before /tasks/:id, which would take "history" for an id. */
tasks.get('/tasks/history', async (req, res) => {
  const where = { AND: [visible(req), { status: 'approved' }] }
  const offset = number(req.query.offset, 0)
  const limit = Math.min(50, Math.max(1, number(req.query.limit, 50)))
  const rows = await db.task.findMany({ where, include: taskWith, orderBy: [{ dueAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: limit })
  res.json(rows.map((row) => asTask(row)))
})

/** getTask: with fileUrl on its proofs. */
tasks.get('/tasks/:id', async (req, res) => {
  res.json(asTask(await visibleTask(req, req.params.id), { files: true }))
})

/** createTask: the child must be the parent's own (NOT_FOUND), then INVALID, then SCREENED. */
tasks.post('/tasks', async (req, res) => {
  const body = req.body ?? {}
  const child = await ownChild(req, text(body.childId))
  const values = checkTask(body)
  cap('tasks', await unapproved(child.id))
  const row = await db.task.create({ data: { ...values, childId: child.id, createdAt: now() }, include: taskWith })
  res.status(201).json(asTask(row))
})

/** updateTask: rule 2, editable until the first proof is sent. A task given to another child loses its pin. */
tasks.put('/tasks/:id', async (req, res) => {
  only(req, 'parent')
  const task = await visibleTask(req, req.params.id)
  if (task.status !== 'todo') refuse('LOCKED') // todo is the only status without a proof
  const body = req.body ?? {}
  const child = await ownChild(req, text(body.childId))
  const values = checkTask(body, task.dueAt)
  if (child.id !== task.childId) cap('tasks', await unapproved(child.id)) // L6: a moved task counts against the child it goes to
  // Conditional, so a proof sent while this request was checking still wins.
  const { count } = await db.task.updateMany({
    where: { id: task.id, status: 'todo' },
    data: { ...values, childId: child.id, ...(child.id !== task.childId && { pinned: false }) },
  })
  if (count === 0) refuse(await whyNot(db, { id: task.id }))
  res.json(asTask(await visibleTask(req, task.id)))
})

/** deleteTask: rule 2, deletable until it is approved. The proof files go after the rows have. */
tasks.delete('/tasks/:id', async (req, res) => {
  only(req, 'parent')
  const task = await visibleTask(req, req.params.id)
  const files = await db.$transaction(async (tx) => {
    // sendProof updates this row to take a proof, so one sent meanwhile is in the list below, or finds the task gone
    await tx.$queryRaw`SELECT 1 FROM "Task" WHERE id = ${task.id} FOR UPDATE`
    const proofs = await tx.proof.findMany({ where: { taskId: task.id, fileType: { not: null } }, select: { id: true } })
    const { count } = await tx.task.deleteMany({ where: { id: task.id, status: { not: 'approved' } } })
    if (count === 0) refuse(await whyNot(tx, { id: task.id }))
    return proofs.map((proof) => proof.id)
  })
  await removeFiles(files)
  res.status(204).end()
})

// ------------------------------------------------------------------ proof

// Memory storage: nothing reaches the disk until the checks in sendProof have passed.
const parse = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 2 } }).single('file')
/** multer's own errors (the limits) reach app.js as they are. A body its parser cannot read at all (no boundary, cut off) is an unreadable proof too. */
const upload = (req, res, next) => parse(req, res, (err) => next(err && !(err instanceof multer.MulterError) ? new ApiError('INVALID', { proof: 'format' }) : err))

// L8: the children whose upload is being received now. A proof is held in memory and stripping copies it, so a slow upload keeps
// up to 50 MB for as long as the request lasts: at most 4 at once, and 1 per child.
const receiving = new Set()
/** How many uploads are being received now. Read only by the tests, which wait on it instead of on a timer. */
export const uploadsInFlight = () => receiving.size

/**
 * Runs before multer, so a refused upload writes nothing: a child's own task, still open (rule 2), then a free slot (L8), which is
 * given back when the response closes, however the request ends.
 */
async function mayReceiveProof(req, res, next) {
  const me = only(req, 'child')
  const task = (await db.task.findFirst({ where: { id: text(req.params.id), childId: me.id } })) ?? refuse('NOT_FOUND')
  if (!OPEN.includes(task.status)) refuse('LOCKED')
  if (receiving.size >= 4 || receiving.has(me.id)) refuse('TOO_MANY')
  if (res.destroyed || req.socket.destroyed) return // the caller left while the task was looked up: 'close' has fired, so a slot taken now would never come back
  receiving.add(me.id)
  res.on('close', () => receiving.delete(me.id))
  req.task = task
  next()
}

/**
 * sendProof (A5, A6, A9): the note checks, then the file's type from its bytes, then the bytes without their location, then the
 * file on disk, then one transaction that takes the child's lock first. That serialises it with B1's erase(), which locks the same
 * row, so a deleted family never keeps a file. Nothing stays on disk when the transaction fails.
 */
tasks.post('/tasks/:id/proofs', proofLimit, mayReceiveProof, upload, async (req, res) => {
  const { task, file } = req
  const note = text(req.body?.note)
  invalid({ proof: !file && !note.trim() && 'required', note: note.length > 500 && 'length' })
  const id = randomUUID()
  const proof = { id, taskId: task.id, note: note.trim() }
  if (file) {
    const type = sniff(file.buffer) ?? refuse('FILE_TYPE')
    const bytes = strip(file.buffer, type)
    Object.assign(proof, { fileName: NAMES[type], fileType: type, fileSize: bytes.length }) // C3: never the device's name
    // L6 and L9, before anything is written: the family's files with this one, then the room left on the drive. T4: a file
    // removed for age no longer takes room.
    // ponytail: summed before the transaction and without a lock, so uploads at the same moment can each pass: the family ends over
    // by the files in flight, at most 4 of 25 MB (L8). Take the parent's row lock around the sum and the insert if that matters.
    const held = await db.proof.aggregate({ _sum: { fileSize: true }, where: { removedAt: null, task: { child: { parentId: req.user.parentId } } } })
    if ((held._sum.fileSize ?? 0) + bytes.length > STORAGE_BYTES) refuse('QUOTA', { quota: 'storage' })
    if (!(await hasRoom(process.env.UPLOAD_DIR, bytes.length, FREE_BYTES))) refuse('QUOTA', { quota: 'disk' })
    await saveFile(id, bytes)
  }
  const row = await db
    .$transaction(async (tx) => {
      await lockChild(tx, task.childId)
      // A9: sending proof marks the earlier result as seen. Rule 22: it also ends the child's pin on this task.
      const { count } = await tx.task.updateMany({ where: { id: task.id, childId: task.childId, status: { in: OPEN } }, data: { status: 'review', pinned: false, resultSeen: true } })
      if (count === 0) refuse(await whyNot(tx, { id: task.id, childId: task.childId }))
      const sentAt = now()
      const { dueAt } = await tx.task.findUniqueOrThrow({ where: { id: task.id }, select: { dueAt: true } }) // as it stands now, not as the check saw it
      await tx.proof.create({ data: { ...proof, sentAt, late: sentAt > dueAt } }) // rule 1: late proof is accepted, and marked
      return tx.task.findUniqueOrThrow({ where: { id: task.id }, include: taskWith })
    })
    .catch(async (error) => {
      if (file) await removeFiles([id])
      throw error
    })
  res.status(201).json(asTask(row, { files: true }))
})

/**
 * listMyProofs (K5): the signed-in child's approved photos and videos, newest approval first, `limit` (1 to 24, default 24) from
 * `offset`. Only once Today has shown the approval (rule 13), and only proofs that still have a file: a PDF is left out, and so
 * is a file removed for age (T4).
 */
tasks.get('/proofs/mine', async (req, res) => {
  const me = only(req, 'child')
  const rows = await db.proof.findMany({
    where: { result: 'approved', removedAt: null, task: { childId: me.id, resultSeen: true }, OR: [{ fileType: { startsWith: 'image/' } }, { fileType: { startsWith: 'video/' } }] },
    include: { task: { select: { title: true } } },
    orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }],
    skip: number(req.query.offset, 0),
    take: Math.min(24, Math.max(1, number(req.query.limit, 24))),
  })
  res.json(rows.map((p) => ({
    id: p.id,
    fileUrl: `/api/proofs/${p.id}/file`,
    fileType: p.fileType,
    taskId: p.taskId,
    taskTitle: p.task.title,
    at: p.reviewedAt.toISOString(),
    cheer: p.cheerKind || p.cheerLine ? { kind: p.cheerKind, line: p.cheerLine } : undefined,
  })))
})

/** The proof file, to the task's child and that child's parent only (A5). A moderator is NOT_ALLOWED, a signed-out visitor NOT_SIGNED_IN. */
tasks.get('/proofs/:id/file', async (req, res) => {
  const proof = await db.proof.findFirst({ where: { id: text(req.params.id), fileType: { not: null }, removedAt: null, task: visible(req) } })
  if (!proof) refuse('NOT_FOUND')
  await sendProofFile(res, proof)
})

// ------------------------------------------------------------------ review

/**
 * An approval (recordAwards): completes the child's quest for the week the proof was sent in when it reaches the
 * target, from the quest as it is now and before the stickers are worked out, so a quest sticker belongs to this same approval.
 * Then records every sticker the child's record has now reached and they do not hold: one pass over the tasks, not a replay of every
 * approval, so an approval stays quick however long the history. Runs inside the review's transaction, after the task is approved.
 */
async function recordApproval(tx, task, at) {
  const snapshot = await loadChild(tx, task.childId)
  const { zone, quest, questAwards } = snapshot
  const approved = snapshot.tasks.find((t) => t.id === task.id)
  const week = questCompletedBy(snapshot.tasks, quest, Object.fromEntries(questAwards.map((a) => [a.week, a])), approved, zone)
  if (week) {
    const { target, bonus, surprise } = quest
    await tx.questAward.create({ data: { childId: task.childId, week, target, bonus, surprise, earnedAt: at, taskId: task.id, taskTitle: task.title } })
    await tx.quest.update({ where: { childId: task.childId }, data: { surprise: null } }) // opened now
    questAwards.unshift({ week, target, bonus, surprise, earnedAt: at.toISOString(), taskId: task.id, taskTitle: task.title })
  }
  const earned = reached(snapshot.tasks, at, { rest: snapshot.rest, quests: questAwards.length, zone }).filter((s) => !snapshot.awards[s.id])
  const data = earned.map((s) => ({ childId: task.childId, stickerId: s.id, earnedAt: at, taskId: task.id, taskTitle: task.title }))
  await tx.award.createMany({ data, skipDuplicates: true })
}

/**
 * approveProof and sendBackProof (rules 4, 10, 19, 20): one route, `result` says which. A parent's answer to the newest proof lands
 * once: the child's lock serialises two answers, and the second finds the task no longer in review (REVIEWED).
 */
tasks.post('/tasks/:id/review', async (req, res) => {
  const me = only(req, 'parent')
  const found = await visibleTask(req, req.params.id)
  const body = req.body ?? {}
  const result = body.result
  if (result !== 'approved' && result !== 'sentBack') refuse('INVALID', { result: 'required' })
  const proofId = text(body.proofId)
  const note = result === 'sentBack' ? text(body.note) : ''
  const cheer = result === 'approved' && body.cheer && typeof body.cheer === 'object' ? body.cheer : null
  const row = await db.$transaction(async (tx) => {
    await lockChild(tx, found.childId)
    const task = (await tx.task.findUnique({ where: { id: found.id }, include: taskWith })) ?? refuse('NOT_FOUND')
    if (task.status !== 'review' || task.proofs.at(-1).id !== proofId) refuse('REVIEWED')
    // A cheer with no kind and no words is not stored. A line of the wrong type is as wrong as one that is too long.
    const kind = cheer?.kind ?? null
    const typed = cheer?.line ?? ''
    const line = text(typed).trim()
    invalid({
      note: (result === 'sentBack' && !note.trim() && 'required') || (note.length > 300 && 'length'),
      cheer: kind !== null && !CHEER_KINDS.includes(kind) && 'kind',
      line: (typeof typed !== 'string' || line.length > 120) && 'length',
    })
    screen(`${note} ${line}`) // C7: both reach the child; only one is ever set (a send-back has no cheer), so the word says where it is
    const at = now()
    // Conditional on the status the checks saw: 0 rows means another answer landed first.
    const { count } = await tx.task.updateMany({ where: { id: task.id, status: 'review' }, data: { status: result, resultSeen: false } }) // rule 4: new to the child until seen
    if (count === 0) refuse('REVIEWED')
    await tx.proof.update({
      where: { id: proofId },
      data: { result, reviewNote: note.trim(), reviewBy: me.name, reviewedAt: at, cheerKind: kind, cheerLine: line },
    })
    if (result === 'approved') await recordApproval(tx, task, at)
    return tx.task.findUniqueOrThrow({ where: { id: task.id }, include: taskWith })
  })
  res.json(asTask(row, { files: true }))
})

/** markResultsSeen: on the child's own listed tasks only, so a result that arrives meanwhile is still new. */
tasks.post('/tasks/seen', async (req, res) => {
  const me = only(req, 'child')
  const { taskIds } = req.body ?? {}
  if (!Array.isArray(taskIds) || taskIds.length > 200 || !taskIds.every((id) => typeof id === 'string')) refuse('INVALID', { taskIds: 'format' })
  await db.task.updateMany({ where: { childId: me.id, id: { in: taskIds.map(text) } }, data: { resultSeen: true } })
  res.status(204).end()
})

/** pinTask (rule 22): one at a time; null clears the choice. Open tasks only, and the child's own. */
tasks.put('/pin', async (req, res) => {
  const me = only(req, 'child')
  const { taskId } = req.body ?? {}
  await db.$transaction(async (tx) => {
    await lockChild(tx, me.id) // sendProof clears a pin under the same lock
    const task = taskId === null ? null : ((await tx.task.findFirst({ where: { id: text(taskId), childId: me.id } })) ?? refuse('NOT_FOUND'))
    if (task && !OPEN.includes(task.status)) refuse('LOCKED')
    await tx.task.updateMany({ where: { childId: me.id }, data: { pinned: false } })
    if (task) {
      // Conditional, so a task the parent has just moved to a sibling or a proof just sent cannot end up pinned: the refusal undoes the unpinning.
      const { count } = await tx.task.updateMany({ where: { id: task.id, childId: me.id, status: { in: OPEN } }, data: { pinned: true } })
      if (count === 0) refuse(await whyNot(tx, { id: task.id, childId: me.id }))
    }
  })
  res.json(await list(req))
})

// ------------------------------------------------------------------ counts

/** getCounts (P3): the navigation's numbers in one call. A parent's proofs and reward requests waiting; a child's new results and, K2, answers. */
tasks.get('/counts', async (req, res) => {
  const me = signedIn(req)
  if (me.role === 'child') {
    const [results, answers] = await Promise.all([
      db.task.count({ where: { childId: me.id, resultSeen: false } }),
      db.rewardRequest.count({ where: { childId: me.id, answerSeen: false } }),
    ])
    return res.json({ results, answers })
  }
  if (me.role !== 'parent') refuse('NOT_ALLOWED')
  const [proofs, requests] = await Promise.all([
    db.task.count({ where: { status: 'review', child: { parentId: me.id } } }),
    db.rewardRequest.count({ where: { parentId: me.id, status: 'requested' } }),
  ])
  res.json({ proofs, requests })
})
