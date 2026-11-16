import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { ChartNoAxesColumn, Flame, Printer, Sticker as StickerIcon } from 'lucide-react'
import * as api from '../api/index.js'
import Badge from '../components/Badge.jsx'
import GrowthRuler from '../components/GrowthRuler.jsx'
import Weeks from '../components/Weeks.jsx'
import { EmptyState, ErrorState, Message, PageLoading } from '../components/states.jsx'
import { Points } from '../components/Task.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { useSession } from '../store/session.js'
import { errorText } from '../utils/messages.js'
import { inThisWeek } from '../utils/tasks.js'
import NotFound from './NotFound.jsx'
import { Calendar } from './progress/Calendar.jsx'
import { StickerChart } from './progress/StickerChart.jsx'
import { CheckIn, FridgeChart } from './progress/CheckInAndFridge.jsx'
import { LOCALE, plural } from '../utils/format.js'
import { busyProps } from '../utils/forms.js'
// One child's progress, for their parent: the parent's one page of charts (DESIGN.md section
// 11). Everything on it is worked out from the child's own tasks and is something the child can
// see too, on Growth and Stickers. Printed, the same page is the report. The Streak section is
// also where a parent marks rest days, which the printed report leaves out.

const fullDate = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const tasksText = (n) => plural(n, 'task')

/** The day a number of days from today falls on, as 'YYYY-MM-DD'. */

const MEASURES = [
  { id: 'weeks', label: 'By week', Icon: ChartNoAxesColumn },
  { id: 'streak', label: 'Streak', Icon: Flame },
  { id: 'stickers', label: 'Stickers', Icon: StickerIcon },
]

