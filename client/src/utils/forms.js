import { errorText, passwordRefusal } from './messages.js'

/**
 * Phase 7, item 7: a button that is busy stays focusable. aria-disabled says it is unavailable; the click is swallowed before the
 * button's own handler, and preventDefault stops a submit button sending its form. disabled would drop the focus to the page.
 */
export const busyProps = (busy) => ({
  'aria-disabled': busy ? 'true' : undefined,
  onClickCapture: busy
    ? (event) => {
        event.preventDefault()
        event.stopPropagation()
      }
    : undefined,
})

/**
 * Phase 7, item 6: a ref for a message that arrives with a page change, so it takes the focus and is read. Deferred, because the root
 * layout moves the focus to the page after every change of address, after the page's own effects.
 */
export const focusLater = (element) => {
  if (element) setTimeout(() => element.focus(), 0)
}

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
