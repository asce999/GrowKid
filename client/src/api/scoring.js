/**
 * The award rules (FRONTEND-SITEMAP.md section 12, rule 3), as plain functions of one child's
 * tasks and the time. Part of the stand-in: the server's scoring engine must give the same
 * answers. Nothing here touches the browser, so `npm run check` can run it.
 *
 * Two things a parent sets are inputs, because they cannot be worked out from the tasks: rest
 * days (rule 21), passed as a list of 'YYYY-MM-DD' keys, and the quests the child has completed
 * (rule 19), passed as awards. The caller supplies both; nothing here stores them.
 *
 * Every function that answers "which day?" takes a last `zone` (an IANA time zone, rule 25). Left out, the day is the one
 * in this machine's own zone, which is what the stand-in uses. The server passes the family's zone.
 */

/** Every level takes this much XP. An approved task's points are its XP. */
const LEVEL_XP = 100

/**
 * The stickers, in the order of the chart. Shape and colour follow DESIGN.md section 10: gold
 * seals for task counts, navy shields for streaks, green hexagons for levels, gold stars for a
 * skill. A sticker is plain data: it is earned once the child's record (see recordOf) has `need`
 * or more of its `measure`, and a sticker once earned is never lost.
 */
export const STICKERS = [
  { id: 'first-task', name: 'First task', how: 'Awarded when your first task is approved.', shape: 'seal', tone: 'sun', measure: 'approved', need: 1 },
  { id: 'tasks-10', name: '10 tasks', how: 'Awarded when 10 of your tasks have been approved.', shape: 'seal', tone: 'sun', measure: 'approved', need: 10 },
  { id: 'tasks-25', name: '25 tasks', how: 'Awarded when 25 of your tasks have been approved.', shape: 'seal', tone: 'sun', measure: 'approved', need: 25 },
  { id: 'tasks-50', name: '50 tasks', how: 'Awarded when 50 of your tasks have been approved.', shape: 'seal', tone: 'sun', measure: 'approved', need: 50 },
  { id: 'streak-3', name: '3-day streak', how: 'Awarded when your streak reaches 3 days.', shape: 'shield', tone: 'navy', measure: 'streak', need: 3 },
  { id: 'streak-7', name: '7-day streak', how: 'Awarded when your streak reaches 7 days.', shape: 'shield', tone: 'navy', measure: 'streak', need: 7 },
  { id: 'streak-30', name: '30-day streak', how: 'Awarded when your streak reaches 30 days.', shape: 'shield', tone: 'navy', measure: 'streak', need: 30 },
  { id: 'level-2', name: 'Level 2', how: 'Awarded when you reach level 2.', shape: 'hexagon', tone: 'sprout', measure: 'level', need: 2 },
  { id: 'level-5', name: 'Level 5', how: 'Awarded when you reach level 5.', shape: 'hexagon', tone: 'sprout', measure: 'level', need: 5 },
  { id: 'level-10', name: 'Level 10', how: 'Awarded when you reach level 10.', shape: 'hexagon', tone: 'sprout', measure: 'level', need: 10 },
  { id: 'all-kinds', name: 'All six kinds', how: 'Awarded when a task of each of the six kinds has been approved.', shape: 'star', tone: 'sun', measure: 'kinds', need: 6 },
  { id: 'first-try-5', name: 'Right first time', how: 'Awarded when 5 tasks have been approved on the first try.', shape: 'star', tone: 'sun', measure: 'firstTry', need: 5 },
  { id: 'quest-1', name: 'First quest', how: 'Awarded when you complete your first weekly quest.', shape: 'star', tone: 'sun', measure: 'quests', need: 1 },
  { id: 'quest-4', name: '4 quests', how: 'Awarded when you have completed 4 weekly quests.', shape: 'star', tone: 'sun', measure: 'quests', need: 4 },
]

// Every day question is answered in one time zone (rule 25): `zone` is an IANA name such as 'Asia/Kolkata', and none
// means this machine's own zone, which is what the stand-in wants. A "day" below is a number: the UTC midnight of its
// calendar date, so adding days is plain arithmetic and no local-time getter or setter is needed.
const DAY = 86_400_000
const formatters = new Map() // one formatter per zone: building them is the slow part
const wallOf = (time, zone) => {
  if (!formatters.has(zone)) {
    formatters.set(zone, new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }))
  }
  return Object.fromEntries(formatters.get(zone).formatToParts(new Date(time)).map(({ type, value }) => [type, Number(value)]))
}
const memo = new Map() // zone -> (time -> its day key): the streak rules ask about the same few thousand times over and over
let memoSize = 0
/**
 * A calendar day as 'YYYY-MM-DD' in the zone (rule 21).
 * ponytail: the answers are remembered, and all forgotten at 10,000, which is far more than one child's history; if a longer
 * history makes that thrash, use a least-recently-used cache.
 */
