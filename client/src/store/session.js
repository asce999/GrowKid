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
  signIn: async (details) => set({ user: await api.signIn(details), ended: null }),
  signUp: async (details) => set({ user: await api.signUp(details), ended: null }),
  signOut: async () => {
    // only the server can end the session (the cookie is httpOnly): if it cannot be reached this rejects and the device is
    // still signed in, so the button says so instead of pretending
    await api.signOut()
    set({ user: null, ended: 'left' })
  },
  /** Deletes the family's data, which also ends the session. Landing then says so, once. */
  deleteFamily: async (password) => {
    await api.deleteFamily(password)
    set({ user: null, ended: 'deleted' })
  },
  /** The server said the session is gone. A late answer after signing out changes nothing. */
  expire: () => set((s) => (s.user ? { user: null, ended: 'expired' } : s)),
}))


// P13: the screens count days in the signed-in family's zone, as the server does; signed out, the device's
useSession.subscribe((now) => setZone(now.user?.zone))
