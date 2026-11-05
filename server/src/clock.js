/** The server's clock: every stored time and every "what is today?" comes from here (section 7, Time). */
let offset = 0

export const now = () => new Date(Date.now() + offset)

/** Moves the clock by a number of days (the X-Clock-Days header, never mounted in production). Anything not a number resets it. */
export const setClockDays = (days) => {
  const d = Number(days)
  offset = Number.isFinite(d) ? d * 86_400_000 : 0
}
