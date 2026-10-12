import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Camera, FileText, PenLine, Upload } from 'lucide-react'
import * as api from '../api/index.js'
import { Field } from '../components/Field.jsx'
import Proof from '../components/Proof.jsx'
import { Earlier, Note, SentLine, Stamp } from '../components/Review.jsx'
import StatusTag from '../components/StatusTag.jsx'
import { ErrorState, Message, PageLoading } from '../components/states.jsx'
import { CategoryTile, Due, Points } from '../components/Task.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { fileSizeText } from '../utils/format.js'
import { errorText } from '../utils/messages.js'
import { PROOF_TYPES, rules } from '../utils/rules.js'
import { isOpen, statusOf } from '../utils/tasks.js'
import NotFound from './NotFound.jsx'

// A task as the child sees it, and the most repeated action in the product: sending proof.
// It stays on this page, a step at a time: choose, look at it, send. Nothing is awarded here:
// that happens when a parent approves, and then this page carries the stamp.

/** What the server may say about a proof, in the child's words. The chosen proof is always kept. */
const REFUSED = {
  FILE_TYPE: 'That kind of file cannot be sent. Choose a photo, a video or a PDF.',
  FILE_TOO_LARGE: 'That file is too big. The most that can be sent is 25 MB. Choose a smaller one.',
  NETWORK: 'It did not send. Your proof is still here. Check the connection and try again.',
}

/** A file input dressed as a button. The label is what is pressed; the input inside it takes the focus. */
function Chooser({ className, camera = false, disabled, onPick, children }) {
  return (
    <label className={`btn file-button ${className}`}>
      {children}
      <input
        type="file"
        className="sr-only"
        accept={camera ? 'image/*' : PROOF_TYPES}
        capture={camera ? 'environment' : undefined}
        disabled={disabled}
        onChange={onPick}
      />
    </label>
  )
}

function SendProof({ task, again, onSent, onStale }) {
  const [chosen, setChosen] = useState(null) // the file, and an address to preview it from
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState(null)
  const [failed, setFailed] = useState(false)
  const [progress, setProgress] = useState(null) // 0 to 1 while a proof is being sent
  const [over, setOver] = useState(false)
  const [noPlay, setNoPlay] = useState(null) // the address of a video this browser cannot play
  const sendButton = useRef(null)
  const said = useRef(null)
  // A phone or tablet opens its camera first. A desktop gets a file chooser and a place to drop.
  const touch = window.matchMedia('(pointer: coarse)').matches
  const file = chosen?.file
  const sending = progress !== null
  const ready = Boolean(file) || note.trim() !== ''
  // one main button at a time: choosing, until there is something to send
  const main = ready ? 'btn-secondary' : 'btn-primary'

  useEffect(() => {
    if (!chosen) return
    sendButton.current?.focus() // the next press sends it
    return () => URL.revokeObjectURL(chosen.url)
  }, [chosen])
  // on a phone a new message can land under the bottom bar: bring it into view
  useEffect(() => {
    if (problem) said.current?.scrollIntoView({ block: 'nearest' })
  }, [problem])
  // the preview takes its height only once it has loaded, which pushes the button down the page
  const showSend = () => sendButton.current?.scrollIntoView({ block: 'nearest' })

  function choose(picked) {
    if (!picked || sending) return
    const wrong = rules.proofFile(picked)
    setProblem(wrong)
    setFailed(false)
    if (!wrong) setChosen({ file: picked, url: URL.createObjectURL(picked) })
  }
  const pick = (event) => {
    choose(event.target.files[0])
    event.target.value = '' // so the same file can be chosen again
  }

  async function send(event) {
    event.preventDefault()
    setProblem(null)
    setProgress(0)
    try {
      onSent(await api.sendProof(task.id, { file, note }, { onProgress: setProgress }))
    } catch (error) {
      noticeExpiry(error)
      // sent from another device, or deleted, while this page was open: show the task as it is now
      if (error.code === 'LOCKED' || error.code === 'NOT_FOUND') return onStale()
      setProgress(null)
      setFailed(true)
      setProblem(REFUSED[error.code] ?? `${errorText(error)} Your proof is still here.`)
    }
  }

  return (
    <form
      className="mt-8 border-t pt-6"
      onSubmit={send}
      noValidate
      // a file dropped anywhere on the proof is taken, so the browser never opens it instead
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        choose(event.dataTransfer.files[0])
      }}
    >
      <h2 className="type-subheading">{again ? 'Try again' : 'Send proof'}</h2>
      <p className="muted mt-1">{again ? 'Fix what the note says, then send new proof.' : 'Show your parent that it is done.'}</p>

      {file ? (
        <figure className="mt-4 overflow-hidden rounded-card border bg-white">
          {file.type.startsWith('image/') ? (
            <img src={chosen.url} alt="The photo you chose" onLoad={showSend} className="max-h-[45vh] w-full bg-navy-100 object-contain sm:max-h-[60vh]" />
          ) : file.type.startsWith('video/') && noPlay !== chosen.url ? (
            <video src={chosen.url} aria-label="The video you chose" onLoadedMetadata={showSend} onError={() => setNoPlay(chosen.url)} className="max-h-[45vh] w-full bg-navy-100 sm:max-h-[60vh]" controls />
          ) : (
            <p className="flex items-center gap-3 p-4 font-medium">
              <FileText className="size-6 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{file.name}</span>
            </p>
          )}
          <figcaption className="type-small flex flex-wrap items-center justify-between gap-x-4 border-t py-1 pr-2 pl-4">
            <span className="muted min-w-0 truncate">
              {file.name}, {fileSizeText(file.size)}
            </span>
            <Chooser className="btn-text" disabled={sending} onPick={pick}>
              Choose another
            </Chooser>
          </figcaption>
        </figure>
      ) : (
        <div className={`not-yet mt-4 grid gap-2 rounded-card p-4 sm:p-6 ${over ? 'drop-over' : ''}`}>
          {touch && (
            <Chooser camera className={`btn-lg ${main}`} disabled={sending} onPick={pick}>
              <Camera className="size-5 shrink-0" aria-hidden="true" />
              Take a photo
            </Chooser>
          )}
          <Chooser className={touch ? 'btn-text' : `btn-lg ${main}`} disabled={sending} onPick={pick}>
            {!touch && <Upload className="size-5 shrink-0" aria-hidden="true" />}
            Choose a photo, video or file
          </Chooser>
          {!touch && <p className="type-small muted text-center">Or drop it here. A photo, a video or a PDF, up to 25 MB.</p>}
        </div>
      )}

      <details className="mt-3">
        <summary className="btn btn-text cursor-pointer">
          <PenLine className="size-5 shrink-0" aria-hidden="true" />
          Add a note
        </summary>
        <div className="mt-3">
          <Field
            as="textarea"
            label="Note for your parent"
            hint="You can send a note on its own if there is nothing to photograph."
            rows={3}
            maxLength={500}
            name="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={sending}
          />
        </div>
      </details>

      {problem && (
        <Message ref={said} tone="danger" alert className="type-body-child mt-4 scroll-mb-24">
          {problem}
        </Message>
      )}
      {sending && file && (
        <div className="mt-4">
          <p className="font-medium">
            Sending… <span className="tabular-nums">{Math.round(progress * 100)}%</span>
          </p>
          <div className="ruler mt-3" style={{ '--at': `${progress * 100}%` }}>
            <progress value={progress} max={1} aria-label="Sending your proof" />
          </div>
        </div>
      )}
      {ready && (
        <button ref={sendButton} className="btn btn-lg btn-primary mt-6 w-full scroll-mb-24 sm:w-auto sm:min-w-64" disabled={sending}>
          {sending ? 'Sending…' : failed ? 'Try again' : 'Send proof'}
        </button>
      )}
    </form>
  )
}

