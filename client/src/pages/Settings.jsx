import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import * as api from '../api/index.js'
import { Field, PasswordField, Requirement } from '../components/Field.jsx'
import { ErrorState, Message, PageLoading } from '../components/states.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { useSession } from '../store/session.js'
import { focusFirstInvalid } from '../utils/forms.js'
import { errorText } from '../utils/messages.js'
import { rules } from '../utils/rules.js'

// The parent's own account: name, password, the family leaderboard switch, and deleting the
// family's data. Short and plain (DESIGN.md section 12, principle 9). Deleting is the most destructive thing in the product, so
// it says exactly what goes and asks for the password; it is not dressed up as a danger zone.

function Name({ user }) {
  const [name, setName] = useState(user.name)
  const [state, setState] = useState({})

  async function submit(event) {
    event.preventDefault()
    if (rules.name(name)) {
      focusFirstInvalid(event.currentTarget)
      return setState({ tried: true })
    }
    setState({ busy: true })
    try {
      useSession.setState({ user: await api.updateName(name) }) // the shell shows the name
      setState({ saved: true })
    } catch (failure) {
      setState({ problem: errorText(noticeExpiry(failure)) })
    }
  }

  return (
    <form className="grid max-w-md gap-4" onSubmit={submit} noValidate>
      <Field
        label="Your name"
        hint="Your children see it beside every approval and note."
        error={state.tried ? rules.name(name) : null}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setState((s) => ({ tried: s.tried, busy: s.busy }))
        }}
        name="name"
        autoComplete="name"
      />
      {state.problem && (
        <Message tone="danger" alert>
          {state.problem}
        </Message>
      )}
      {state.saved && (
        <Message tone="success" role="status">
          Name saved.
        </Message>
      )}
      <button className="btn btn-primary justify-self-start" disabled={state.busy}>
        {state.busy ? 'Saving…' : 'Save name'}
      </button>
    </form>
  )
}

function Password() {
  const [values, setValues] = useState({ current: '', next: '' })
  const [state, setState] = useState({})
  const errors = {
    current: values.current ? null : 'Type the password you sign in with now.',
    next: rules.parentPassword(values.next),
  }
  const change = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }))
    setState((s) => ({ tried: s.tried, busy: s.busy }))
  }

  async function submit(event) {
    event.preventDefault()
    if (errors.current || errors.next) {
      focusFirstInvalid(event.currentTarget)
      return setState({ tried: true })
    }
    setState({ busy: true })
    try {
      await api.changePassword(values)
      setValues({ current: '', next: '' })
      setState({ saved: true })
    } catch (failure) {
      noticeExpiry(failure)
      setState(failure.code === 'WRONG_PASSWORD' ? { wrong: true } : { problem: errorText(failure) })
    }
  }

  return (
    <form className="grid max-w-md gap-4" onSubmit={submit} noValidate>
      <PasswordField
        label="Current password"
        error={state.wrong ? 'That is not your current password. Check it and try again.' : state.tried ? errors.current : null}
        value={values.current}
        onChange={change('current')}
        autoComplete="current-password"
      />
      <PasswordField
        label="New password"
        hint={<Requirement met={!errors.next}>At least 8 characters</Requirement>}
        error={state.tried ? errors.next : null}
        value={values.next}
        onChange={change('next')}
        autoComplete="new-password"
      />
      {state.problem && (
        <Message tone="danger" alert>
          {state.problem}
        </Message>
      )}
      {state.saved && (
        <Message tone="success" role="status">
          Password changed. Use the new one the next time you sign in.
        </Message>
      )}
      <button className="btn btn-secondary justify-self-start" disabled={state.busy}>
        {state.busy ? 'Changing…' : 'Change password'}
      </button>
    </form>
  )
}

/** The one switch that shows children each other's week. It saves as soon as it is changed. */
function Leaderboard({ settings }) {
  const [on, setOn] = useState(settings.leaderboard)
  const [state, setState] = useState({})
  const box = useRef(null)

  async function change(event) {
    const checked = event.target.checked
    setOn(checked)
    setState({ busy: true })
    let next = { saved: true }
    try {
      await api.setLeaderboard(checked)
    } catch (failure) {
      setOn(!checked) // the box goes back to what is saved
      next = { problem: errorText(noticeExpiry(failure)) }
    }
    // disabling the box dropped the focus from it: draw it enabled again, then put the focus back
    flushSync(() => setState(next))
    box.current?.focus()
  }

  return (
    <div className="grid max-w-prose gap-3">
      <label className="flex min-h-11 items-start gap-3">
        <input ref={box} type="checkbox" className="mt-0.5 size-5 shrink-0" checked={on} disabled={state.busy} onChange={change} />
        <span>Show a weekly leaderboard to my children</span>
      </label>
      <p className="type-small muted">
        Each child sees their brothers’ and sisters’ first names and how many of their tasks were approved this week. Nothing else. It
        starts again every Monday, and it only appears with two or more children.
      </p>
      {state.problem && (
        <Message tone="danger" alert>
          {state.problem}
        </Message>
      )}
      {state.saved && (
        <Message tone="success" role="status">
          Saved.
        </Message>
      )}
    </div>
  )
}

