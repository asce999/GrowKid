/** Rows to API shapes (plan section 6): an optional field is left out, never null, and a hash or tokenVersion never leaves. */

/** A User as index.js documents it. */
export const asUser = ({ id, role, name, email, username }) => ({
  id, role, name, email: email ?? undefined, username: username ?? undefined,
})

/** A Child as index.js documents it. */
export const asChild = ({ id, name, username }) => ({ id, name, username })
