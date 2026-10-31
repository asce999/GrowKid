import { now } from '../api/clock.js'

// How names, times and sizes are written out. Indian English throughout.

const clock = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' })
const calendar = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
const nearby = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' })
const megabytes = new Intl.NumberFormat('en-IN', { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 })
const kilobytes = new Intl.NumberFormat('en-IN', { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 })

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/** A time in day words: "today, 6:00 pm", "tomorrow, 7:00 pm", "Sat, 11 Oct, 5:00 pm". Never a countdown. */
export function whenText(iso) {
  const date = new Date(iso)
  const days = Math.round((startOfDay(date) - startOfDay(now())) / 86_400_000)
  return `${Math.abs(days) <= 1 ? nearby.format(days, 'day') : calendar.format(date)}, ${clock.format(date)}`
}

/**
 * A local calendar day as 'YYYY-MM-DD', the same as scoring.js's dayKey (pages may not import
 * scoring.js). To turn a key back into a date, use new Date(`${key}T00:00`), which is local time;
 * new Date(key) alone is UTC and can land on the day before.
 */
export const dayKeyOf = (time) => {
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** An ISO time as the value of a datetime-local input, which is in local time. */
export function toLocalInput(iso) {
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

export const fileSizeText = (bytes) =>
  bytes >= 1024 * 1024 ? megabytes.format(bytes / (1024 * 1024)) : kilobytes.format(Math.max(1, bytes / 1024))

/** The first letter of a name, for an avatar. Counts by character, so an accent or an emoji survives. */
export const initialOf = (name) => ([...(name ?? '')][0] ?? '').toUpperCase()

/** A streak's day mark in words, for a screen reader. */
export const DAY_SAID = { done: 'counted', missed: 'missed', rest: 'a rest day', none: 'nothing to count' }
