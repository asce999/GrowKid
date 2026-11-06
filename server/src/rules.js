import { now } from './clock.js'
import { invalid, refuse, text } from './errors.js'
import { STICKERS, approvedInWeek, balanceOf, dayKey, progress, questOf, recordOf, score, weekKey } from './scoring.js'

/** The rules a handler checks by value, ported from the stand-in removed in B4. The award rules are in scoring.js. */

// Rule 5, proof files: one photo, video or PDF of up to 25 MB, or a note with no file. The seven types are files.js's sniff table.
export const MAX_FILE_BYTES = 25 * 1024 * 1024
const CATEGORIES = ['chores', 'study', 'reading', 'creative', 'outdoors', 'health']
// Rule 20, cheers: the six kinds a parent can approve with.
export const CHEER_KINDS = ['proud', 'tidy', 'brave', 'clever', 'kind', 'effort']
/** The statuses in which a task takes proof (rule 2). */
export const OPEN = ['todo', 'sentBack']
// Rule 8 (A8): the stand-in's three words, until the user supplies more.
const BLOCKED_WORDS = ['secret', 'dare', "don't tell"]

/** Rule 8: SCREENED, naming the word, when the text uses a blocked word. A typographic apostrophe counts as a plain one. */
export function screen(words) {
  const lower = words.toLowerCase().replaceAll('’', "'")
  const word = BLOCKED_WORDS.find((w) => new RegExp(String.raw`\b${w}\b`).test(lower))
  if (word) refuse('SCREENED', { word })
}

/**
 * Rules 2 and 8 for what a parent types: INVALID with every wrong field, then SCREENED. The caller has already found the child.
 * before is the due time an edited task has now: the due time must lie in the future when the task is new or the time moved
 * (compared by the minute, as the form works in minutes). Returns the values to store.
 */
export function checkTask(body, before) {
  const category = text(body.category)
  const title = text(body.title).trim()
  const instructions = text(body.instructions)
  const dueAt = new Date(text(body.dueAt))
  const { points } = body
  const valid = !Number.isNaN(dueAt.getTime())
  const moved = !before || (valid && dueAt.toISOString().slice(0, 16) !== before.toISOString().slice(0, 16))
  invalid({
    category: !CATEGORIES.includes(category) && 'required',
    title: (title.length < 3 || title.length > 80) && 'length',
    instructions: (!instructions.trim() || instructions.length > 500) && 'length',
    dueAt: (!valid || (moved && dueAt <= now())) && 'past',
    points: !(Number.isInteger(points) && points >= 5 && points <= 100 && points % 5 === 0) && 'range',
  })
  screen(`${title} ${instructions}`)
  return { category, title, instructions: instructions.trim(), dueAt, points }
}

// ------------------------------------------------------------------ the engagement rules (17 to 24), ported from the stand-in removed in B4
// Pure functions over the snapshot loadChild gives (plan section 7), with the time passed in. Every day question uses
// snapshot.zone, the family's zone (rule 25), never the server's own.

/** The day this many days from today (negative for the past) in the zone, as 'YYYY-MM-DD'. Calendar arithmetic, so no clock change can skip a day. */
export function dayKeyIn(days, time, zone) {
  const [y, m, d] = dayKey(time, zone).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Whether text names a real calendar day: the pattern alone lets 2026-02-31 through. */
export function isDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === day
}

/** The rest days a parent can still change: from 7 days ago onward (rule 21). Earlier ones stay, and still count. Needs { rest, zone }. */
export const recentRest = ({ rest, zone }, time) => rest.filter((day) => day >= dayKeyIn(-7, time, zone))

/** Whether the child has seen the approval an award came with on Today (rule 13). An award with no task is seen. */
const awardSeen = ({ tasks }, award) => tasks.find((t) => t.id === award.taskId)?.resultSeen ?? true
/** A task as the child has been shown it: an approval they have not yet seen on Today still waits. */
const notShown = (t) => (t.status === 'approved' && !t.resultSeen ? { ...t, status: 'review' } : t)

/**
 * A child's score by the award rules (rules 3, 13, 17, 19), and beside it the score as the child has been shown it: an approval not
 * yet seen on Today still counts as waiting there, and so does a quest completed with it. balance is what the child can spend; the
 * child's own, in shown, is what a request is checked against. A quest carries its surprise and whether it is sealed for a parent,
 * who always reads it; growthForChild takes it back for the child.
 */
