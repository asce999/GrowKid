import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, WifiOff } from 'lucide-react'
import { pretendingOffline } from '../api/index.js'
import { useStale } from '../hooks/useLoad.js'
import { inZone } from '../utils/format.js'
import { errorText } from '../utils/messages.js'

// The shared loading, empty and error states (FRONTEND-SITEMAP.md section 10).

const TONES = {
  info: { look: 'message-info', Icon: Info },
  success: { look: 'message-success', Icon: CircleCheck },
  warning: { look: 'message-warning', Icon: TriangleAlert },
  danger: { look: 'message-danger', Icon: CircleAlert },
}

/** A message that stays on the page beside the thing it is about. Never a toast. */
export function Message({ tone = 'info', alert = false, className = '', children, ...rest }) {
  const { look, Icon } = TONES[tone]
  return (
    <div className={`message ${look} ${className}`} role={alert ? 'alert' : undefined} {...rest}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** What just happened, as { tone, text }. It takes focus when it appears: the button that caused it has gone. */
export function Result({ result, className = 'mt-4' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (result) ref.current?.focus()
  }, [result])
  if (!result) return null
  return (
    <Message ref={ref} tabIndex={-1} tone={result.tone} alert={result.tone === 'danger'} className={className}>
      {result.text}
    </Message>
  )
}

/** A page's loading state: a still outline of a heading and some rows. */
export function PageLoading({ rows = 3 }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div role="status">
      <span className="sr-only">Loading</span>
      <div className="skeleton h-8 w-40" />
      <div className="mt-8 grid gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
      {slow && <p className="type-small muted mt-4">Still loading. The first load can take up to a minute.</p>}
    </div>
  )
}

/** Nothing here yet: a dashed outline, one sentence and one action. */
export function EmptyState({ title, children, action }) {
  return (
    <div className="not-yet rounded-card p-6">
      <h2 className="type-subheading">{title}</h2>
      <p className="muted mt-1 max-w-prose">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/**
 * Phase 7, items 6 and 8: Try again, at full size. The message holding it goes away once it is pressed, so the focus would fall to
 * the page; instead it moves to `target` (a selector, the page's main by default), which holds what was loaded again.
 */
export function RetryButton({ onRetry, target = '#main', className = 'btn btn-text px-0' }) {
  const pressed = useRef(false)
  useEffect(
    () => () => {
      if (pressed.current) setTimeout(() => document.querySelector(target)?.focus(), 0)
    },
    [target],
  )
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        pressed.current = true
        onRetry()
      }}
    >
      Try again
    </button>
  )
}

/** The page could not load: what happened, and Try again. */
export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="rounded-card border bg-white p-6">
      <h2 className="type-subheading flex items-center gap-2">
        <CircleAlert className="size-5 text-coral-700" aria-hidden="true" />
        This page did not load
      </h2>
      <p className="muted mt-1 max-w-prose">{errorText(error)}</p>
      <div className="mt-4">
        <RetryButton onRetry={onRetry} className="btn btn-secondary" />
      </div>
    </div>
  )
}

const onConnectionChange = (notify) => {
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
  return () => {
    window.removeEventListener('online', notify)
    window.removeEventListener('offline', notify)
  }
}

/** Tells the shells how tall the banner is, so their sticky bars sit below it and not under it. */
function measure(banner) {
  const root = document.documentElement
  const observer = new ResizeObserver(() => root.style.setProperty('--banner-h', `${banner.offsetHeight}px`))
  observer.observe(banner)
  return () => {
    observer.disconnect()
    root.style.removeProperty('--banner-h')
  }
}

/** A banner across the top while there is no network, or (P7) while a page's refreshes keep failing. It stays in view as the page scrolls. */
export function OfflineBanner() {
  const online = useSyncExternalStore(onConnectionChange, () => navigator.onLine && !pretendingOffline())
  const stale = useStale((s) => Object.values(s.since).sort((a, b) => a - b)[0]) // P7: the oldest page still showing old data
  if (online && stale) {
    return (
      <p ref={measure} role="status" className="message message-warning sticky top-0 z-20 justify-center rounded-none">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Could not refresh. Showing what was here at {inZone({ hour: 'numeric', minute: '2-digit' }).format(stale)}.
      </p>
    )
  }
  if (online) return null
  return (
    <p ref={measure} role="status" className="message message-warning sticky top-0 z-20 justify-center rounded-none">
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      No network. What you see may be out of date, and changes will not save until you are back online.
    </p>
  )
}
