import { now } from '../api/clock.js'

// How names, times and sizes are written out. Indian English throughout.

/**
 * P13: the family's time zone (rule 25), from the signed-in user; undefined (signed out, a moderator) means the device's. Every day
 * the screens work out is a day in this zone, the same as the server's, and so is every time they show.
 */
let zone
export const setZone = (next) => {
  zone = next
}
/** A date formatter in the family's zone. Made when asked, so it follows the zone of whoever is signed in. */
export const inZone = (options) => new Intl.DateTimeFormat('en-IN', { ...options, timeZone: zone })
const nearby = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' })
const megabytes = new Intl.NumberFormat('en-IN', { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 })
const kilobytes = new Intl.NumberFormat('en-IN', { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 })

/** The parts of a time on the family's wall clock: year, month, day, hour (00 to 23), minute. */
function wall(time) {
  const fields = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone }
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', fields).formatToParts(new Date(time)).map((p) => [p.type, p.value]))
}

/** A calendar day in the family's zone as 'YYYY-MM-DD', the same as scoring.js's dayKey (pages may not import scoring.js). */
export const dayKeyOf = (time) => {
  const p = wall(time)
  return `${p.year}-${p.month}-${p.day}`
}

const utcOf = (key) => Date.UTC(...key.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)))
/** The day key this many days after (or before) another. Calendar arithmetic, so no clock change can skip a day. */
export const addDays = (key, n) => new Date(utcOf(key) + n * 86_400_000).toISOString().slice(0, 10)
/** Days from one day key to another. */
export const daysBetween = (from, to) => Math.round((utcOf(to) - utcOf(from)) / 86_400_000)
/** Monday = 0 to Sunday = 6, for a day key. */
export const weekdayOf = (key) => (new Date(utcOf(key)).getUTCDay() + 6) % 7

/**
 * P14: a day key as a Date to label with a formatter that has `timeZone: 'UTC'` (see `dayLabel`): noon UTC of that day, so the
 * label is that day on every device. new Date('YYYY-MM-DD') alone is midnight UTC, the day before west of UTC.
 */
export const dateOfKey = (key) => new Date(utcOf(key) + 12 * 3_600_000)
/** A formatter for day keys: pass it dateOfKey(key). */
export const dayLabel = (options) => new Intl.DateTimeFormat('en-IN', { ...options, timeZone: 'UTC' })

/** A time in day words: "today, 6:00 pm", "tomorrow, 7:00 pm", "Sat, 11 Oct, 5:00 pm", in the family's zone. Never a countdown. */
export function whenText(iso) {
  const date = new Date(iso)
  const days = daysBetween(dayKeyOf(now()), dayKeyOf(date))
  const day = Math.abs(days) <= 1 ? nearby.format(days, 'day') : inZone({ weekday: 'short', day: 'numeric', month: 'short' }).format(date)
  return `${day}, ${inZone({ hour: 'numeric', minute: '2-digit' }).format(date)}`
}

/** An ISO time as the value of a datetime-local input: the family's wall clock (P13). */
export function toLocalInput(iso) {
  const p = wall(iso)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/**
 * P13: a datetime-local value, read as the family's wall clock, as an ISO time; null when it is not a time. The zone's offset is
 * found at the guess and again at the answer, so a day the clocks change still lands on the right instant.
 */
export function fromLocalInput(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value ?? '')
  if (!m) return null
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  const offset = (t) => {
    const p = wall(t)
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(t / 60_000) * 60_000
  }
  const first = asUtc - offset(asUtc)
  return new Date(asUtc - offset(first)).toISOString()
}

export const fileSizeText = (bytes) =>
  bytes >= 1024 * 1024 ? megabytes.format(bytes / (1024 * 1024)) : kilobytes.format(Math.max(1, bytes / 1024))

/** The first letter of a name, for an avatar. Counts by character, so an accent or an emoji survives. */
export const initialOf = (name) => ([...(name ?? '')][0] ?? '').toUpperCase()

/** A streak's day mark in words, for a screen reader. */
export const DAY_SAID = { done: 'counted', missed: 'missed', rest: 'a rest day', none: 'nothing to count' }
