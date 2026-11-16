import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Check, Clock, Phone } from 'lucide-react'
import * as api from '../api/index.js'
import KeepWork from '../components/KeepWork.jsx'
import { Field } from '../components/Field.jsx'
import { Message, RetryButton } from '../components/states.jsx'
import { useForm } from '../hooks/useForm.js'
import { useLoad } from '../hooks/useLoad.js'
import { homeFor, useSession } from '../store/session.js'
import { whenText } from '../utils/format.js'
import { busyProps } from '../utils/forms.js'

// Report a problem. The reader may be a worried child, so: few words, no blame, nothing to
// choose from a list, and a confirmation that takes the whole screen and says what happens next.
// Serious and plain, never themed as a game (DESIGN.md section 12, principle 9).

/**
 * Who reads a report. The one place that says so: if the moderator's page is ever cut, change
 * this line to the truth. No time is promised, because a time is a promise a person would have
 * to keep (sitemap section 12, rule 15).
 */
const READER = 'A moderator at GrowKid'
const MAX = 1000

/**
 * A child helpline. Childline 1098 confirmed on 10 October 2026 against the Ministry of Women and
 * Child Development's page (wcd.gov.in/child/child-helpline: Child Helpline 1098, 24x7, integrated
 * with the 112 emergency system) and a district government page (palwal.gov.in/child-helpline-1098:
 * "a National, 24 Hour, Emergency toll free phone service for children"; "Any child or concerned
 * adult can dial 1098"). Check it again before a public launch.
 */
function Helpline() {
  return (
    <p className="flex items-start gap-3 rounded-card border bg-white p-4">
      <Phone className="mt-1 size-5 shrink-0 text-navy-800" aria-hidden="true" />
      <span>
        <span className="block font-semibold">Need help right now?</span>
        Tell a grown-up you trust, or call Childline on{' '}
        <a href="tel:1098" className="font-semibold text-navy-800 underline underline-offset-4">
          1098
        </a>
        . The call is free, at any time of day or night.
      </span>
    </p>
  )
}

