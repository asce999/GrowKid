import { now } from '../api/clock.js'

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
 * The child's next task. Something a parent sent back comes first, because fixing it is the
 * next step. Otherwise it is the task still to do that is due soonest, so an overdue task is
 * always next. The API returns tasks soonest due first. This is the only place that decides it.
 */
export const nextTask = (tasks) =>
  tasks.find((task) => task.status === 'sentBack') ?? tasks.find((task) => task.status === 'todo')

/** The parent's answer to the newest proof, if it has one. */
export const lastReview = (task) => task.proofs.at(-1)?.review

/** Due between this Monday and next, or older and still open: what Overview calls "this week". */
export function inThisWeek(task) {
  const today = now()
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7))
  const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7)
  const due = new Date(task.dueAt)
  return due < nextMonday && (due >= monday || isOpen(task))
}
