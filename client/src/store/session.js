import { create } from 'zustand'
import * as api from '../api/index.js'
import { setZone } from '../utils/format.js'

/** Where each role lands after signing in, and the part of the site that is theirs. */
const HOME = { parent: '/parent', child: '/child', moderator: '/admin/reports' }
const AREA = { parent: '/parent', child: '/child', moderator: '/admin' }

export const homeFor = (user) => HOME[user.role]

/** After sign-in: back to the page they were sent away from, if it is theirs to open. */
export const destinationFor = (user, from) =>
  from && (from.startsWith('/report') || from.startsWith(AREA[user.role])) ? from : HOME[user.role]

export const useSession = create((set) => ({
  /** undefined until the first check, then a User or null. */
  user: undefined,
  loadFailed: false,
  /** Why the last session ended: 'expired', 'left' (they signed out), 'deleted' (the family's data) or null. */
  ended: null,
  /** T5: the code a sign-up answered with, in memory only, until Overview has shown it. */
  recoveryCode: null,

  load: async () => {
    set({ loadFailed: false })
    try {
      set({ user: await api.getSession() })
    } catch {
      set({ loadFailed: true })
    }
  },
  /** K10, K11: the signed-in child's own account as the server answered a change to it. */
  setUser: (user) => set({ user }),
  /** Landing has said how the last session ended; there is nothing more to say. */
  clearEnded: () => set({ ended: null }),
  /** T5: Overview has shown the recovery code, and the parent has put it away. */
  clearRecoveryCode: () => set({ recoveryCode: null }),
  // T5: every change of person drops the recovery code, so it never outlives the parent it was made for
  signIn: async (details) => set({ user: await api.signIn(details), ended: null, recoveryCode: null }),
  signUp: async (details) => {
    const { recoveryCode, ...user } = await api.signUp(details)
    set({ user, ended: null, recoveryCode })
  },
  signOut: async () => {
    // only the server can end the session (the cookie is httpOnly): if it cannot be reached this rejects and the device is
    // still signed in, so the button says so instead of pretending
    await api.signOut()
    set({ user: null, ended: 'left', recoveryCode: null })
  },
  /** Deletes the family's data, which also ends the session. Landing then says so, once. */
  deleteFamily: async (password) => {
    await api.deleteFamily(password)
    set({ user: null, ended: 'deleted', recoveryCode: null })
  },
  /** The server said the session is gone. A late answer after signing out changes nothing. */
  expire: () => set((s) => (s.user ? { user: null, ended: 'expired', recoveryCode: null } : s)),
}))


// P13: the screens count days in the signed-in family's zone, as the server does; signed out, the device's
useSession.subscribe((now) => setZone(now.user?.zone))
