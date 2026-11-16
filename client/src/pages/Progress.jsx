import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { ChartNoAxesColumn, Flame, Printer, Sticker as StickerIcon } from 'lucide-react'
import * as api from '../api/index.js'
import Badge from '../components/Badge.jsx'
import { Field } from '../components/Field.jsx'
import GrowthRuler from '../components/GrowthRuler.jsx'
import Weeks from '../components/Weeks.jsx'
import { EmptyState, ErrorState, Message, PageLoading } from '../components/states.jsx'
import Sticker from '../components/Sticker.jsx'
import { Points } from '../components/Task.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { useSession } from '../store/session.js'
import { DAY_SAID, addDays, dateOfKey, dayKeyOf, dayLabel, daysBetween, weekdayOf, whenText } from '../utils/format.js'
import { errorText } from '../utils/messages.js'
import { iconOf, tiltOf } from '../utils/stickers.js'
import { inThisWeek } from '../utils/tasks.js'
import NotFound from './NotFound.jsx'

// One child's progress, for their parent: the parent's one page of charts (DESIGN.md section
// 11). Everything on it is worked out from the child's own tasks and is something the child can
// see too, on Growth and Stickers. Printed, the same page is the report. The Streak section is
// also where a parent marks rest days, which the printed report leaves out.

const dayMonth = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })
// P14: day keys labelled the same on every device (dateOfKey); a day mark is the instant its day starts in the family's zone
const fullDay = dayLabel({ weekday: 'long', day: 'numeric', month: 'long' })
const named = (day) => dateOfKey(dayKeyOf(day))
const fullDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const letter = dayLabel({ weekday: 'narrow' })
const tasksText = (n) => (n === 1 ? '1 task' : `${n} tasks`)
const daysText = (n) => (n === 1 ? '1 day' : `${n} days`)

/** The day a number of days from today falls on, as 'YYYY-MM-DD'. */
const dayIn = (n) => addDays(dayKeyOf(api.now()), n) // P13: in the family's zone

/**
 * The rest days a parent has set for a child, and the form to add one. A rest day is never
 * missed, so it neither adds to the streak nor breaks it. onChange asks the page for fresh
 * figures, so the calendar shows the mark.
 */
