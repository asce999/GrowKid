// P6: the last answer each page's loader gave, for the same question, so a page that is opened again shows it at once and
// refreshes quietly. Memory only: it ends with the tab, and nothing is written to the browser's storage.

const answers = new Map()

/** The question a loader asks: the page it is on, the loader's own code and what it depends on. */
export const keyFor = (path, load, deps) => `${path}\n${load.toString()}\n${JSON.stringify(deps)}`
export const recall = (key) => answers.get(key)
export const remember = (key, data) => answers.set(key, data)
export const size = () => answers.size

/**
 * Empties the cache whenever the signed-in person changes: signing in, signing out, a session that ends, deleting the family. On a
 * shared device the next person must never see the last person's pages. `store` is a zustand store holding `user`.
 */
export function forgetOnUserChange(store) {
  return store.subscribe((now, before) => {
    if (now.user?.id !== before.user?.id) answers.clear()
  })
}
