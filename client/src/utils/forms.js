import { errorText } from './messages.js'

/** After a refused submit: wait for the errors to render, then go to the first one. */
export function focusFirstInvalid(form) {
  setTimeout(() => form?.querySelector('[aria-invalid="true"]')?.focus())
}

/** What to say under a form the server would not take. */
export const submitProblem = (error) =>
  error.code === 'INVALID' ? 'Check the details above and try again.' : errorText(error)