export const dayKey = (time, zone) => {
  const at = time instanceof Date ? time.getTime() : time
  let byTime = memo.get(zone)
  if (!byTime) memo.set(zone, (byTime = new Map()))
  let key = byTime.get(at)
  if (key === undefined) {
    if (memoSize >= 10_000) {
      memo.clear()
      memoSize = 0
      memo.set(zone, (byTime = new Map()))
    }
    const w = wallOf(at, zone)
    key = `${String(w.year).padStart(4, '0')}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`
    byTime.set(at, key)
    memoSize++
  }
  return key
}
/** The day number of a 'YYYY-MM-DD' key. */
const dayOfKey = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const dayOf = (time, zone) => dayOfKey(dayKey(time, zone))
/** The Monday that begins the week a time falls in, as a day number. Weeks run Monday to Sunday (rule 12). */
const mondayOf = (time, zone) => {
  const day = dayOf(time, zone)
  return day - ((new Date(day).getUTCDay() + 6) % 7) * DAY
}
/** The week a time falls in, named by its Monday as 'YYYY-MM-DD'. */
export const weekKey = (time, zone) => new Date(mondayOf(time, zone)).toISOString().slice(0, 10)
/**
 * The ISO time at which a day begins in the zone: what the pages show as that day (only the mark is affected, never which day counts).
 * ponytail: the zone's offset is looked up twice, so a zone that changes its clock exactly at midnight can show a mark an hour out.
 */
const startOf = (day, zone) => {
  const behind = (at) => {
    const w = wallOf(at, zone)
    return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(at / 1000) * 1000
  }
  return new Date(day - behind(day - behind(day))).toISOString()
}

const restSet = (rest) => new Set(rest.map(dayOfKey))
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
 *
 * rest is a Set of days (as dayOf gives them) a parent has set aside (rule 21). Such a day is
 * never missed, so it neither adds to the streak nor breaks it. If proof was approved on it, it
 * still counts and shows as done.
 */
function streakOf(approved, tasks, time, span = 7, rest = new Set(), zone) {
  const today = dayOf(time, zone)
  const done = new Set(approved.map((task) => dayOf(task.proofs.at(-1).sentAt, zone)))
  const sent = new Set(tasks.flatMap((task) => task.proofs.map((proof) => dayOf(proof.sentAt, zone))))
  const missed = new Set()
  for (const task of tasks) {
    const due = dayOf(task.dueAt, zone)
    const sentByThen = task.proofs.length > 0 && dayOf(task.proofs[0].sentAt, zone) <= due
    if (due < today && !sentByThen && !sent.has(due) && !rest.has(due)) missed.add(due)
  }
  let days = 0
  let best = 0
  for (const day of [...new Set([...done, ...missed])].sort((a, b) => a - b)) {
    days = missed.has(day) ? 0 : days + 1
    best = Math.max(best, days)
  }
  const week = Array.from({ length: span }, (_, i) => {
    const at = today - (span - 1 - i) * DAY
    return { day: startOf(at, zone), state: done.has(at) ? 'done' : rest.has(at) ? 'rest' : missed.has(at) ? 'missed' : 'none' }
  })
  return { days, best, week }
}

/** Level, XP, points and streak, from the tasks as they stand at this time. rest: see streakOf. zone: see dayKey. */
export function score(tasks, time, rest = [], zone) {
  const approved = approvedOf(tasks)
  return {
    ...levelOf(sum(approved)),
    waitingXp: sum(tasks.filter((task) => task.status === 'review')),
    streak: streakOf(approved, tasks, time, 7, restSet(rest), zone),
  }
}

/**
 * A child's progress over time, for the parent's Progress page and its report (rule 14). Nothing
 * here is stored: it is the same tasks read by week.
 *
 * weeks: the last six weeks, this one last, each with the tasks approved in it and the XP they
 * earned. As with the streak, a task belongs to the week its approved proof was sent in, so a
 * parent who approves on Monday what was sent on Sunday moves nothing into the new week.
 * calendar: the streak's day marks from the Monday three weeks before this week's, up to today,
 * rest days included.
 */