export function growthOf(snapshot, time) {
  const { zone, tasks, rest, quest: def, questAwards: awards, requests } = snapshot
  const byWeek = Object.fromEntries(awards.map((a) => [a.week, a]))
  const sealed = (quest) => quest && { ...quest, sealed: Boolean(quest.surprise) && !quest.completed }
  const current = score(tasks, time, rest, zone)
  current.balance = balanceOf(current.points, awards, requests)
  current.quest = sealed(questOf(tasks, def, byWeek, time, zone))
  const shownTasks = tasks.map(notShown)
  const seenAwards = awards.filter((a) => awardSeen(snapshot, a))
  const shownScore = score(shownTasks, time, rest, zone)
  const shown = {
    ...shownScore,
    // what is waiting for a parent is the same either way: an approval not yet seen is not waiting for one
    waitingXp: current.waitingXp,
    balance: balanceOf(shownScore.points, seenAwards, requests),
    quest: sealed(questOf(shownTasks, def, Object.fromEntries(seenAwards.map((a) => [a.week, a])), time, zone)),
  }
  const questAwards = awards.map(({ week, target, bonus, surprise, earnedAt, taskId, taskTitle }) => ({
    week, target, bonus, surprise, earnedAt, taskId, taskTitle, seen: awardSeen(snapshot, { taskId }),
  }))
  return { ...current, questAwards, shown }
}

/**
 * A quest as a child may read it (rule 19). The surprise stays sealed until the week's quest is complete and they have seen it.
 * After that it reads as the award does: a parent who changes the quest later in the week is setting up a later week, so nothing
 * of the change opens early.
 */
function questForChild(quest, award) {
  if (!quest) return quest
  if (!award) return { ...quest, surprise: null, sealed: Boolean(quest.surprise) }
  const { target, bonus, surprise } = award
  return { ...quest, target, bonus, done: target, surprise, sealed: false }
}

/** Growth as a child is given it. */
export function growthForChild(snapshot, time) {
  const growth = growthOf(snapshot, time)
  const { completed, week } = growth.shown.quest ?? {} // shown only counts the quests the child has seen
  const award = completed ? growth.questAwards.find((a) => a.week === week) : undefined
  return { ...growth, quest: questForChild(growth.quest, award), shown: { ...growth.shown, quest: questForChild(growth.shown.quest, award) } }
}

/** The sticker chart for the child (rule 13): earned and seen ones in full, the rest with how far along they are. */
export function stickerList(snapshot, time) {
  const { zone, tasks, rest, questAwards, awards } = snapshot
  const seenAwards = questAwards.filter((a) => awardSeen(snapshot, a))
  const record = recordOf(tasks.map(notShown), time, { rest, quests: seenAwards.length, zone })
  return STICKERS.map((s) => {
    const award = awards[s.id]
    const seen = award && awardSeen(snapshot, award)
    const sticker = award ? { ...s, ...award, seen } : s
    // a sticker not yet earned, or not yet seen, shows how far along it is
    return seen ? sticker : { ...sticker, have: Math.min(s.need, record[s.measure]) }
  })
}

/** One child's progress for their parent (rule 14): the real score, the weeks, the calendar, the counts and the stickers. */
export function progressOf({ zone, tasks, rest, awards }, child, time) {
  const open = tasks.filter((t) => OPEN.includes(t.status))
  return {
    child,
    ...score(tasks, time, rest, zone),
    ...progress(tasks, time, rest, zone),
    counts: {
      approved: tasks.filter((t) => t.status === 'approved').length,
      waiting: tasks.filter((t) => t.status === 'review').length,
      open: open.length,
      overdue: open.filter((t) => t.status === 'todo' && new Date(t.dueAt) < time).length,
    },
    stickers: STICKERS.map((s) => ({ ...s, ...awards[s.id] })),
  }
}

/**
 * The leaderboard (rule 23): entries are { child: { id, name }, snapshot } for every sibling. Only approvals each
 * child has been shown count (rule 13), so no one learns of a sibling's result before they do. The week is the family's.
 */
export const leaderboardOf = (entries, meId, time) =>
  entries
    .map(({ child, snapshot: { zone, tasks } }) => ({
      name: child.name, tasks: approvedInWeek(tasks.map(notShown), weekKey(time, zone), zone), you: child.id === meId,
    }))
    .sort((a, b) => b.tasks - a.tasks || a.name.localeCompare(b.name))

/**
 * Rule 19, setQuest: INVALID with every wrong field, then SCREENED. A quest already reached this week would show as
 * full and never pay, because a quest completes on an approval. Returns the quest to store.
 */
export function checkQuest(def, { zone, tasks, questAwards }, time) {
  const { target, bonus } = def
  const said = def.surprise ?? ''
  const surprise = text(said).trim() || null // an empty surprise means none
  const week = weekKey(time, zone)
  const passed = !questAwards.some((a) => a.week === week) && target <= approvedInWeek(tasks, week, zone)
  invalid({
    target: (!(Number.isInteger(target) && target >= 2 && target <= 20) && 'range') || (passed && 'done'),
    bonus: !(Number.isInteger(bonus) && bonus >= 10 && bonus <= 200 && bonus % 5 === 0) && 'range',
    surprise: (typeof said !== 'string' || (surprise ?? '').length > 80) && 'length',
  })
  if (surprise) screen(surprise)
  return { target, bonus, surprise }
}
