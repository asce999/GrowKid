import { useSyncExternalStore } from 'react'

/** Phase 7, item 17: whether a media query matches now, kept up to date as it changes. */
export function useMedia(query) {
  return useSyncExternalStore(
    (changed) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', changed)
      return () => list.removeEventListener('change', changed)
    },
    () => window.matchMedia(query).matches,
  )
}
