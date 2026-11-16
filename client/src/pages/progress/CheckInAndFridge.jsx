import * as api from '../../api/index.js'
import Sticker from '../../components/Sticker.jsx'
import { Points } from '../../components/Task.jsx'
import { addDays, dayKeyOf, daysBetween, weekdayOf, whenText } from '../../utils/format.js'
import { iconOf } from '../../utils/stickers.js'

// K12: questions for a family to talk over at the weekend. Three a week, taken in turn, so nothing needs storing.
const QUESTIONS = [
  'Which task are you proudest of this week?',
  'What was hardest this week, and what helped?',
  'Which task would you swap for a new one?',
  'What should we try together next week?',
  'Who helped you this week, and how?',
  'What did you learn that surprised you?',
  'Which reward are you saving for, and why?',
  'What would make next week easier?',
  'What did you do this week without being asked?',
]

/** K12: from Friday to Sunday, three questions for the family's weekly check-in. Nothing is stored. */
export function CheckIn({ name }) {
  const today = dayKeyOf(api.now())
  if (weekdayOf(today) < 4) return null // Friday is 4
  const week = Math.floor(daysBetween('2026-01-05', addDays(today, -weekdayOf(today))) / 7) // weeks since a Monday
  const asked = [0, 1, 2].map((i) => QUESTIONS[(week * 3 + i) % QUESTIONS.length])
  return (
    <section className="card mt-6 max-w-2xl print:hidden" aria-labelledby="check-in-title">
      <h2 id="check-in-title" className="type-subheading">
        This week’s family check-in
      </h2>
      <p className="mt-1">A few minutes together at the weekend. Ask {name}:</p>
      <ol className="mt-3 grid list-decimal gap-1 pl-6">
        {asked.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ol>
    </section>
  )
}

/** K12: the fridge chart: this week's tasks with a box to tick, and the stickers earned. Printed instead of the report. */
export function FridgeChart({ child, tasks, stickers }) {
  const earned = stickers.filter((sticker) => sticker.earnedAt)
  return (
    <section className="hidden print:block">
      <p className="font-display text-navy-800">GrowKid</p>
      <h1>{child.name}’s week</h1>
      <p className="muted mt-1">Tick each task when it is done.</p>
      {tasks.length === 0 ? (
        <p className="mt-6">No tasks are due this week.</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {tasks.map((task) => (
            <li key={task.id} className="flex break-inside-avoid items-center gap-4 border-b pb-3">
              <span className="size-8 shrink-0 rounded-tag border-2 border-navy-800" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{task.title}</span>
                <span className="type-small muted block">Due {whenText(task.dueAt)}</span>
              </span>
              <Points value={task.points} short />
            </li>
          ))}
        </ul>
      )}
      {earned.length > 0 && (
        <>
          <h2 className="type-subheading mt-8">Stickers earned</h2>
          <ul className="mt-3 flex flex-wrap gap-4">
            {earned.map((sticker) => (
              <li key={sticker.id} className="grid w-20 justify-items-center gap-1 text-center">
                <Sticker icon={iconOf(sticker)} shape={sticker.shape} tone={sticker.tone} className="size-12" />
                <span className="type-small">{sticker.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
