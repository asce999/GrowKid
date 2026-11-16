import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift, Video } from 'lucide-react'
import * as api from '../api/index.js'
import Badge from '../components/Badge.jsx'
import { GrowthPath, NextStickers } from '../components/GrowthPath.jsx'
import GrowthRuler from '../components/GrowthRuler.jsx'
import Plant from '../components/Plant.jsx'
import { Gain } from '../components/Review.jsx'
import { EmptyState, ErrorState, Message, PageLoading } from '../components/states.jsx'
import Sticker from '../components/Sticker.jsx'
import Streak from '../components/Streak.jsx'
import { CategoryTile, Points } from '../components/Task.jsx'
import Weeks from '../components/Weeks.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { dateOfKey, dayLabel, whenText, plural } from '../utils/format.js'
import { errorText } from '../utils/messages.js'
import { plantOf, plantText } from '../utils/plant.js'
import { iconOf, isEarned } from '../utils/stickers.js'
import { lastReview } from '../utils/tasks.js'
import { busyProps } from '../utils/forms.js'

const weekStart = dayLabel({ day: 'numeric', month: 'long' }) // P14: a week's Monday as a key, the same day on every device

// Everything the child has earned, and why: the ruler, the streak, the road ahead, the stickers
// closest to being earned, the family's week if a parent turned it on, and a plain history. No
// charts: those are the parent's. A reward is given on Today first, so this page shows the
// score as the child has seen it and says when something new is waiting there.

export default function Growth() {
  const loaded = useLoad(
    () => Promise.all([api.getGrowth(), api.listTasks(), api.listStickers(), api.getLeaderboard(), api.listHistory(), api.listMyProofs()]),
    [],
    { live: true },
  )
  const [more, setMore] = useState({ pages: [], busy: false, problem: null }) // P8: history pages after the first, from "Show more"
  const [morePhotos, setMorePhotos] = useState({ pages: [], busy: false, problem: null }) // K5: the same for my proofs

  if (loaded.status === 'loading') return <PageLoading rows={4} />
  if (loaded.status === 'error') return <ErrorState error={loaded.error} onRetry={loaded.reload} />
  const [growth, tasks, stickers, board, firstPage, firstPhotos] = loaded.data
  const photoPages = [firstPhotos, ...morePhotos.pages]
  const photos = photoPages.flat()
  const allPhotos = photoPages.at(-1).length < api.MY_PROOFS_PAGE
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

  async function showMorePhotos() {
    setMorePhotos((m) => ({ ...m, busy: true, problem: null }))
    try {
      const page = await api.listMyProofs(photos.length)
      setMorePhotos((m) => ({ pages: [...m.pages, page], busy: false, problem: null }))
    } catch (error) {
      setMorePhotos((m) => ({ ...m, busy: false, problem: errorText(noticeExpiry(error)) }))
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

      {/* K9: the level as a plant, worked out from the level the child has been shown */}
      <section className="mt-6 flex items-center gap-4 sm:gap-6" aria-labelledby="plant-title">
        <Plant level={shown.level} className="size-32 shrink-0 sm:size-40" />
        <div className="min-w-0">
          <h2 id="plant-title" className="type-subheading">
            {plantText(shown.level)}
          </h2>
          <p className="type-small muted mt-1">
            {plantOf(shown.level).next
              ? `At level ${shown.level + 1} it becomes a ${plantOf(shown.level).next.toLowerCase()}.`
              : 'It grows a ring for every level from here.'}
          </p>
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
                <Badge avatar={entry.avatar} name={entry.name} />
                <span className="min-w-0 flex-1 break-words">
                  {entry.name}
                  {entry.you && ' (you)'}
                </span>
                <span className="shrink-0">
                  {plural(entry.tasks, 'task')}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="mt-10">
        <Weeks weeks={growth.weeks} who="you" whose="yours" title="Your weeks" />
        {growth.bestWeek > 0 && (
          <p className="mt-2 font-medium">
            Your best week: {plural(growth.bestWeek, 'task')}
          </p>
        )}
      </div>

      {photos.length > 0 && (
        <section className="mt-10" aria-labelledby="my-proofs-title">
          <h2 id="my-proofs-title" className="type-subheading">
            My proofs
          </h2>
          <p className="type-small muted mt-1">Photos and videos from your approved tasks, newest first.</p>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              <li key={photo.id}>
                <Link to={`/child/tasks/${photo.taskId}`} className="block overflow-hidden rounded-card">
                  {photo.fileType.startsWith('image/') ? (
                    <img src={photo.fileUrl} alt={`Your photo for “${photo.taskTitle}”`} width={240} height={240} loading="lazy" className="aspect-square w-full bg-navy-100 object-cover" />
                  ) : (
                    <span className="grid aspect-square w-full place-content-center justify-items-center gap-1 bg-navy-800 p-2 text-center text-white">
                      <Video className="size-8" aria-hidden="true" />
                      <span className="type-small line-clamp-2 break-words">
                        <span className="sr-only">Your video for </span>
                        {photo.taskTitle}
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {!allPhotos && (
            <div className="mt-4 grid justify-items-start gap-3">
              {morePhotos.problem && (
                <Message tone="danger" alert>
                  {morePhotos.problem}
                </Message>
              )}
              <button type="button" className="btn btn-secondary" {...busyProps(morePhotos.busy)} onClick={showMorePhotos}>
                {morePhotos.busy ? 'Loading…' : 'Show more'}
              </button>
            </div>
          )}
        </section>
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
                  <Sticker icon={iconOf(sticker)} shape={sticker.shape} tone={sticker.tone} className="size-10" />
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
              <button type="button" className="btn btn-secondary" {...busyProps(more.busy)} onClick={showMore}>
                {more.busy ? 'Loading…' : 'Show more'}
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
