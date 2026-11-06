import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'
import { only, ownChild, signedIn } from '../auth.js'
import { now } from '../clock.js'
import { db, loadChild, lockChild, taskWith } from '../db.js'
import { ApiError, invalid, refuse, text } from '../errors.js'
import { removeFiles, safeName, saveFile, sendProofFile, sniff, strip } from '../files.js'
import { CHEER_KINDS, MAX_FILE_BYTES, OPEN, checkTask } from '../rules.js'
import { questCompletedBy, stickers } from '../scoring.js'
import { asTask } from '../shape.js'

/** Tasks, proof, review and files (plan B2). Mirrors fake.js:322-522 and 802-812. */
export const tasks = Router()

/** Which tasks this user may see (fake.js:322-336): a parent's whole family, or a child's own. A moderator sees none. */
export function visible(req) {
  const me = signedIn(req)
  if (me.role === 'child') return { childId: me.id }
  if (me.role !== 'parent') refuse('NOT_ALLOWED')
  return { child: { parentId: me.id } }
}

/** One task this user may see, with its proofs, or NOT_FOUND. */
const visibleTask = async (req, id) =>
  (await db.task.findFirst({ where: { id: text(id), ...visible(req) }, include: taskWith })) ?? refuse('NOT_FOUND')

/** Every task this user may see, soonest due first, as listTasks gives them (proofs without fileUrl). */
async function list(req) {
  const rows = await db.task.findMany({ where: visible(req), include: taskWith, orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] })
  return rows.map((row) => asTask(row))
}

/** Why a conditional write on a task matched nothing: the task is gone, or no longer the sender's (NOT_FOUND); or no longer in the status the write needed (LOCKED). */
const whyNot = async (client, where) => ((await client.task.count({ where })) ? 'LOCKED' : 'NOT_FOUND')

// ------------------------------------------------------------------ tasks

/** listTasks */
tasks.get('/tasks', async (req, res) => {
  res.json(await list(req))
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

/** Runs before multer, so a refused upload writes nothing: a child's own task, still open (rule 2). */
async function mayReceiveProof(req, _res, next) {
  const me = only(req, 'child')
  const task = (await db.task.findFirst({ where: { id: text(req.params.id), childId: me.id } })) ?? refuse('NOT_FOUND')
  if (!OPEN.includes(task.status)) refuse('LOCKED')
  req.task = task
  next()
}

/**
 * sendProof (A5, A6, A9): the note checks, then the file's type from its bytes, then the bytes without their location, then the
 * file on disk, then one transaction that takes the child's lock first. That serialises it with B1's erase(), which locks the same
 * row, so a deleted family never keeps a file. Nothing stays on disk when the transaction fails.
 */
tasks.post('/tasks/:id/proofs', mayReceiveProof, upload, async (req, res) => {
  const { task, file } = req
  const note = text(req.body?.note)
  invalid({ proof: !file && !note.trim() && 'required', note: note.length > 500 && 'length' })
  const id = randomUUID()
  const proof = { id, taskId: task.id, note: note.trim() }
  if (file) {
    const type = sniff(file.buffer) ?? refuse('FILE_TYPE')
    const bytes = strip(file.buffer, type)
    Object.assign(proof, { fileName: safeName(file.originalname), fileType: type, fileSize: bytes.length })
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

/** The proof file, to the task's child and that child's parent only (A5). A moderator is NOT_ALLOWED, a signed-out visitor NOT_SIGNED_IN. */
tasks.get('/proofs/:id/file', async (req, res) => {
  const proof = await db.proof.findFirst({ where: { id: text(req.params.id), fileType: { not: null }, task: visible(req) } })
  if (!proof) refuse('NOT_FOUND')
  await sendProofFile(res, proof)
})

// ------------------------------------------------------------------ review

/**
 * An approval (fake.js:495-507, recordAwards): completes the child's quest for the week the proof was sent in when it reaches the
 * target, from the quest as it is now and before the stickers are worked out, so a quest sticker belongs to this same approval.
 * Then records every sticker the child now has and did not. Runs inside the review's transaction, after the task is approved.
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
  const earned = stickers(snapshot.tasks, { rest: snapshot.rest, questAwards, zone }).filter((s) => s.earnedAt && !snapshot.awards[s.id])
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

/** countProofsWaiting */
tasks.get('/counts/proofs', async (req, res) => {
  const me = only(req, 'parent')
  res.json(await db.task.count({ where: { status: 'review', child: { parentId: me.id } } }))
})

/** countNewResults */
tasks.get('/counts/results', async (req, res) => {
  const me = only(req, 'child')
  res.json(await db.task.count({ where: { childId: me.id, resultSeen: false } }))
})
