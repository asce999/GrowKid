import { useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link } from 'react-router-dom'
import * as api from '../api/index.js'
import { Field, PasswordField, Requirement } from '../components/Field.jsx'
import { AuthShell } from '../components/Shells.jsx'
import { Message } from '../components/states.jsx'
import { useLoad } from '../hooks/useLoad.js'
import { useSession } from '../store/session.js'
import { focusFirstInvalid, refusedPassword, submitProblem } from '../utils/forms.js'
import { rules } from '../utils/rules.js'

// Only parents sign up (decision D1). A new parent is signed in and lands on Overview.

/**
 * A time zone's one name. Browsers that fold aliases make Asia/Calcutta and Asia/Kolkata compare equal; where one does not, or does
 * not know a name at all (RangeError), the name stays as given: nothing is pre-selected and the parent chooses.
 */
function zoneName(timeZone) {
  try {
    return new Intl.DateTimeFormat('en', { timeZone }).resolvedOptions().timeZone
  } catch {
    return timeZone
  }
}

/** The code of the one country whose time zone is this device's, or '' when none or several are (rule 25). */
function countryHere(countries) {
  const here = zoneName(undefined)
  const found = countries.filter((c) => zoneName(c.zone) === here)
  return found.length === 1 ? found[0].code : ''
}

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
  const countries = useLoad(api.listCountries)
  // null until they choose: then the country this device is in, if there is just one
  const [values, setValues] = useState({ name: '', email: '', password: '', country: null })
  const guess = useMemo(() => (countries.data ? countryHere(countries.data) : ''), [countries.data])
  const country = values.country ?? guess
  const [isParent, setIsParent] = useState(false)
  const [tried, setTried] = useState(false)
  const [takenEmail, setTakenEmail] = useState(null)
  const [refused, setRefused] = useState(null)
  const [problem, setProblem] = useState(null)
  const [busy, setBusy] = useState(false)
  const form = useRef(null)
  const select = useRef(null)

  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }))
  // a refusal was judged against all three, so changing any of them lets the form be sent again
  const sent = `${values.name}\n${values.email}\n${values.password}`
  const errors = {
    name: rules.name(values.name),
    email:
      rules.email(values.email) ??
      (takenEmail === values.email.trim().toLowerCase()
        ? 'That email already has an account. Sign in instead, or use another email.'
        : null),
    password: rules.parentPassword(values.password) ?? (refused?.value === sent ? refused.text : null),
    country: country
      ? null
      : countries.status === 'ready'
        ? 'Choose the country you live in.'
        : 'Wait for the list of countries, then choose one.',
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
      await signUp({ ...values, country, consent: isParent }) // C8: the tick is the consent; the route guard then sends them to Overview
    } catch (error) {
      const guessable = refusedPassword(error, 'password', sent)
      if (error.code === 'EMAIL_TAKEN') setTakenEmail(values.email.trim().toLowerCase())
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
          hint={<Requirement met={values.password.length >= 8}>At least 8 characters</Requirement>}
          error={shown('password')}
          value={values.password}
          onChange={set('password')}
          name="password"
          autoComplete="new-password"
        />
        <Field
          as="select"
          label="Country"
          hint="Each day starts and ends by the clock in this country. You can change it later in Settings."
          error={shown('country')}
          value={country}
          onChange={set('country')}
          name="country"
          autoComplete="country"
          ref={select}
        >
          <option value="">{countries.status === 'loading' ? 'Loading countries…' : 'Choose a country'}</option>
          {countries.data?.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Field>
        {countries.status === 'error' && (
          <Message tone="danger" alert>
            The list of countries did not load.{' '}
            <button
              type="button"
              className="btn btn-text min-h-0 px-1"
              onClick={() => {
                countries.reload()
                select.current?.focus()
              }}
            >
              Try again
            </button>
          </Message>
        )}

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
            <span>I am the parent or guardian of the children I will add, and I have read Safety and privacy.</span>
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
