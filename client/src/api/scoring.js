/**
 * The award rules (FRONTEND-SITEMAP.md section 12, rule 3), as plain functions of one child's
 * tasks and the time. Part of the stand-in: the server's scoring engine must give the same
 * answers. Nothing here touches the browser, so `npm run check` can run it.
 */

/** Every level takes this much XP. An approved task's points are its XP. */
const LEVEL_XP = 100

/**
 * The stickers, in the order of the chart. Shape and colour follow DESIGN.md section 10: gold
 * seals for task counts, navy shields for streaks, green hexagons for levels, gold stars for a
 * skill. earned decides from the child's record so far; a sticker once earned is never lost.
 */
export const STICKERS = [
  { id: 'first-task', name: 'First task', how: 'Awarded when your first task is approved.', shape: 'seal', tone: 'sun', earned: (s) => s.approved >= 1 },
  { id: 'tasks-10', name: '10 tasks', how: 'Awarded when 10 of your tasks have been approved.', shape: 'seal', tone: 'sun', earned: (s) => s.approved >= 10 },
  { id: 'tasks-25', name: '25 tasks', how: 'Awarded when 25 of your tasks have been approved.', shape: 'seal', tone: 'sun', earned: (s) => s.approved >= 25 },
  { id: 'streak-3', name: '3-day streak', how: 'Awarded when your streak reaches 3 days.', shape: 'shield', tone: 'navy', earned: (s) => s.streak >= 3 },
  { id: 'streak-7', name: '7-day streak', how: 'Awarded when your streak reaches 7 days.', shape: 'shield', tone: 'navy', earned: (s) => s.streak >= 7 },
  { id: 'streak-30', name: '30-day streak', how: 'Awarded when your streak reaches 30 days.', shape: 'shield', tone: 'navy', earned: (s) => s.streak >= 30 },
  { id: 'level-2', name: 'Level 2', how: 'Awarded when you reach level 2.', shape: 'hexagon', tone: 'sprout', earned: (s) => s.level >= 2 },
  { id: 'level-5', name: 'Level 5', how: 'Awarded when you reach level 5.', shape: 'hexagon', tone: 'sprout', earned: (s) => s.level >= 5 },
  { id: 'level-10', name: 'Level 10', how: 'Awarded when you reach level 10.', shape: 'hexagon', tone: 'sprout', earned: (s) => s.level >= 10 },
  { id: 'all-kinds', name: 'All six kinds', how: 'Awarded when a task of each of the six kinds has been approved.', shape: 'star', tone: 'sun', earned: (s) => s.kinds >= 6 },
  { id: 'first-try-5', name: 'Right first time', how: 'Awarded when 5 tasks have been approved on the first try.', shape: 'star', tone: 'sun', earned: (s) => s.firstTry >= 5 },
]

/** The chart: every sticker, without its rule. */
export const CHART = STICKERS.map(({ earned: _rule, ...sticker }) => sticker)

