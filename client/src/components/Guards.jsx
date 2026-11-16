import { useEffect, useRef } from 'react'
import { Navigate, Outlet, ScrollRestoration, useLocation, useRouteError } from 'react-router-dom'
import * as api from '../api/index.js'
import { mayReloadOnce } from '../api/reload.js'
import { useLoad } from '../hooks/useLoad.js'
import { destinationFor, homeFor, useSession } from '../store/session.js'
import { KeepWorkHost } from './KeepWork.jsx'
import { EmptyState, ErrorState, OfflineBanner, PageLoading } from './states.jsx'

// Who may open what, and where everyone else is sent (FRONTEND-SITEMAP.md section 3).

/** Loads the session once, and moves focus to the page whenever the address changes. */
export function Root() {
  const user = useSession((s) => s.user)
  const loadFailed = useSession((s) => s.loadFailed)
  const load = useSession((s) => s.load)
  const { pathname } = useLocation()

  useEffect(() => {
    load()
  }, [load])
  // Moves focus to the page when the address changes, not on the first load: there the first Tab
  // has to reach the skip link.
  const last = useRef(pathname)
  useEffect(() => {
    if (last.current === pathname) return
    last.current = pathname
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <>
      <a href="#main" className="btn btn-primary skip-link print:hidden">
        Skip to content
      </a>
      <OfflineBanner />
      {loadFailed ? (
        <main id="main" tabIndex={-1} className="mx-auto max-w-parent p-6">
          <ErrorState onRetry={load} />
        </main>
      ) : user === undefined ? (
        <main id="main" tabIndex={-1} className="mx-auto max-w-parent p-6">
          <PageLoading />
        </main>
      ) : (
        <Outlet />
      )}
      <KeepWorkHost />
      <ScrollRestoration />
    </>
  )
}

/** While the first page's code arrives (P5): the same skeleton the app shows while the session loads. */
export function Booting() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-parent p-6">
      <PageLoading />
    </main>
  )
}

/**
 * A page's code that failed to load: after an update the old file names are gone, and the browser's own wording differs (Chrome
 * "Failed to fetch dynamically imported module", Firefox "error loading dynamically imported module", Safari "Importing a module
 * script failed").
 */
const missingCode = (error) => /dynamically imported module|Importing a module script failed/i.test(String(error?.message ?? ''))

/** Something broke while drawing a page. A page whose code would not load reloads the app once first (P5). */
export function Crashed() {
  const error = useRouteError()
  const reloading = missingCode(error) && mayReloadOnce()
  useEffect(() => {
    if (reloading) window.location.reload()
  }, [reloading])
  if (reloading) return <Booting />
  return (
    <main id="main" className="mx-auto max-w-parent p-6">
      <ErrorState onRetry={() => window.location.reload()} />
    </main>
  )
}

/** Landing, Sign in and Sign up are for people who are not signed in. Everyone else goes home. */
export function SignedOutOnly() {
  const user = useSession((s) => s.user)
  const from = useLocation().state?.from
  return user ? <Navigate to={destinationFor(user, from)} replace /> : <Outlet />
}

/**
 * Lets in one role, or any signed-in user when no role is given.
 * Signed out: to Sign in, remembering the page unless they chose to sign out. After deleting their
 * data they go to Landing, which says so once.
 * Wrong role: to their own home.
 */
export function RequireRole({ role, children }) {
  const user = useSession((s) => s.user)
  const ended = useSession((s) => s.ended)
  const { pathname, search, hash } = useLocation()
  if (!user) {
    if (ended === 'deleted') return <Navigate to="/" replace state={{ deleted: true }} />
    return <Navigate to="/login" replace state={ended === 'left' ? null : { from: pathname + search + hash }} />
  }
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />
  return children
}

/** /parent/progress goes to the first child's progress. */
export function FirstChildProgress() {
  const children = useLoad(api.listChildren)
  if (children.status === 'loading') return <PageLoading rows={2} />
  if (children.status === 'error') return <ErrorState error={children.error} onRetry={children.reload} />
  if (children.data.length > 0) return <Navigate to={`/parent/progress/${children.data[0].id}`} replace />
  return (
    <>
      <h1>Progress</h1>
      <div className="mt-6">
        <EmptyState title="No children yet">Progress appears here once a child has been added.</EmptyState>
      </div>
    </>
  )
}
