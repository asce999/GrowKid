import { PrismaClient } from '@prisma/client'
import { zoneOf } from './countries.js'
import { asTask } from './shape.js'

// minimal: Prisma's default error text quotes the query's values, which can be a task title or a proof note (sitemap rule 28, F7)
export const db = new PrismaClient({ errorFormat: 'minimal' })

/** Section 7, Races: takes the child's row lock so score-then-write handlers (approve, request, quest) cannot interleave. Call first inside db.$transaction. */
export const lockChild = (tx, id) => tx.$queryRaw`SELECT 1 FROM "User" WHERE id = ${id} FOR UPDATE`

/** What a task is read with, so shape.js's asTask has the child's name and the proofs oldest first. */
export const taskWith = { child: { select: { name: true } }, proofs: { orderBy: [{ sentAt: 'asc' }, { id: 'asc' }] } }

/**
 * Section 7, the snapshot: everything scoring.js and the ported rules read about one child, in the shapes they expect, plus the zone
 * their days are counted in (rule 25: the parent's country). Call it inside the transaction that holds lockChild.
 * ponytail: loads the child's whole history on each score read; fine for hundreds of tasks, add aggregate queries past thousands.
 */
export async function loadChild(tx, childId) {
  const where = { childId }
  const [owner, tasks, rest, quest, questAwards, awards, requests] = await Promise.all([
    tx.user.findUnique({ where: { id: childId }, select: { parent: { select: { country: true } } } }),
    tx.task.findMany({ where, include: taskWith }),
    tx.restDay.findMany({ where, orderBy: { day: 'asc' } }),
    tx.quest.findUnique({ where }),
    tx.questAward.findMany({ where, orderBy: { earnedAt: 'desc' } }),
    tx.award.findMany({ where }),
    tx.rewardRequest.findMany({ where }),
  ])
  return {
    zone: zoneOf(owner?.parent?.country),
    tasks: tasks.map((task) => asTask(task)),
    rest: rest.map((r) => r.day),
    quest: quest && { target: quest.target, bonus: quest.bonus, surprise: quest.surprise },
    questAwards: questAwards.map((a) => ({ ...a, earnedAt: a.earnedAt.toISOString() })),
    awards: Object.fromEntries(awards.map((a) => [a.stickerId, { earnedAt: a.earnedAt.toISOString(), taskId: a.taskId, taskTitle: a.taskTitle }])),
    requests,
  }
}

/**
 * The snapshots of these children, all read from one moment: loadChild's seven queries run in one repeatable-read transaction, so
 * a poll that lands during an approval sees all of it or none, never a quest complete and then sealed again. One transaction for
 * the request, however many children. For read routes only: a handler that writes takes lockChild and calls loadChild itself.
 */
export const readChildren = (ids) =>
  db.$transaction((tx) => Promise.all(ids.map((id) => loadChild(tx, id))), { isolationLevel: 'RepeatableRead' })
