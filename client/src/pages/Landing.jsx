import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Camera, ListTodo, ShieldCheck, Sprout } from 'lucide-react'
import { now } from '../api/index.js'
import GrowthRuler from '../components/GrowthRuler.jsx'
import { Gain, Stamp } from '../components/Review.jsx'
import { Message } from '../components/states.jsx'
import Sticker from '../components/Sticker.jsx'
import Streak from '../components/Streak.jsx'
import { TaskCard } from '../components/Task.jsx'
import { useOnce } from '../hooks/useOnce.js'
import { useSession } from '../store/session.js'
import { STICKER_ICONS } from '../utils/stickers.js'

// The landing page. Its pictures are the app's own pieces with made-up numbers, nothing animates
// (the reward moment stays inside the app), and it says only what is true of the app today.
// Five parts, in order: the opening, how it works, parents and children, safety, the close.

// ------------------------------------------------------------------ 1. the opening

// ponytail: these four are copied from the sticker chart (server/src/scoring.js), which pages may not
// import, and so are "3 of 14" and "Fourteen to collect" below. server/test/scoring.test.js asserts there are 14;
// if a name, a shape or the count changes there, change it here.
const EXAMPLE_STICKERS = [
  { name: 'First task', shape: 'seal', tone: 'sun', tilt: -6 },
  { name: '3-day streak', shape: 'shield', tone: 'navy', tilt: 4 },
  { name: 'Level 2', shape: 'hexagon', tone: 'sprout', tilt: -3 },
  { name: '7-day streak', shape: 'shield', tone: 'navy', slot: true },
]

