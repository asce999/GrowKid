import { now } from '../api/clock.js'
import { addDays, dayKeyOf, weekdayOf } from './format.js'

/** The word each status is shown as. A proof the parent did not accept is "Sent back", never "Rejected". */
export const STATUS_WORDS = {
  todo: 'To do',
  overdue: 'Overdue',
  review: 'In review',
  sentBack: 'Sent back',
  approved: 'Approved',
  dueSoon: 'Due soon',
}

/** What a task shows as. "Overdue" is not stored: it is a To do task whose due time has passed. */
export const statusOf = (task) =>
  task.status === 'todo' && task.dueAt && new Date(task.dueAt) < now() ? 'overdue' : task.status

/** A task takes proof while it is still to do, or after a parent sent it back. */
export const isOpen = (task) => task.status === 'todo' || task.status === 'sentBack'

/**
 * The child's next task. The task the child chose comes first, for as long as it is open (rule
 * 22). Otherwise something a parent sent back comes first, because fixing it is the next step.
 * Otherwise it is the task still to do that is due soonest, so an overdue task is always next.
 * The API returns tasks soonest due first. This is the only place that decides it.
 */
export const nextTask = (tasks) =>
  tasks.find((task) => task.pinned && isOpen(task)) ??
  tasks.find((task) => task.status === 'sentBack') ??
  tasks.find((task) => task.status === 'todo')

/** The parent's answer to the newest proof, if it has one. */
export const lastReview = (task) => task.proofs.at(-1)?.review

/** Due between this Monday and next, or older and still open: what Overview calls "this week". Days in the family's zone (P13). */
export function inThisWeek(task) {
  const today = dayKeyOf(now())
  const monday = addDays(today, -weekdayOf(today))
  const due = dayKeyOf(task.dueAt)
  return due < addDays(monday, 7) && (due >= monday || isOpen(task))
}

/** H13: due between this Monday and next, whatever its status, in the family's zone: what the quest form counts. */
export function dueThisWeek(task) {
  const today = dayKeyOf(now())
  const monday = addDays(today, -weekdayOf(today))
  const due = dayKeyOf(task.dueAt)
  return due >= monday && due < addDays(monday, 7)
}

/**
 * Rule 24, the streak reminder, worded as fact: only when a task is due today and still open, no proof has been sent today, and
 * today is not a rest day. Days in the family's zone (P13). streak is growth's, whose last day mark is today.
 */
export function remindsStreak(tasks, streak, time) {
  const today = dayKeyOf(time)
  const dueToday = tasks.some((t) => isOpen(t) && dayKeyOf(t.dueAt) === today)
  const sentToday = tasks.some((t) => t.proofs.some((p) => dayKeyOf(p.sentAt) === today))
  return dueToday && !sentToday && streak.week.at(-1).state !== 'rest'
}

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
/** H1: a series' days in words: "Repeats every day", or "Repeats Mon, Wed". weekdays is 7 bits, Monday = 1. */
export const repeatText = (weekdays) =>
  weekdays === 127 ? 'Repeats every day' : `Repeats ${WEEKDAY.filter((_, i) => weekdays & (1 << i)).join(', ')}`
