// P5: whether a page whose code failed to load may reload the app by itself. Here because only client/src/api/ touches browser
// storage. The mark lasts a minute, so one failure reloads once and a second failure in a row shows the crash screen instead of
// looping; a failure much later (another update) may reload again.

const KEY = 'growkid.reloaded'
const MINUTE = 60_000

/** True, and remembered for a minute, when the app has not reloaded itself in the last minute. False when storage is unavailable. */
export function mayReloadOnce(now = Date.now()) {
  try {
    const last = Number(sessionStorage.getItem(KEY))
    if (last && now - last < MINUTE) return false
    sessionStorage.setItem(KEY, String(now))
    return true
  } catch {
    return false // private mode or blocked storage: never risk a reload loop
  }
}
