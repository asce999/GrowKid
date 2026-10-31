import { useEffect, useRef, useState } from 'react'
import { useSession } from '../store/session.js'

/** Sends the user to Sign in when the server says the session has gone. Returns the error. */
export function noticeExpiry(error) {
  if (error?.code === 'NOT_SIGNED_IN') useSession.getState().expire()
  return error
}

/**
 * Loads data for a page: { status: 'loading' | 'ready' | 'error', data, error, reload, set }.
 * Pass the values the request depends on as deps.
 *
 * live: also load again, quietly, when the page regains focus and once a minute. This is all
 * that "real-time" means here (FRONTEND-SITEMAP.md section 12, rule 7). A quiet load that fails
 * keeps what is on screen.
 */
export function useLoad(load, deps = [], { live = false } = {}) {
  const [state, setState] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const turn = useRef(0) // counts answers asked for or put in place: only the newest may land

  useEffect(() => {
    let current = true
    const run = (quiet) => {
      const mine = ++turn.current
      const newest = () => current && mine === turn.current
      load().then(
        (data) => newest() && setState({ status: 'ready', data }),
        (error) => {
          noticeExpiry(error)
          if (newest() && !quiet) setState({ status: 'error', error })
        },
      )
    }
    setState({ status: 'loading' })
    run(false)
    if (!live) {
      return () => {
        current = false
      }
    }
    const again = () => document.visibilityState === 'visible' && run(true)
    const timer = setInterval(again, 60_000)
    window.addEventListener('focus', again)
    return () => {
      current = false
      clearInterval(timer)
      window.removeEventListener('focus', again)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])

  return {
    ...state,
    reload: () => setAttempt((n) => n + 1),
    /**
     * Puts an answer the server has just given in place of what was loaded. Pass a function to
     * change part of it: it gets what is there by then, not what was there when the request left.
     */
    set: (data) => {
      turn.current++
      setState((was) => ({ status: 'ready', data: typeof data === 'function' ? data(was.data) : data }))
    },
  }
}