function DeleteFamily({ user, family }) {
  const deleteFamily = useSession((s) => s.deleteFamily)
  const dialog = useRef(null)
  const [password, setPassword] = useState('')
  const [state, setState] = useState({})
  const names = new Intl.ListFormat('en-IN', { type: 'conjunction' }).format(family.map((child) => child.name))

  async function submit(event) {
    event.preventDefault()
    if (!password) {
      focusFirstInvalid(event.currentTarget)
      return setState({ wrong: 'Type your password to delete everything.' })
    }
    setState({ busy: true })
    try {
      await deleteFamily(password) // signed out: the guard leaves for Landing, which says it is done
    } catch (failure) {
      noticeExpiry(failure)
      setState(failure.code === 'WRONG_PASSWORD' ? { wrong: 'That is not your password. Nothing was deleted.' } : { problem: errorText(failure) })
    }
  }

  return (
    <div className="grid max-w-prose gap-4">
      <p className="muted">
        This deletes your account, {family.length > 0 ? `the sign-ins of ${names}` : 'every sign-in'}, every task and every proof, and all
        progress. It cannot be undone. To keep a record, save a report from{' '}
        <Link to="/parent/progress" className="font-medium text-navy-800 underline underline-offset-4">
          Progress
        </Link>{' '}
        first.
      </p>
      <button type="button" className="btn btn-secondary justify-self-start" onClick={() => dialog.current.showModal()}>
        Delete the family’s data…
      </button>

      <dialog ref={dialog} className="dialog" aria-labelledby="delete-title" onClose={() => { setPassword(''); setState({}) }}>
        <form onSubmit={submit} noValidate>
          <h2 id="delete-title" className="type-subheading flex items-center gap-2">
            <TriangleAlert className="size-5 shrink-0 text-coral-700" aria-hidden="true" />
            Delete your family’s data?
          </h2>
          <p className="mt-2">These are deleted for good:</p>
          <ul className="mt-2 grid list-disc gap-1 pl-5">
            <li>your account, {user.email}</li>
            {family.length > 0 && (
              <li>
                the {family.length === 1 ? 'sign-in' : 'sign-ins'} of {names}
              </li>
            )}
            <li>every task, and every photo, video, file and note sent as proof</li>
            <li>all points, levels, streaks and stickers</li>
            <li>every report your family sent that a moderator has answered</li>
          </ul>
          <p className="mt-3">
            A report no moderator has answered yet is kept for the moderator, with no account and no link back to your family.
            It is deleted once it is answered.
          </p>
          <p className="mt-3">Everything else cannot be undone, and no copy is kept.</p>
          <div className="mt-4">
            <PasswordField
              label="Your password"
              hint="Type it to confirm."
              error={state.wrong}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setState((s) => (s.busy ? s : {}))
              }}
              autoComplete="current-password"
            />
          </div>
          {state.problem && (
            <Message tone="danger" alert className="mt-4">
              {state.problem} Nothing was deleted.
            </Message>
          )}
          <div className="mt-6 grid gap-3 sm:flex">
            <button type="button" className="btn btn-secondary" onClick={() => dialog.current.close()}>
              Keep everything
            </button>
            <button className="btn btn-danger" disabled={state.busy}>
              {state.busy ? 'Deleting…' : 'Delete everything'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}

export default function Settings() {
  const user = useSession((s) => s.user)
  const loaded = useLoad(() => Promise.all([api.listChildren(), api.getSettings()]))
  if (!user) return null // deleted a moment ago, and on the way to Landing

  return (
    <>
      <title>Settings – GrowKid</title>
      <h1>Settings</h1>
      {loaded.status === 'loading' ? (
        <div className="mt-6">
          <PageLoading rows={3} />
        </div>
      ) : loaded.status === 'error' ? (
        <div className="mt-6">
          <ErrorState error={loaded.error} onRetry={loaded.reload} />
        </div>
      ) : (
        <>
          <p className="muted mt-2">You sign in with {user.email}. The email cannot be changed in this version.</p>
          <section className="mt-8 border-t pt-6" aria-labelledby="name-title">
            <h2 id="name-title" className="type-subheading mb-4">
              Name
            </h2>
            <Name user={user} />
          </section>
          <section className="mt-8 border-t pt-6" aria-labelledby="password-title">
            <h2 id="password-title" className="type-subheading mb-4">
              Password
            </h2>
            <Password />
          </section>
          <section className="mt-8 border-t pt-6" aria-labelledby="leaderboard-title">
            <h2 id="leaderboard-title" className="type-subheading mb-4">
              Family leaderboard
            </h2>
            <Leaderboard settings={loaded.data[1]} />
          </section>
          <section className="mt-8 border-t pt-6" aria-labelledby="delete-section-title">
            <h2 id="delete-section-title" className="type-subheading mb-4">
              Delete the family’s data
            </h2>
            <DeleteFamily user={user} family={loaded.data[0]} />
          </section>
        </>
      )}
    </>
  )
}
