import { useEffect, useId, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { CalendarDays, ChartNoAxesColumn, Gift, House, ListTodo, LogOut, Sprout, Sticker, Users, Volume2, VolumeX } from 'lucide-react'
import * as api from '../api/index.js'
import { nudge } from '../api/notify.js'
import { noticeExpiry } from '../hooks/useLoad.js'
import { homeFor, useSession } from '../store/session.js'
import { initialOf } from '../utils/format.js'
import Badge from './Badge.jsx'
import Logo from './Logo.jsx'

// The page shells. One product at two volumes (DESIGN.md section 11): the parent's shell is
// white and quiet, the child's commits to navy. Both mark the current page the same way.

const PARENT_NAV = [
  { to: '/parent', label: 'Overview', Icon: House, end: true },
  { to: '/parent/tasks', label: 'Tasks', Icon: ListTodo },
  { to: '/parent/rewards', label: 'Rewards', Icon: Gift },
  { to: '/parent/progress', label: 'Progress', Icon: ChartNoAxesColumn },
  { to: '/parent/family', label: 'Family', Icon: Users },
]
const PARENT_MENU = [
  { to: '/parent/settings', label: 'Settings' },
  { to: '/report', label: 'Report a problem' },
]
const CHILD_NAV = [
  { to: '/child', label: 'Today', Icon: CalendarDays, end: true, also: '/child/tasks' }, // a task is opened from Today
  { to: '/child/growth', label: 'Growth', Icon: Sprout },
  { to: '/child/stickers', label: 'Stickers', Icon: Sticker },
  { to: '/child/rewards', label: 'Rewards', Icon: Gift },
]
const CHILD_MENU = [
  { to: '/privacy', label: 'What parents can see' },
  { to: '/report', label: 'Report a problem' },
]

/**
 * counts holds a number for each item that has one: `to` is its path, `n` the number and `what`
 * the words a screen reader hears after it. With `away` set the number shows only if it was
 * asked for from another page: the item's own page is already showing the news, and what was
 * counted there is out of date by the time the child leaves.
 */
function NavItems({ items, counts }) {
  const { pathname } = useLocation()
  return items.map(({ to, label, Icon, end, also }) => {
    const count = counts?.find((c) => c.to === to)
    const here = (end ? pathname === to : pathname.startsWith(to)) || (also && pathname.startsWith(also))
    return (
      <Link key={to} to={to} className="nav-item" aria-current={here ? 'page' : undefined}>
        <Icon className="size-5 shrink-0" aria-hidden="true" />
        {label}
        {count?.n > 0 && !(count.away && count.askedAt === to) && (
          <span className="nav-count">
            {count.n}
            <span className="sr-only"> {count.what}</span>
          </span>
        )}
      </Link>
    )
  })
}

/**
 * The navigation's numbers (P3), from one call: proofs and reward requests waiting for a parent, results waiting for a child.
 * Asked again on every page change, so a number falls as soon as the thing is dealt with, and whenever the pages themselves
 * reload: on focus and once a minute.
 */
function useCounts() {
  const { pathname } = useLocation()
  const [counts, setCounts] = useState({})
  const seen = useRef(null) // the last total, for the nudge (H12)
  useEffect(() => {
    let current = true
    const ask = () =>
      api.getCounts().then((found) => {
        if (!current) return
        // H12: more waiting than last time, while this tab is hidden: the page's own notice, when the parent turned it on
        const total = (found.proofs ?? 0) + (found.requests ?? 0)
        if (seen.current !== null && total > seen.current) nudge()
        seen.current = total
        setCounts({ ...found, askedAt: pathname })
      }, noticeExpiry)
    ask()
    const timer = setInterval(ask, 60_000)
    window.addEventListener('focus', ask)
    window.addEventListener('growkid:counts', ask) // for a page that deals with the thing without leaving
    return () => {
      current = false
      clearInterval(timer)
      window.removeEventListener('focus', ask)
      window.removeEventListener('growkid:counts', ask)
    }
  }, [pathname])
  return counts
}

/**
 * H12: the tab's title begins with how many things are waiting, "(2) Overview – GrowKid". Each page sets its own title, so this
 * watches the title and puts the count back in front whenever a page changes it.
 */
function useTitleCount(n) {
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\) /, '')
      const want = n > 0 ? `(${n}) ${base}` : base
      if (document.title !== want) document.title = want
    }
    apply()
    const watch = new MutationObserver(apply)
    watch.observe(document.head, { subtree: true, childList: true, characterData: true })
    return () => {
      watch.disconnect()
      document.title = document.title.replace(/^\(\d+\) /, '')
    }
  }, [n])
}