function ChildProgress({ id }) {
  const parent = useSession((s) => s.user)
  const loaded = useLoad(() => Promise.all([api.getProgress(id), api.listChildren()]), [id])
  const [measure, setMeasure] = useState('weeks')
  const [report, setReport] = useState({}) // { status: 'preparing' | 'failed', error, what }
  const [fridge, setFridge] = useState(null) // K12: this week's tasks, only while the fridge chart prints

  // K12: the fridge chart prints in place of the report, then the page is as it was
  async function printFridge() {
    setReport({})
    try {
      const tasks = (await api.listTasks()).filter((task) => task.childId === id && inThisWeek(task))
      flushSync(() => setFridge(tasks))
      window.print()
    } catch (error) {
      setReport({ status: 'failed', error: noticeExpiry(error), what: 'fridge chart' })
    }
    setFridge(null)
  }

  // The report is this page, printed. It is prepared first: the figures are asked for again, so
  // that what is printed is true at that moment.
  async function download() {
    setReport({ status: 'preparing' })
    try {
      const fresh = await api.getProgress(id)
      // the fresh figures are drawn before the print window opens
      flushSync(() => {
        loaded.set([fresh, loaded.data[1]])
        setReport({})
      })
      window.print()
    } catch (error) {
      setReport({ status: 'failed', error: noticeExpiry(error) })
    }
  }

  // Quiet, and never loaded.reload(): that would swap the page for the skeleton and drop the
  // focus from the rest-day controls.
  const refreshProgress = () =>
    api
      .getProgress(id)
      .then((fresh) => loaded.set([fresh, loaded.data[1]]))
      .catch(noticeExpiry)

  if (loaded.status === 'loading') return <PageLoading rows={3} />
  if (loaded.status === 'error') {
    // another family's child looks exactly like one that does not exist
    return loaded.error.code === 'NOT_FOUND' ? <NotFound /> : <ErrorState error={loaded.error} onRetry={loaded.reload} />
  }
  const [progress, family] = loaded.data
  const { child, counts, streak } = progress
  const only = (wanted) => (measure === wanted ? '' : 'max-lg:hidden print:block')

  return (
    <>
      {fridge && <FridgeChart child={child} tasks={fridge} stickers={progress.stickers} />}
      <div className={fridge ? 'print:hidden' : undefined}>
      <title>{`${child.name}’s progress – GrowKid`}</title>
      <p className="hidden font-display text-navy-800 print:block">GrowKid progress report</p>
      <h1>
        <span className="print:hidden">Progress</span>
        <span className="hidden print:inline">{child.name}</span>
      </h1>
      <p className="muted mt-1 hidden print:block">
        Prepared for {parent?.name} on {fullDate.format(api.now())}.
      </p>

      {family.length > 1 && (
        <nav aria-label="Child" className="mt-4 flex flex-wrap gap-2 print:hidden">
          {family.map((one) => (
            <Link key={one.id} to={`/parent/progress/${one.id}`} className="btn btn-secondary btn-switch" aria-current={one.id === child.id ? 'page' : undefined}>
              <Badge avatar={one.avatar} name={one.name} className="size-7" />
              {one.name}
            </Link>
          ))}
        </nav>
      )}

      <section className="mt-6 max-w-2xl" aria-label={`${child.name}’s level`}>
        <h2 className="type-subheading mb-3 print:hidden">{child.name}</h2>
        <GrowthRuler {...progress} />
        {counts.approved > 0 && (
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Points value={progress.points} /> earned from {tasksText(counts.approved)} approved.
          </p>
        )}
        <p className="muted mt-1">
          {counts.waiting === 0 ? 'No proof is' : counts.waiting === 1 ? '1 proof is' : `${counts.waiting} proofs are`} waiting for your review.{' '}
          {counts.open === 0 ? 'Nothing is' : counts.open === 1 ? '1 task is' : `${counts.open} tasks are`} still to do
          {counts.overdue > 0 && `, ${counts.overdue} of them overdue`}.
        </p>
      </section>

      <CheckIn name={child.name} />

      {counts.approved === 0 ? (
        <div className="mt-8 max-w-2xl">
          <EmptyState
            title="No approved tasks yet"
            action={
              <Link to={`/parent/tasks?child=${child.id}`} className="btn btn-secondary">
                See {child.name}’s tasks
              </Link>
            }
          >
            When you approve {child.name}’s first proof, the weeks, the streak and the stickers appear here, and a report can be saved.
          </EmptyState>
        </div>
      ) : (
        <>
          <fieldset className="mt-6 lg:hidden print:hidden">
            <legend className="sr-only">What to show</legend>
            <div className="grid grid-cols-3 gap-2">
              {MEASURES.map(({ id: value, label, Icon }) => (
                <label key={value} className="choice">
                  <input type="radio" name="measure" className="sr-only" checked={measure === value} onChange={() => setMeasure(value)} />
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 grid items-start gap-x-12 gap-y-10 lg:mt-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] print:mt-8 print:block print:space-y-8">
            <div className={`break-inside-avoid ${only('weeks')}`}>
              <Weeks weeks={progress.weeks} who={child.name} whose={`${child.name}’s`} />
            </div>
            <div className={`break-inside-avoid ${only('streak')}`}>
              <Calendar streak={streak} calendar={progress.calendar} child={child} onChange={refreshProgress} />
            </div>
            <div className={`break-inside-avoid lg:col-span-2 ${only('stickers')}`}>
              <StickerChart stickers={progress.stickers} name={child.name} />
            </div>
          </div>

          <div className="mt-10 grid max-w-2xl gap-3 border-t pt-6 print:hidden">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button type="button" className="btn btn-primary" {...busyProps(report.status === 'preparing')} onClick={download}>
                <Printer className="size-5 shrink-0" aria-hidden="true" />
                {report.status === 'preparing' ? 'Preparing the report…' : 'Download report'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={printFridge}>
                Print a fridge chart
              </button>
              <p className="type-small muted min-w-0 flex-1 basis-56">
                Opens your browser’s print window. Choose “Save as PDF” there to keep a copy.
              </p>
            </div>
            {report.status === 'preparing' && (
              <Message role="status">The report is being prepared with {child.name}’s latest figures.</Message>
            )}
            {report.status === 'failed' && (
              <Message tone="danger" alert>
                The {report.what ?? 'report'} could not be prepared. {errorText(report.error)}
              </Message>
            )}
            <p className="type-small muted">
              {child.name} sees all of this too, on Growth and Stickers. Nothing here is hidden from them.
            </p>
          </div>
        </>
      )}
      </div>
    </>
  )
}

export default function Progress() {
  const { childId } = useParams()
  return <ChildProgress key={childId} id={childId} />
}
