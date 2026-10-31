import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Gift, Pin } from 'lucide-react'
import * as api from '../api/index.js'
import GrowthRuler from '../components/GrowthRuler.jsx'
import { QuestBar } from '../components/Quest.jsx'
import { Gain } from '../components/Review.jsx'
import { EmptyState, ErrorState, Message, PageLoading } from '../components/states.jsx'
import Sticker from '../components/Sticker.jsx'
import Streak from '../components/Streak.jsx'
import { CategoryTile, TaskCard, TaskRow } from '../components/Task.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { dayKeyOf } from '../utils/format.js'
import { errorText } from '../utils/messages.js'
import { STICKER_ICONS } from '../utils/stickers.js'
import { isOpen, nextTask } from '../utils/tasks.js'

// The child's home: the navy band with the level, the ruler, the weekly quest, the streak and
// its reminder, then the one next task. It is also where the reward moment plays (DESIGN.md
// section 10): whatever a parent has approved since the child last looked is gathered into one
// sequence on the band, once. The child can pin any other open task here as the one to do next.

/** pin, when given, puts a "Do next" button beside each row. */
function Rows({ title, tasks, children, pin }) {
  if (tasks.length === 0) return null
  return (
    <section className="mt-10">
      <h2 className="type-subheading">{title}</h2>
      {children}
      <ul className="mt-3 overflow-hidden rounded-card border bg-white">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            to={`/child/tasks/${task.id}`}
            action={
              pin && (
                <button type="button" className="btn btn-text type-small" onClick={() => pin(task.id)}>
                  <Pin className="size-4 shrink-0" aria-hidden="true" />
                  <span aria-hidden="true">Do next</span>
                  <span className="sr-only">Do “{task.title}” next</span>
                </button>
              )
            }
          />
        ))}
      </ul>
    </section>
  )
}

/**
 * The streak reminder, worded as fact (rule 23): only when a task is due today and still open,
 * no proof has been sent today, and today is not a rest day.
 */
function Reminder({ tasks, streak }) {
  const today = dayKeyOf(api.now())
  const dueToday = tasks.some((t) => isOpen(t) && dayKeyOf(t.dueAt) === today)
  const sentToday = tasks.some((t) => t.proofs.some((p) => dayKeyOf(p.sentAt) === today))
  if (!dueToday || sentToday || streak.week.at(-1).state === 'rest') return null
  return (
    <p className="type-small mt-3 flex items-center gap-2 font-medium">
      <Flame className="size-4 shrink-0" aria-hidden="true" />
      {streak.days > 0
        ? `A task is due today. Send proof for it to keep your ${streak.days}-day streak.`
        : 'A task is due today. Send proof for it to start a streak.'}
    </p>
  )
}

/**
 * The band. moment holds what is new on this visit: the approvals, the stickers and quests they
 * earned and the score the child last saw. The ruler grows from that score first; the stickers
 * land after, then the quest. tasks are the child's, for the reminder.
 */
