import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, SlidersHorizontal } from 'lucide-react'
import * as api from '../api/index.js'
import StatusTag from '../components/StatusTag.jsx'
import { EmptyState, ErrorState, Message, PageLoading } from '../components/states.jsx'
import { AddChildFirst, CategoryTile, Due, Points, TaskRow } from '../components/Task.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { useOnce } from '../hooks/useOnce.js'
import { CATEGORIES } from '../utils/categories.js'
import { errorText } from '../utils/messages.js'
import { STATUS_WORDS, repeatText, statusOf } from '../utils/tasks.js'
import { focusLater, busyProps } from '../utils/forms.js'

// Every task in the family, soonest due first: a table on wide screens, stacked rows on a phone.
// The filters live in the address, so a filtered list can be reloaded, shared and gone back to.
// A phone has one filter control, which opens them; a wider screen shows them all.

const PAGE = 50
const STATUSES = ['todo', 'dueSoon', 'overdue', 'review', 'sentBack', 'approved'] // the ones a task can be in today
const cell = 'px-6 py-3 text-left align-middle'

function Filter({ label, value, onChange, children }) {
  return (
    <label className="grid gap-1 sm:w-44">
      <span className="type-small font-medium">{label}</span>
      <select className="field" value={value} onChange={onChange}>
        {children}
      </select>
    </label>
  )
}