function RestDays({ child, onChange }) {
  const loaded = useLoad(() => api.listRestDays(child.id), [child.id])
  const [day, setDay] = useState('')
  const [state, setState] = useState({})
  const field = useRef(null)

  async function change(key, rest) {
    setState({ busy: true })
    try {
      loaded.set(await api.setRestDay(child.id, key, rest))
      setState({})
      onChange()
      if (rest) setDay('')
    } catch (error) {
      noticeExpiry(error)
      setState(error.code === 'INVALID' ? { range: true } : { problem: errorText(error) })
    }
    // the button that was pressed has been disabled or removed, and the focus went with it
    field.current?.focus()
  }

  return (
    <div className="mt-6 border-t pt-4 print:hidden">
      <h3 className="type-small font-semibold">Rest days</h3>
      <p className="type-small muted mt-1 max-w-prose">
        On a rest day nothing is missed, so {child.name}’s streak is safe. You can mark a day up to 7 days back.
      </p>
      {loaded.status === 'loading' ? (
        <div className="skeleton mt-3 h-16 max-w-md" />
      ) : loaded.status === 'error' ? (
        <div className="mt-3 max-w-md">
          <ErrorState error={loaded.error} onRetry={loaded.reload} />
        </div>
      ) : (
        <>
          {loaded.data.length > 0 && (
            <ul className="mt-3 grid max-w-md gap-1">
              {loaded.data.map((key) => {
                const text = fullDay.format(dateOfKey(key))
                return (
                  <li key={key} className="flex items-center justify-between gap-3">
                    <span>{text}</span>
                    <button type="button" className="btn btn-text type-small" disabled={state.busy} onClick={() => change(key, false)}>
                      Remove<span className="sr-only"> rest day: {text}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <form
            className="mt-3 grid max-w-xs gap-3"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              change(day, true)
            }}
          >
            <Field
              ref={field}
              type="date"
              label="Mark a rest day"
              min={dayIn(-7)}
              max={dayIn(90)}
              name="rest-day"
              value={day}
              onChange={(event) => {
                setDay(event.target.value)
                setState((s) => (s.busy ? s : {}))
              }}
              error={state.range ? 'Choose a day from a week ago up to three months ahead.' : null}
            />
            {state.problem && (
              <Message tone="danger" alert>
                {state.problem}
              </Message>
            )}
            <button className="btn btn-secondary justify-self-start" disabled={state.busy}>
              {state.busy ? 'Saving…' : 'Add rest day'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}

/** The streak's day marks, four weeks of them, a week to a row. The same marks the child sees for the last seven days. */
function Calendar({ streak, calendar, child, onChange }) {
  const said = (state) => calendar.filter((day) => day.state === state).length
  return (
    <section aria-labelledby="streak-title">
      <h2 id="streak-title" className="type-subheading">
        Streak
      </h2>
      <p className="mt-1 flex flex-wrap items-center gap-x-2">
        <Flame className={`size-6 shrink-0 ${streak.days > 0 ? 'icon-earned' : ''}`} aria-hidden="true" />
        <span className="type-game">{streak.days}</span> day streak
        <span className="type-small muted">Best so far: {daysText(streak.best)}</span>
      </p>
      <p className="muted mt-1 max-w-prose">
        In these four weeks, {daysText(said('done'))} counted and {said('missed')} {said('missed') === 1 ? 'was' : 'were'} missed.
      </p>
      <ol className="mt-4 grid w-fit grid-cols-7 gap-1.5" aria-label={`${child.name}’s days, four weeks, Monday first`}>
        {calendar.slice(0, 7).map(({ day }) => (
          <li key={`head-${day}`} className="type-small muted text-center font-medium" aria-hidden="true">
            {letter.format(named(day))}
          </li>
        ))}
        {calendar.map(({ day, state }) => (
          <li key={day} className={`day-mark day-${state} size-9 tabular-nums`}>
            <span aria-hidden="true">{Number(dayKeyOf(day).slice(8))}</span>
            <span className="sr-only">
              {fullDay.format(named(day))}: {DAY_SAID[state]}
            </span>
          </li>
        ))}
      </ol>
      <ul className="type-small mt-4 grid gap-1.5">
        <li className="flex items-center gap-2">
          <span className="day-mark day-done size-5" aria-hidden="true" />
          Counted: proof sent that day was approved
        </li>
        <li className="flex items-center gap-2">
          <span className="day-mark day-missed size-5" aria-hidden="true" />
          Missed: a task was due and no proof was sent
        </li>
        <li className="flex items-center gap-2">
          <span className="day-mark day-none size-5" aria-hidden="true" />
          Nothing to count: the streak is left as it was
        </li>
        <li className="flex items-center gap-2">
          <span className="day-mark day-rest size-5" aria-hidden="true" />
          Rest day: set by you, never missed
        </li>
      </ul>
      <RestDays child={child} onChange={onChange} />
    </section>
  )
}

/** The child's sticker chart, as the parent sees it: earned ones in colour, the rest as named outlines. */
function StickerChart({ stickers, name }) {
  const earned = stickers.filter((sticker) => sticker.earnedAt)
  return (
    <section aria-labelledby="stickers-title">
      <h2 id="stickers-title" className="type-subheading">
        Stickers
      </h2>
      <p className="muted mt-1">
        {earned.length === 0 ? `${name} has not earned a sticker yet.` : `${name} has earned ${earned.length} of ${stickers.length}.`}
      </p>
      <ul className="mt-4 grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
        {stickers.map((sticker, i) => (
          <li key={sticker.id} className="grid justify-items-center gap-1 text-center">
            <Sticker
              icon={iconOf(sticker)}
              shape={sticker.shape}
              tone={sticker.tone}
              tilt={tiltOf(i)}
              slot={!sticker.earnedAt}
              className="size-14"
            />
            <span className="type-small font-medium">{sticker.name}</span>
            <span className="type-small muted">
              {sticker.earnedAt ? `Earned ${dayMonth.format(new Date(sticker.earnedAt))}` : 'Not earned yet'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

const MEASURES = [
  { id: 'weeks', label: 'By week', Icon: ChartNoAxesColumn },
  { id: 'streak', label: 'Streak', Icon: Flame },
  { id: 'stickers', label: 'Stickers', Icon: StickerIcon },
]

// K12: questions for a family to talk over at the weekend. Three a week, taken in turn, so nothing needs storing.
const QUESTIONS = [
  'Which task are you proudest of this week?',
  'What was hardest this week, and what helped?',
  'Which task would you swap for a new one?',
  'What should we try together next week?',
  'Who helped you this week, and how?',
  'What did you learn that surprised you?',
  'Which reward are you saving for, and why?',
  'What would make next week easier?',
  'What did you do this week without being asked?',
]

/** K12: from Friday to Sunday, three questions for the family's weekly check-in. Nothing is stored. */
function CheckIn({ name }) {
  const today = dayKeyOf(api.now())
  if (weekdayOf(today) < 4) return null // Friday is 4
  const week = Math.floor(daysBetween('2026-01-05', addDays(today, -weekdayOf(today))) / 7) // weeks since a Monday
  const asked = [0, 1, 2].map((i) => QUESTIONS[(week * 3 + i) % QUESTIONS.length])
  return (
    <section className="card mt-6 max-w-2xl print:hidden" aria-labelledby="check-in-title">
      <h2 id="check-in-title" className="type-subheading">
        This week’s family check-in
      </h2>
      <p className="mt-1">A few minutes together at the weekend. Ask {name}:</p>
      <ol className="mt-3 grid list-decimal gap-1 pl-6">
        {asked.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ol>
    </section>
  )
}

/** K12: the fridge chart: this week's tasks with a box to tick, and the stickers earned. Printed instead of the report. */
function FridgeChart({ child, tasks, stickers }) {
  const earned = stickers.filter((sticker) => sticker.earnedAt)
  return (
    <section className="hidden print:block">
      <p className="font-display text-navy-800">GrowKid</p>
      <h1>{child.name}’s week</h1>
      <p className="muted mt-1">Tick each task when it is done.</p>
      {tasks.length === 0 ? (
        <p className="mt-6">No tasks are due this week.</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {tasks.map((task) => (
            <li key={task.id} className="flex break-inside-avoid items-center gap-4 border-b pb-3">
              <span className="size-8 shrink-0 rounded-tag border-2 border-navy-800" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{task.title}</span>
                <span className="type-small muted block">Due {whenText(task.dueAt)}</span>
              </span>
              <Points value={task.points} short />
            </li>
          ))}
        </ul>
      )}
      {earned.length > 0 && (
        <>
          <h2 className="type-subheading mt-8">Stickers earned</h2>
          <ul className="mt-3 flex flex-wrap gap-4">
            {earned.map((sticker) => (
              <li key={sticker.id} className="grid w-20 justify-items-center gap-1 text-center">
                <Sticker icon={iconOf(sticker)} shape={sticker.shape} tone={sticker.tone} className="size-12" />
                <span className="type-small">{sticker.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

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
              <button type="button" className="btn btn-primary" disabled={report.status === 'preparing'} onClick={download}>
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
