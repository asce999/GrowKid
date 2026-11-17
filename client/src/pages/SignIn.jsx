import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import * as api from '../api/index.js'
import { Field, PasswordField } from '../components/Field.jsx'
import { AuthShell } from '../components/Shells.jsx'
import { Message } from '../components/states.jsx'
import { useLoad } from '../hooks/useLoad.js'
import { useSession } from '../store/session.js'
import { errorText } from '../utils/messages.js'
import { busyProps } from '../utils/forms.js'

// One page for a parent, a child and the moderator, with no role to pick (decision D1).
// Nothing is remembered from the last person: both fields start empty on every visit.

const WHO_TYPES_WHAT = (
  <dl className="grid gap-5">
    <div>
      <dt className="type-subheading">Parents</dt>
      <dd className="muted">Sign in with your email.</dd>
    </div>
    <div>
      <dt className="type-subheading">Children</dt>
      <dd className="muted">Sign in with the username your parent gave you.</dd>
    </div>
  </dl>
)

export default function SignIn() {
  const signIn = useSession((s) => s.signIn)
  const ended = useSession((s) => s.ended)
  const from = useLocation().state?.from
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState(null)
  const [busy, setBusy] = useState(false)
  // T1: a moderator's second step. It belongs to the details it followed, so changing either of them hides it again.
  const [code, setCode] = useState('')
  const [needsCode, setNeedsCode] = useState(false)
  const first = useRef(null)
  const codeBox = useRef(null)
  const demo = useLoad(api.listDemoSignIns)
  const changed = (set) => (e) => {
    set(e.target.value)
    setNeedsCode(false)
    setCode('')
  }

  async function submit(event) {
    event.preventDefault()
    if (!identifier.trim() || !password) {
      setProblem('Type your email or username, and your password.')
      return
    }
    if (needsCode && !code.trim()) {
      setProblem(errorText({ code: 'NEEDS_CODE' }))
      codeBox.current?.querySelector('input')?.focus()
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      await signIn({ identifier, password, ...(needsCode && { code }) }) // the route guard then sends them to their own home
    } catch (error) {
      if (error.code === 'NEEDS_CODE') {
        // drawn at once, so the code field exists before the focus moves into it
        flushSync(() => {
          setNeedsCode(true)
          setBusy(false)
          setProblem(error.fields?.code === 'wrong' ? 'That code did not match. Wait for the next code in your app, then try again.' : null)
        })
        codeBox.current?.querySelector('input')?.focus()
        return
      }
      setProblem(
        error.code === 'WRONG_DETAILS'
          ? 'That email or username and password do not match. Check both and try again.'
          : errorText(error),
      )
      setBusy(false)
      first.current?.querySelector('input')?.focus()
    }
  }

  return (
    <AuthShell aside={WHO_TYPES_WHAT}>
      <title>Sign in – GrowKid</title>
      <h1>Sign in</h1>

      {ended === 'expired' && (
        <Message className="mt-4">You were signed out. Sign in again to carry on.</Message>
      )}
      {!ended && from && <Message className="mt-4">Sign in to open that page.</Message>}

      <form className="mt-6 grid gap-5" onSubmit={submit} noValidate>
        <div ref={first}>
          <Field
            label="Email or username"
            hint={<span className="lg:hidden">Parents use their email. Children use their username.</span>}
            value={identifier}
            onChange={changed(setIdentifier)}
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
          />
        </div>
        <PasswordField
          label="Password"
          value={password}
          onChange={changed(setPassword)}
          name="password"
          autoComplete="current-password"
        />
        {needsCode && (
          <>
            <Message role="status">Your password is right. Now type the code from your authenticator app.</Message>
            <div ref={codeBox}>
              <Field
                label="Code"
                hint="6 digits. It changes every 30 seconds."
                value={code}
                onChange={(e) => setCode(e.target.value)}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck="false"
                maxLength={7}
              />
            </div>
          </>
        )}
        {problem && (
          <Message tone="danger" alert>
            {problem}
          </Message>
        )}
        <button className="btn btn-lg btn-primary w-full sm:w-auto sm:justify-self-start" {...busyProps(busy)}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <details className="mt-6">
        <summary className="min-h-11 cursor-pointer py-2.5 font-medium text-navy-800 underline underline-offset-4">
          Forgot your password?
        </summary>
        <p className="muted mt-2">
          If you are a child, ask your parent. They can set a new password for you. If you are a parent,{' '}
          <Link to="/forgot" className="font-medium text-navy-800 underline underline-offset-4">
            set a new password with your recovery code
          </Link>
          .
        </p>
      </details>

      <p className="mt-6">
        New to GrowKid?{' '}
        <Link to="/signup" className="font-medium text-navy-800 underline underline-offset-4">
          Create a parent account
        </Link>
      </p>

      {demo.data?.length > 0 && (
        <section className="not-yet mt-10 rounded-card p-4">
          <h2 className="font-medium">Demo sign-ins</h2>
          <p className="type-small muted">Shown in development builds only.</p>
          <ul className="type-small mt-3 grid gap-2">
            {demo.data.map(({ who, identifier: id, password: pw }) => (
              <li key={id} className="flex flex-wrap items-center justify-between gap-x-3">
                <span>
                  <span className="font-medium">{who}</span>
                  <span className="muted block">
                    {id} with {pw}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-text"
                  onClick={() => {
                    setIdentifier(id)
                    setPassword(pw)
                    setProblem(null)
                    setNeedsCode(false) // the code step belongs to the details it followed
                    setCode('')
                  }}
                >
                  Fill in
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AuthShell>
  )
}
