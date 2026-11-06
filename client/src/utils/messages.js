const TEXT = {
  NETWORK: 'GrowKid could not be reached. Check your connection and try again.',
  NOT_SIGNED_IN: 'You have been signed out. Sign in again to carry on.',
  NOT_ALLOWED: 'Your account cannot do that.',
  INVALID: 'Some details were not accepted. Check them and try again.',
  NOT_FOUND: 'That no longer exists. It may have been deleted.',
  LOCKED: 'That can no longer be changed.',
  NOT_ENOUGH: 'You do not have enough points for that yet.',
  TOO_MANY: 'Too many tries. Wait a while, then try again.',
}

/** Plain words for a failed request: what happened and what to do. */
export const errorText = (error) =>
  TEXT[error?.code] ?? 'Something went wrong on our side. Try again in a moment.'
