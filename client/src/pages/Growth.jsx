import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift } from 'lucide-react'
import * as api from '../api/index.js'
import { GrowthPath, NextStickers } from '../components/GrowthPath.jsx'
import GrowthRuler from '../components/GrowthRuler.jsx'
import { Gain } from '../components/Review.jsx'
import { EmptyState, ErrorState, Message, PageLoading } from '../components/states.jsx'
import Sticker from '../components/Sticker.jsx'
import Streak from '../components/Streak.jsx'
import { CategoryTile, Points } from '../components/Task.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { dateOfKey, dayLabel, whenText } from '../utils/format.js'
import { errorText } from '../utils/messages.js'
import { STICKER_ICONS, isEarned } from '../utils/stickers.js'
import { lastReview } from '../utils/tasks.js'

const weekStart = dayLabel({ day: 'numeric', month: 'long' }) // P14: a week's Monday as a key, the same day on every device

// Everything the child has earned, and why: the ruler, the streak, the road ahead, the stickers
// closest to being earned, the family's week if a parent turned it on, and a plain history. No
// charts: those are the parent's. A reward is given on Today first, so this page shows the
// score as the child has seen it and says when something new is waiting there.

export default function Growth() {
  const loaded = useLoad(
    () => Promise.all([api.getGrowth(), api.listTasks(), api.listStickers(), api.getLeaderboard(), api.listHistory()]),
    [],
    { live: true },
  )
  const [more, setMore] = useState({ pages: [], busy: false, problem: null }) // P8: history pages after the first, from "Show more"

  if (loaded.status === 'loading') return <PageLoading rows={4} />
  if (loaded.status === 'error') return <ErrorState error={loaded.error} onRetry={loaded.reload} />
  const [growth, tasks, stickers, board, firstPage] = loaded.data
  const shown = growth.shown
  const pages = [firstPage, ...more.pages]
  const done = pages.at(-1).length < api.HISTORY_PAGE // the last page was short: nothing older is left
  const approved = pages.flat().filter((task, i, all) => task.resultSeen && all.findIndex((t) => t.id === task.id) === i)
  // ponytail: pages come newest due first and the list reads by approval time, so the edge between pages is close, not exact
  const reach = done || approved.length === 0 ? '' : lastReview(approved.at(-1)).at // older stickers and quests wait for their page
  // newest first; a sticker or a quest sits just above the approval that earned it
  const history = [
    ...approved.map((task) => ({ at: lastReview(task).at, task })),
    ...stickers.filter(isEarned).map((sticker) => ({ at: sticker.earnedAt, sticker })),
    ...growth.questAwards.filter((a) => a.seen).map((award) => ({ at: award.earnedAt, award })),
  ]
    .filter((entry) => entry.task || entry.at >= reach)
    .sort((a, b) => b.at.localeCompare(a.at) || (a.task ? 1 : 0) - (b.task ? 1 : 0))

  async function showMore() {
    setMore((m) => ({ ...m, busy: true, problem: null }))
    try {
      const page = await api.listHistory(pages.flat().length)
      setMore((m) => ({ pages: [...m.pages, page], busy: false, problem: null }))
    } catch (error) {
      setMore((m) => ({ ...m, busy: false, problem: errorText(noticeExpiry(error)) }))
    }
  }

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

      <h2 className="type-display mt-6 text-navy-800 sm:mt-8">The road ahead</h2>
      <GrowthPath level={shown.level} xpForNext={shown.xpForNext} stickers={stickers} />

      <NextStickers stickers={stickers} />

      {board && (
        <>
          <h2 className="type-subheading mt-10">This week in your family</h2>
          <p className="type-small muted mt-1">Tasks approved since Monday. It starts again every Monday.</p>
          <ol className="mt-3 overflow-hidden rounded-card border bg-white">
            {board.map((entry, i) => (
              <li key={i} className={`flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-6 ${entry.you ? 'font-semibold' : ''}`}>
                <span className="type-game w-6 shrink-0 text-center">{i + 1}</span>
                <span className="min-w-0 flex-1 break-words">
                  {entry.name}
                  {entry.you && ' (you)'}
                </span>
                <span className="shrink-0">
                  {entry.tasks} {entry.tasks === 1 ? 'task' : 'tasks'}
                </span>
              </li>
            ))}
          </ol>
        </>
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
            <Points value={shown.points} /> earned so far.{' '}
            <Points value={shown.balance} /> to spend.{' '}
            <Link to="/child/rewards" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Rewards
            </Link>
          </p>
          <ul className="mt-4 overflow-hidden rounded-card border bg-white">
            {history.map(({ at, task, sticker, award }) =>
              task ? (
                <li key={task.id} className="border-b last:border-b-0">
                  <Link to={`/child/tasks/${task.id}`} className="task-row">
                    <CategoryTile task={task} small />
                    <Gain task={task} />
                  </Link>
                </li>
              ) : award ? (
                <li key={award.week} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-6">
                  <span className="grid size-10 shrink-0 place-items-center rounded-tag bg-navy-100 text-navy-800">
                    <Gift className="size-5" aria-hidden="true" />
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="font-medium">Weekly quest complete: +{award.bonus} points</span>
                    <span className="type-small muted break-words">
                      For the week starting {weekStart.format(dateOfKey(award.week))}.
                      {award.surprise ? ` Surprise: ${award.surprise}.` : ''}
                    </span>
                  </span>
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
          {!done && (
            <div className="mt-4 grid justify-items-start gap-3">
              {more.problem && (
                <Message tone="danger" alert>
                  {more.problem}
                </Message>
              )}
              <button type="button" className="btn btn-secondary" disabled={more.busy} onClick={showMore}>
                {more.busy ? 'Loading…' : 'Show more'}
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
