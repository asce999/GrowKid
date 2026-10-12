import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import * as api from '../api/index.js'
import { EmptyState, ErrorState, Message, PageLoading } from '../components/states.jsx'
import { CategoryTile, TaskRow } from '../components/Task.jsx'
import { useLoad } from '../hooks/useLoad.js'
import { useOnce } from '../hooks/useOnce.js'
import { initialOf, whenText } from '../utils/format.js'
import { inThisWeek } from '../utils/tasks.js'

// The parent's home. It opens on what needs the parent now: proofs waiting, oldest first. Then
// the week's tasks, then each child's progress in a line. Not a dashboard: nothing here is a
// number for its own sake, and every figure comes from the tasks themselves.

const sentAt = (task) => task.proofs.at(-1).sentAt

export default function Overview() {
  const loaded = useLoad(
    async () => {
      const [family, tasks, growth] = await Promise.all([api.listChildren(), api.listTasks(), api.listGrowth()])
      return { family, tasks, growth }
    },
    [],
    { live: true },
  )
  const [note] = useOnce()

  if (loaded.status === 'loading') return <PageLoading rows={3} />
  if (loaded.status === 'error') return <ErrorState error={loaded.error} onRetry={loaded.reload} />
  const { family, tasks, growth } = loaded.data
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
            {waiting.length > 0 && (
              <ul className="mt-4 overflow-hidden rounded-card border bg-white">
                {waiting.map((task) => (
                  <li key={task.id} className="border-b last:border-b-0">
                    <Link to={`/parent/tasks/${task.id}`} className="task-row">
                      <CategoryTile task={task} small />
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="line-clamp-2 font-medium break-words">{task.title}</span>
                        <span className="type-small muted">
                          {task.childName} sent proof <time dateTime={sentAt(task)}>{whenText(sentAt(task))}</time>
                          {task.proofs.at(-1).late && ', after the task was due'}
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
