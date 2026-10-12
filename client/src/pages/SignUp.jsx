import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Field, PasswordField, Requirement } from '../components/Field.jsx'
import { AuthShell } from '../components/Shells.jsx'
import { Message } from '../components/states.jsx'
import { useSession } from '../store/session.js'
import { focusFirstInvalid, submitProblem } from '../utils/forms.js'
import { rules } from '../utils/rules.js'

// Only parents sign up (decision D1). A new parent is signed in and lands on Overview.

const WHAT_HAPPENS = (
  <dl className="grid gap-5">
    <div>
      <dt className="type-subheading">One account for the family</dt>
      <dd className="muted">You add your children after this. Each child gets their own sign-in.</dd>
    </div>
    <div>
      <dt className="type-subheading">Children do not sign up</dt>
      <dd className="muted">A child can only join through a parent.</dd>
    </div>
  </dl>
)

export default function SignUp() {
  const signUp = useSession((s) => s.signUp)
  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const [isParent, setIsParent] = useState(false)
  const [tried, setTried] = useState(false)
  const [takenEmail, setTakenEmail] = useState(null)
  const [problem, setProblem] = useState(null)
  const [busy, setBusy] = useState(false)
  const form = useRef(null)

  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }))
  const errors = {
    name: rules.name(values.name),
    email:
      rules.email(values.email) ??
      (takenEmail === values.email.trim().toLowerCase()
        ? 'That email already has an account. Sign in instead, or use another email.'
        : null),
    password: rules.parentPassword(values.password),
    isParent: isParent ? null : 'Tick this to confirm you are the parent or guardian.',
  }
  const shown = (field) => (tried || (field === 'email' && takenEmail) ? errors[field] : null)

  async function submit(event) {
    event.preventDefault()
    setTried(true)
    setProblem(null)
    if (Object.values(errors).some(Boolean)) return focusFirstInvalid(form.current)
    setBusy(true)
    try {
      await signUp(values) // the route guard then sends them to Overview
    } catch (error) {
      if (error.code === 'EMAIL_TAKEN') setTakenEmail(values.email.trim().toLowerCase())
      else setProblem(submitProblem(error))
      setBusy(false)
    }
  }

  return (
    <AuthShell aside={WHAT_HAPPENS}>
      <title>Create a parent account – GrowKid</title>
      <h1>Create a parent account</h1>
      <p className="muted mt-2 lg:hidden">
        One account for the family. You add your children after this, and each child gets their own sign-in.
      </p>

      <form ref={form} className="mt-6 grid gap-5" onSubmit={submit} noValidate>
        <Field
          label="Your name"
          hint="Your children see this name when you approve their work."
          error={shown('name')}
          value={values.name}
          onChange={set('name')}
          name="name"
          autoComplete="name"
        />
        <Field
          label="Email"
          hint="You sign in with this."
          error={shown('email')}
          value={values.email}
          onChange={set('email')}
          type="email"
          name="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck="false"
        />
        <PasswordField
          label="Password"
          hint={<Requirement met={!errors.password}>At least 8 characters</Requirement>}
          error={shown('password')}
          value={values.password}
          onChange={set('password')}
          name="password"
          autoComplete="new-password"
        />

        <div className="grid gap-2">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0"
              checked={isParent}
              onChange={(e) => setIsParent(e.target.checked)}
              aria-invalid={shown('isParent') ? 'true' : undefined}
              aria-describedby={shown('isParent') ? 'is-parent-error' : undefined}
            />
            <span>I am the parent or guardian of the children I will add.</span>
          </label>
          {shown('isParent') && (
            <p id="is-parent-error" className="type-small text-coral-700">
              {errors.isParent}
            </p>
          )}
          <p className="type-small muted">
            Before you start, read how GrowKid keeps children safe and what it stores in{' '}
            <Link to="/privacy" className="font-medium text-navy-800 underline underline-offset-4">
              Safety and privacy
            </Link>
            .
          </p>
        </div>

        {problem && (
          <Message tone="danger" alert>
            {problem}
          </Message>
        )}
        <button className="btn btn-lg btn-primary w-full sm:w-auto sm:justify-self-start" disabled={busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-navy-800 underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