/** A child's growth band as Today shows it, in its finished state, with numbers that belong to nobody. */
function ExampleBand() {
  const week = ['none', 'none', 'done', 'done', 'done', 'done', 'done'].map((state, i) => {
    const day = now()
    day.setDate(day.getDate() - (6 - i))
    return { day: day.toISOString(), state }
  })
  return (
    <figure>
      <div className="on-navy growth-band relative overflow-hidden rounded-card px-5 pt-5 pb-9 sm:px-6 sm:pt-6">
        <GrowthRuler level={3} xp={64} xpForNext={100} waitingXp={20} />
        <div className="mt-6">
          <Streak streak={{ days: 5, best: 5, week }} />
        </div>
        <ul className="mt-6 grid grid-cols-4 gap-2" aria-label="Stickers: 3 of 14 earned">
          {EXAMPLE_STICKERS.map(({ name, slot, ...look }) => (
            <li key={name} className="grid justify-items-center gap-2 text-center">
              <Sticker icon={STICKER_ICONS[look.shape]} slot={slot} className="size-14" {...look} />
              <span className="type-small font-medium">
                {name}
                {slot && <span className="sr-only">, not earned yet</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="type-small muted mt-3">
        An example. These numbers are made up: this is how a child’s home page starts, with their level, streak and stickers.
      </figcaption>
    </figure>
  )
}

function Opening() {
  return (
    <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-16" aria-labelledby="opening-title">
      <div>
        {/* DESIGN.md section 6 keeps Baloo 2 for the game and child page titles, so the headline is the Headline role: Lexend */}
        <h1 id="opening-title" className="type-headline text-navy-800">
          Tasks done at home. Growth you can see.
        </h1>
        <p className="type-body-child mt-4 max-w-prose">
          GrowKid is for families. A parent sets a real task, the child sends proof that they did it, and the parent’s approval earns
          XP, levels, a streak and stickers.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/signup" className="btn btn-lg btn-primary max-sm:w-full">
            Create a parent account
          </Link>
          <Link to="/login" className="btn btn-text">
            Sign in
          </Link>
        </div>
      </div>
      <ExampleBand />
    </section>
  )
}

// ------------------------------------------------------------------ 2. how it works

const STEPS = [
  {
    id: 'set',
    label: 'A parent sets a task',
    Icon: ListTodo,
    text: 'The parent writes what to do, when it is due and how many points it is worth. The child sees it as their next task.',
    ruler: { xp: 40 },
  },
  {
    id: 'send',
    label: 'The child sends proof',
    Icon: Camera,
    text: 'The child does it away from the screen, then sends a photo, a video, a file or a note. Nothing is earned yet, so the ruler shows the XP as waiting.',
    ruler: { xp: 40, waitingXp: 30 },
  },
  {
    id: 'answer',
    label: 'The parent answers',
    Icon: BadgeCheck,
    text: 'The parent looks at the proof and approves it, or sends it back with a note saying what to fix. A child who is sent back can try again.',
    ruler: { xp: 40 },
  },
  {
    id: 'grow',
    label: 'The ruler grows',
    Icon: Sprout,
    text: 'Every approved point is one XP, and every 100 XP is a new level. On their Today page the child sees what they earned, and why.',
    ruler: { xp: 70 },
  },
]

/** The one sample task, as it stands at each step. Times are worked out from now, so none is in the past. */
function sampleTask(step) {
  const due = now()
  due.setDate(due.getDate() + 1)
  due.setHours(18, 0, 0, 0)
  // the card and the band read only the status, and the stamp's who and when
  const review = { by: 'Mum', at: new Date(now() - 10 * 60_000).toISOString() }
  return {
    id: 'sample',
    category: 'chores',
    title: 'Water the balcony plants',
    instructions: 'Give each pot one full mug. Send a photo when you are done.',
    points: 30,
    dueAt: due.toISOString(),
    status: step === 'set' ? 'todo' : step === 'send' ? 'review' : 'approved',
    proofs: step === 'set' ? [] : [step === 'send' ? {} : { review }],
  }
}

function HowItWorks() {
  const [step, setStep] = useState('set')
  const chosen = STEPS.find((s) => s.id === step)
  const task = sampleTask(step)
  return (
    <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-16" aria-labelledby="loop-title">
      <div>
        <h2 id="loop-title" className="type-heading">
          How it works
        </h2>
        <p className="mt-2 max-w-prose">Follow one task from start to finish. Choose a step to see how it looks in the app.</p>
        <fieldset className="mt-6">
          <legend className="sr-only">The steps of one task</legend>
          <div className="grid grid-cols-2 gap-2">
            {STEPS.map(({ id, label, Icon }) => (
              <label key={id} className="choice">
                <input type="radio" className="sr-only" name="step" value={id} checked={step === id} onChange={() => setStep(id)} />
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="type-body-child mt-6 max-w-prose" aria-live="polite">
          {chosen.text}
        </p>
      </div>

      <div className="grid gap-4">
        {/* the stamp is shown once: on the card when the parent answers, then in the band with what it earned */}
        <TaskCard task={task}>{step === 'answer' && <Stamp review={task.proofs[0].review} className="mt-4" />}</TaskCard>
        {/* a new ruler for each step: it is drawn where it belongs, and never grows on this page */}
        <div className="on-navy rounded-card p-5">
          {step === 'grow' && (
            <div className="mb-5">
              <Gain task={task} />
            </div>
          )}
          <GrowthRuler key={step} level={3} xpForNext={100} {...chosen.ruler} />
        </div>
        <p className="type-small muted -mt-2">The same example, with made-up numbers.</p>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ 3. parents and children

const FOR_PARENTS = [
  ['Clear tasks', 'Say what to do, when it is due and what it is worth, in your own words.'],
  ['Proof to review', 'See the photo, video, file or note your child sent. Approve it, or send it back with a note.'],
  ['Progress over time', 'See each child’s level, streak and stickers, the tasks approved each week, and print a report.'],
  ['Rewards and quests', 'Add rewards your children can spend points on, set a weekly quest, and cheer them on when you approve.'],
]
const FOR_CHILDREN = [
  ['One next task', 'Your home page opens on what to do next, and what it is worth.'],
  ['XP and levels', 'Every approved task fills your ruler. Every 100 XP is a new level.'],
  ['A streak', 'Send proof on the days a task is due, and your streak grows. Today reminds you once, and never anywhere else.'],
  ['Stickers', 'Fourteen to collect. You earn each one once, and you keep it for good.'],
  ['Rewards and quests', 'Spend points on rewards your parent sets, and finish a weekly quest for bonus points.'],
]

function Gets({ title, items, id }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="type-heading">
        {title}
      </h2>
      <ul className="mt-4 grid gap-4">
        {items.map(([lead, rest]) => (
          <li key={lead}>
            <span className="block font-semibold">{lead}</span>
            <span className="muted block max-w-prose">{rest}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ParentsAndChildren() {
  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-0">
      <div className="lg:pr-12">
        <Gets id="parents-title" title="For parents" items={FOR_PARENTS} />
      </div>
      <div className="border-t pt-10 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12">
        <Gets id="children-title" title="For children" items={FOR_CHILDREN} />
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ 4. safety

const SAFETY = [
  [
    'A parent creates every child’s account.',
    'A child cannot sign up alone. There is no chat, no public profile and no way to contact someone outside the family.',
  ],
  [
    'A child sees what a parent sees about them.',
    'The tasks, the proof, the notes, who approved each task and when, and the score. Nothing is judged in secret.',
  ],
  [
    'A child can report a problem without telling a parent.',
    'The report goes straight to a moderator. A parent is not asked, told or shown it. The moderator sees the words and a copy of the task, never a name or a photo.',
  ],
]

function Safety() {
  return (
    <section aria-labelledby="safety-title">
      <h2 id="safety-title" className="type-heading flex items-center gap-2">
        <ShieldCheck className="size-6 shrink-0 text-navy-800" aria-hidden="true" />
        How GrowKid keeps children safe
      </h2>
      <dl className="mt-6 border-b">
        {SAFETY.map(([statement, rest]) => (
          <div key={statement} className="grid gap-1 border-t py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-12">
            <dt className="type-subheading">{statement}</dt>
            <dd className="muted max-w-prose">{rest}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 max-w-prose">
        GrowKid is still being built. Everything a family adds is kept on the GrowKid server, and proof photos are seen only by the child
        and their parent.{' '}
        <Link to="/privacy" className="font-medium text-navy-800 underline underline-offset-4">
          Read more on Safety and privacy
        </Link>
        .
      </p>
    </section>
  )
}

// ------------------------------------------------------------------ 5. the close

function Closing() {
  return (
    <section aria-labelledby="closing-title">
      <h2 id="closing-title" className="type-heading">
        Start with one task
      </h2>
      <p className="mt-2 max-w-prose">Create a parent account, add your child, and set the first task.</p>
      <Link to="/signup" className="btn btn-lg btn-primary mt-6 max-sm:w-full">
        Create a parent account
      </Link>
    </section>
  )
}

const Rule = () => <div className="ruler-rule my-16" aria-hidden="true" />

export default function Landing() {
  // after deleting a family's data the guard sends the user here once, with this note
  const [note] = useOnce()
  const deleted = Boolean(note?.deleted)
  useEffect(() => {
    // the note has been read: the session has nothing more to say about how it ended
    if (deleted) useSession.setState({ ended: null })
  }, [deleted])

  return (
    <>
      <title>GrowKid – tasks done at home, growth you can see</title>
      {deleted && (
        <Message tone="success" className="mb-8" role="status">
          Your account and your family’s data have been deleted. Nothing was kept, except any report that no moderator had
          answered yet. It has no account and no link to your family.
        </Message>
      )}
      <Opening />
      <Rule />
      <HowItWorks />
      <Rule />
      <ParentsAndChildren />
      <Rule />
      <Safety />
      <Rule />
      <Closing />
    </>
  )
}
