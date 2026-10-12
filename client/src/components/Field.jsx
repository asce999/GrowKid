import { useId, useState } from 'react'
import { Check, Circle, CircleAlert } from 'lucide-react'

/**
 * A labelled input with its hint and its error wired up for screen readers.
 * error is shown beside the field and says what to do. after sits inside the input, on the right.
 * as="textarea" or as="select" (with its options as children) for the other controls.
 */
export function Field({ label, hint, error, after, as: Control = 'input', inputClassName = '', ...input }) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <div className="relative">
        <Control
          id={id}
          className={`field ${inputClassName}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...input}
        />
        {after}
      </div>
      {hint && (
        <div id={`${id}-hint`} className="type-small muted">
          {hint}
        </div>
      )}
      {error && (
        <p id={`${id}-error`} className="type-small flex items-start gap-1.5 text-coral-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

/** A password input with a Show / Hide button. startVisible for a password someone else must be told. */
export function PasswordField({ startVisible = false, ...field }) {
  const [visible, setVisible] = useState(startVisible)
  return (
    <Field
      {...field}
      type={visible ? 'text' : 'password'}
      inputClassName="pr-20"
      autoCapitalize="none"
      spellCheck="false"
      after={
        <button
          type="button"
          className="btn btn-text absolute inset-y-0.5 right-0.5 min-h-0 px-3"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      }
    />
  )
}

/** One requirement that ticks itself off as you type. */
export function Requirement({ met, children }) {
  const Icon = met ? Check : Circle
  return (
    <span className={`flex items-center gap-1.5 ${met ? 'font-medium text-sprout-800' : ''}`}>
      <Icon className="size-4 shrink-0" strokeWidth={met ? 3 : 2} aria-hidden="true" />
      {children}
      <span className="sr-only">{met ? '(done)' : '(not yet)'}</span>
    </span>
  )
}
