import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { KeyRound, TriangleAlert } from 'lucide-react'
import * as api from '../api/index.js'
import { Field, PasswordField, Requirement } from '../components/Field.jsx'
import { ErrorState, Message, PageLoading } from '../components/states.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { focusFirstInvalid, submitProblem } from '../utils/forms.js'
import { errorText } from '../utils/messages.js'
import { asUsername, rules } from '../utils/rules.js'
import NotFound from './NotFound.jsx'

// Add a child, or edit one. A child's sign-in exists only here (decision D1), so the three
// moments where a parent could lose access or data each get their own unmistakable step:
// the new details are shown once, a reset says the old password dies, and removing asks twice.

function AddChild() {
  const navigate = useNavigate()
  const [values, setValues] = useState({ name: '', username: '', password: '' })
  const [tried, setTried] = useState(false)
  const [takenUsername, setTakenUsername] = useState(null)
  const [problem, setProblem] = useState(null)
  const [busy, setBusy] = useState(false)
  const form = useRef(null)

  const errors = {
    name: rules.name(values.name),
    username:
      rules.username(values.username) ??
      (takenUsername === values.username ? 'That username is taken. Try another, or add a number.' : null),
    password: rules.childPassword(values.password),
  }
  const shown = (field) => (tried || (field === 'username' && takenUsername) ? errors[field] : null)
  const who = values.name.trim() || 'Your child'

  async function submit(event) {
    event.preventDefault()
    setTried(true)
    setProblem(null)
    if (Object.values(errors).some(Boolean)) return focusFirstInvalid(form.current)
    setBusy(true)
    try {
      const child = await api.addChild(values)
      // Family shows these once, then forgets them
      navigate('/parent/family', { state: { added: { ...child, password: values.password } } })
    } catch (error) {
      noticeExpiry(error)
      if (error.code === 'USERNAME_TAKEN') setTakenUsername(values.username)
      else setProblem(submitProblem(error))
      setBusy(false)
    }
  }

  return (
    <>
      <title>Add a child – GrowKid</title>
      <h1>Add a child</h1>
      <p className="muted mt-2 max-w-prose">
        You choose how your child signs in. They cannot create an account themselves.
      </p>

      <form ref={form} className="mt-6 grid max-w-md gap-5" onSubmit={submit} noValidate>
        <Field
          label="Child’s name"
          error={shown('name')}
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          autoComplete="off"
        />
        <Field
          label="Username"
          hint="They type this to sign in. Lowercase letters and numbers, 3 to 20 long."
          error={shown('username')}
          value={values.username}
          onChange={(e) => setValues((v) => ({ ...v, username: asUsername(e.target.value) }))}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck="false"
        />
        <PasswordField
          startVisible
          label="Password"
          hint={
            <>
              <Requirement met={!errors.password}>At least 6 characters</Requirement>
              <span className="mt-1 block">Pick one {who === 'Your child' ? 'your child' : who} can remember.</span>
            </>
          }
          error={shown('password')}
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          autoComplete="off"
        />

        {!errors.username && (
          <Message>
            {who} will sign in with the username <span className="font-semibold">{values.username}</span>.
          </Message>
        )}
        {problem && (
          <Message tone="danger" alert>
            {problem}
          </Message>
        )}
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add child'}
          </button>
          <Link to="/parent/family" className="btn btn-text">
            Cancel
          </Link>
        </div>
      </form>
    </>
  )
}

function Rename({ child, onRenamed }) {
  const [name, setName] = useState(child.name)
  const [state, setState] = useState({})
  const error = state.tried ? rules.name(name) : null

  async function submit(event) {
    event.preventDefault()
    if (rules.name(name)) return setState({ tried: true })
    setState({ busy: true })
    try {
      onRenamed(await api.renameChild(child.id, name))
      setState({ saved: true })
    } catch (failure) {
      setState({ problem: errorText(noticeExpiry(failure)) })
    }
  }

  return (
    <form className="grid max-w-md gap-4" onSubmit={submit} noValidate>
      <Field
        label="Child’s name"
        error={error}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setState((s) => ({ tried: s.tried, busy: s.busy }))
        }}
        autoComplete="off"
      />
      {state.problem && (
        <Message tone="danger" alert>
          {state.problem}
        </Message>
      )}
      {state.saved && <Message tone="success">Name saved.</Message>}
      <button className="btn btn-primary justify-self-start" disabled={state.busy}>
        {state.busy ? 'Saving…' : 'Save name'}
      </button>
    </form>
  )
}

