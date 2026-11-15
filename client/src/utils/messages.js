const TEXT = {
  NETWORK: 'GrowKid could not be reached. Check your connection and try again.',
  NOT_SIGNED_IN: 'You have been signed out. Sign in again to carry on.',
  NOT_ALLOWED: 'Your account cannot do that.',
  INVALID: 'Some details were not accepted. Check them and try again.',
  NOT_FOUND: 'That no longer exists. It may have been deleted.',
  LOCKED: 'That can no longer be changed.',
  NOT_ENOUGH: 'You do not have enough points for that yet.',
  TOO_MANY: 'Too many tries. Wait a while, then try again.',
  PAUSED: 'This family’s account is paused while a report is looked at.',
}

/** Sitemap rule 27, L6 and L9: what to say for each cap, by the refusal's fields.quota. */
const QUOTA = {
  children: 'A family can have up to 10 children. Remove one to add another.',
  tasks: 'This child already has 300 tasks that are not approved yet. Approve or delete some, then try again.',
  rewards: 'A family can have up to 50 rewards. Delete one to add another.',
  storage: 'There is no room left for more photos and videos. Send a note instead, and tell a parent.',
  disk: 'This computer is almost out of space, so the file was not saved. Send a note instead, and tell a parent.',
}

/** Rule 27, L4: why the server would not take a new password, by fields.password (fields.next when changing one). Null for any other reason. */
const PASSWORD = {
  common: 'That is one of the most common passwords, so it is easy to guess. Choose a different one.',
  personal: 'That password has a name, a username or an email in it, so it is easy to guess. Choose a different one.',
}
export const passwordRefusal = (reason) => PASSWORD[reason] ?? null

const FALLBACK = 'Something went wrong on our side. Try again in a moment.'

/** Plain words for a failed request: what happened and what to do. A paused limit says how long to wait when the server said (L2). */
export function errorText(error) {
  const { code, fields } = error ?? {}
  if (code === 'TOO_MANY' && fields?.minutes > 0) return `Too many tries. Try again in ${fields.minutes} ${fields.minutes === 1 ? 'minute' : 'minutes'}.`
  if (code === 'QUOTA') return QUOTA[fields?.quota] ?? FALLBACK
  return TEXT[code] ?? FALLBACK
}
