import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ChevronRight } from 'lucide-react'
import * as api from '../api/index.js'
import { Field } from '../components/Field.jsx'
import { EmptyState, ErrorState, Message, PageLoading } from '../components/states.jsx'
import { Points } from '../components/Task.jsx'
import KeepWork from '../components/KeepWork.jsx'
import { useForm } from '../hooks/useForm.js'
import { useLoad } from '../hooks/useLoad.js'
import { whenText } from '../utils/format.js'
import { busyProps } from '../utils/forms.js'

// The moderator's one page: a work list. Reports waiting, oldest first; open one in place, read
// it, answer it, and it leaves the list. No statistics and no user management (decision D3). A moderator is shown the
// least that lets them answer: the words, the role of whoever sent them, and how the task is
// written. Never a name, a photo or anything else of the family's (sitemap section 12, rule 15).

const FROM = { child: 'A child', parent: 'A parent' }

/** The task a report was sent from, as it was written at that moment. */
function Item({ item }) {
  return (
    <div className="mt-4 border-l-2 border-navy-800 pl-4">
      <h3 className="font-semibold">The task it was sent from</h3>
      <dl className="mt-2 grid gap-3">
        <div>
          <dt className="type-small muted">Title</dt>
          <dd className="break-words">{item.title}</dd>
        </div>
        <div>
          <dt className="type-small muted">What the child was asked to do</dt>
          <dd className="break-words whitespace-pre-line">{item.instructions}</dd>
        </div>
        <div>
          <dt className="type-small muted">Due and worth</dt>
          <dd className="flex flex-wrap items-center gap-x-3">
            <time dateTime={item.dueAt}>{whenText(item.dueAt)}</time>
            <Points value={item.points} />
          </dd>
        </div>
        {item.notes.length > 0 && (
          <div>
            <dt className="type-small muted">{item.notes.length === 1 ? 'The note a parent sent proof back with' : 'The notes a parent sent proof back with'}</dt>
            {item.notes.map((note, i) => (
              <dd key={i} className="break-words whitespace-pre-line">
                {note}
              </dd>
            ))}
          </div>
        )}
      </dl>
      <p className="type-small muted mt-3">
        This is a copy made when the report was sent. Proof had been sent {item.proofs === 1 ? 'once' : `${item.proofs} times`}; proof is never shown to a
        moderator.
      </p>
    </div>
  )
}

function Answer({ report, onResolved, onStale }) {
  // Phase 7, item 17: on useForm. The answer stays in the box after a refusal; a report dealt with elsewhere refreshes the list.
  const { form, values, field, busy, problem, shown, submit, changed } = useForm({ answer: '' })
  const errors = { answer: values.answer.trim() ? null : 'Write an answer. It is the only thing they get back.' }
  const send = (event) =>
    submit(
      event,
      errors,
      async () => onResolved(await api.resolveReport(report.id, values.answer)),
      (failure) => (failure.code === 'LOCKED' || failure.code === 'NOT_FOUND') && (onStale(), true), // answered elsewhere, or the family deleted its data
    )

  return (
    <form ref={form} className="mt-6 grid gap-4" onSubmit={send} noValidate>
      <KeepWork dirty={changed} what="the answer you typed" />
      <Field
        as="textarea"
        rows={4}
        label="Your answer"
        hint={`${FROM[report.from]} reads this, so write it for them. Nobody else is told, and nothing in their family is changed.`}
        error={shown(errors, 'answer')}
        value={values.answer}
        name="answer"
        autoComplete="off"
        maxLength={500}
        onChange={field('answer')}
      />
      {problem && (
        <Message tone="danger" alert>
          The report was not resolved. {problem}
        </Message>
      )}
      <button className="btn btn-primary justify-self-start" {...busyProps(busy)}>
        {busy ? 'Resolving…' : 'Mark resolved'}
      </button>
    </form>
  )
}

/** One report, opened in place. A native disclosure: Enter and Space open it. */
function ReportRow({ report, children }) {
  return (
    <li className="border-b last:border-b-0">
      <details className="group">
        <summary className="task-row cursor-pointer list-none">
          <ChevronRight className="size-5 shrink-0 text-navy-600 transition-transform group-open:rotate-90" aria-hidden="true" />
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="line-clamp-2 font-medium break-words group-open:line-clamp-none">{report.details}</span>
            <span className="type-small muted">
              {FROM[report.from]} sent this <time dateTime={report.sentAt}>{whenText(report.sentAt)}</time>
              {report.item && ', from a task'}.
            </span>
            {report.senderGone && (
              <span className="type-small muted">Their account has since been deleted, so an answer will not be kept.</span>
            )}
          </span>
        </summary>
        <div className="max-w-prose px-4 pb-6 sm:px-6">
          {/* Phase 7: each opened report has its own heading, so the task under it reads as part of this report */}
          <h2 className="sr-only">
            The report {FROM[report.from].toLowerCase()} sent {whenText(report.sentAt)}
          </h2>
          {report.item ? <Item item={report.item} /> : <p className="type-small muted">It was not sent from a task, so there is nothing else to show.</p>}
          {children}
        </div>
      </details>
    </li>
  )
}

export default function Reports() {
  const loaded = useLoad(api.listReports, [], { live: true })
  const [note, setNote] = useState(null)
  const said = useRef(null)
  const [limit, setLimit] = useState(50) // P8: 50 at a time

  if (loaded.status === 'error') {
    return (
      <>
        <title>Reports – GrowKid</title>
        <h1>Reports</h1>
        <div className="mt-6">
          <ErrorState error={loaded.error} onRetry={loaded.reload} />
        </div>
      </>
    )
  }
  if (loaded.status === 'loading') return <PageLoading rows={3} />
  const waiting = loaded.data.filter((report) => !report.resolution)
  const resolve = (answered) => {
    // ponytail: built on the list as it was when the answer was sent. A report that arrived in
    // that moment is back on the next reload: on focus, or within a minute.
    loaded.set(loaded.data.map((report) => (report.id === answered.id ? answered : report)))
    flushSync(() =>
      setNote(
        answered.senderGone
          ? 'Resolved. Their account has since been deleted, so the answer was not kept.'
          : 'Resolved. Your answer now shows on their Report a problem page.',
      ),
    )
    said.current?.focus() // Phase 7: the form that was used has gone; the confirmation says what happened
  }
  const stale = () => {
    setNote('That report had already been dealt with. The list is up to date now.')
    loaded.reload()
  }

  return (
    <>
      <title>Reports – GrowKid</title>
      <h1>Reports</h1>
      <p className="muted mt-2">
        {waiting.length === 0 ? 'No reports are waiting.' : waiting.length === 1 ? '1 report is waiting.' : `${waiting.length} reports are waiting, oldest first.`}
      </p>
      {note && (
        <Message ref={said} tabIndex={-1} tone="success" className="mt-4" role="status">
          {note}
        </Message>
      )}

      {waiting.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nothing to read">When a parent or a child reports a problem, it shows here.</EmptyState>
        </div>
      ) : (
        <>
          <ul className="mt-6 overflow-hidden rounded-card border bg-white">
            {waiting.slice(0, limit).map((report) => (
              <ReportRow key={report.id} report={report}>
                <Answer report={report} onResolved={resolve} onStale={stale} />
              </ReportRow>
            ))}
          </ul>
          {waiting.length > limit && (
            <button type="button" className="btn btn-secondary mt-4" onClick={() => setLimit(limit + 50)}>
              Show more
            </button>
          )}
        </>
      )}
    </>
  )
}
