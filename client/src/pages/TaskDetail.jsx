import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Lock, TriangleAlert } from 'lucide-react'
import * as api from '../api/index.js'
import { Cheer, CheerPicker } from '../components/Cheer.jsx'
import { Field } from '../components/Field.jsx'
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
      navigate('/parent', { state: done })
    } catch (error) {
      noticeExpiry(error)
      // reviewed already, in another tab or on another device: show the task as it stands
      if (error.code === 'REVIEWED' || error.code === 'NOT_FOUND') return onStale()
      setState({ problem: error.code === 'INVALID' && error.fields?.line ? 'Keep the line to 120 characters.' : errorText(error) })
    }
  }
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
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn btn-primary" disabled={state.busy}>
            {state.busy ? 'Sending back…' : 'Send back'}
          </button>
          <button type="button" className="btn btn-text" disabled={state.busy} onClick={() => setWriting(false)}>
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
        <button type="button" className="btn btn-approve" disabled={state.busy} onClick={approve}>
          {state.busy ? 'Approving…' : 'Approve'}
        </button>
        <button ref={sendBackButton} type="button" className="btn btn-secondary" disabled={state.busy} onClick={() => setWriting(true)}>
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
  const dialog = useRef(null)
  const [state, setState] = useState({})

  async function remove() {
    setState({ busy: true })
    try {
      await api.deleteTask(task.id)
      navigate('/parent/tasks', { state: { deleted: task.title } })
    } catch (failure) {
      setState({ problem: errorText(noticeExpiry(failure)) })
    }
  }

  return (
    <>
      <button type="button" className="btn btn-text text-coral-700" onClick={() => dialog.current.showModal()}>
        Delete
      </button>
      <dialog ref={dialog} className="dialog" aria-labelledby="delete-title">
        <h2 id="delete-title" className="type-subheading flex items-center gap-2">
          <TriangleAlert className="size-5 shrink-0 text-coral-700" aria-hidden="true" />
          Delete this task?
        </h2>
        <p className="mt-2 break-words">
          “{task.title}” disappears from {task.childName}’s Today.
          {task.proofs.length > 0 && ' The proof they sent is deleted with it.'} This cannot be undone.
        </p>
        {state.problem && (
          <Message tone="danger" alert className="mt-4">
            {state.problem}
          </Message>
        )}
        <div className="mt-6 grid gap-3 sm:flex">
          <button type="button" className="btn btn-secondary" onClick={() => dialog.current.close()}>
            Keep the task
          </button>
          <button type="button" className="btn btn-danger" disabled={state.busy} onClick={remove}>
            {state.busy ? 'Deleting…' : 'Delete task'}
          </button>
        </div>
      </dialog>
    </>
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

export default function TaskDetail() {
  const { taskId } = useParams()
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
      <Link to="/parent/tasks" className="inline-flex min-h-11 items-center font-medium text-navy-800 underline underline-offset-4">
        Tasks
      </Link>
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
        <Message tone="success" className="mt-4">
          Changes saved.
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
          <Changes task={task} />
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
