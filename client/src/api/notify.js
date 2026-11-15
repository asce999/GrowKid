// H12: a nudge on this computer, with no service worker, no push service and no other company. The parent's choice is kept in this
// browser only, here because only client/src/api/ touches browser storage. The notification says nothing about the family.

const KEY = 'growkid.notify'
export const NOTICE = 'Something is waiting in GrowKid'

/** Whether this browser can show a notification at all. */
export const canNotify = () => typeof window !== 'undefined' && 'Notification' in window

/** Whether the parent turned the nudge on in this browser, and the browser still allows it. */
export function wantsNudge() {
  try {
    return canNotify() && Notification.permission === 'granted' && localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

/** Turns the nudge on (asking the browser's permission, at this tap only) or off. Resolves to whether it is on now. */
export async function setNudge(on) {
  try {
    if (!on) {
      localStorage.removeItem(KEY)
      return false
    }
    if (!canNotify()) return false
    const allowed = Notification.permission === 'granted' || (await Notification.requestPermission()) === 'granted'
    if (allowed) localStorage.setItem(KEY, 'on')
    return allowed
  } catch {
    return false
  }
}

/** Shows the nudge, if it is on and the page cannot be seen. Never a name, a task or a number. */
export function nudge() {
  if (wantsNudge() && document.visibilityState === 'hidden') new Notification(NOTICE)
}
