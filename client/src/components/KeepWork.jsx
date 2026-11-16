import { useEffect, useId, useRef, useSyncExternalStore } from 'react'
import { useBlocker } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'

// Final plan Phase 7, item 1: leaving a page with typed work asks first. A router allows one blocker at a time, and a page can hold
// more than one form (Rewards has the reward form and a quest form), so each form only says what it would lose (<KeepWork>) and
// one KeepWorkHost, in the root layout, blocks for all of them.

const unsaved = new Map() // a form's id -> what leaving would lose, while it has typed work
let version = 0
const listeners = new Set()
const changed = () => {
  version++
  listeners.forEach((listener) => listener())
}
const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Says that this form has typed work (`dirty`) and what it is: "the task you typed". Renders nothing. */
export default function KeepWork({ dirty, what }) {
  const id = useId()
  useEffect(() => {
    if (!dirty) return
    unsaved.set(id, what)
    changed()
    return () => {
      unsaved.delete(id)
      changed()
    }
  }, [dirty, what, id])
  return null
}

/**
 * The one blocker: a link, Back or Cancel inside the app opens this dialog while any form has typed work; closing the tab or
 * reloading gets the browser's own question. Staying is the first button, as in ConfirmDialog; leaving is red.
 */
export function KeepWorkHost() {
  useSyncExternalStore(subscribe, () => version)
  const dirty = unsaved.size > 0
  const blocker = useBlocker(({ currentLocation, nextLocation }) => unsaved.size > 0 && currentLocation.pathname !== nextLocation.pathname)
  const dialog = useRef(null)
  const leaving = useRef(false)
  const id = useId()
  const what = [...unsaved.values()].join(' and ')

  useEffect(() => {
    if (blocker.state === 'blocked') {
      leaving.current = false
      dialog.current?.showModal()
    }
  }, [blocker.state])

  useEffect(() => {
    if (!dirty) return
    const warn = (event) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  return (
    // Escape or "Keep editing" closes it and stays; only "Leave" goes on
    <dialog ref={dialog} className="dialog" aria-labelledby={id} onClose={() => !leaving.current && blocker.reset?.()}>
      <h2 id={id} className="type-subheading flex items-center gap-2">
        <TriangleAlert className="size-5 shrink-0 text-coral-700" aria-hidden="true" />
        Leave without saving?
      </h2>
      <p className="mt-2">If you leave now, {what || 'what you typed'} will be lost.</p>
      <div className="mt-6 grid gap-3 sm:flex">
        <button type="button" className="btn btn-secondary" onClick={() => dialog.current.close()}>
          Keep editing
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            leaving.current = true
            dialog.current.close()
            blocker.proceed?.()
          }}
        >
          Leave without saving
        </button>
      </div>
    </dialog>
  )
}
