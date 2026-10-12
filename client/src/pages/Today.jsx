import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api/index.js'
import GrowthRuler from '../components/GrowthRuler.jsx'
import { Gain } from '../components/Review.jsx'
import { EmptyState, ErrorState, PageLoading } from '../components/states.jsx'
import Sticker from '../components/Sticker.jsx'
import Streak from '../components/Streak.jsx'
import { CategoryTile, TaskCard, TaskRow } from '../components/Task.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { STICKER_ICONS } from '../utils/stickers.js'
import { isOpen, nextTask } from '../utils/tasks.js'

// The child's home: the navy band with the level, the ruler and the streak, then the one next
// task. It is also where the reward moment plays (DESIGN.md section 10): whatever a parent has
// approved since the child last looked is gathered into one sequence on the band, once.

function Rows({ title, tasks, children }) {
  if (tasks.length === 0) return null
  return (
    <section className="mt-10">
      <h2 className="type-subheading">{title}</h2>
      {children}
      <ul className="mt-3 overflow-hidden rounded-card border bg-white">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} to={`/child/tasks/${task.id}`} />
        ))}
      </ul>
    </section>
  )
}

/**
 * The band. moment holds what is new on this visit: the approvals, the stickers they earned and
 * the score the child last saw. The ruler grows from that score first; the stickers land after.
 */
function Band({ growth, moment, onShown }) {
  const [grown, setGrown] = useState(false)
  const arrived = () => {
    setGrown(true)
    onShown(moment.plays)
  }
  return (
    <>
      <GrowthRuler {...growth} from={moment.from} onGrown={arrived} />
      {moment.gains.length > 0 && (
        <ul className="mt-5 grid gap-3">
          {moment.gains.map((task) => (
            <li key={task.id}>
              <Link to={`/child/tasks/${task.id}`} className="flex items-center gap-3 rounded-control underline-offset-4 hover:underline">
                <CategoryTile task={task} small />
                <Gain task={task} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {moment.stickers.length > 0 && (
        <ul className="mt-5 grid gap-3">
          {moment.stickers.map((sticker, i) => (
            <li key={sticker.id} className="flex items-center gap-4">
              {/* a sticker from earlier in this visit has landed already and stays put */}
              <div className={sticker.play < moment.plays ? '' : grown ? 'land' : 'invisible'} style={{ animationDelay: `calc(var(--duration-pause) + ${i * 120}ms)` }}>
                <Sticker icon={STICKER_ICONS[sticker.shape]} shape={sticker.shape} tone={sticker.tone} tilt={-6} className="size-20" />
              </div>
              <p className="min-w-0">
                <span className="type-small muted block">New sticker</span>
                <span className="block font-semibold">{sticker.name}</span>
                <span className="type-small block">{sticker.how}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6">
        <Streak streak={growth.streak} />
      </div>
    </>
  )
}

export default function Today() {
  // what has been new during this visit. It stays on the band until the child leaves, and
  // `plays` goes up each time something new arrives, which is what starts the reward moment.
  const visit = useRef({ plays: 0, from: null, gains: [], stickers: [] })
  const [shown, setShown] = useState(0) // the last play that was watched to the end
  const loaded = useLoad(
    async () => {
      const [tasks, growth, stickers] = await Promise.all([api.listTasks(), api.getGrowth(), api.listStickers()])
      const seen = visit.current
      const fresh = tasks.filter((t) => t.status === 'approved' && !t.resultSeen && !seen.gains.some((g) => g.id === t.id))
      if (fresh.length > 0) {
        const play = seen.plays + 1
        const theirs = stickers.filter((s) => fresh.some((t) => t.id === s.taskId)).map((s) => ({ ...s, play }))
        visit.current = { plays: play, from: growth.shown, gains: [...seen.gains, ...fresh], stickers: [...seen.stickers, ...theirs] }
      }
      return { tasks, growth, moment: visit.current }
    },
    [],
    { live: true },
  )

  // Tell the server which results have been shown, and only those: an approval counts once its
  // moment has been watched to the end. If telling fails, they are simply new again next time.
  const told = (loaded.data?.tasks ?? [])
    .filter((t) => !t.resultSeen && (t.status !== 'approved' || shown === loaded.data.moment.plays))
    .map((t) => t.id)
    .join()
  useEffect(() => {
    if (told) api.markResultsSeen(told.split(',')).catch(noticeExpiry)
  }, [told])

  if (loaded.status === 'error') {
    return (
      <>
        <title>Today – GrowKid</title>
        <h1>Today</h1>
        <div className="mt-6">
          <ErrorState error={loaded.error} onRetry={loaded.reload} />
        </div>
      </>
    )
  }

  const { tasks, growth, moment } = loaded.data ?? {}
  const next = tasks && nextTask(tasks)
  const waiting = tasks?.filter((task) => task.status === 'review') ?? []

  return (
    <>
      <title>Today – GrowKid</title>
      <section className="on-navy band-open -mt-8 pt-4 pb-6 sm:pb-8" aria-label="Your growth">
        <h1 className="sr-only">Today</h1>
        {growth ? <Band key={moment.plays} growth={growth} moment={moment} onShown={setShown} /> : <div className="skeleton h-40" />}
      </section>

      {!tasks ? (
        <div className="mt-8">
          <PageLoading rows={3} />
        </div>
      ) : (
        <>
          <h2 className="type-display mt-6 text-navy-800 sm:mt-8">Next up</h2>
          <div className="mt-4">
            {tasks.length === 0 ? (
              <EmptyState title="No tasks yet">When your parent sets a task, it shows up here.</EmptyState>
            ) : !next && waiting.length > 0 ? (
              <EmptyState title="All done for now">
                Everything you had to do has been sent. A parent checks it next.
              </EmptyState>
            ) : !next ? (
              <EmptyState title="Nothing to do right now">Every task is done. New ones show up here.</EmptyState>
            ) : (
              <TaskCard task={next}>
                <Link to={`/child/tasks/${next.id}`} className="btn btn-lg btn-primary press-all mt-6 w-full">
                  {next.status === 'sentBack' ? 'Try again' : 'Send proof'}
                </Link>
              </TaskCard>
            )}
          </div>

          <Rows title="Also to do" tasks={tasks.filter((task) => isOpen(task) && task !== next)} />
          <Rows title="In review" tasks={waiting}>
            <p className="type-small muted mt-1">Nothing is awarded for these yet. A parent has to approve them first.</p>
          </Rows>
        </>
      )}
    </>
  )
}