function ResetPassword({ child }) {
  const [password, setPassword] = useState('')
  const [state, setState] = useState({})
  const error = state.tried ? rules.childPassword(password) : null

  async function submit(event) {
    event.preventDefault()
    if (rules.childPassword(password)) return setState({ tried: true })
    setState({ busy: true })
    try {
      await api.resetChildPassword(child.id, password)
      setState({ done: password }) // shown once, here, then gone when the parent leaves the page
      setPassword('')
    } catch (failure) {
      setState({ problem: errorText(noticeExpiry(failure)) })
    }
  }

  return (
    <form className="grid max-w-md gap-4" onSubmit={submit} noValidate>
      <p className="muted">
        Set a new password if {child.name} has forgotten theirs. The old password stops working straight away.
      </p>
      {state.done ? (
        <div className="rounded-card border-2 border-navy-800 bg-white p-4" role="status">
          <p className="flex items-center gap-2 font-semibold">
            <KeyRound className="size-5" aria-hidden="true" />
            New password for {child.username}: {state.done}
          </p>
          <p className="type-small muted mt-1">Tell {child.name} now. It is not shown again.</p>
        </div>
      ) : (
        <>
          <PasswordField
            startVisible
            label="New password"
            hint={<Requirement met={!rules.childPassword(password)}>At least 6 characters</Requirement>}
            error={error}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
          {state.problem && (
            <Message tone="danger" alert>
              {state.problem}
            </Message>
          )}
          <button className="btn btn-secondary justify-self-start" disabled={state.busy}>
            {state.busy ? 'Resetting…' : 'Reset password'}
          </button>
        </>
      )}
    </form>
  )
}

function Remove({ child }) {
  const navigate = useNavigate()
  const dialog = useRef(null)
  const [state, setState] = useState({})

  async function remove() {
    setState({ busy: true })
    try {
      await api.removeChild(child.id)
      navigate('/parent/family', { state: { removed: child.name } })
    } catch (failure) {
      setState({ problem: errorText(noticeExpiry(failure)) })
    }
  }

  return (
    <div className="grid max-w-md gap-4">
      <p className="muted">
        This deletes {child.name}’s sign-in, tasks, proofs and progress. It cannot be undone.
      </p>
      <button type="button" className="btn btn-danger justify-self-start" onClick={() => dialog.current.showModal()}>
        Remove {child.name}
      </button>

      <dialog ref={dialog} className="dialog" aria-labelledby="remove-title">
        <h2 id="remove-title" className="type-subheading flex items-center gap-2">
          <TriangleAlert className="size-5 text-coral-700" aria-hidden="true" />
          Remove {child.name}?
        </h2>
        <p className="mt-2">
          {child.name} will no longer be able to sign in. Their tasks, proofs and progress are deleted for good, and so are
          their reports that a moderator has answered. A report no moderator has answered yet is kept for the moderator, with
          no account and no link back to your family.
        </p>
        {state.problem && (
          <Message tone="danger" alert className="mt-4">
            {state.problem}
          </Message>
        )}
        <div className="mt-6 grid gap-3 sm:flex">
          <button type="button" className="btn btn-secondary" onClick={() => dialog.current.close()}>
            Keep {child.name}
          </button>
          <button type="button" className="btn btn-danger" disabled={state.busy} onClick={remove}>
            {state.busy ? 'Removing…' : `Remove ${child.name}`}
          </button>
        </div>
      </dialog>
    </div>
  )
}

function EditChild({ id }) {
  const loaded = useLoad(() => api.getChild(id), [id])
  const [renamed, setRenamed] = useState(null)

  if (loaded.status === 'loading') return <PageLoading rows={3} />
  if (loaded.status === 'error') {
    // another family's child looks exactly like one that does not exist
    return loaded.error.code === 'NOT_FOUND' ? (
      <NotFound />
    ) : (
      <ErrorState error={loaded.error} onRetry={loaded.reload} />
    )
  }
  const child = renamed ?? loaded.data

  return (
    <>
      <title>{`${child.name} – GrowKid`}</title>
      <Link to="/parent/family" className="inline-flex min-h-11 items-center font-medium text-navy-800 underline underline-offset-4">
        Family
      </Link>
      <h1>{child.name}</h1>
      <p className="muted mt-2">Signs in as {child.username}. A username cannot be changed.</p>

      <section className="mt-8 border-t pt-6" aria-labelledby="rename-title">
        <h2 id="rename-title" className="type-subheading mb-4">
          Name
        </h2>
        <Rename child={child} onRenamed={setRenamed} />
      </section>
      <section className="mt-8 border-t pt-6" aria-labelledby="password-title">
        <h2 id="password-title" className="type-subheading mb-4">
          Password
        </h2>
        <ResetPassword child={child} />
      </section>
      <section className="mt-8 border-t pt-6" aria-labelledby="remove-section-title">
        <h2 id="remove-section-title" className="type-subheading mb-4">
          Remove {child.name}
        </h2>
        <Remove child={child} />
      </section>
    </>
  )
}

export default function ChildForm() {
  const { childId } = useParams()
  return childId ? <EditChild key={childId} id={childId} /> : <AddChild />
}
