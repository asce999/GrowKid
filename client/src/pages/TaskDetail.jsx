import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import * as api from '../api/index.js'
import { Cheer, CheerPicker } from '../components/Cheer.jsx'
import { Field } from '../components/Field.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import Proof from '../components/Proof.jsx'
import { Earlier, Note, SentLine, Stamp } from '../components/Review.jsx'
import StatusTag from '../components/StatusTag.jsx'
import { ErrorState, Message, PageLoading } from '../components/states.jsx'
import { CategoryTile, Due, Points } from '../components/Task.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { useOnce } from '../hooks/useOnce.js'
import { errorText } from '../utils/messages.js'
import { statusOf } from '../utils/tasks.js'
import NotFound from './NotFound.jsx'
import { busyProps } from '../utils/forms.js'

// A task as the parent sees it. When proof is waiting it leads with the proof, shown large,
// with Approve as the one main button, and a cheer to add to an approval just above it. Sending
// back opens its note in place: never a dialog.

/**
 * Approve (with the cheer chosen above it, if any), or Send back with a note. On a phone the bar
 * stays at the bottom of the screen while the proof is looked at; on a desktop it sits beside the
 * proof.
 */
function ReviewBar({ task, proof, cheer, onStale }) {
  const navigate = useNavigate()
  const [writing, setWriting] = useState(false)
  const [note, setNote] = useState('')
  const [state, setState] = useState({})
  const form = useRef(null)
  const sendBackButton = useRef(null)
  const wasWriting = useRef(false)
  const child = task.childName
  // into the note when it opens, and back to the button that opened it when it is cancelled
  useEffect(() => {
    if (writing) form.current?.querySelector('textarea')?.focus()
    else if (wasWriting.current) sendBackButton.current?.focus()
    wasWriting.current = writing
  }, [writing])

  async function answer(act, done) {
    setState({ busy: true })
    try {
      await act()
      // H6: on to the oldest other proof waiting, in Overview's order, carrying the result; Overview when none is left
      const waiting = (await api.listTasks().catch(() => []))
        .filter((t) => t.status === 'review' && t.id !== task.id)
        .sort((a, b) => a.proofs.at(-1).sentAt.localeCompare(b.proofs.at(-1).sentAt))
      navigate(waiting[0] ? `/parent/tasks/${waiting[0].id}` : '/parent', { state: { ...done, next: Boolean(waiting[0]) } })
    } catch (error) {
      noticeExpiry(error)
      // reviewed already, in another tab or on another device: show the task as it stands
      if (error.code === 'REVIEWED' || error.code === 'NOT_FOUND') return onStale()
      setState({ problem: error.code === 'INVALID' && error.fields?.line ? 'Keep the line to 120 characters.' : error.code === 'SCREENED' ? screened(error.fields.word) : errorText(error) })
    }
  }
  // C7: the note or the cheer's line, whichever was sent, used a word GrowKid screens for
  const screened = (word) => (writing ? `The note cannot use “${word}”. Change it, then send it back.` : `The cheer cannot use “${word}”. Change the line, then approve.`)
  const line = cheer.line.trim()
  const approve = () =>
    answer(() => api.approveProof(task.id, proof.id, cheer.kind || line ? { kind: cheer.kind, line } : undefined), {
      approved: { child, points: task.points, title: task.title },
    })
  function sendBack(event) {
    event.preventDefault()
    if (!note.trim()) {
      setState({ tried: true })
      form.current?.querySelector('textarea')?.focus()
      return
    }
    answer(() => api.sendBackProof(task.id, proof.id, note), { sentBack: { child, title: task.title } })
  }

  const problem = state.problem && (
    <Message tone="danger" alert className="mb-3">
      {state.problem}
    </Message>
  )

  if (writing) {
    return (
      <form ref={form} className="review-bar review-open" onSubmit={sendBack} noValidate>
        {problem}
        <Field
          as="textarea"
          label={`What should ${child} fix?`}
          hint={`${child} reads this note. Say one thing to do differently, in words they would use, like “Water the big pot at the back too.”`}
          error={state.tried && !note.trim() ? `Write a note so ${child} knows what to fix.` : null}
          rows={3}
          maxLength={300}
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {/* H7: a ready note to start from; it fills the box and stays editable */}
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Ready notes">
          {['The photo is blurry', 'Part of it is missing', 'Nearly there, try once more'].map((ready) => (
            <button
              key={ready}
              type="button"
              className="btn btn-secondary min-h-11 px-3"
              aria-pressed={note === ready}
              onClick={() => {
                setNote(ready)
                form.current?.querySelector('textarea')?.focus()
              }}
            >
              {ready}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn btn-primary" {...busyProps(state.busy)}>
            {state.busy ? 'Sending back…' : 'Send back'}
          </button>
          <button type="button" className="btn btn-text" {...busyProps(state.busy)} onClick={() => setWriting(false)}>
            Cancel
          </button>
        </div>
      </form>
    )
  }
  return (
    <div className="review-bar">
      {problem}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-approve" {...busyProps(state.busy)} onClick={approve}>
          {state.busy ? 'Approving…' : 'Approve'}
        </button>
        <button ref={sendBackButton} type="button" className="btn btn-secondary" {...busyProps(state.busy)} onClick={() => setWriting(true)}>
          Send back
        </button>
      </div>
      <p className="type-small muted mt-2 hidden lg:block">
        Approving gives {child} the {task.points} points. Sending back asks for a note first.
      </p>
    </div>
  )
}

function Delete({ task }) {
  const navigate = useNavigate()
  const confirm = useRef(null)
  return (
    <>
      <button type="button" className="btn btn-text text-coral-700" onClick={() => confirm.current.open()}>
        Delete
      </button>
      <ConfirmDialog
        ref={confirm}
        danger
        title="Delete this task?"
        keep="Keep the task"
        confirm="Delete task"
        busyText="Deleting…"
        act={async () => {
          await api.deleteTask(task.id)
          navigate('/parent/tasks', { state: { deleted: task.title } })
        }}
      >
        <p>
          “{task.title}” disappears from {task.childName}’s Today.
          {task.proofs.length > 0 && ' The proof they sent is deleted with it.'} This cannot be undone.
        </p>
      </ConfirmDialog>
    </>
  )
}

/** H3: stops the series that made this task. Every task it made stays, this one included; nothing is lost, so the act is the primary button. */
function StopRepeating({ task, onStopped }) {
  const confirm = useRef(null)
  const [done, setDone] = useState(false)
  if (!task.seriesId && !done) return null
  return (
    <section className="mt-8 border-t pt-6" aria-labelledby="repeat-title">
      <h2 id="repeat-title" className="type-subheading">
        Repeating
      </h2>
      {done ? (
        <Message tone="success" role="status" className="mt-3">
          It no longer repeats. The tasks it already made stay.
        </Message>
      ) : (
        <>
          <p className="muted mt-1">A new task like this one is made each day it repeats.</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => confirm.current.open()}>
            Stop repeating
          </button>
          <ConfirmDialog
            ref={confirm}
            title="Stop repeating this task?"
            keep="Keep repeating"
            confirm="Stop repeating"
            busyText="Stopping…"
            act={async () => {
              await api.stopSeries(task.seriesId)
              confirm.current.close()
              setDone(true)
              onStopped()
            }}
          >
            <p>No more tasks like this are made. {task.childName}’s tasks it already made stay, this one too.</p>
          </ConfirmDialog>
        </>
      )}
    </section>
  )
}

/** Edit and Delete, or the reason one of them is closed (FRONTEND-SITEMAP.md section 12, rule 2). */
function Changes({ task }) {
  const approved = task.status === 'approved'
  const closed = approved
    ? 'This task is approved, so it stays as history. It cannot be edited or deleted.'
    : task.proofs.length > 0 &&
      `${task.childName} has sent proof, so this task can no longer be edited. It can still be deleted until it is approved.`
  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3 border-t pt-6">
        {closed ? (
          <button type="button" className="btn btn-secondary" disabled aria-describedby="closed-why">
            Edit
          </button>
        ) : (
          <Link to={`/parent/tasks/${task.id}/edit`} className="btn btn-secondary">
            Edit
          </Link>
        )}
        {approved ? (
          <button type="button" className="btn btn-text" disabled aria-describedby="closed-why">
            Delete
          </button>
        ) : (
          <Delete task={task} />
        )}
        {/* H4: always open, approved tasks too: a copy is a new task, with its due time left to the parent */}
        <Link to="/parent/tasks/new" state={{ copy: task }} className="btn btn-text">
          Duplicate
        </Link>
      </div>
      {closed && (
        <p id="closed-why" className="type-small muted mt-3 flex items-start gap-2">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {closed}
        </p>
      )}
    </>
  )
}

/** H6: one task page per task, so going on to the next proof starts with a closed note and no cheer chosen. */
export default function TaskDetail() {
  const { taskId } = useParams()
  return <TaskPage key={taskId} taskId={taskId} />
}

function TaskPage({ taskId }) {
  const loaded = useLoad(() => api.getTask(taskId), [taskId])
  const [note] = useOnce()
  const [stale, setStale] = useState(false)
  const [cheer, setCheer] = useState({ kind: null, line: '' }) // added to the approval, if there is one

  if (loaded.status === 'loading') return <PageLoading rows={3} />
  if (loaded.status === 'error') {
    // another family's task looks exactly like one that does not exist
    return loaded.error.code === 'NOT_FOUND' ? <NotFound /> : <ErrorState error={loaded.error} onRetry={loaded.reload} />
  }
  const task = loaded.data
  const proof = task.proofs.at(-1)
  const review = proof?.review
  const label = `Proof from ${task.childName} for ${task.title}`
  const reviewing = Boolean(proof) && task.status === 'review'

  return (
    <>
      <title>{`${task.title} – GrowKid`}</title>
      <nav aria-label="Back" className="flex flex-wrap gap-x-6">
        <Link to="/parent/tasks" className="inline-flex min-h-11 items-center font-medium text-navy-800 underline underline-offset-4">
          Tasks
        </Link>
        <Link to="/parent" className="inline-flex min-h-11 items-center font-medium text-navy-800 underline underline-offset-4">
          Back to overview
        </Link>
      </nav>
      <h1 className="break-words">{task.title}</h1>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <CategoryTile task={task} small />
        <StatusTag status={statusOf(task)} />
        <span>
          For {task.childName}
          {task.pinned && ', who chose it to do next'}
        </span>
        <Due task={task} className="type-small" />
        <Points value={task.points} />
      </p>
      {note?.saved && (
        <Message tone="success" role="status" className="mt-4">
          Changes saved.
        </Message>
      )}
      {/* H6: the answer to the last proof, said here when this is the next one waiting */}
      {note?.approved && (
        <Message tone="success" className="mt-4" role="status">
          Approved. {note.approved.child} earned {note.approved.points} points for “{note.approved.title}”. Here is the next proof waiting.
        </Message>
      )}
      {note?.sentBack && (
        <Message tone="success" className="mt-4" role="status">
          “{note.sentBack.title}” went back to {note.sentBack.child} with your note. Here is the next proof waiting.
        </Message>
      )}
      {stale && (
        <Message className="mt-4">
          This proof had already been reviewed, here or on another device. This is the task as it stands now.
        </Message>
      )}

      <div
        className={`mt-8 grid items-start gap-x-8 gap-y-6 ${
          reviewing ? 'lg:grid-cols-[3fr_2fr] lg:grid-rows-[auto_auto_1fr]' : proof ? 'lg:grid-cols-[3fr_2fr] lg:grid-rows-[auto_1fr]' : ''
        }`}
      >
        {proof && (
          <section aria-labelledby="proof-title" className={reviewing ? 'lg:row-span-3' : 'lg:row-span-2'}>
            <h2 id="proof-title" className="type-subheading">
              Proof from {task.childName}
            </h2>
            <SentLine proof={proof} className="mt-1" />
            <div className="mt-3">
              <Proof proof={proof} label={label} onRetry={loaded.reload} />
            </div>
            {review?.result === 'approved' && (
              <>
                <Stamp review={review} className="mt-4" />
                <Cheer cheer={review.cheer} className="mt-2" />
                <p className="mt-1 flex flex-wrap items-center gap-x-2">
                  {task.childName} earned <Points value={task.points} /> for this task.
                </p>
              </>
            )}
            {review?.result === 'sentBack' && (
              <>
                <Note review={review} className="mt-4" />
                <p className="muted mt-3">Waiting for {task.childName} to send new proof.</p>
              </>
            )}
            <Earlier task={task} label={label} />
          </section>
        )}
        {task.status === 'review' && (
          <>
            {/* its own grid item, and ReviewBar stays unwrapped: it is sticky on a phone */}
            <div className="lg:col-start-2">
              <CheerPicker value={cheer} onChange={setCheer} child={task.childName} />
            </div>
            <ReviewBar
              task={task}
              proof={proof}
              cheer={cheer}
              onStale={() => {
                setStale(true)
                loaded.reload()
              }}
            />
          </>
        )}

        <div className="max-w-prose">
          <h2 className="type-subheading">What to do</h2>
          <p className="mt-1 break-words whitespace-pre-line">{task.instructions}</p>
          {task.doneLooksLike && ( // H5: beside the proof, so the review checks against it
            <>
              <h2 className="type-subheading mt-6">What done looks like</h2>
              <p className="mt-1 break-words whitespace-pre-line">{task.doneLooksLike}</p>
            </>
          )}
          <Changes task={task} />
          <StopRepeating task={task} onStopped={loaded.reload} />
          <p className="mt-8">
            <Link to={`/report?task=${task.id}`} className="type-small inline-flex min-h-11 items-center text-navy-800 underline underline-offset-4">
              Report a problem with this task
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
