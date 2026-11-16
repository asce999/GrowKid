import { Link } from 'react-router-dom'
import { Flag, Gift, Target } from 'lucide-react'
import { Points } from './Task.jsx'

// The weekly quest a parent sets: tasks to get approved this week, for bonus points. It only
// ever points at doing real tasks (DESIGN.md section 10).

/** K3: the reward the child is saving for, as a short ruler of the shown balance against its cost. null draws nothing. */
export function GoalBar({ goal, balance }) {
  if (!goal) return null
  const left = Math.max(0, goal.cost - balance)
  return (
    <section aria-label="Your savings goal" className="mt-6">
      <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <Target className="size-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">Saving for {goal.title}</span>
        </span>
        <Points value={goal.cost} />
      </p>
      <div className="ruler quest-ruler mt-2" style={{ '--at': `${Math.min(1, balance / goal.cost) * 100}%` }}>
        <progress value={Math.min(balance, goal.cost)} max={goal.cost} aria-label={`Points saved for ${goal.title}`} />
      </div>
      <p className="type-small mt-2">
        {left > 0 ? (
          `${left} more ${left === 1 ? 'point' : 'points'} to go.`
        ) : (
          <>
            You have enough to ask for it.{' '}
            <Link to="/child/rewards" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Rewards
            </Link>
          </>
        )}
      </p>
    </section>
  )
}

/** The quest as a ruler with a status line. quest is the shown one from getGrowth; null draws nothing. */
export function QuestBar({ quest }) {
  if (!quest) return null
  const status = quest.completed
    ? 'Quest complete. A new one starts on Monday.'
    : `${quest.done} of ${quest.target} tasks approved this week. ${quest.target - quest.done} to go.`
  return (
    <section aria-label="This week’s quest" className="mt-6">
      <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="flex items-center gap-2 font-semibold">
          <Flag className="size-5 shrink-0" aria-hidden="true" />
          This week’s quest
        </span>
        <span className="flex items-center gap-1">
          +<Points value={quest.bonus} />
        </span>
      </p>
      <div className="ruler quest-ruler mt-2" style={{ '--at': `${(quest.done / quest.target) * 100}%` }}>
        <progress value={quest.done} max={quest.target} aria-label="Tasks approved for this week’s quest" />
      </div>
      <p className="type-small mt-2">{status}</p>
      {quest.sealed && (
        <p className="type-small mt-1 flex items-center gap-1.5">
          <Gift className="size-4 shrink-0" aria-hidden="true" />A surprise is sealed inside. It opens when the quest is complete.
        </p>
      )}
      {quest.completed && quest.surprise && (
        <p className="type-small mt-1 flex items-center gap-1.5 font-medium">
          <Gift className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">Your surprise: {quest.surprise}</span>
        </p>
      )}
    </section>
  )
}
