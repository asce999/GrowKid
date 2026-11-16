import { Flame } from 'lucide-react'
import { DayMark } from '../../components/Streak.jsx'
import { DAY_SAID, dateOfKey, dayKeyOf, dayLabel, plural } from '../../utils/format.js'
import { RestDays } from './RestDays.jsx'

// P14: day keys labelled the same on every device (dateOfKey); a day mark is the instant its day starts in the family's zone
const fullDay = dayLabel({ weekday: 'long', day: 'numeric', month: 'long' })
const named = (day) => dateOfKey(dayKeyOf(day))
const letter = dayLabel({ weekday: 'narrow' })
const daysText = (n) => plural(n, 'day')

/** The streak's day marks, four weeks of them, a week to a row. The same marks the child sees for the last seven days. */
export function Calendar({ streak, calendar, child, onChange }) {
  const said = (state) => calendar.filter((day) => day.state === state).length
  return (
    <section aria-labelledby="streak-title">
      <h2 id="streak-title" className="type-subheading">
        Streak
      </h2>
      <p className="mt-1 flex flex-wrap items-center gap-x-2">
        <Flame className={`size-6 shrink-0 ${streak.days > 0 ? 'icon-earned' : ''}`} aria-hidden="true" />
        <span className="type-game">{streak.days}</span> day streak
        <span className="type-small muted">Best so far: {daysText(streak.best)}</span>
      </p>
      <p className="muted mt-1 max-w-prose">
        In these four weeks, {daysText(said('done'))} counted and {said('missed')} {said('missed') === 1 ? 'was' : 'were'} missed.
      </p>
      <ol className="mt-4 grid w-fit grid-cols-7 gap-1.5" aria-label={`${child.name}’s days, four weeks, Monday first`}>
        {calendar.slice(0, 7).map(({ day }) => (
          <li key={`head-${day}`} className="type-small muted text-center font-medium" aria-hidden="true">
            {letter.format(named(day))}
          </li>
        ))}
        {calendar.map(({ day, state }) => (
          <DayMark key={day} state={state} className="size-9 tabular-nums">
            <span aria-hidden="true">{Number(dayKeyOf(day).slice(8))}</span>
            <span className="sr-only">
              {fullDay.format(named(day))}: {DAY_SAID[state]}
            </span>
          </DayMark>
        ))}
      </ol>
      <ul className="type-small mt-4 grid gap-1.5">
        <li className="flex items-center gap-2">
          <DayMark as="span" state="done" className="size-5" />
          Counted: proof sent that day was approved
        </li>
        <li className="flex items-center gap-2">
          <DayMark as="span" state="missed" className="size-5" />
          Missed: a task was due and no proof was sent
        </li>
        <li className="flex items-center gap-2">
          <DayMark as="span" state="none" className="size-5" />
          Nothing to count: the streak is left as it was
        </li>
        <li className="flex items-center gap-2">
          <DayMark as="span" state="rest" className="size-5" />
          Rest day: set by you, never missed
        </li>
      </ul>
      <RestDays child={child} onChange={onChange} />
    </section>
  )
}
