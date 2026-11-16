import { BadgeCheck, BookOpen, Check, Clock, Flame, Sprout, Star } from 'lucide-react'
import GrowthRuler from '../components/GrowthRuler.jsx'
import Plant from '../components/Plant.jsx'
import Logo, { LogoMark } from '../components/Logo.jsx'
import StatusTag from '../components/StatusTag.jsx'
import Sticker from '../components/Sticker.jsx'
import { plantText } from '../utils/plant.js'

// A colour token's value, read from the stylesheet so this page cannot drift from index.css.
const tokenValue = (token) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim().toUpperCase()

const COLOURS = [
  {
    name: 'Navy',
    job: 'Structure, text, main actions and information. The light steps are the greys.',
    steps: ['navy-50', 'navy-100', 'navy-200', 'navy-400', 'navy-600', 'navy-800', 'navy-950'],
  },
  {
    name: 'Sprout',
    job: 'Growth: XP, progress and anything approved.',
    steps: ['sprout-100', 'sprout-300', 'sprout-500', 'sprout-800'],
  },
  {
    name: 'Sun',
    job: 'Something earned: stickers, points and level-ups. Always solid, never a background or a button.',
    steps: ['sun-300', 'sun-500', 'sun-800'],
  },
  {
    name: 'Coral',
    job: 'Something to fix: sent back, overdue, errors and deleting.',
    steps: ['coral-100', 'coral-500', 'coral-700'],
  },
  {
    name: 'Ember',
    job: 'Time pressure: due soon. Used sparingly.',
    steps: ['ember-100', 'ember-500', 'ember-800'],
  },
]

const TYPE = [
  { role: 'type-display', use: 'Child page titles and celebrations', sample: 'Level 8 reached' },
  { role: 'type-headline', use: 'Headlines on the public pages', sample: 'Tasks done at home' },
  { role: 'type-game', use: 'Level, XP, points and streak numbers', sample: '650 of 1,000 XP' },
  { role: 'type-heading', use: 'Parent page titles and section headings', sample: 'Tasks this week' },
  { role: 'type-subheading', use: 'Card and dialog titles', sample: 'Water the balcony plants' },
  { role: 'type-body-child', use: 'Reading text on child screens', sample: 'Give each pot one full mug, then send a photo.' },
  { role: 'type-body', use: 'Reading text everywhere else', sample: 'Aarav sent a photo for Water the balcony plants.' },
  { role: 'type-small', use: 'Helper text, timestamps and tags', sample: 'Due today, 6 pm' },
  { role: 'type-data', use: 'Parent statistics and tables', sample: '14 of 16 tasks approved' },
]

const TASKS = [
  { title: 'Pack the school bag', meta: 'Due tomorrow, 7 am', status: 'todo' },
  { title: 'Water the balcony plants', meta: 'Photo sent today, 5:40 pm', status: 'review' },
  { title: 'Read 20 pages', meta: 'Approved by Mum, yesterday', status: 'approved' },
  { title: 'Practise the 7 times table', meta: 'Mum asked for a clearer photo', status: 'sentBack' },
  { title: 'Tidy the study desk', meta: 'Due today, 6 pm', status: 'dueSoon' },
  { title: 'Return the library book', meta: 'Was due on Monday', status: 'overdue' },
]

const WEEK = [
  ['Mon', 'done'],
  ['Tue', 'done'],
  ['Wed', 'done'],
  ['Thu', 'done'],
  ['Fri', 'done'],
  ['Sat', 'today'],
  ['Sun', 'later'],
]