/** What this person has reported before, and the moderator's answer where there is one. */
function Mine({ reports }) {
  if (reports.status === 'error') {
    return (
      <Message tone="warning" className="mt-10">
        <p>Your earlier reports did not load. You can still send a new one.</p>
        <RetryButton onRetry={reports.reload} target="#mine" />
      </Message>
    )
  }
  if (reports.status === 'loading') return <div className="skeleton mt-10 h-16" role="status" aria-label="Loading your reports" />
  if (reports.data.length === 0) return null
  return (
    <section className="mt-10 border-t pt-6" aria-labelledby="mine-title">
      <h2 id="mine-title" className="type-subheading">
        Your reports
      </h2>
      <ul className="mt-3 grid gap-4">
        {reports.data.map((report) => (
          <li key={report.id} className="rounded-card border bg-white p-4">
            <p className="flex flex-wrap items-center justify-between gap-2">
              <span className="type-small muted">
                Sent <time dateTime={report.sentAt}>{whenText(report.sentAt)}</time>
              </span>
              {report.resolution ? (
                <span className="tag tag-success">
                  <Check className="size-3.5" aria-hidden="true" />
                  Answered
                </span>
              ) : (
                <span className="tag tag-info">
                  <Clock className="size-3.5" aria-hidden="true" />
                  Waiting to be read
                </span>
              )}
            </p>
            <p className="mt-2 break-words whitespace-pre-line">{report.details}</p>
            {report.item && <p className="type-small muted mt-1">About the task “{report.item.title}”.</p>}
            {report.resolution && (
              <div className="mt-3 rounded-control bg-navy-100 p-3">
                <p className="type-small font-semibold text-navy-800">
                  The moderator answered, <time dateTime={report.resolution.at}>{whenText(report.resolution.at)}</time>
                </p>
                <p className="mt-1 break-words whitespace-pre-line">{report.resolution.note}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function Report() {
  const user = useSession((s) => s.user)
  const taskId = useSearchParams()[0].get('task')
  // the task this report was opened from, if it is theirs to see; without it the form works the same
  // P8: the one task, not the whole list to find it in; one that is not theirs (NOT_FOUND) is simply not attached
  const task = useLoad(async () => (taskId ? api.getTask(taskId).catch((error) => (error.code === 'NOT_FOUND' ? undefined : Promise.reject(error))) : undefined), [taskId])
  const mine = useLoad(api.listMyReports)
  // Phase 7, item 17: on useForm. What was typed stays in the box after a refusal; once sent, the page says what happens next.
  const { form, values, setValues, field, busy, setBusy, problem, shown, submit, changed } = useForm({ details: '', aboutTask: true })
  const [state, setState] = useState({}) // { sent }: the confirmation in place of the form
  const child = user?.role === 'child'
  const details = values.details
  const errors = { details: details.trim() ? null : 'Write a few words about what is wrong.' }

  const send = (event) =>
    submit(event, errors, async () => {
      await api.sendReport({ details, taskId: task.data && values.aboutTask ? task.data.id : undefined })
      setValues({ details: '', aboutTask: true })
      setBusy(false)
      setState({ sent: true })
      mine.reload()
      document.getElementById('main')?.focus() // the form has gone: start reading from the top
      window.scrollTo(0, 0)
    })

  if (user?.role === 'moderator') return <Navigate to={homeFor(user)} replace /> // reports come to them
  if (state.sent) {
    return (
      <div className="max-w-prose">
        <title>Report sent – GrowKid</title>
        <h1>Your report was sent</h1>
        <p className="mt-4">
          {READER} will read it. {child ? 'Your parent is not told about it and cannot see it.' : 'Your children are not told about it and cannot see it.'}
        </p>
        <p className="mt-3">The answer will show on this page, under “Your reports”. Come back here to read it.</p>
        <div className="mt-6">
          <Helpline />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={homeFor(user)} className={`btn btn-primary ${child ? 'btn-lg' : ''}`}>
            {child ? 'Back to Today' : 'Back to Overview'}
          </Link>
          <button type="button" className={`btn btn-text ${child ? 'btn-lg' : ''}`} onClick={() => {
              flushSync(() => setState({}))
              document.getElementById('mine')?.focus() // Phase 7: straight to the reports, under the form
            }}>
            See your reports
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-prose">
      <title>Report a problem – GrowKid</title>
      <h1>Report a problem</h1>
      <p className="mt-2">
        If something here feels wrong, say so. {READER} reads every report.{' '}
        {child ? 'Your parent is not told and cannot see it.' : 'Your children are not told and cannot see it.'}
      </p>

      <KeepWork dirty={changed} what="the report you typed" />
      <form ref={form} className="mt-6 grid gap-5" onSubmit={send} noValidate>
        <Field
          as="textarea"
          rows={5}
          label="What is wrong?"
          hint={`Use your own words. A few are enough.${details.length > MAX - 200 ? ` ${MAX - details.length} characters left.` : ''}`}
          error={shown(errors, 'details')}
          value={details}
          name="details"
          autoComplete="off"
          maxLength={MAX}
          onChange={field('details')}
        />
        {task.data && (
          <label className="flex min-h-11 items-start gap-3">
            <input type="checkbox" className="mt-1 size-5 shrink-0" checked={values.aboutTask} onChange={field('aboutTask', (e) => e.target.checked)} />
            <span>
              This is about the task “{task.data.title}”
              <span className="type-small muted block">The moderator is shown how the task is written. Never a photo, and never your name.</span>
            </span>
          </label>
        )}
        {problem && (
          <Message tone="danger" alert>
            Your report was not sent. {problem} What you wrote is still here.
          </Message>
        )}
        <button className={`btn btn-primary justify-self-start ${child ? 'btn-lg max-sm:w-full' : ''}`} {...busyProps(busy)}>
          {busy ? 'Sending…' : 'Send report'}
        </button>
      </form>

      <div className="mt-8">
        <Helpline />
      </div>
      <div id="mine" tabIndex={-1}>
        <Mine reports={mine} />
      </div>
    </div>
  )
}
