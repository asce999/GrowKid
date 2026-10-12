/**
 * The time. Everything that asks "what is today?" asks here, so that in development the clock
 * can be moved: open any page with ?clock=<days>, for example ?clock=3 or ?clock=-1.5, and this
 * browser tab lives that many days ahead (or behind) until ?clock=0. Streaks could not be
 * checked otherwise without waiting days. In a production build the clock cannot be moved.
 *
 * It has no other imports, so the rules that depend on it can be run by `npm run check`.
 */
let offset = 0
if (import.meta.env?.DEV && typeof sessionStorage !== 'undefined') {
  const asked = new URLSearchParams(window.location.search).get('clock')
  if (asked !== null) sessionStorage.setItem('growkid.clock', asked)
  offset = (Number(sessionStorage.getItem('growkid.clock')) || 0) * 86_400_000
}

export const now = () => new Date(Date.now() + offset)