/** What the newest proof came to: waiting, sent back with a note, or approved with the stamp. */
function Outcome({ task, justNow }) {
  const proof = task.proofs.at(-1)
  const said = useRef(null)
  useEffect(() => {
    if (justNow) said.current?.focus()
  }, [justNow])

  return (
    <section className="mt-8 border-t pt-6">
      {task.status === 'review' && (
        <Message ref={said} tabIndex={-1} role="status" className={`type-body-child ${justNow ? 'settle' : ''}`}>
          <p className="font-semibold">{justNow ? 'Proof sent' : 'Waiting for a parent'}</p>
          <p>Nothing is awarded yet. A parent has to approve it first.</p>
        </Message>
      )}
      {task.status === 'approved' && (
        <>
          <Stamp review={proof.review} />
          <p className="mt-2 flex flex-wrap items-center gap-x-2">
            You earned <Points value={task.points} /> for this task.
          </p>
        </>
      )}
      <h2 className="type-subheading mt-6">What you sent</h2>
      <SentLine proof={proof} className="mt-1" />
      <div className="mt-3">
        <Proof proof={proof} label={`What you sent for ${task.title}`} small />
      </div>
      <Earlier task={task} label={`What you sent for ${task.title}`} />
    </section>
  )
}

function Task({ id }) {
  // live: a parent may review this task while the page is open
  const loaded = useLoad(() => api.getTask(id), [id], { live: true })
  const [justSent, setJustSent] = useState(false)

  if (loaded.status === 'loading') return <PageLoading rows={3} />
  if (loaded.status === 'error') {
    // a task of another child or family looks exactly like one that does not exist
    return loaded.error.code === 'NOT_FOUND' ? (
      <NotFound />
    ) : (
      <ErrorState error={loaded.error} onRetry={loaded.reload} />
    )
  }
  const task = loaded.data
  const sentBack = task.status === 'sentBack'

  return (
    <>
      <title>{`${task.title} – GrowKid`}</title>
      <Link to="/child" className="inline-flex min-h-11 items-center font-medium text-navy-800 underline underline-offset-4">
        Today
      </Link>
      <h1 className="break-words">{task.title}</h1>
      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <CategoryTile task={task} small />
        <StatusTag status={statusOf(task)} />
        <Due task={task} className="type-small font-medium" />
        <Points value={task.points} />
      </p>

      {sentBack && <Note review={task.proofs.at(-1).review} className="type-body-child mt-6" />}
      <h2 className="type-subheading mt-6">What to do</h2>
      <p className="mt-1 break-words whitespace-pre-line">{task.instructions}</p>

      {isOpen(task) && (
        <SendProof
          task={task}
          again={sentBack}
          onSent={(sent) => {
            setJustSent(true)
            loaded.set(sent)
          }}
          onStale={loaded.reload}
        />
      )}
      {task.proofs.length > 0 && <Outcome task={task} justNow={justSent && task.status === 'review'} />}

      <p className="mt-10">
        <Link to={`/report?task=${task.id}`} className="type-small inline-flex min-h-11 items-center text-navy-800 underline underline-offset-4">
          Report a problem with this task
        </Link>
      </p>
    </>
  )
}

export default function ChildTask() {
  const { taskId } = useParams()
  return <Task key={taskId} id={taskId} />
}