const dayOf = (time) => {
  const d = new Date(time)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
const sum = (tasks) => tasks.reduce((total, task) => total + task.points, 0)
const approvedAt = (task) => task.proofs.at(-1).review.at
/** The approved tasks, in the order they were approved. */
const approvedOf = (tasks) =>
  tasks.filter((task) => task.status === 'approved').sort((a, b) => approvedAt(a).localeCompare(approvedAt(b)))

const levelOf = (points) => ({ level: Math.floor(points / LEVEL_XP) + 1, xp: points % LEVEL_XP, xpForNext: LEVEL_XP, points })

/**
 * The streak, which is fair to the child because only the child's own actions move it.
 *
 * A day counts when proof the child sent that day was approved: the day is the day it was
 * sent, so a parent who approves late breaks nothing. A day is missed when a task was due on it
 * and no proof for that task had been sent by the end of the day, unless the child sent any
 * proof at all that day, whatever later happens to it: waiting, approved or sent back. A
 * parent's answer therefore never turns a day into a missed one. Any other day changes nothing.
 * The streak is the number of days that count since the last missed day; the best one is kept.
 */
function streakOf(approved, tasks, time, span = 7) {
  const today = dayOf(time)
  const done = new Set(approved.map((task) => dayOf(task.proofs.at(-1).sentAt)))
  const sent = new Set(tasks.flatMap((task) => task.proofs.map((proof) => dayOf(proof.sentAt))))
  const missed = new Set()
  for (const task of tasks) {
    const due = dayOf(task.dueAt)
    const sentByThen = task.proofs.length > 0 && dayOf(task.proofs[0].sentAt) <= due
    if (due < today && !sentByThen && !sent.has(due)) missed.add(due)
  }
  let days = 0
  let best = 0
  for (const day of [...new Set([...done, ...missed])].sort((a, b) => a - b)) {
    days = missed.has(day) ? 0 : days + 1
    best = Math.max(best, days)
  }
  const week = Array.from({ length: span }, (_, i) => {
    const day = new Date(today)
    day.setDate(day.getDate() - (span - 1 - i))
    return { day: day.toISOString(), state: done.has(day.getTime()) ? 'done' : missed.has(day.getTime()) ? 'missed' : 'none' }
  })
  return { days, best, week }
}

/** Level, XP, points and streak, from the tasks as they stand at this time. */
export function score(tasks, time) {
  const approved = approvedOf(tasks)
  return {
    ...levelOf(sum(approved)),
    waitingXp: sum(tasks.filter((task) => task.status === 'review')),
    streak: streakOf(approved, tasks, time),
  }
}

/** The Monday that begins the week a time falls in. Weeks run Monday to Sunday (rule 12). */
const mondayOf = (time) => {
  const d = new Date(time)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
}

/**
 * A child's progress over time, for the parent's Progress page and its report (rule 14). Nothing
 * here is stored: it is the same tasks read by week.
 *
 * weeks: the last six weeks, this one last, each with the tasks approved in it and the XP they
 * earned. As with the streak, a task belongs to the week its approved proof was sent in, so a
 * parent who approves on Monday what was sent on Sunday moves nothing into the new week.
 * calendar: the streak's day marks from the Monday three weeks before this week's, up to today.
 */
export function progress(tasks, time) {
  const approved = approvedOf(tasks)
  const monday = mondayOf(time)
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(monday)
    start.setDate(start.getDate() - 7 * (5 - i))
    const done = approved.filter((task) => mondayOf(task.proofs.at(-1).sentAt).getTime() === start.getTime())
    return { start: start.toISOString(), tasks: done.length, xp: sum(done) }
  })
  const sinceMonday = Math.round((dayOf(time) - monday) / 86_400_000)
  return { weeks, calendar: streakOf(approved, tasks, time, 21 + sinceMonday + 1).week }
}

/**
 * Every sticker, and for an earned one the approval that earned it: when, and for which task.
 * The approvals are gone through in order, so each sticker is dated by the first approval after
 * which its condition held.
 */
export function stickers(tasks) {
  const approved = approvedOf(tasks)
  const awards = {}
  approved.forEach((task, i) => {
    const soFar = approved.slice(0, i + 1)
    const record = {
      approved: soFar.length,
      level: levelOf(sum(soFar)).level,
      streak: streakOf(soFar, tasks, approvedAt(task)).best,
      kinds: new Set(soFar.map((t) => t.category)).size,
      firstTry: soFar.filter((t) => t.proofs.length === 1).length,
    }
    for (const sticker of STICKERS) {
      if (!awards[sticker.id] && sticker.earned(record)) {
        awards[sticker.id] = { earnedAt: approvedAt(task), taskId: task.id, taskTitle: task.title }
      }
    }
  })
  return CHART.map((sticker) => ({ ...sticker, ...awards[sticker.id] }))
}
