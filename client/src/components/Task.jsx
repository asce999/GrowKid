import { Link } from 'react-router-dom'
import { ChevronRight, Clock, Star } from 'lucide-react'
import { now } from '../api/index.js'
import { categoryOf } from '../utils/categories.js'
import { whenText } from '../utils/format.js'
import { lastReview, statusOf } from '../utils/tasks.js'
import { Note } from './Review.jsx'
import { EmptyState } from './states.jsx'
import StatusTag from './StatusTag.jsx'

// How a task is shown: plain words, never themed (DESIGN.md section 10).

/** A task is always for one child, so with no children there is nothing to set yet. */
export function AddChildFirst() {
  return (
    <EmptyState
      title="Add a child first"
      action={
        <Link to="/parent/family/new" className="btn btn-primary">
          Add a child
        </Link>
      }
    >
      A task is always set for one child, so there has to be a child to set it for.
    </EmptyState>
  )
}

/**
 * The one piece of flavour on a task: its category's icon on a tile. The icon says what kind
 * of task it is; the tile's colour says where the task stands, in the status tag's own roles.
 */
export function CategoryTile({ task, small = false }) {
  const category = categoryOf(task.category)
  if (!category) return null
  return (
    <span className={`category-tile category-${statusOf(task)} ${small ? 'size-10' : 'size-12'}`}>
      <category.Icon className={small ? 'size-5' : 'size-6'} aria-hidden="true" />
      <span className="sr-only">{category.name}</span>
    </span>
  )
}

/** What a task is worth: the gold star and an ink number. short leaves the word to screen readers. */
export function Points({ value, short = false }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap tabular-nums">
      <Star className="icon-earned size-5 shrink-0" aria-hidden="true" />
      {value}
      <span className={short ? 'sr-only' : ''}>points</span>
    </span>
  )
}

/** When a task is due, in day words and clock time. Never a countdown. */
export function Due({ task, className = '' }) {
  const passed = task.status !== 'approved' && new Date(task.dueAt) < now()
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Clock className="size-4 shrink-0" aria-hidden="true" />
      {task.dueAt ? (
        <span>
          {passed ? 'Was due' : 'Due'} <time dateTime={task.dueAt}>{whenText(task.dueAt)}</time>
        </span>
      ) : (
        'No due time yet'
      )}
    </span>
  )
}

/**
 * The child's task card. Today leads with it and the parent's task form previews it.
 * A task that was sent back shows the parent's note where the instructions were, because the
 * note is now what to do. children is the card's one action.
 */
export function TaskCard({ task, children }) {
  const review = task.status === 'sentBack' && lastReview(task)
  return (
    <article className="card task-card type-body-child">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <CategoryTile task={task} />
        <StatusTag status={statusOf(task)} />
        <span className="ml-auto">
          <Points value={task.points} />
        </span>
      </div>
      <h3 className="type-subheading mt-4 break-words">{task.title}</h3>
      {review ? (
        <Note review={review} brief className="mt-3" />
      ) : (
        <p className="muted mt-1 line-clamp-3 break-words whitespace-pre-line">{task.instructions}</p>
      )}
      <p className="type-small mt-4 font-medium">
        <Due task={task} />
      </p>
      {children}
    </article>
  )
}

/**
 * A task as one row of a list: title, then status and due time. who names the child, for a
 * parent; more is one more quiet line ("Repeats Mon, Wed"). action is one control that sits beside the link, not inside it (a link
 * cannot hold a button).
 */
export function TaskRow({ task, to, who, more, action }) {
  return (
    <li className="flex flex-wrap items-center border-b last:border-b-0 sm:flex-nowrap">
      {/* on a phone the action takes its own line, so the title keeps its width */}
      <Link to={to} className="task-row min-w-0 flex-1 max-sm:basis-full">
        <CategoryTile task={task} small />
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="line-clamp-2 font-medium break-words">{task.title}</span>
          <span className="type-small flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusTag status={statusOf(task)} />
            <Due task={task} className="muted" />
          </span>
          {who && (
            <span className="type-small muted">
              For {who}
              {task.pinned && ', who chose it to do next'}
            </span>
          )}
          {more && <span className="type-small muted">{more}</span>}
        </span>
        <Points value={task.points} short />
        <ChevronRight className="size-5 shrink-0 text-navy-600 max-sm:hidden" aria-hidden="true" />
      </Link>
      {action && <div className="ml-auto shrink-0 pr-2 sm:pr-4">{action}</div>}
    </li>
  )
}
