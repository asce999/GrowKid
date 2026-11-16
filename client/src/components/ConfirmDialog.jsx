import { useId, useImperativeHandle, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { errorText } from '../utils/messages.js'
import { noticeExpiry } from '../hooks/useLoad.js'
import { Message } from './states.jsx'
import { busyProps } from '../utils/forms.js'

/**
 * The confirm step every serious act uses (final plan Phase 5, item 1; DESIGN.md section 18): a native modal dialog, so Escape
 * closes it and the browser returns the focus to the button that opened it. The heading says the act as a question, the text says
 * what follows, the first button backs out in words ("Keep the task"), and the second does the act. `danger` draws the act red and
 * the heading with a warning; without it the act is the primary button, for a step that loses nothing.
 *
 * Open it through the ref: ref.current.open(). act() runs on the second button; a refusal is shown inside the dialog.
 */
export default function ConfirmDialog({ ref, title, children, keep, confirm, busyText, danger = false, act }) {
  const dialog = useRef(null)
  const id = useId()
  const [state, setState] = useState({})
  useImperativeHandle(ref, () => ({
    open: () => {
      setState({})
      dialog.current.showModal()
    },
    close: () => dialog.current.close(),
  }))

  async function run() {
    setState({ busy: true })
    try {
      await act()
      setState({})
    } catch (failure) {
      setState({ problem: errorText(noticeExpiry(failure)) })
    }
  }

  return (
    <dialog ref={dialog} className="dialog" aria-labelledby={id}>
      <h2 id={id} className="type-subheading flex items-center gap-2">
        {danger && <TriangleAlert className="size-5 shrink-0 text-coral-700" aria-hidden="true" />}
        {title}
      </h2>
      <div className="mt-2 break-words">{children}</div>
      {state.problem && (
        <Message tone="danger" alert className="mt-4">
          {state.problem}
        </Message>
      )}
      <div className="mt-6 grid gap-3 sm:flex">
        <button type="button" className="btn btn-secondary" onClick={() => dialog.current.close()}>
          {keep}
        </button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} {...busyProps(state.busy)} onClick={run}>
          {state.busy ? busyText : confirm}
        </button>
      </div>
    </dialog>
  )
}
