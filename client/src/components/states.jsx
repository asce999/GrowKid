import { useEffect, useState, useSyncExternalStore } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, WifiOff } from 'lucide-react'
import { pretendingOffline } from '../api/index.js'
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

/** The page could not load: what happened, and Try again. */
export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="rounded-card border bg-white p-6">
      <h2 className="type-subheading flex items-center gap-2">
        <CircleAlert className="size-5 text-coral-700" aria-hidden="true" />
        This page did not load
      </h2>
      <p className="muted mt-1 max-w-prose">{errorText(error)}</p>
      <button type="button" className="btn btn-secondary mt-4" onClick={onRetry}>
        Try again
      </button>
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

/** A banner across the top while there is no network. It stays in view as the page scrolls. */
export function OfflineBanner() {
  const online = useSyncExternalStore(onConnectionChange, () => navigator.onLine && !pretendingOffline())
  if (online) return null
  return (
    <p ref={measure} role="status" className="message message-warning sticky top-0 z-20 justify-center rounded-none">
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      No network. What you see may be out of date, and changes will not save until you are back online.
    </p>
  )
}