function Section({ title, note, children }) {
  return (
    <section className="grid gap-x-12 gap-y-6 border-t py-12 lg:grid-cols-[13rem_1fr]">
      <div>
        <h2 className="type-heading">{title}</h2>
        <p className="type-small muted mt-2">{note}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

// One specimen in the shape row.
function Shape({ label, children }) {
  return (
    <figure className="grid justify-items-start gap-3">
      <div className="grid h-20 items-center">{children}</div>
      <figcaption className="type-small muted">{label}</figcaption>
    </figure>
  )
}

function DayMark({ day, state }) {
  return (
    <li className="grid justify-items-center gap-1">
      <span className="type-small muted">{day}</span>
      {state === 'done' ? (
        <span className="grid size-8 place-items-center rounded-tag border border-sun-800 bg-sun-500">
          <Check className="size-4" strokeWidth={3} aria-hidden="true" />
          <span className="sr-only">done</span>
        </span>
      ) : (
        <span className={`size-8 rounded-tag ${state === 'today' ? 'not-yet' : 'bg-navy-100'}`}>
          <span className="sr-only">{state === 'today' ? 'today, not done yet' : 'still to come'}</span>
        </span>
      )}
    </li>
  )
}

export default function DesignSheet() {
  return (
    <main id="main" className="mx-auto max-w-parent px-4 sm:px-8">
      <header className="py-12">
        <Logo />
        <h1 className="type-heading mt-8">GrowKid design sheet</h1>
        <p className="muted mt-2 max-w-prose">
          The tokens and pieces every screen is built from. The rules behind them are in Documentation/DESIGN.md.
        </p>
      </header>

      <Section
        title="Logo"
        note="A sprout that is also a child with both arms up. The long leaf leans like a tick, and the head is the colour of something earned."
      >
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid place-items-center rounded-card border bg-white p-6">
            <LogoMark className="size-32" />
          </div>
          <div className="grid place-items-center rounded-card border bg-white p-6">
            <Logo className="logo-lg" />
          </div>
          <div className="on-navy grid place-items-center rounded-card p-6">
            <Logo className="logo-lg" />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-end gap-6">
          {['size-4', 'size-6', 'size-8', 'size-12'].map((size) => (
            <LogoMark key={size} className={size} />
          ))}
          <p className="type-small muted max-w-prose">
            Holds up from a 16 px browser tab to a slide. Keep the colours as they are and leave a leaf of space
            around it.
          </p>
        </div>
      </Section>

      <Section title="Plant" note="K9: the level as a plant, ten stages and then rings. Worked out from the level; never a character.">
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <li key={i} className="grid justify-items-center gap-1 text-center">
              <Plant level={i + 1} className="size-24" />
              <span className="type-small">{plantText(i + 1)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Colour" note="Five families. Each has one job, so a colour always means the same thing.">
        <div className="grid gap-8">
          {COLOURS.map(({ name, job, steps }) => (
            <div key={name}>
              <h3 className="type-subheading">{name}</h3>
              <p className="muted max-w-prose">{job}</p>
              <ul className="mt-3 flex flex-wrap gap-3">
                {steps.map((token) => (
                  <li key={token} className="type-small w-24">
                    <div className="h-12 rounded-tag border" style={{ background: `var(--color-${token})` }} />
                    <div className="mt-2 font-medium">{token}</div>
                    <div className="muted">{tokenValue(token)}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Type"
        note="Lexend does the work; Baloo 2 talks about the game. Set text with these roles, never with a raw size."
      >
        <dl className="grid gap-6">
          {TYPE.map(({ role, use, sample }) => (
            <div key={role} className="grid gap-1 sm:grid-cols-[14rem_1fr] sm:items-baseline sm:gap-6">
              <dt className="type-small muted">
                <span className="block font-medium text-navy-950">{role}</span>
                {use}
              </dt>
              <dd className={role}>{sample}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        title="Shape"
        note="Rectangles are structure. Only people and achievements break the rectangle, and a dashed outline means not yet."
      >
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          <Shape label="Tag, 6 px">
            <StatusTag status="approved" />
          </Shape>
          <Shape label="Button and input, 10 px">
            <button className="btn btn-secondary">Cancel</button>
          </Shape>
          <Shape label="Card, 16 px">
            <div className="h-16 w-28 rounded-card border bg-white" />
          </Shape>
          <Shape label="Person, circle">
            <span className="avatar" aria-hidden="true">
              A
            </span>
          </Shape>
          <Shape label="Achievement, sticker">
            <Sticker icon={Star} shape="hexagon" tone="navy" tilt={-5} className="size-16" />
          </Shape>
          <Shape label="Not yet, dashed">
            <div className="not-yet h-16 w-28 rounded-card" />
          </Shape>
        </div>
      </Section>

      <Section
        title="Controls"
        note="A button says what happens. Navy is the main action and there is one per screen. Green is only for approving."
      >
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary">Create task</button>
          <button className="btn btn-approve">Approve</button>
          <button className="btn btn-secondary">Send back</button>
          <button className="btn btn-danger">Delete task</button>
          <button className="btn btn-text">Cancel</button>
          <button className="btn btn-primary" disabled>
            Create task
          </button>
        </div>
        <div className="mt-6 max-w-sm">
          <button className="btn btn-lg btn-primary w-full">Send proof</button>
          <p className="type-small muted mt-2">The child's main button is taller and full width on a phone.</p>
        </div>

        <div className="mt-8 grid items-start gap-6 sm:grid-cols-2">
          <label className="grid gap-2 font-medium">
            Task name
            <input className="field font-normal" placeholder="Water the balcony plants" />
          </label>
          <label className="grid gap-2 font-medium">
            Due
            <input className="field font-normal" aria-invalid="true" aria-describedby="due-error" />
            <span id="due-error" className="type-small font-normal text-coral-700">
              Add a day and time so Aarav knows when it is due.
            </span>
          </label>
        </div>
      </Section>

      <Section
        title="Status"
        note="Always an icon, a word and a colour together. A rejected proof is shown as sent back, with a way to try again."
      >
        <ul className="rounded-card border bg-white">
          {TASKS.map(({ title, meta, status }) => (
            <li
              key={title}
              className="flex flex-col items-start gap-2 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div>
                <p className="font-medium">{title}</p>
                <p className="type-small muted">{meta}</p>
              </div>
              <StatusTag status={status} />
            </li>
          ))}
        </ul>

        <div className="not-yet mt-8 rounded-card p-6">
          <p className="type-subheading">No tasks yet</p>
          <p className="muted mt-1">Create the first one for Aarav and it will show up here.</p>
          <button className="btn btn-secondary mt-4">Create task</button>
        </div>
        <p className="type-small muted mt-2">An empty state: a dashed outline, one sentence and one action.</p>
      </Section>

      <Section
        title="Game pieces"
        note="Levels are measured on a growth ruler, like pencil marks on a door frame. Badges are stickers, like a star chart on the fridge."
      >
        <div className="max-w-xl">
          <GrowthRuler level={7} xp={650} xpForNext={1000} />
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-4">
          <p className="flex items-center gap-2">
            <Star className="icon-earned size-6" aria-hidden="true" />
            <span className="type-game">850</span> points
          </p>
          <p className="flex items-center gap-2">
            <Flame className="icon-earned size-6" aria-hidden="true" />
            <span className="type-game">12</span> day streak
          </p>
        </div>

        <ul className="mt-6 flex gap-3" aria-label="This week">
          {WEEK.map(([day, state]) => (
            <DayMark key={day} day={day} state={state} />
          ))}
        </ul>
        <p className="type-small muted mt-2">5 of 7 days this week. A missed day ends a streak quietly.</p>

        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          <Sticker icon={Check} name="First task" how="Finished your first task." shape="seal" tilt={-6} />
          <Sticker
            icon={Flame}
            name="7 day streak"
            how="Did a task 7 days in a row."
            shape="shield"
            tone="navy"
            tilt={4}
          />
          <Sticker
            icon={BookOpen}
            name="Study star"
            how="Finished 10 study tasks."
            shape="star"
            tone="sprout"
            tilt={-3}
          />
          <Sticker icon={Sprout} name="Level 5" how="Grew to level 5." shape="hexagon" tilt={5} />
          <Sticker name="30 day streak" how="Do a task 30 days in a row." shape="shield" locked />
        </div>

        <p className="mt-10 flex items-center gap-2 font-medium text-sprout-800">
          <BadgeCheck className="size-6" aria-hidden="true" />
          Approved by Mum, today 6:40 pm
        </p>
        <p className="type-small muted mt-2">The approval stamp: who approved and when, on every approved task.</p>
      </Section>

      <Section
        title="Two volumes"
        note="The same pieces for both audiences. The parent side is quiet and leads with what needs review. The child side carries more colour and leads with the next task."
      >
        <div className="grid items-start gap-x-8 gap-y-12 lg:grid-cols-2">
          <div>
            <h3 className="type-subheading">Parent</h3>
            <p className="type-heading mt-6">Overview</p>
            <p className="muted mt-1">3 proofs are waiting for review.</p>
            <article className="card mt-6">
              <div className="flex items-start gap-3">
                <span className="avatar" aria-hidden="true">
                  A
                </span>
                <div className="min-w-0 flex-1">
                  <p className="type-subheading">Water the balcony plants</p>
                  <p className="type-small muted">Aarav sent a photo today, 5:40 pm</p>
                </div>
                <StatusTag status="review" />
              </div>
              <div
                role="img"
                aria-label="Photo proof from Aarav for Water the balcony plants"
                className="type-small muted mt-4 grid aspect-4/3 place-items-center rounded-card bg-navy-100"
              >
                Photo proof
              </div>
              <p className="mt-4">All six pots done, even the big one.</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button className="btn btn-approve">Approve</button>
                <button className="btn btn-secondary">Send back</button>
              </div>
            </article>
          </div>

          <div>
            <h3 className="type-subheading">Child</h3>
            <div className="on-navy mt-6 rounded-card p-4 sm:p-6">
              <GrowthRuler level={7} xp={650} xpForNext={1000} />
              <p className="mt-4 flex items-center gap-2">
                <Flame className="icon-earned size-6" aria-hidden="true" />
                <span className="type-game">12</span> day streak
              </p>
            </div>
            <p className="type-display mt-8">Next up</p>
            <article className="card type-body-child mt-4">
              <div className="flex items-center justify-between gap-3">
                <StatusTag status="todo" />
                <span className="flex items-center gap-2 font-medium">
                  <Star className="icon-earned size-5" aria-hidden="true" />
                  30 points
                </span>
              </div>
              <p className="type-subheading mt-4">Water the balcony plants</p>
              <p className="muted mt-1">Give each pot one full mug. Send a photo when you are done.</p>
              <p className="type-small mt-4 flex items-center gap-2 font-medium">
                <Clock className="size-4" aria-hidden="true" />
                Due today, 6 pm
              </p>
              <button className="btn btn-lg btn-primary mt-6 w-full">Send proof</button>
            </article>
          </div>
        </div>
      </Section>
    </main>
  )
}