/** Always one tap away, because a parent and a child often share one device. */
function SignOut({ className }) {
  const signOut = useSession((s) => s.signOut)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  function press() {
    if (busy) return
    setBusy(true)
    setFailed(false) // so a repeated failure is announced again
    signOut()
      .catch(() => setFailed(true))
      .finally(() => setBusy(false))
  }
  // aria-disabled, never disabled: the focus has to stay on the button
  return (
    <>
      <button type="button" className={className} aria-disabled={busy ? 'true' : undefined} onClick={press}>
        <LogOut className="size-5 shrink-0" aria-hidden="true" />
        {failed ? 'Retry sign out' : 'Sign out'}
      </button>
      <span className="sr-only" role="alert">
        {failed && 'Not signed out. Check your connection and try again.'}
      </span>
    </>
  )
}

/** K11: the child's own switch for the reward moment's sound. The name stays "Sound"; the state is the switch's. */
function SoundSwitch() {
  const user = useSession((s) => s.user)
  const setUser = useSession((s) => s.setUser)
  const [busy, setBusy] = useState(false)
  const on = user?.sound !== false
  async function toggle() {
    setBusy(true)
    try {
      setUser(await api.setSound(!on))
    } catch (error) {
      noticeExpiry(error) // otherwise the switch stays as it was, which is what it shows
    }
    setBusy(false)
  }
  return (
    <button type="button" role="switch" aria-checked={on} className="nav-item w-full" disabled={busy} onClick={toggle}>
      {on ? <Volume2 className="size-5 shrink-0" aria-hidden="true" /> : <VolumeX className="size-5 shrink-0" aria-hidden="true" />}
      Sound
      <span className="type-small muted ml-auto" aria-hidden="true">
        {on ? 'On' : 'Off'}
      </span>
    </button>
  )
}

/** The avatar button and the short menu it opens. A native popover: Escape and outside taps close it. */
function AccountMenu({ items }) {
  const user = useSession((s) => s.user)
  const id = useId()
  const close = () => document.getElementById(id)?.hidePopover()
  const place = (event) => {
    const at = document.getElementById(`${id}-button`).getBoundingClientRect()
    event.currentTarget.style.top = `${at.bottom + 8}px`
    event.currentTarget.style.right = `${document.documentElement.clientWidth - at.right}px`
  }
  return (
    <>
      <button
        type="button"
        id={`${id}-button`}
        className="rounded-full"
        popoverTarget={id}
        aria-label={`Account menu for ${user?.name}`}
      >
        <Badge avatar={user?.avatar} name={user?.name} className="size-11" />
      </button>
      {createPortal(
        <div id={id} popover="auto" className="menu" onBeforeToggle={place}>
          <p className="type-small muted px-3 py-2">
            Signed in as <span className="font-medium text-navy-950">{user?.name}</span>
          </p>
          {items.map(({ to, label }) => (
            <Link key={to} to={to} className="nav-item" onClick={close}>
              {label}
            </Link>
          ))}
          {user?.role === 'child' && <SoundSwitch />}
        </div>,
        document.body,
      )}
    </>
  )
}

export function ParentShell() {
  const user = useSession((s) => s.user)
  const { proofs = 0, requests = 0, askedAt } = useCounts()
  useTitleCount(proofs + requests) // H12
  const counts = [
    { to: '/parent', n: proofs, askedAt, what: 'waiting for review' },
    { to: '/parent/rewards', n: requests, askedAt, what: 'reward requests waiting' },
  ]
  return (
    <div className="lg:grid lg:min-h-page lg:grid-cols-[var(--container-sidebar)_minmax(0,1fr)] print:block">
      <aside className="nav-rail sticky top-(--banner-h) hidden h-[calc(100dvh-var(--banner-h))] flex-col overflow-y-auto bg-white py-6 pr-7 pl-4 lg:flex print:hidden">
        <Link to="/parent" className="mb-8 self-start">
          <Logo />
        </Link>
        <nav aria-label="Main" className="grid gap-1">
          <NavItems items={PARENT_NAV} counts={counts} />
        </nav>
        <div className="mt-auto grid gap-1 border-t pt-4">
          <p className="flex items-center gap-3 px-3 py-2">
            <span className="avatar" aria-hidden="true">
              {initialOf(user?.name)}
            </span>
            <span className="min-w-0 truncate font-medium">{user?.name}</span>
          </p>
          {PARENT_MENU.map(({ to, label }) => (
            <NavLink key={to} to={to} className="nav-item">
              {label}
            </NavLink>
          ))}
          <SignOut className="nav-item" />
        </div>
      </aside>

      <header className="sticky top-(--banner-h) z-10 flex items-center justify-between gap-2 border-b bg-white py-2 pr-2 pl-4 lg:hidden print:hidden">
        <Link to="/parent">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <SignOut className="btn btn-text whitespace-nowrap" />
          <AccountMenu items={PARENT_MENU} />
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-parent px-4 pt-6 pb-28 sm:px-8 lg:py-10 print:max-w-none print:p-0">
        <Outlet />
      </main>

      <nav aria-label="Main" className="nav-bar grid-cols-5 bg-white lg:hidden print:hidden">
        <NavItems items={PARENT_NAV} counts={counts} />
      </nav>
    </div>
  )
}

