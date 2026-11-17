import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api/index.js'
import { Field, PasswordField, Requirement } from '../components/Field.jsx'
import { AuthShell } from '../components/Shells.jsx'
import { Message } from '../components/states.jsx'
import { useForm } from '../hooks/useForm.js'
import { busyProps, focusFirstInvalid, focusLater, refusedPassword } from '../utils/forms.js'
import { rules } from '../utils/rules.js'

// T5: a parent who forgot their password sets a new one with their email and the recovery code they saved. A child's password is
// still set by their parent, from Family.

const WHO = (
  <dl className="grid gap-5">
    <div>
      <dt className="type-subheading">Parents</dt>
      <dd className="muted">Use the recovery code from when you made your account, or a newer one from Settings.</dd>
    </div>
    <div>
      <dt className="type-subheading">Children</dt>
      <dd className="muted">Ask your parent. They can set a new password for you from Family.</dd>
    </div>
  </dl>
)

const link = 'font-medium text-navy-800 underline underline-offset-4'

export default function Forgot() {
  const { form, values, field, busy, problem, setProblem, shown, submit } = useForm({ email: '', code: '', password: '' })
  const [refused, setRefused] = useState(null) // the new password the server found easy to guess, while it is still the one typed
  const [done, setDone] = useState(false)
  const errors = {
    email: rules.email(values.email),
    code: values.code.trim() ? null : 'Type your recovery code.',
    password: rules.parentPassword(values.password) ?? (refused?.value === values.password ? refused.text : null),
  }
  const send = (event) =>
    submit(
      event,
      errors,
      async () => {
        await api.resetPassword(values)
        setDone(true)
      },
      (failure) => {
        if (failure.code === 'WRONG_DETAILS') {
          setProblem('That email and recovery code do not match. Check both and try again.')
          return true
        }
        const guessable = refusedPassword(failure, 'password', values.password)
        if (!guessable) return false
        setRefused(guessable)
        focusFirstInvalid(form.current)
        return true
      },
    )

  return (
    <AuthShell aside={WHO}>
      <title>Set a new password – GrowKid</title>
      <h1>Set a new password</h1>
      <p className="muted mt-2">For parents. You need the recovery code you saved when you made your account.</p>

      {done ? (
        <div className="mt-6 grid justify-items-start gap-4">
          <Message ref={focusLater} tabIndex={-1} tone="success" role="status">
            Your password is changed, and that recovery code is used up.
          </Message>
          <Link to="/login" className="btn btn-primary">
            Sign in
          </Link>
          <p className="muted">After you sign in, make a new recovery code in Settings.</p>
        </div>
      ) : (
        <>
          <form ref={form} className="mt-6 grid gap-5" onSubmit={send} noValidate>
            <Field
              label="Email"
              hint="You sign in with this."
              error={shown(errors, 'email')}
              value={values.email}
              onChange={field('email')}
              type="email"
              name="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck="false"
            />
            <Field
              label="Recovery code"
              hint="16 letters and numbers. Dashes and spaces do not matter."
              error={shown(errors, 'code')}
              value={values.code}
              onChange={field('code')}
              name="recovery-code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
            />
            <PasswordField
              label="New password"
              hint={<Requirement met={values.password.length >= 8}>At least 8 characters</Requirement>}
              error={shown(errors, 'password')}
              value={values.password}
              onChange={field('password')}
              name="password"
              autoComplete="new-password"
            />
            {problem && (
              <Message tone="danger" alert>
                {problem}
              </Message>
            )}
            <button className="btn btn-lg btn-primary w-full sm:w-auto sm:justify-self-start" {...busyProps(busy)}>
              {busy ? 'Setting your password…' : 'Set the new password'}
            </button>
          </form>
          <p className="mt-6">
            No recovery code? Then a parent’s password cannot be reset in this version.{' '}
            <Link to="/login" className={link}>
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}
