import { Router } from 'express'
import { only, ownChild } from '../auth.js'
import { now } from '../clock.js'
import { zoneOf } from '../countries.js'
import { db, lockChild } from '../db.js'
import { refuse, text } from '../errors.js'
import { cap, checkSeries } from '../rules.js'
import { atTimeIn, dayKey } from '../scoring.js'

/** Repeating tasks (sitemap rule 9, H1 to H3): a parent's series, and the tasks they make day by day. */
export const series = Router()

const MOST_OPEN = 300 // rules.js CAPS.tasks: a series never pushes a child past the task cap (L6)

/** The children a request may make today's tasks for, each with the zone its days are counted in (rule 25). */
export function childrenOf(req) {
  const me = req.user
  if (me?.role === 'child') return Promise.resolve([{ id: me.id, zone: zoneOf(me.parent?.country) }])
  if (me?.role !== 'parent') return Promise.resolve([])
  return db.user.findMany({ where: { parentId: me.id }, select: { id: true } }).then((rows) => rows.map(({ id }) => ({ id, zone: zoneOf(me.country) })))
}

/**
 * H2: makes today's task for each running series of these children that runs today and has none yet. Today and its weekday are
 * the family's; the task is due at the series' time. It never makes a missed day afterwards. A series made after today's time
 * starts tomorrow, so it never makes a task that is overdue at once. One task per series per day: the unique (seriesId, seriesDay)
 * pair and skipDuplicates hold that under racing loads, and the child's lock holds the task cap.
 */
export async function makeDueTasks(children, time = now()) {
  if (children.length === 0) return
  const running = await db.taskSeries.findMany({ where: { childId: { in: children.map((c) => c.id) }, active: true } })
  for (const child of children) {
    const day = dayKey(time, child.zone)
    const [y, m, d] = day.split('-').map(Number)
    const bit = 1 << ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) // Monday = 1 ... Sunday = 64
    const due = running
      .filter((s) => s.childId === child.id && s.weekdays & bit)
      .map((s) => ({ s, dueAt: atTimeIn(day, s.dueTime, child.zone) }))
      .filter(({ s, dueAt }) => dueAt > s.createdAt)
    if (due.length === 0) continue
    const made = await db.task.findMany({ where: { seriesId: { in: due.map(({ s }) => s.id) }, seriesDay: day }, select: { seriesId: true } })
    const missing = due.filter(({ s }) => !made.some((t) => t.seriesId === s.id))
    if (missing.length === 0) continue
    await db.$transaction(async (tx) => {
      await lockChild(tx, child.id)
      const room = MOST_OPEN - (await tx.task.count({ where: { childId: child.id, status: { not: 'approved' } } }))
      const data = missing.slice(0, Math.max(0, room)).map(({ s, dueAt }) => ({
        childId: child.id, category: s.category, title: s.title, instructions: s.instructions, doneLooksLike: s.doneLooksLike,
        points: s.points, dueAt, createdAt: time, seriesId: s.id, seriesDay: day,
      }))
      await tx.task.createMany({ data, skipDuplicates: true })
    })
  }
}

export const asSeries = ({ id, childId, category, title, instructions, doneLooksLike, points, weekdays, dueTime, active }) => ({
  id, childId, category, title, instructions, doneLooksLike, points, weekdays, dueTime, active,
})

/** One of the signed-in parent's series, or NOT_FOUND: another family's does not exist as far as they can tell. */
async function ownSeries(req) {
  const me = only(req, 'parent')
  return (await db.taskSeries.findFirst({ where: { id: text(req.params.id), child: { parentId: me.id } } })) ?? refuse('NOT_FOUND')
}

/** listSeries: the family's series, oldest first, stopped ones included until they are deleted. */
series.get('/series', async (req, res) => {
  const me = only(req, 'parent')
  const rows = await db.taskSeries.findMany({ where: { child: { parentId: me.id } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
  res.json(rows.map(asSeries))
})

/** createSeries (H1): for one of the parent's children, checked and screened as a task is; at most 20 per child. */
series.post('/series', async (req, res) => {
  const body = req.body ?? {}
  const child = await ownChild(req, text(body.childId))
  const values = checkSeries(body)
  cap('series', await db.taskSeries.count({ where: { childId: child.id } }))
  const row = await db.taskSeries.create({ data: { ...values, childId: child.id, createdAt: now() } })
  res.status(201).json(asSeries(row))
})

/** updateSeries (H3): changes the tasks it makes from now on; the ones it made stay as they are. The child cannot change. */
series.put('/series/:id', async (req, res) => {
  const found = await ownSeries(req)
  const values = checkSeries(req.body ?? {})
  res.json(asSeries(await db.taskSeries.update({ where: { id: found.id }, data: values })))
})

/** stopSeries (H3): the series goes; every task it made stays, no longer linked to it. */
series.delete('/series/:id', async (req, res) => {
  const found = await ownSeries(req)
  await db.taskSeries.delete({ where: { id: found.id } })
  res.status(204).end()
})
