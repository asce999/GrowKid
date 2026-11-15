// `npm run check`: P13 and P14, days counted in the family's zone whatever the device's, and day keys labelled the same everywhere.
import assert from 'node:assert/strict'
import { addDays, dateOfKey, dayKeyOf, dayLabel, daysBetween, fromLocalInput, setZone, toLocalInput, weekdayOf } from './format.js'
import { remindsStreak } from './tasks.js'

const instant = '2026-11-15T20:00:00.000Z' // Sunday 15 November, 8 pm in London

setZone('Asia/Kolkata') // already Monday 01:30 there
assert.equal(dayKeyOf(instant), '2026-11-16')
setZone('America/New_York') // still Sunday 15:00 there
assert.equal(dayKeyOf(instant), '2026-11-15')

// the due-time field reads and writes the family's wall clock, both ways, on the days the clocks change too
for (const [zone, value] of [['America/New_York', '2026-03-08T03:30'], ['America/New_York', '2026-11-01T01:30'], ['Asia/Kolkata', '2026-11-15T18:00'], ['Australia/Sydney', '2026-10-04T03:15']]) {
  setZone(zone)
  assert.equal(toLocalInput(fromLocalInput(value)), value, `${zone} ${value}`)
}
setZone('Asia/Kolkata')
assert.equal(fromLocalInput('2026-11-15T18:00'), '2026-11-15T12:30:00.000Z') // 6 pm in India
assert.equal(fromLocalInput('not a time'), null)

// calendar arithmetic on keys
assert.equal(addDays('2026-02-28', 1), '2026-03-01')
assert.equal(addDays('2026-01-01', -1), '2025-12-31')
assert.equal(daysBetween('2026-11-15', '2026-11-17'), 2)
assert.equal(weekdayOf('2026-11-16'), 0) // a Monday
assert.equal(weekdayOf('2026-11-15'), 6) // a Sunday

// P14: a key is labelled as its own day; new Date(key) would be the day before west of UTC
assert.equal(dayLabel({ weekday: 'long' }).format(dateOfKey('2026-11-16')), 'Monday')
assert.equal(dayLabel({ day: 'numeric' }).format(dateOfKey('2026-11-01')), '1')

// rule 24 in the family's zone: a task due at 23:00 Sunday in New York is "today" there, though it is Monday in UTC
setZone('America/New_York')
const due = '2026-11-16T04:00:00.000Z' // 23:00 Sunday 15 November in New York
const sunday = '2026-11-15T22:00:00.000Z'
const task = (proofs = []) => ({ status: 'todo', dueAt: due, proofs })
const streak = (state = 'none') => ({ week: [{ state }] })
assert.equal(remindsStreak([task()], streak(), sunday), true)
assert.equal(remindsStreak([task([{ sentAt: '2026-11-15T21:00:00.000Z' }])], streak(), sunday), false) // proof sent today
assert.equal(remindsStreak([task()], streak('rest'), sunday), false) // a rest day
setZone('Europe/London') // Monday already: nothing is due today there
assert.equal(remindsStreak([task()], streak(), sunday), false)
console.log('family-zone days hold')
