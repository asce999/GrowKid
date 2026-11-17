import { Router } from 'express'
import { only, paused, reportLimit, securityLog, signedIn } from '../auth.js'
import { now } from '../clock.js'
import { db, lockChild, taskWith } from '../db.js'
import { invalid, refuse, text } from '../errors.js'
import { setPaused } from '../pause.js'
import { asReport, asTask, itemOf } from '../shape.js'
import { number, visible } from './tasks.js'

/**
 * Reports to the moderator (plan B3, rules 15 and 16). Ported from the stand-in removed in B4. Since Phase 8 the moderator can answer
 * a report and pause or unpause the family that sent it (T2), and each of those leaves one ModeratorAction row (T3).
 */
export const reports = Router()

/** T2: what asReport needs to say whether the sender's family is paused, and nothing else of theirs. */
const forModerator = { by: { select: { pausedAt: true, parent: { select: { pausedAt: true } } } } }

/**
 * sendReport (A10): straight to the moderator's list, at most 10 sent an hour from one user (reportLimit; refused ones do not count).
 * No parent is asked, told or shown. The moderator can answer it and pause the sender's family (T2), as the server operator's
 * script, scripts/pause-family.js, also can (C6). A task the sender cannot see is left out without a word, and the report
 * still goes.
 */
reports.post('/reports', reportLimit, async (req, res) => {
  const me = signedIn(req)
  if (me.role === 'moderator') refuse('NOT_ALLOWED')
  const body = req.body ?? {}
  const details = text(body.details)
  invalid({ details: (!details.trim() && 'required') || (details.length > 1000 && 'length') })
  const taskId = text(body.taskId)
  const task = taskId ? await db.task.findFirst({ where: { id: taskId, ...visible(req) }, include: taskWith }) : null
  const row = await db.report.create({
    data: { byId: me.id, from: me.role, details: details.trim(), sentAt: now(), ...(task && { item: itemOf(asTask(task)) }) },
  })
  res.status(201).json(asReport(row))
})

/** listMyReports: the signed-in user's own, newest first, each with the answer once there is one. A parent never sees a child's. */
reports.get('/reports/mine', async (req, res) => {
  const me = signedIn(req)
  const rows = await db.report.findMany({ where: { byId: me.id }, orderBy: [{ sentAt: 'desc' }, { id: 'desc' }] })
  res.json(rows.map((row) => asReport(row)))
})

const REPORTS_PAGE = 200
/**
 * listReports (T3): how many reports wait in all, and 200 of them from `offset`, oldest first. The total is always said, so a flood
 * from one family cannot hide another child's report behind the end of the list. An answered report is never sent again: its sender
 * reads it through listMyReports.
 */
reports.get('/reports', async (req, res) => {
  only(req, 'moderator')
  const where = { resolvedAt: null }
  const [waiting, rows] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({ where, include: forModerator, orderBy: [{ sentAt: 'asc' }, { id: 'asc' }], skip: number(req.query.offset, 0), take: REPORTS_PAGE }),
  ])
  res.json({ waiting, reports: rows.map((row) => asReport(row, { moderator: true })) })
})

/**
 * resolveReport (A11): the moderator's answer, once. A report whose sender was deleted has nobody to read it, so it goes (rule 16)
 * and is returned answered, with senderGone. The write is conditional on resolvedAt being empty, so two answers at once land once.
 * It takes the sender's row lock first, the lock erase() holds on every user it deletes: so erase either finished before (byId is
 * null here) or runs after this commits and deletes the answered report with the rest of the sender's.
 */
reports.post('/reports/:id/resolve', async (req, res) => {
  const me = only(req, 'moderator')
  const id = text(req.params.id)
  const note = text((req.body ?? {}).note)
  const answered = await db.$transaction(async (tx) => {
    const found = (await tx.report.findUnique({ where: { id } })) ?? refuse('NOT_FOUND')
    if (found.byId) await lockChild(tx, found.byId) // lockChild locks any user row
    const report = (await tx.report.findUnique({ where: { id }, include: forModerator })) ?? refuse('NOT_FOUND')
    if (report.resolvedAt) refuse('LOCKED')
    if (report.by && paused(report.by)) refuse('LOCKED') // T2: nobody in a paused family could read the answer
    invalid({ note: (!note.trim() && 'required') || (note.length > 500 && 'length') })
    const { count } = await tx.report.updateMany({ where: { id, resolvedAt: null }, data: { resolutionNote: note.trim(), resolvedAt: now() } })
    if (count === 0) refuse('LOCKED')
    await tx.moderatorAction.create({ data: { moderatorId: me.id, action: 'answer', reportId: id, at: now() } }) // T3
    const done = await tx.report.findUniqueOrThrow({ where: { id }, include: forModerator })
    if (done.byId === null) await tx.report.delete({ where: { id } })
    return done
  })
  res.json(asReport(answered, { moderator: true }))
})

/**
 * pauseFamily and unpauseFamily (rule 30, T2): the family of a waiting report's sender, as scripts/pause-family.js does it. A report
 * that is gone or answered, or whose sender is gone, is NOT_FOUND. The act and its record (T3) land together.
 */
const pausing = (action) => async (req, res) => {
  const me = only(req, 'moderator')
  const id = text(req.params.id)
  const row = await db.$transaction(async (tx) => {
    const waiting = await tx.report.findFirst({ where: { id, resolvedAt: null }, select: { id: true } })
    if (!waiting || (await setPaused(tx, id, action === 'pause'))) refuse('NOT_FOUND')
    await tx.moderatorAction.create({ data: { moderatorId: me.id, action, reportId: id, at: now() } })
    return tx.report.findUniqueOrThrow({ where: { id }, include: forModerator })
  })
  securityLog(`family-${action}`, req) // C9
  res.json(asReport(row, { moderator: true }))
}
reports.post('/reports/:id/pause', pausing('pause'))
reports.post('/reports/:id/unpause', pausing('unpause'))
