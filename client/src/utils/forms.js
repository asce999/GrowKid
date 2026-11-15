import { errorText, passwordRefusal } from './messages.js'

/** After a refused submit: wait for the errors to render, then go to the first one. */
export function focusFirstInvalid(form) {
  setTimeout(() => form?.querySelector('[aria-invalid="true"]')?.focus())
}

/**
 * The server's reason for refusing this exact password as easy to guess (rule 27, L4), or null. The form shows `text` on the
 * password field for as long as the field still holds `value`.
 */
export function refusedPassword(error, field, value) {
  const text = error.code === 'INVALID' && passwordRefusal(error.fields?.[field])
  return text ? { value, text } : null
}

/** What to say under a form the server would not take. */
export const submitProblem = (error) =>
  error.code === 'INVALID' ? 'Check the details above and try again.' : errorText(error)