function Band({ growth, moment, tasks, onShown }) {
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
      {moment.quests.length > 0 && (
        <ul className="mt-5 grid gap-3">
          {moment.quests.map((award, i) => (
            // the whole row lands, not only the tile: the surprise must not be readable before the ruler arrives
            <li
              key={award.week}
              className={`flex items-center gap-4 ${award.play < moment.plays ? '' : grown ? 'land' : 'invisible'}`}
              style={{ animationDelay: `calc(var(--duration-pause) + ${(moment.stickers.length + i) * 120}ms)` }}
            >
              <span className="grid size-20 shrink-0 place-items-center rounded-card bg-white text-navy-800">
                <Gift className="size-10" aria-hidden="true" />
              </span>
              <p className="min-w-0">
                <span className="type-small muted block">Quest complete</span>
                <span className="block font-semibold">+{award.bonus} points to spend</span>
                {award.surprise && <span className="type-small block break-words">Your surprise: {award.surprise}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
      <QuestBar quest={growth.shown.quest} />
      <div className="mt-6">
        <Streak streak={growth.streak} />
      </div>
      <Reminder tasks={tasks} streak={growth.shown.streak} />
    </>
  )
}

export default function Today() {
  // what has been new during this visit. It stays on the band until the child leaves, and
  // `plays` goes up each time something new arrives, which is what starts the reward moment.
  const visit = useRef({ plays: 0, from: null, gains: [], stickers: [], quests: [] })
  const [shown, setShown] = useState(0) // the last play that was watched to the end
  const [problem, setProblem] = useState('') // why choosing the next task failed, if it did
  const nextUp = useRef(null)
  const loaded = useLoad(
    async () => {
      const [tasks, growth, stickers] = await Promise.all([api.listTasks(), api.getGrowth(), api.listStickers()])
      const seen = visit.current
      const fresh = tasks.filter((t) => t.status === 'approved' && !t.resultSeen && !seen.gains.some((g) => g.id === t.id))
      if (fresh.length > 0) {
        const play = seen.plays + 1
        const theirs = stickers.filter((s) => fresh.some((t) => t.id === s.taskId)).map((s) => ({ ...s, play }))
        const done = growth.questAwards.filter((a) => fresh.some((t) => t.id === a.taskId)).map((a) => ({ ...a, play }))
        visit.current = {
          plays: play,
          from: growth.shown,
          gains: [...seen.gains, ...fresh],
          stickers: [...seen.stickers, ...theirs],
          quests: [...seen.quests, ...done],
        }
      }
      return { tasks, growth, moment: visit.current }
    },
    [],
    { live: true },
  )

  // Tell the server which results have been shown, and only those: an approval counts once its
  // moment has been watched to the end. If telling fails, they are simply new again next time. An
  // approval that arrived with the answer to a pin is in no moment yet, so it waits for the next load.
  const told = (loaded.data?.tasks ?? [])
    .filter((t) => !t.resultSeen && (t.status !== 'approved' || (shown === loaded.data.moment.plays && loaded.data.moment.gains.some((g) => g.id === t.id))))
    .map((t) => t.id)
    .join()
  useEffect(() => {
    if (!told) return
    // growth is loaded again once the results are marked seen: the quest bar and the reminder read growth.shown, which is out of date until then
    api.markResultsSeen(told.split(',')).then(api.getGrowth).then((growth) => loaded.set((data) => ({ ...data, growth }))).catch(noticeExpiry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [told])

  // Choose the next task, or hand the choice back with null. Uses `set`, never `reload`: a reload
  // would remount the band and play the reward moment again. The button pressed has gone, so
  // focus goes to the task it changed.
  const pin = async (id) => {
    setProblem('')
    try {
      const pinned = await api.pinTask(id)
      loaded.set((data) => ({ ...data, tasks: pinned }))
      nextUp.current?.focus()
    } catch (e) {
      setProblem(errorText(noticeExpiry(e)))
    }
  }

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
        {growth ? <Band key={moment.plays} growth={growth} moment={moment} tasks={tasks} onShown={setShown} /> : <div className="skeleton h-40" />}
      </section>

      {!tasks ? (
        <div className="mt-8">
          <PageLoading rows={3} />
        </div>
      ) : (
        <>
          <h2 ref={nextUp} tabIndex={-1} className="type-display mt-6 text-navy-800 sm:mt-8">
            Next up
          </h2>
          {problem && (
            <Message tone="danger" alert className="mt-4">
              {problem}
            </Message>
          )}
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
                {next.pinned && (
                  <p className="type-small muted mt-3 flex items-center gap-2">
                    <Pin className="size-4 shrink-0" aria-hidden="true" />
                    You chose this one.{' '}
                    {/* above the card's press-all overlay, which would otherwise take the tap */}
                    <button type="button" className="btn btn-text type-small relative z-1" onClick={() => pin(null)}>
                      Let GrowKid choose
                    </button>
                  </p>
                )}
                <Link to={`/child/tasks/${next.id}`} className="btn btn-lg btn-primary press-all mt-6 w-full">
                  {next.status === 'sentBack' ? 'Try again' : 'Send proof'}
                </Link>
              </TaskCard>
            )}
          </div>

          <Rows title="Also to do" tasks={tasks.filter((task) => isOpen(task) && task !== next)} pin={pin} />
          <Rows title="In review" tasks={waiting}>
            <p className="type-small muted mt-1">Nothing is awarded for these yet. A parent has to approve them first.</p>
          </Rows>
        </>
      )}
    </>
  )
}