export default function Tasks() {
  const loaded = useLoad(() => Promise.all([api.listTasks(), api.listChildren(), api.listSeries()]), [], { live: true }) // P6: live, like Overview
  // P8: 50 rows at a time; past the window (P2), older approved tasks come from the history, a page at a time
  const [limit, setLimit] = useState(PAGE)
  const [older, setOlder] = useState({ pages: [], busy: false, problem: null })
  const [filters, setFilters] = useSearchParams()
  const [note] = useOnce()
  const [open, setOpen] = useState(false)

  const child = filters.get('child') ?? ''
  const status = filters.get('status') ?? ''
  const category = filters.get('category') ?? ''
  const filtersOn = [child, status, category].filter(Boolean).length
  const setFilter = (name) => (event) =>
    setFilters(
      (now) => {
        const next = new URLSearchParams(now)
        if (event.target.value) next.set(name, event.target.value)
        else next.delete(name)
        return next
      },
      { replace: true },
    )

  const [windowed, family, series] = loaded.data ?? [[], [], []]
  const repeats = (task) => { const s = series.find((one) => one.id === task.seriesId); return s ? repeatText(s.weekdays) : null } // H1
  const tasks = [...windowed, ...older.pages.flat()].filter((task, i, all) => all.findIndex((t) => t.id === task.id) === i)
  const historyDone = older.pages.length > 0 && older.pages.at(-1).length < api.HISTORY_PAGE
  const shown = tasks.filter(
    (task) =>
      (!child || task.childId === child) &&
      (!status || statusOf(task) === status || (status === 'todo' && statusOf(task) === 'dueSoon')) &&
      (!category || task.category === category),
  )
  const several = family.length > 1
  const rows = shown.slice(0, limit)
  async function showMore() {
    if (shown.length > limit) return setLimit(limit + PAGE)
    setOlder((o) => ({ ...o, busy: true, problem: null }))
    try {
      const page = await api.listHistory(older.pages.flat().length)
      setOlder((o) => ({ pages: [...o.pages, page], busy: false, problem: null }))
      setLimit(limit + PAGE)
    } catch (error) {
      setOlder((o) => ({ ...o, busy: false, problem: errorText(noticeExpiry(error)) }))
    }
  }
  const createLink = `/parent/tasks/new${child ? `?child=${child}` : ''}`

  return (
    <>
      <title>Tasks – GrowKid</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Tasks</h1>
        {tasks.length > 0 && (
          <Link to={createLink} className="btn btn-primary">
            <Plus className="size-5 shrink-0" aria-hidden="true" />
            Create task
          </Link>
        )}
      </div>

      {note?.created && (
        <Message ref={focusLater} tabIndex={-1} tone="success" role="status" className="mt-4">
          {note.created.repeats
            ? `“${note.created.title}” is set up. ${note.created.repeats}: ${note.created.childName} sees each day’s task on Today.`
            : `“${note.created.title}” was created. ${note.created.childName} will see it on Today.`}
        </Message>
      )}
      {note?.deleted && (
        <Message ref={focusLater} tabIndex={-1} tone="success" role="status" className="mt-4">
          “{note.deleted}” was deleted.
        </Message>
      )}

      <div className="mt-6">
        {loaded.status === 'loading' && <PageLoading rows={4} />}
        {loaded.status === 'error' && <ErrorState error={loaded.error} onRetry={loaded.reload} />}
        {loaded.status === 'ready' && family.length === 0 && <AddChildFirst />}
        {loaded.status === 'ready' && family.length > 0 && tasks.length === 0 && (
          <EmptyState
            title="No tasks yet"
            action={
              <Link to={createLink} className="btn btn-primary">
                Create the first task
              </Link>
            }
          >
            Set a task with a due time and points. {several ? 'Your child' : family[0].name} sees it on Today and sends
            proof when it is done.
          </EmptyState>
        )}
        {tasks.length > 0 && (
          <>
            <button
              type="button"
              className="btn btn-secondary sm:hidden"
              aria-expanded={open}
              aria-controls="task-filters"
              onClick={() => setOpen(!open)}
            >
              <SlidersHorizontal className="size-5 shrink-0" aria-hidden="true" />
              {filtersOn === 0 ? 'Filter' : `Filter (${filtersOn} on)`}
            </button>
            <div id="task-filters" className={`gap-3 max-sm:mt-3 sm:flex ${open ? 'grid' : 'hidden'}`}>
              {several && (
                <Filter label="Child" value={child} onChange={setFilter('child')}>
                  <option value="">All children</option>
                  {family.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Filter>
              )}
              <Filter label="Status" value={status} onChange={setFilter('status')}>
                <option value="">Any status</option>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_WORDS[value]}
                  </option>
                ))}
              </Filter>
              <Filter label="Category" value={category} onChange={setFilter('category')}>
                <option value="">Any category</option>
                {CATEGORIES.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Filter>
            </div>
            <p className="type-small muted mt-3" role="status">
              {rows.length === tasks.length ? `${tasks.length} in all` : `${rows.length} of ${tasks.length} shown`}
              {!historyDone && ', and older approved tasks below'}
            </p>

            {shown.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title="No tasks match"
                  action={
                    <button type="button" className="btn btn-secondary" onClick={() => {
                      flushSync(() => setFilters({}, { replace: true }))
                      document.getElementById('task-list')?.focus() // Phase 7: the list the filters were hiding
                    }}>
                      Clear the filters
                    </button>
                  }
                >
                  Nothing fits these filters. Clear them to see every task.
                </EmptyState>
              </div>
            ) : (
              <div id="task-list" tabIndex={-1} aria-label="Tasks" className="mt-3 overflow-hidden rounded-card border bg-white">
                <table className="hidden w-full sm:table">
                  <caption className="sr-only">Tasks, soonest due first</caption>
                  <thead>
                    <tr className="type-small muted border-b">
                      <th scope="col" className={`${cell} font-medium`}>
                        Task
                      </th>
                      {several && (
                        <th scope="col" className={`${cell} font-medium`}>
                          Child
                        </th>
                      )}
                      <th scope="col" className={`${cell} font-medium`}>
                        Due
                      </th>
                      <th scope="col" className={`${cell} font-medium`}>
                        Points
                      </th>
                      <th scope="col" className={`${cell} font-medium`}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((task) => (
                      <tr key={task.id} className="border-b last:border-b-0">
                        <td className={`${cell} break-words`}>
                          <span className="flex items-center gap-3">
                            <CategoryTile task={task} small />
                            <span className="grid">
                              <Link to={`/parent/tasks/${task.id}`} className="font-medium text-navy-800 underline underline-offset-4">
                                {task.title}
                              </Link>
                              {repeats(task) && <span className="type-small muted">{repeats(task)}</span>}
                            </span>
                          </span>
                        </td>
                        {several && <td className={cell}>{task.childName}</td>}
                        <td className={`${cell} type-small`}>
                          <Due task={task} />
                        </td>
                        <td className={cell}>
                          <Points value={task.points} short />
                        </td>
                        <td className={cell}>
                          <StatusTag status={statusOf(task)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="sm:hidden">
                  {rows.map((task) => (
                    <TaskRow key={task.id} task={task} to={`/parent/tasks/${task.id}`} who={several && task.childName} more={repeats(task)} />
                  ))}
                </ul>
              </div>
            )}
            {(shown.length > limit || !historyDone) && (
              <div className="mt-4 grid justify-items-start gap-3">
                {older.problem && (
                  <Message tone="danger" alert>
                    {older.problem}
                  </Message>
                )}
                <button type="button" className="btn btn-secondary" {...busyProps(older.busy)} onClick={showMore}>
                  {older.busy ? 'Loading…' : shown.length > limit ? 'Show more' : 'Show older approved tasks'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