export function progress(tasks, time, rest = [], zone) {
  const approved = approvedOf(tasks)
  const monday = mondayOf(time, zone)
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const start = monday - 7 * (5 - i) * DAY
    const done = approved.filter((task) => mondayOf(task.proofs.at(-1).sentAt, zone) === start)
    return { start: startOf(start, zone), tasks: done.length, xp: sum(done) }
  })
  const sinceMonday = (dayOf(time, zone) - monday) / DAY
  return { weeks, calendar: streakOf(approved, tasks, time, 21 + sinceMonday + 1, restSet(rest), zone).week }
}

/**
 * The figures the stickers are measured by, for these approvals out of all of the child's tasks
 * (the other tasks decide which days were missed). quests is how many weekly quests are done.
 */
const recordFor = (approved, tasks, time, rest, quests, zone) => ({
  approved: approved.length,
  level: levelOf(sum(approved)).level,
  streak: streakOf(approved, tasks, time, 7, rest, zone).best,
  kinds: new Set(approved.map((t) => t.category)).size,
  firstTry: approved.filter((t) => t.proofs.length === 1).length,
  quests,
})

/** The record the stickers are measured by, for the tasks as they stand. streak is the best one. zone: see dayKey. */
export const recordOf = (tasks, time, { rest = [], quests = 0, zone } = {}) =>
  recordFor(approvedOf(tasks), tasks, time, restSet(rest), quests, zone)

/**
 * Every sticker, and for an earned one the approval that earned it: when, and for which task.
 * The approvals are gone through in order, so each sticker is dated by the first approval after
 * which its condition held. questAwards are the quests the child has completed, each with the
 * time it was earned; one counts from the approval at that time on.
 */
export function stickers(tasks, { rest = [], questAwards = [], zone } = {}) {
  const approved = approvedOf(tasks)
  const restDays = restSet(rest)
  const awards = {}
  approved.forEach((task, i) => {
    const quests = questAwards.filter((award) => award.earnedAt <= approvedAt(task)).length
    const record = recordFor(approved.slice(0, i + 1), tasks, approvedAt(task), restDays, quests, zone)
    for (const sticker of STICKERS) {
      if (!awards[sticker.id] && record[sticker.measure] >= sticker.need) {
        awards[sticker.id] = { earnedAt: approvedAt(task), taskId: task.id, taskTitle: task.title }
      }
    }
  })
  return STICKERS.map((sticker) => ({ ...sticker, ...awards[sticker.id] }))
}

/** How many tasks were approved in a week (a weekKey), counted by the week the proof was sent in. */
export const approvedInWeek = (tasks, week, zone) =>
  tasks.filter((task) => task.status === 'approved' && weekKey(task.proofs.at(-1).sentAt, zone) === week).length

/**
 * This week's quest for a child (rule 19), or null when a parent has set none. def is what the
 * parent set, awardsByWeek the quests the child has completed by their week. A quest that was
 * completed stays completed for its week, whatever the parent changes afterwards. The surprise
 * is returned as written: the stand-in decides who may read it.
 */
export function questOf(tasks, def, awardsByWeek, time, zone) {
  if (!def) return null
  const week = weekKey(time, zone)
  return {
    week,
    target: def.target,
    bonus: def.bonus,
    done: Math.min(def.target, approvedInWeek(tasks, week, zone)),
    completed: Boolean(awardsByWeek?.[week]),
    surprise: def.surprise,
  }
}

/**
 * The week a quest was completed in by this approval, or null. tasks already includes task as
 * approved. The week is the one its proof was sent in (rule 14), so a proof sent on Sunday and
 * approved on Monday completes last week's quest. A week is completed once: it needs no award yet.
 */
export function questCompletedBy(tasks, def, awardsByWeek, task, zone) {
  const week = weekKey(task.proofs.at(-1).sentAt, zone)
  return def && !awardsByWeek?.[week] && approvedInWeek(tasks, week, zone) >= def.target ? week : null
}

/**
 * What a child can spend (rule 17): every point earned, plus the bonus of every quest completed,
 * less the cost of every request still waiting or already given. Declined requests cost nothing.
 */
export const balanceOf = (points, questAwards, requests) =>
  points
  + questAwards.reduce((total, award) => total + award.bonus, 0)
  - requests.filter((r) => r.status === 'requested' || r.status === 'given').reduce((total, r) => total + r.cost, 0)
