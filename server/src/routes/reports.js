import { Router } from 'express'
import { only, signedIn } from '../auth.js'
import { now } from '../clock.js'
import { db, lockChild, taskWith } from '../db.js'
import { invalid, refuse, text } from '../errors.js'
import { asReport, asTask, itemOf } from '../shape.js'
import { visible } from './tasks.js'

/** Reports to the moderator (plan B3, rules 15 and 16). Mirrors fake.js:837-895. */
export const reports = Router()

/**
 * sendReport (A10): straight to the moderator's list. No parent is asked, told or shown, and the moderator has no power beyond
 * answering. A task the sender cannot see is left out without a word, and the report still goes.
 */
reports.post('/reports', async (req, res) => {
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

/**
 * listReports: the reports still waiting for an answer, oldest first, for the moderator. The page shows no answered report
 * (Reports.jsx lists only those without a resolution), so an answered one is not sent again on every poll: the sender reads it
 * through listMyReports instead.
 */
reports.get('/reports', async (req, res) => {
  only(req, 'moderator')
  const rows = await db.report.findMany({ where: { resolvedAt: null }, orderBy: [{ sentAt: 'asc' }, { id: 'asc' }] })
  res.json(rows.map((row) => asReport(row, { moderator: true })))
})

/**
 * resolveReport (A11): the moderator's answer, once. A report whose sender was deleted has nobody to read it, so it goes (rule 16)
 * and is returned answered, with senderGone. The write is conditional on resolvedAt being empty, so two answers at once land once.
 * It takes the sender's row lock first, the lock erase() holds on every user it deletes: so erase either finished before (byId is
 * null here) or runs after this commits and deletes the answered report with the rest of the sender's.
 */
reports.post('/reports/:id/resolve', async (req, res) => {
  only(req, 'moderator')
  const id = text(req.params.id)
  const note = text((req.body ?? {}).note)
  const answered = await db.$transaction(async (tx) => {
    const found = (await tx.report.findUnique({ where: { id } })) ?? refuse('NOT_FOUND')
    if (found.byId) await lockChild(tx, found.byId) // lockChild locks any user row
    const report = (await tx.report.findUnique({ where: { id } })) ?? refuse('NOT_FOUND')
    if (report.resolvedAt) refuse('LOCKED')
    invalid({ note: (!note.trim() && 'required') || (note.length > 500 && 'length') })
    const { count } = await tx.report.updateMany({ where: { id, resolvedAt: null }, data: { resolutionNote: note.trim(), resolvedAt: now() } })
    if (count === 0) refuse('LOCKED')
    const done = await tx.report.findUniqueOrThrow({ where: { id } })
    if (done.byId === null) await tx.report.delete({ where: { id } })
    return done
  })
  res.json(asReport(answered, { moderator: true }))
})
