import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link } from 'react-router-dom'
import { Flame, Gift, MailOpen, Pin } from 'lucide-react'
import * as api from '../api/index.js'
import GrowthRuler from '../components/GrowthRuler.jsx'
import Plant from '../components/Plant.jsx'
import { GoalBar, QuestBar } from '../components/Quest.jsx'
import AskForTask from '../components/Suggest.jsx'
import { Gain } from '../components/Review.jsx'
import { EmptyState, ErrorState, Message, PageLoading } from '../components/states.jsx'
import Sticker from '../components/Sticker.jsx'
import Streak from '../components/Streak.jsx'
import { CategoryTile, Points, TaskCard, TaskRow } from '../components/Task.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { useSession } from '../store/session.js'
import { plantOf } from '../utils/plant.js'
import { play } from '../utils/sound.js'
import { whenText, plural } from '../utils/format.js'
import { errorText } from '../utils/messages.js'
import { iconOf } from '../utils/stickers.js'
import { clockText, isOpen, nextTask, remindsStreak, repeatText } from '../utils/tasks.js'
import { busyProps } from '../utils/forms.js'

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
  if (!remindsStreak(tasks, streak, api.now())) return null // rule 24, in utils/tasks.js
  return (
    <p className="type-small mt-3 flex items-center gap-2 font-medium">
      <Flame className="size-4 shrink-0" aria-hidden="true" />
      {streak.days > 0
        ? `A task is due today. Send proof for it to keep your ${streak.days}-day streak.`
        : 'A task is due today. Send proof for it to start a streak.'}
    </p>
  )
}

