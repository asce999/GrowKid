import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Keeps what the last page handed over in the navigation state (a new child's sign-in details,
 * "saved", "deleted") for this visit only. It is wiped from the browser history at once, so
 * going back or reloading does not show it a second time.
 */
export function useOnce() {
  const location = useLocation()
  const navigate = useNavigate()
  const [note, setNote] = useState(location.state)
  useEffect(() => {
    if (location.state) navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location, navigate])
  const dismiss = () => {
    setNote(null)
    document.getElementById('main')?.focus() // the button that was pressed is about to disappear
  }
  return [note, dismiss]
}
