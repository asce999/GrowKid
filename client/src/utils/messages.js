const TEXT = {
  NETWORK: 'GrowKid could not be reached. Check your connection and try again.',
  NOT_SIGNED_IN: 'You have been signed out. Sign in again to carry on.',
  NOT_ALLOWED: 'Your account cannot do that.',
  NOT_FOUND: 'That no longer exists. It may have been deleted.',
  LOCKED: 'That can no longer be changed.',
}

/** Plain words for a failed request: what happened and what to do. */
export const errorText = (error) =>
  TEXT[error?.code] ?? 'Something went wrong on our side. Try again in a moment.'