/** K7: the family agreement, until the child agrees: their repeating tasks and the family's rewards, and "I agree". */
function Agreement({ agreement, onAgreed }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  async function yes() {
    setBusy(true)
    setProblem('')
    try {
      await api.agree()
      onAgreed()
    } catch (error) {
      setProblem(errorText(noticeExpiry(error)))
      setBusy(false)
    }
  }
  return (
    <section className="card mt-10" aria-labelledby="agreement-title">
      <h2 id="agreement-title" className="type-subheading">
        Our agreement
      </h2>
      <p className="mt-1">What comes back each week, and what your points can be spent on.</p>
      {agreement.series.length > 0 && (
        <>
          <h3 className="type-small muted mt-4 font-medium">Tasks that repeat</h3>
          <ul className="mt-1 grid gap-1">
            {agreement.series.map((series) => (
              <li key={series.id} className="flex flex-wrap items-center gap-x-2 break-words">
                <span className="font-medium">{series.title}</span>
                <span className="type-small muted">
                  {repeatText(series.weekdays)}, due {clockText(series.dueTime)}.
                </span>
                <Points value={series.points} short />
              </li>
            ))}
          </ul>
        </>
      )}
      {agreement.rewards.length > 0 && (
        <>
          <h3 className="type-small muted mt-4 font-medium">Rewards</h3>
          <ul className="mt-1 grid gap-1">
            {agreement.rewards.map((reward) => (
              <li key={reward.id} className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words">{reward.title}</span>
                <span className="shrink-0">
                  <Points value={reward.cost} short />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {problem && (
        <Message tone="danger" alert className="mt-4">
          {problem}
        </Message>
      )}
      <button type="button" className="btn btn-secondary mt-4" {...busyProps(busy)} onClick={yes}>
        I agree
      </button>
    </section>
  )
}

/**
 * The band. moment holds what is new on this visit: the approvals, the stickers and quests they
 * earned and the score the child last saw. The ruler grows from that score first; the stickers
 * land after, then the quest. tasks are the child's, for the reminder.
 */
function Band({ growth, moment, tasks, onShown }) {
  const [grown, setGrown] = useState(false)
  const sound = useSession((s) => s.user?.sound !== false) // K11: the child's own switch
  const levelled = Boolean(moment.from) && growth.level > moment.from.level // K13: a passed level gets its own beat
  const landing = moment.stickers.filter((sticker) => sticker.play === moment.plays).length
  const timers = useRef([])
  // K11: the ruler's tone as it starts to grow; only when XP moved, so an answer alone plays nothing. Leaving stops the tones still to come.
  useEffect(() => {
    if (sound && moment.from && growth.points > moment.from.points) play('rise')
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  /** When the nth landing after the ruler starts: one step apart, and after the level's own beat when a level was passed (K13). */
  const delay = (n) => `calc(var(--duration-pause) + ${levelled ? 'var(--duration-reward) + var(--duration-pause) + ' : ''}${n * 120}ms)`
  const arrived = () => {
    setGrown(true)
    onShown(moment.plays)
    if (!sound) return
    if (levelled) play('level')
    // the same steps as delay(), in milliseconds read from the motion tokens, so the ticks land with the stickers
    const token = (name) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0
    const pause = token('--duration-pause')
    const after = levelled ? token('--duration-reward') + pause : 0
    for (let i = 0; i < landing; i++) timers.current.push(setTimeout(() => play('sticker'), after + pause + i * 120))
  }
  const plant = plantOf(growth.level)
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
      {levelled && (
        <div className={`mt-5 flex items-center gap-4 ${grown ? 'land' : 'invisible'}`} style={{ animationDelay: 'var(--duration-pause)' }}>
          <span className="grid size-20 shrink-0 place-items-center rounded-card bg-white *:col-start-1 *:row-start-1">
            <Plant level={moment.from.level} className={`size-16 ${grown ? 'fade-out' : ''}`} />
            <Plant level={growth.level} className={`size-16 ${grown ? 'land' : 'opacity-0'}`} />
          </span>
          <p className="min-w-0">
            <span className="type-small muted block">New level</span>
            <span className="block font-semibold">Level {growth.level}</span>
            <span className="type-small block">
              {plant.rings ? `Your tree has ${plural(plant.rings, 'ring')} now.` : `Your plant is a ${plant.name.toLowerCase()} now.`}
            </span>
          </p>
        </div>
      )}
      {moment.stickers.length > 0 && (
        <ul className="mt-5 grid gap-3">
          {moment.stickers.map((sticker, i) => (
            <li key={sticker.id} className="flex items-center gap-4">
              {/* a sticker from earlier in this visit has landed already and stays put; after a level's beat, the stickers wait for it */}
              <div
                className={sticker.play < moment.plays ? '' : grown ? 'land' : 'invisible'}
                style={{ animationDelay: delay(i) }}
              >
                <Sticker icon={iconOf(sticker)} shape={sticker.shape} tone={sticker.tone} tilt={-6} className="size-20" />
              </div>
              <p className="min-w-0">
                <span className="type-small muted block">New sticker</span>
                <span className="block font-semibold">{sticker.name}</span>
                <span className="type-small block">{sticker.how}</span>
                <Link to={`/child/stickers?sticker=${sticker.id}`} className="type-small inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                  See it on your chart
                </Link>
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
              style={{ animationDelay: delay(moment.stickers.length + i) }}
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
      {moment.answers.length > 0 && (
        <ul className="mt-5 grid gap-3">
          {moment.answers.map((request, i) => (
            // K2: an answer to a reward request lands last, after the approvals, stickers and quests
            <li
              key={request.id}
              className={`flex items-center gap-4 ${request.play < moment.plays ? '' : grown ? 'land' : 'invisible'}`}
              style={{ animationDelay: delay(moment.stickers.length + moment.quests.length + i) }}
            >
              <span className="grid size-20 shrink-0 place-items-center rounded-card bg-white text-navy-800">
                <MailOpen className="size-10" aria-hidden="true" />
              </span>
              <p className="min-w-0">
                <span className="type-small muted block">{request.answer ? `${request.answer.by} answered` : 'A parent answered'}</span>
                <span className="block font-semibold break-words">{request.title}</span>
                <span className="type-small block break-words">
                  {request.status === 'given' ? 'Given. Enjoy it.' : 'Not this time. Your points came back.'}
                  {request.note && ` “${request.note}”`}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
      <QuestBar quest={growth.shown.quest} />
      <GoalBar goal={growth.goal} balance={growth.shown.balance} />
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
  const visit = useRef({ plays: 0, from: null, gains: [], stickers: [], quests: [], answers: [] })
  const [agreed, setAgreed] = useState(false) // K7: just agreed on this visit
  const agreedNote = useRef(null)
  const [shown, setShown] = useState(0) // the last play that was watched to the end
  const [problem, setProblem] = useState('') // why choosing the next task failed, if it did
  const nextUp = useRef(null)
  const loaded = useLoad(
    async () => {
      const { tasks, growth, stickers, answers, agreement } = await api.getToday() // P1: one call, one moment
      const seen = visit.current
      const fresh = tasks.filter((t) => t.status === 'approved' && !t.resultSeen && !seen.gains.some((g) => g.id === t.id))
      const heard = answers.filter((r) => !seen.answers.some((a) => a.id === r.id)) // K2
      if (fresh.length > 0 || heard.length > 0) {
        const play = seen.plays + 1
        const theirs = stickers.filter((s) => fresh.some((t) => t.id === s.taskId)).map((s) => ({ ...s, play }))
        const done = growth.questAwards.filter((a) => fresh.some((t) => t.id === a.taskId)).map((a) => ({ ...a, play }))
        visit.current = {
          plays: play,
          from: growth.shown,
          gains: [...seen.gains, ...fresh],
          stickers: [...seen.stickers, ...theirs],
          quests: [...seen.quests, ...done],
          answers: [...seen.answers, ...heard.map((r) => ({ ...r, play }))],
        }
      }
      return { tasks, growth, agreement, moment: visit.current }
    },
    [],
    { live: true, cache: false }, // the reward moment's state rides on the data: a cached copy could play it again
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

  // K2: the answers in the moment are seen once it has been watched to the end; if telling fails, they are new again next time
  const heardAll = shown === loaded.data?.moment.plays ? loaded.data.moment.answers.map((r) => r.id).join() : ''
  useEffect(() => {
    if (heardAll) api.markAnswersSeen(heardAll.split(',')).catch(noticeExpiry)
  }, [heardAll])

  function agreedNow() {
    flushSync(() => setAgreed(true))
    agreedNote.current?.focus()
    loaded.set((data) => ({ ...data, agreement: { agreedAt: new Date(api.now()).toISOString() } }))
  }

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

  const { tasks, growth, agreement, moment } = loaded.data ?? {}
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
            ) : null}
            {!next ? (
              <AskForTask className="mt-8" />
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
          {agreement?.agreedAt ? (
            !agreed && (
              <p className="type-small muted mt-10">
                You agreed to our agreement <time dateTime={agreement.agreedAt}>{whenText(agreement.agreedAt)}</time>.
              </p>
            )
          ) : (
            agreement && <Agreement agreement={agreement} onAgreed={agreedNow} />
          )}
          {agreed && (
            <Message ref={agreedNote} tabIndex={-1} tone="success" className="mt-10">
              You agreed. Your parent can see it on your page.
            </Message>
          )}
        </>
      )}
    </>
  )
}
