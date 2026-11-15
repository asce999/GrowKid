import { useEffect, useId, useRef, useState } from 'react'
import { create } from 'zustand'
import { useSession } from '../store/session.js'
import { forgetOnUserChange, keyFor, recall as recallAny, remember as rememberAny } from './pageCache.js'

// cache: false (a key of null) neither shows nor keeps an answer
const recall = (key) => (key === null ? undefined : recallAny(key))
const remember = (key, data) => key !== null && rememberAny(key, data)

forgetOnUserChange(useSession) // P6: never the last person's pages

/** Sends the user to Sign in when the server says the session has gone. Returns the error. */
export function noticeExpiry(error) {
  if (error?.code === 'NOT_SIGNED_IN') useSession.getState().expire()
  return error
}

/** P7: the pages whose quiet refreshes have failed twice in a row, each with when it last loaded. StaleNote shows the oldest. */
export const useStale = create(() => ({ since: {} }))
const markStale = (id, at) => useStale.setState((s) => ({ since: { ...s.since, [id]: at } }))
const clearStale = (id) => useStale.setState((s) => (id in s.since ? { since: Object.fromEntries(Object.entries(s.since).filter(([k]) => k !== id)) } : s))

const FOCUS_GAP = 15_000 // P6: a page that regains focus refreshes at most this often

/**
 * Loads data for a page: { status: 'loading' | 'ready' | 'error', data, error, reload, set }.
 * Pass the values the request depends on as deps.
 *
 * P6: a question asked before (same page, same loader, same deps) shows its last answer at once and refreshes quietly, and Try
 * again keeps what is on screen. live: also load again, quietly, when the page regains focus (at most every 15 seconds) and once a
 * minute; that is all "real-time" means here (sitemap rule 7). A quiet load that fails keeps what is on screen; two in a row
 * say so (P7).
 */
export function useLoad(load, deps = [], { live = false, cache = true } = {}) {
  const id = useId()
  const key = cache ? keyFor(window.location.pathname, load, deps) : null
  const [state, setState] = useState(() => (recall(key) === undefined ? { status: 'loading' } : { status: 'ready', data: recall(key) }))
  const [attempt, setAttempt] = useState(0)
  const turn = useRef(0) // counts answers asked for or put in place: only the newest may land
  const health = useRef({ failures: 0, loadedAt: null, lastRun: 0 })

  useEffect(() => {
    let current = true
    const run = (quiet) => {
      const mine = ++turn.current
      const newest = () => current && mine === turn.current
      health.current.lastRun = Date.now()
      Promise.resolve().then(load).then( // a loader may return a plain value or throw, not only a promise
        (data) => {
          if (!newest()) return
          remember(key, data)
          health.current = { ...health.current, failures: 0, loadedAt: new Date() }
          clearStale(id)
          setState({ status: 'ready', data })
        },
        (error) => {
          noticeExpiry(error)
          if (!newest()) return
          if (!quiet) return setState({ status: 'error', error })
          health.current.failures++
          if (health.current.failures >= 2 && health.current.loadedAt) markStale(id, health.current.loadedAt)
        },
      )
    }
    const shown = recall(key)
    if (shown === undefined) {
      setState({ status: 'loading' })
      run(false)
    } else {
      setState({ status: 'ready', data: shown }) // P6: on screen at once; the answer replaces it quietly
      run(true)
    }
    if (!live) {
      return () => {
        current = false
      }
    }
    const again = () => document.visibilityState === 'visible' && run(true)
    const onFocus = () => Date.now() - health.current.lastRun >= FOCUS_GAP && again()
    const timer = setInterval(again, 60_000)
    window.addEventListener('focus', onFocus)
    return () => {
      current = false
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])

  useEffect(() => () => clearStale(id), [id]) // a page that goes away stops claiming the notice

  return {
    ...state,
    reload: () => setAttempt((n) => n + 1),
    /**
     * Puts an answer the server has just given in place of what was loaded. Pass a function to
     * change part of it: it gets what is there by then, not what was there when the request left.
     */
    set: (data) => {
      turn.current++
      setState((was) => {
        const next = typeof data === 'function' ? data(was.data) : data
        remember(key, next)
        return { status: 'ready', data: next }
      })
    },
  }
}