export function ChildShell() {
  // a result the child has not seen yet: the reward moment is waiting on Today
  const { results = 0, answers = 0, askedAt } = useCounts()
  const count = { to: '/child', n: results + answers, askedAt, what: 'new', away: true } // K2: answers to requests are news on Today too
  return (
    <div className="min-h-page overflow-x-clip">
      <header className="on-navy growth-band sticky top-(--banner-h) z-10">
        <div className="mx-auto flex max-w-child items-center gap-4 py-2 pr-2 pl-4 lg:py-3">
          <Link to="/child">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden gap-1 lg:flex">
            <NavItems items={CHILD_NAV} counts={[count]} />
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <SignOut className="btn btn-text whitespace-nowrap" />
            <AccountMenu items={CHILD_MENU} />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="volume-child type-body-child mx-auto w-full max-w-child px-4 pt-8 pb-28 lg:pb-12">
        <Outlet />
      </main>

      <nav aria-label="Main" className="on-navy nav-bar grid-cols-4 lg:hidden">
        <NavItems items={CHILD_NAV} counts={[count]} />
      </nav>
    </div>
  )
}

/** The moderator has one page, so the shell is only a bar. */
export function ModeratorShell() {
  return (
    <div className="min-h-page">
      <header className="flex items-center justify-between gap-2 border-b bg-white px-4 py-2">
        <Link to="/admin/reports">
          <Logo />
        </Link>
        <SignOut className="btn btn-text whitespace-nowrap" />
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-parent px-4 py-6 sm:px-8 lg:py-10">
        <Outlet />
      </main>
    </div>
  )
}

/** Pages every signed-in role can open sit in that role's own shell. */
export function RoleShell() {
  const role = useSession((s) => s.user?.role)
  if (role === 'parent') return <ParentShell />
  if (role === 'child') return <ChildShell />
  return <ModeratorShell />
}

/** Public pages, and Not found. The footer links only to pages that exist. */
export function PublicShell() {
  const user = useSession((s) => s.user)
  return (
    <div className="min-h-page flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-2">
        <Link to="/">
          <Logo />
        </Link>
        {user ? (
          <Link to={homeFor(user)} className="btn btn-text">
            Back to GrowKid
          </Link>
        ) : (
          <div className="flex items-center gap-1">
            <Link to="/login" className="btn btn-text">
              Sign in
            </Link>
            <Link to="/signup" className="btn btn-secondary">
              Create a parent account
            </Link>
          </div>
        )}
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-parent flex-1 px-4 py-6 sm:px-8 lg:py-10">
        <Outlet />
      </main>
      <footer className="border-t bg-white">
        <nav aria-label="Footer" className="mx-auto flex max-w-parent flex-wrap gap-x-4 px-2 py-2 sm:px-6">
          <Link to="/privacy" className="btn btn-text">
            Safety and privacy
          </Link>
          {!user && (
            <>
              <Link to="/login" className="btn btn-text">
                Sign in
              </Link>
              <Link to="/signup" className="btn btn-text">
                Create a parent account
              </Link>
            </>
          )}
        </nav>
        {/* final plan Phase 5, item 15: who built it and where to write, as the team gave them on 16 November 2026 */}
        <div className="type-small muted mx-auto grid max-w-parent gap-1 px-5 pb-5 sm:px-9">
          <p>Built by four BTech students: Aryan D’Cruz, Vedant Bane, Niddhi Machhi and Rajat Madan.</p>
          <address className="not-italic">Contact: MIT-ADT, Loni Kalbhor, Maharashtra 412201</address>
        </div>
      </footer>
    </div>
  )
}

/**
 * Sign in and Sign up. The navy band is the door frame the growth chart is drawn on: it runs
 * across the top on a phone and down the left on a desktop, where it also holds the aside.
 */
export function AuthShell({ aside, children }) {
  return (
    <div className="lg:grid lg:min-h-page lg:grid-cols-[minmax(20rem,2fr)_3fr]">
      <header className="on-navy door-band relative flex flex-col gap-6 px-6 pt-4 pb-6 lg:px-12 lg:py-10">
        <Link to="/" className="self-start">
          <Logo />
        </Link>
        <div className="mt-auto hidden lg:block">{aside}</div>
      </header>
      <main id="main" tabIndex={-1} className="px-6 py-8 sm:px-12 lg:py-16">
        <div className="max-w-md">{children}</div>
      </main>
    </div>
  )
}
