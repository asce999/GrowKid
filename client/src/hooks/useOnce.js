import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Phase 7, item 3: a note that must not touch the browser's history at all (a new child's password) is carried here, in memory,
// for the next page to take once. A reload loses it, which is the point.
let carried = null
/** Hands a note to the next page that calls useOnce, without putting it in the navigation state. */
export const carry = (note) => {
  carried = note
}

/**
 * Keeps what the last page handed over (a new child's sign-in details, "saved", "deleted") for this visit only: from carry(), or
 * from the navigation state, which is wiped from the browser history at once, so going back or reloading does not show it again.
 */
export function useOnce() {
  const location = useLocation()
  const navigate = useNavigate()
  const [note, setNote] = useState(() => carried ?? location.state)
  useEffect(() => {
    carried = null
    if (location.state) navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location, navigate])
  const dismiss = () => {
    setNote(null)
    document.getElementById('main')?.focus() // the button that was pressed is about to disappear
  }
  return [note, dismiss]
}
