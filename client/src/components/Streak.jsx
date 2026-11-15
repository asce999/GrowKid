import { Flame } from 'lucide-react'
import { DAY_SAID, dateOfKey, dayKeyOf, dayLabel } from '../utils/format.js'

// P14: a day mark is the instant its day starts in the family's zone; its key is that day, labelled the same on every device
const letter = dayLabel({ weekday: 'narrow' })
const weekday = dayLabel({ weekday: 'long' })
const named = (day) => dateOfKey(dayKeyOf(day))

/**
 * The streak: the flame, the number and the last seven days, today last. It is calm: a missed
 * day ends it quietly and the best is kept; a rest day a parent set changes nothing and is never
 * missed. No countdown and no warning (DESIGN.md section 10).
 */
export default function Streak({ streak, best = false }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <p className="flex flex-wrap items-center gap-x-2">
        <Flame className={`size-6 shrink-0 ${streak.days > 0 ? 'icon-earned' : ''}`} aria-hidden="true" />
        <span className="type-game">{streak.days}</span> day streak
        {best && <span className="type-small muted ml-2">Best so far: {streak.best}</span>}
      </p>
      <ol className="flex gap-1.5" aria-label="The last seven days">
        {streak.week.map(({ day, state }) => (
          <li key={day} className={`day-mark day-${state}`}>
            <span aria-hidden="true">{letter.format(named(day))}</span>
            <span className="sr-only">
              {weekday.format(named(day))}: {DAY_SAID[state]}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
