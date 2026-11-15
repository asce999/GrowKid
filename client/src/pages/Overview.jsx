import { Link } from 'react-router-dom'
import { ChevronRight, Circle, CircleCheck } from 'lucide-react'
import * as api from '../api/index.js'
import { EmptyState, ErrorState, Message, PageLoading } from '../components/states.jsx'
import { CategoryTile, TaskRow } from '../components/Task.jsx'
import { useLoad } from '../hooks/useLoad.js'
import { useOnce } from '../hooks/useOnce.js'
import { addDays, dayKeyOf, daysBetween, initialOf, weekdayOf, whenText } from '../utils/format.js'
import { inThisWeek } from '../utils/tasks.js'

// The parent's home. It opens on what needs the parent now: proofs waiting, oldest first, and a
// link when reward requests are waiting too. Then the week's tasks, then each child's progress in a line. Not a dashboard: nothing here is a
// number for its own sake, and every figure comes from the tasks themselves.

const sentAt = (task) => task.proofs.at(-1).sentAt
const DAY = 86_400_000

/** H9: the first three steps, each ticked from what the parent has already done; gone once all three are. Nothing is stored. */
function FirstSteps({ family, tasks, rewards }) {
  const steps = [
    ['Add a child', family.length > 0, '/parent/family/new'],
    ['Set a first task', tasks.length > 0, '/parent/tasks/new'],
    ['Add a first reward', rewards.length > 0, '/parent/rewards'],
  ]
  if (steps.every(([, done]) => done)) return null
  return (
    <section className="mt-6 rounded-card border bg-white p-4 sm:p-6" aria-labelledby="first-steps">
      <h2 id="first-steps" className="type-subheading">
        Getting started
      </h2>
      <ol className="mt-3 grid gap-2">
        {steps.map(([what, done, to]) => (
          <li key={what} className="flex items-center gap-3">
            {done ? <CircleCheck className="size-5 shrink-0 text-sprout-800" aria-hidden="true" /> : <Circle className="size-5 shrink-0 text-navy-600" aria-hidden="true" />}
            {done ? (
              <span>
                {what} <span className="type-small muted">(done)</span>
              </span>
            ) : (
              <Link to={to} className="inline-flex min-h-11 items-center font-medium text-navy-800 underline underline-offset-4">
                {what}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

/** H10: Monday to Wednesday, last week for each child: tasks approved out of tasks due, and the streak. The child sees the same record. */
function LastWeek({ family, tasks, growth }) {
  const today = dayKeyOf(api.now())
  if (weekdayOf(today) > 2) return null
  const monday = addDays(today, -weekdayOf(today))
  const lastMonday = addDays(monday, -7)
  return (
    <section className="mt-6 rounded-card border bg-white p-4 sm:p-6" aria-labelledby="last-week">
      <h2 id="last-week" className="type-subheading">
        Last week
      </h2>
      <ul className="mt-2 grid gap-1">
        {family.map((child) => {
          const due = tasks.filter((t) => t.childId === child.id && dayKeyOf(t.dueAt) >= lastMonday && dayKeyOf(t.dueAt) < monday)
          const days = growth[child.id]?.streak?.days ?? 0
          return (
            <li key={child.id}>
              <span className="font-medium">{child.name}</span>: {due.filter((t) => t.status === 'approved').length} of {due.length}{' '}
              {due.length === 1 ? 'task' : 'tasks'} approved, and a streak of {days} {days === 1 ? 'day' : 'days'}.
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function Overview() {
  const loaded = useLoad(
    async () => {
      const [family, tasks, growth, rewards, asked] = await Promise.all([api.listChildren(), api.listTasks(), api.listGrowth(), api.listRewards(), api.listRequests()])
      return { family, tasks, growth, rewards, asked, requests: asked.filter((r) => r.status === 'requested').length }
    },
    [],
    { live: true },
  )
  const [note] = useOnce()

  if (loaded.status === 'loading') return <PageLoading rows={3} />
  if (loaded.status === 'error') return <ErrorState error={loaded.error} onRetry={loaded.reload} />
  const { family, tasks, growth, rewards, asked, requests } = loaded.data
  const longWaiting = asked.filter((r) => r.status === 'requested' && api.now() - new Date(r.requestedAt) > 2 * DAY) // H11
  const waiting = tasks.filter((task) => task.status === 'review').sort((a, b) => sentAt(a).localeCompare(sentAt(b)))
  const week = tasks.filter((task) => task.status !== 'review' && inThisWeek(task))

  return (
    <>
      <title>Overview – GrowKid</title>
      <h1>Overview</h1>

      {note?.approved && (
        <Message tone="success" className="mt-4">
          Approved. {note.approved.child} earned {note.approved.points} points for “{note.approved.title}”.
        </Message>
      )}
      {note?.sentBack && (
        <Message tone="success" className="mt-4">
          “{note.sentBack.title}” went back to {note.sentBack.child} with your note. They see it on Today.
        </Message>
      )}
      {longWaiting.map((r) => (
        <Message key={r.id} className="mt-4">
          {r.childName} asked for “{r.title}” {daysBetween(dayKeyOf(r.requestedAt), dayKeyOf(api.now()))} days ago.{' '}
          <Link to="/parent/rewards" className="font-medium text-navy-800 underline underline-offset-4">
            Answer it
          </Link>
        </Message>
      ))}
      <FirstSteps family={family} tasks={tasks} rewards={rewards} />
      {family.length > 0 && tasks.length > 0 && <LastWeek family={family} tasks={tasks} growth={growth} />}

      {family.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No children yet"
            action={
              <Link to="/parent/family/new" className="btn btn-primary">
                Add a child
              </Link>
            }
          >
            Add a child to start setting tasks. You choose the username and password they sign in with.
          </EmptyState>
        </div>
      ) : tasks.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No tasks yet"
            action={
              <Link to="/parent/tasks/new" className="btn btn-primary">
                Create the first task
              </Link>
            }
          >
            Set a task with a due time and points. When proof comes in, it waits for you here.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-2 grid items-start gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <p className="muted">
              {waiting.length === 0
                ? 'Nothing is waiting for review.'
                : waiting.length === 1
                  ? '1 proof is waiting for review.'
                  : `${waiting.length} proofs are waiting for review.`}
            </p>
            {requests > 0 && (
              <p className="mt-2">
                <Link to="/parent/rewards" className="font-medium text-navy-800 underline underline-offset-4">
                  {requests === 1 ? '1 reward request is waiting.' : `${requests} reward requests are waiting.`}
                </Link>
              </p>
            )}
            {waiting.length > 0 && (
              <ul className="mt-4 overflow-hidden rounded-card border bg-white">
                {waiting.map((task) => (
                  <li key={task.id} className="border-b last:border-b-0">
                    <Link to={`/parent/tasks/${task.id}`} className="task-row">
                      <CategoryTile task={task} small />
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="line-clamp-2 font-medium break-words">{task.title}</span>
                        <span className="type-small muted">
                          {/* H8: how long it has waited */}
                          From {task.childName}. Waiting since <time dateTime={sentAt(task)}>{whenText(sentAt(task))}</time>
                          {task.proofs.at(-1).late && ', sent after the task was due'}
                        </span>
                      </span>
                      <span className="font-semibold text-navy-800 underline underline-offset-4">Review</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <h2 className="type-subheading mt-10">This week</h2>
            {week.length === 0 ? (
              <p className="muted mt-1">
                Nothing else is due this week.{' '}
                <Link to="/parent/tasks/new" className="font-medium text-navy-800 underline underline-offset-4">
                  Create a task
                </Link>
              </p>
            ) : (
              family.map((child) => {
                const theirs = week.filter((task) => task.childId === child.id)
                return (
                  theirs.length > 0 && (
                    <section key={child.id} className="mt-3">
                      {family.length > 1 && <h3 className="type-small muted font-medium">{child.name}</h3>}
                      <ul className="mt-2 overflow-hidden rounded-card border bg-white">
                        {theirs.map((task) => (
                          <TaskRow key={task.id} task={task} to={`/parent/tasks/${task.id}`} />
                        ))}
                      </ul>
                    </section>
                  )
                )
              })
            )}
          </div>

          <section aria-labelledby="progress-title">
            <h2 id="progress-title" className="type-subheading">
              Progress
            </h2>
            <ul className="mt-3 overflow-hidden rounded-card border bg-white">
              {family.map((child) => (
                <li key={child.id} className="border-b last:border-b-0">
                  <Link to={`/parent/progress/${child.id}`} className="task-row">
                    <span className="avatar" aria-hidden="true">
                      {initialOf(child.name)}
                    </span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="truncate font-medium">{child.name}</span>
                      {growth[child.id] && (
                        <span className="type-small muted tabular-nums">
                          Level {growth[child.id].level}, {growth[child.id].xp} of {growth[child.id].xpForNext} XP
                          {growth[child.id].waitingXp > 0 && `, ${growth[child.id].waitingXp} XP waiting for you`}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-navy-600" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  )
}
