import { useRef, useState } from 'react'
import { focusFirstInvalid, submitProblem } from '../utils/forms.js'
import { noticeExpiry } from './useLoad.js'

/**
 * What every form here repeats (final plan Phase 5, item 1): its values, whether it has been sent once (errors show only after
 * that), busy while it is being sent, the general problem, and the first invalid field taking the focus.
 *
 * submit(event, errors, send, onError): with any error set, marks the form tried and focuses the first invalid field; otherwise
 * runs send(). A refusal goes to onError first, which returns true when it showed the refusal itself (on a field, say); any
 * other refusal becomes the form's problem. busy stays on after a success, because a form that succeeds usually leaves the page.
 */
export function useForm(initial) {
  const [values, setValues] = useState(initial)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(null)
  const form = useRef(null)

  /** An onChange for a field: its event's value, or, with `read`, whatever read(event) gives. */
  const field = (name, read = (event) => event.target.value) => (event) => setValues((v) => ({ ...v, [name]: read(event) }))
  const shown = (errors, name) => (tried ? errors[name] : null)

  async function submit(event, errors, send, onError = () => false) {
    event?.preventDefault()
    setTried(true)
    setProblem(null)
    if (Object.values(errors).some(Boolean)) return focusFirstInvalid(form.current)
    setBusy(true)
    try {
      await send()
    } catch (error) {
      noticeExpiry(error)
      if (!onError(error)) setProblem(submitProblem(error))
      setBusy(false)
    }
  }

  return { form, values, setValues, field, tried, busy, setBusy, problem, setProblem, shown, submit }
}
