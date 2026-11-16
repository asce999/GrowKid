import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { KeyRound, TriangleAlert } from 'lucide-react'
import * as api from '../api/index.js'
import { Field, PasswordField, Requirement } from '../components/Field.jsx'
import { ErrorState, Message, PageLoading, Result } from '../components/states.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { whenText } from '../utils/format.js'
import { focusFirstInvalid, refusedPassword, submitProblem } from '../utils/forms.js'
import { errorText } from '../utils/messages.js'
import { asUsername, rules } from '../utils/rules.js'
import { makePassword } from '../utils/words.js'
import NotFound from './NotFound.jsx'

// Add a child, or edit one. A child's sign-in exists only here (decision D1), so the three
// moments where a parent could lose access or data each get their own unmistakable step:
// the new details are shown once, a reset says the old password dies, and removing asks twice.

function AddChild() {
  const navigate = useNavigate()
  const [values, setValues] = useState({ name: '', username: '', password: '' })
  const [consent, setConsent] = useState(false) // C8: the parent's tick for this child
  const [tried, setTried] = useState(false)
  const [takenUsername, setTakenUsername] = useState(null)
  const [refused, setRefused] = useState(null)
  const [problem, setProblem] = useState(null)
  const [busy, setBusy] = useState(false)
  const form = useRef(null)
  const passwordInput = useRef(null)
  // a refusal was judged against all three, so changing any of them lets the form be sent again
  const sent = `${values.name}\n${values.username}\n${values.password}`

  const errors = {
    name: rules.name(values.name),
    username:
      rules.username(values.username) ??
      (takenUsername === values.username ? 'That username is taken. Try another, or add a number.' : null),
    password: rules.childPassword(values.password) ?? (refused?.value === sent ? refused.text : null),
    consent: consent ? null : `Tick this to confirm you are ${values.name.trim() ? `${values.name.trim()}’s` : 'this child’s'} parent or guardian.`,
  }
  const shown = (field) => (tried || (field === 'username' && takenUsername) ? errors[field] : null)
  const who = values.name.trim() || 'Your child'
  const whose = values.name.trim() ? `${values.name.trim()}’s` : 'this child’s'

  async function submit(event) {
    event.preventDefault()
    setTried(true)
    setProblem(null)
    if (Object.values(errors).some(Boolean)) return focusFirstInvalid(form.current)
    setBusy(true)
    try {
      const child = await api.addChild({ ...values, consent })
      // Family shows these once, then forgets them
      navigate('/parent/family', { state: { added: { ...child, password: values.password } } })
    } catch (error) {
      noticeExpiry(error)
      const guessable = refusedPassword(error, 'password', sent)
      if (error.code === 'USERNAME_TAKEN') setTakenUsername(values.username)
      else if (!guessable) setProblem(submitProblem(error))
      // drawn at once, so the field is marked and the button is enabled again before the focus moves to the field
      flushSync(() => {
        setRefused(guessable)
        setBusy(false)
      })
      if (guessable) focusFirstInvalid(form.current)
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
              <Requirement met={values.password.length >= 8}>At least 8 characters</Requirement>
              <span className="mt-1 block">Pick one {who === 'Your child' ? 'your child' : who} can remember.</span>
            </>
          }
          error={shown('password')}
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          autoComplete="off"
          ref={passwordInput}
        />
        <button
          type="button"
          className="btn btn-text justify-self-start"
          onClick={() => {
            setValues((v) => ({ ...v, password: makePassword(v.name, v.username) }))
            passwordInput.current.focus() // the field is read out with its new value
          }}
        >
          Make one for me
        </button>

        {!errors.username && (
          <Message>
            {who} will sign in with the username <span className="font-semibold">{values.username}</span>.
          </Message>
        )}
        <div className="grid gap-2">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              aria-invalid={shown('consent') ? 'true' : undefined}
              aria-describedby={shown('consent') ? 'consent-error' : undefined}
            />
            <span>
              I am {whose} parent or guardian, and I agree to GrowKid keeping {whose} tasks, photos and videos as Safety and privacy
              describes.
            </span>
          </label>
          {shown('consent') && (
            <p id="consent-error" className="type-small text-coral-700">
              {errors.consent}
            </p>
          )}
          <p className="type-small muted">
            <Link to="/privacy" className="font-medium text-navy-800 underline underline-offset-4">
              Read Safety and privacy
            </Link>
          </p>
        </div>
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
  const passwordInput = useRef(null)
  const error = state.refused?.value === password ? state.refused.text : state.tried ? rules.childPassword(password) : null

  async function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    if (rules.childPassword(password)) return setState({ tried: true })
    setState({ busy: true })
    try {
      await api.resetChildPassword(child.id, password)
      setState({ done: password }) // shown once, here, then gone when the parent leaves the page
      setPassword('')
    } catch (failure) {
      noticeExpiry(failure)
      const refused = refusedPassword(failure, 'password', password)
      flushSync(() => setState(refused ? { refused } : { problem: errorText(failure) })) // drawn before the focus moves
      if (refused) focusFirstInvalid(form)
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
            hint={<Requirement met={password.length >= 8}>At least 8 characters</Requirement>}
            error={error}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            ref={passwordInput}
          />
          <button
            type="button"
            className="btn btn-text justify-self-start"
            onClick={() => {
              setPassword(makePassword(child.name, child.username))
              passwordInput.current.focus() // the field is read out with its new value
            }}
          >
            Make one for me
          </button>
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

/** Rule 26, L5: ends the child's sessions on every device. The password stays, so the child signs in again with it. */
function SignOutEverywhere({ child }) {
  const dialog = useRef(null)
  const [state, setState] = useState({})

  async function end() {
    setState({ busy: true })
    try {
      await api.endChildSessions(child.id)
      dialog.current.close()
      setState({ done: true })
    } catch (failure) {
      noticeExpiry(failure)
      setState(dialog.current?.open ? { problem: errorText(failure) } : {}) // closed meanwhile: nothing to show it in
    }
  }

  return (
    <div className="grid max-w-md gap-4">
      <p className="muted">
        Use this if {child.name} is still signed in on a device they no longer use, or one that is lost. The password stays the same.
      </p>
      {state.done && (
        <Message tone="success" role="status">
          {child.name} is signed out everywhere.
        </Message>
      )}
      <button type="button" className="btn btn-secondary justify-self-start" onClick={() => dialog.current.showModal()}>
        Sign {child.name} out everywhere
      </button>

      <dialog ref={dialog} className="dialog" aria-labelledby="sessions-title" onClose={() => setState((s) => (s.done ? s : {}))}>
        <h2 id="sessions-title" className="type-subheading">
          Sign {child.name} out everywhere?
        </h2>
        <p className="mt-2">
          {child.name} is signed out on every phone, tablet and computer, and signs in again with the same username and password.
        </p>
        {state.problem && (
          <Message tone="danger" alert className="mt-4">
            {state.problem}
          </Message>
        )}
        <div className="mt-6 grid gap-3 sm:flex">
          <button type="button" className="btn btn-secondary" onClick={() => dialog.current.close()}>
            Keep {child.name} signed in
          </button>
          <button type="button" className="btn btn-primary" disabled={state.busy} onClick={end}>
            {state.busy ? 'Signing out…' : `Sign ${child.name} out everywhere`}
          </button>
        </div>
      </dialog>
    </div>
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

/** K7: whether the child has agreed to the family agreement, and "Ask again", which clears it so Today asks once more. */
function Agreement({ child, onChange }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  async function again() {
    setBusy(true)
    try {
      await api.askAgreementAgain(child.id)
      onChange({ ...child, agreedAt: undefined })
      setResult({ tone: 'success', text: `Today will ask ${child.name} again.` })
    } catch (error) {
      setResult({ tone: 'danger', text: errorText(noticeExpiry(error)) })
    }
    setBusy(false)
  }
  return (
    <>
      <p className="max-w-prose">
        {child.agreedAt ? (
          <>
            {child.name} agreed to their repeating tasks and the family’s rewards: <time dateTime={child.agreedAt}>{whenText(child.agreedAt)}</time>.
          </>
        ) : (
          `Not agreed yet. Today shows ${child.name} the agreement while they have a repeating task or the family has a reward.`
        )}
      </p>
      {child.agreedAt && (
        <button type="button" className="btn btn-secondary mt-4" disabled={busy} onClick={again}>
          Ask again
        </button>
      )}
      <Result result={result} />
    </>
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
      <section className="mt-8 border-t pt-6" aria-labelledby="sessions-section-title">
        <h2 id="sessions-section-title" className="type-subheading mb-4">
          Signed-in devices
        </h2>
        <SignOutEverywhere child={child} />
      </section>
      <section className="mt-8 border-t pt-6" aria-labelledby="agreement-section-title">
        <h2 id="agreement-section-title" className="type-subheading mb-4">
          Agreement
        </h2>
        <Agreement child={child} onChange={setRenamed} />
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
