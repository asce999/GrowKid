import { Link } from 'react-router-dom'
import * as api from '../api/index.js'
import GrowthRuler from '../components/GrowthRuler.jsx'
import { Gain } from '../components/Review.jsx'
import { EmptyState, ErrorState, Message, PageLoading } from '../components/states.jsx'
import Sticker from '../components/Sticker.jsx'
import Streak from '../components/Streak.jsx'
import { CategoryTile, Points } from '../components/Task.jsx'
import { useLoad } from '../hooks/useLoad.js'
import { whenText } from '../utils/format.js'
import { STICKER_ICONS, isEarned } from '../utils/stickers.js'
import { lastReview } from '../utils/tasks.js'

// Everything the child has earned, and why: the ruler, the streak, and a plain history. No
// charts: those are the parent's. A reward is given on Today first, so this page shows the
// score as the child has seen it and says when something new is waiting there.

export default function Growth() {
  const loaded = useLoad(() => Promise.all([api.getGrowth(), api.listTasks(), api.listStickers()]), [], { live: true })

  if (loaded.status === 'loading') return <PageLoading rows={4} />
  if (loaded.status === 'error') return <ErrorState error={loaded.error} onRetry={loaded.reload} />
  const [growth, tasks, stickers] = loaded.data
  const shown = growth.shown
  // newest first; a sticker sits just above the approval that earned it
  const history = [
    ...tasks.filter((task) => task.status === 'approved' && task.resultSeen).map((task) => ({ at: lastReview(task).at, task })),
    ...stickers.filter(isEarned).map((sticker) => ({ at: sticker.earnedAt, sticker })),
  ].sort((a, b) => b.at.localeCompare(a.at) || (a.sticker ? 0 : 1) - (b.sticker ? 0 : 1))

  return (
    <>
      <title>Growth – GrowKid</title>
      <section className="on-navy band-open -mt-8 pt-4 pb-6 sm:pb-8" aria-label="Your level and streak">
        <h1 className="sr-only">Growth</h1>
        <GrowthRuler {...shown} />
        <div className="mt-6">
          <Streak streak={shown.streak} best />
        </div>
      </section>

      {tasks.some((task) => !task.resultSeen) && (
        <Message className="type-body-child mt-6">
          Something new is waiting for you on{' '}
          <Link to="/child" className="font-semibold underline underline-offset-4">
            Today
          </Link>
          .
        </Message>
      )}

      <h2 className="type-display mt-6 text-navy-800 sm:mt-8">What you earned</h2>
      {history.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Nothing earned yet">
            When a parent approves a task, what you earned shows here, with the reason.
          </EmptyState>
        </div>
      ) : (
        <>
          <p className="mt-2 flex flex-wrap items-center gap-x-2">
            <Points value={shown.points} /> earned so far, from {history.filter((entry) => entry.task).length} tasks.
          </p>
          <ul className="mt-4 overflow-hidden rounded-card border bg-white">
            {history.map(({ at, task, sticker }) =>
              task ? (
                <li key={task.id} className="border-b last:border-b-0">
                  <Link to={`/child/tasks/${task.id}`} className="task-row">
                    <CategoryTile task={task} small />
                    <Gain task={task} />
                  </Link>
                </li>
              ) : (
                <li key={sticker.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-6">
                  <Sticker icon={STICKER_ICONS[sticker.shape]} shape={sticker.shape} tone={sticker.tone} className="size-10" />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="font-medium">Sticker: {sticker.name}</span>
                    <span className="type-small muted">
                      {sticker.how} <time dateTime={at}>Earned {whenText(at)}.</time>
                    </span>
                  </span>
                </li>
              ),
            )}
          </ul>
        </>
      )}
    </>
  )
}
