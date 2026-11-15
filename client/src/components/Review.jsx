import { useState } from 'react'
import { BadgeCheck, Undo2 } from 'lucide-react'
import { whenText } from '../utils/format.js'
import { Cheer } from './Cheer.jsx'
import Proof from './Proof.jsx'

// What a parent's review leaves on a task, shown the same to the parent and to the child:
// nothing is earned or judged in secret (DESIGN.md sections 10 and 12).

/** When a proof was sent, and whether that was after the task was due. */
export function SentLine({ proof, className = '' }) {
  return (
    <p className={`type-small muted ${className}`}>
      Sent <time dateTime={proof.sentAt}>{whenText(proof.sentAt)}</time>
      {proof.late && ', after the task was due'}
    </p>
  )
}

/** The approval stamp: who approved and when, on every approved task. */
export function Stamp({ review, className = '' }) {
  return (
    <p className={`stamp ${className}`}>
      <BadgeCheck className="size-6 shrink-0" aria-hidden="true" />
      <span>
        Approved by {review.by}, <time dateTime={review.at}>{whenText(review.at)}</time>
      </span>
    </p>
  )
}

/** What an approval earned and why: the gain, the task it was for, the stamp, and the parent's cheer if there is one. */
export function Gain({ task }) {
  const review = task.proofs.at(-1).review
  return (
    <span className="min-w-0">
      <span className="block font-semibold break-words">
        <span className="type-game">+{task.points} XP</span> for {task.title}
      </span>
      <Stamp review={review} className="type-small" />
      {review.cheer && <Cheer cheer={review.cheer} className="type-small mt-1" />}
    </span>
  )
}

/**
 * The note that comes with a proof sent back: what to fix, from whom and when.
 * brief names only who wrote it, for a card that already says "Sent back".
 */
export function Note({ review, brief = false, className = '' }) {
  return (
    <div className={`rounded-control bg-coral-100 p-3 text-navy-950 ${className}`}>
      <p className="type-small flex items-start gap-2 font-semibold text-coral-700">
        <Undo2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {brief ? (
          `Note from ${review.by}`
        ) : (
          <span>
            Sent back by {review.by}, <time dateTime={review.at}>{whenText(review.at)}</time>
          </span>
        )}
      </p>
      <p className="mt-1 break-words whitespace-pre-line">{review.note}</p>
    </div>
  )
}

/**
 * An earlier attempt's photo, video or note, loaded only when opened (P9): a task sent back three times would otherwise fetch
 * three files nobody asked to see. A native disclosure, so the keyboard and screen readers already know it.
 */
function Attempt({ proof, label }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="mt-2" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-navy-800 underline underline-offset-4">
        {open ? 'Hide what was sent' : 'Show what was sent'}
      </summary>
      {open && (
        <div className="mt-2">
          <Proof proof={proof} label={label} small />
        </div>
      )}
    </details>
  )
}

/** Every attempt before the newest, oldest first: what was sent and the note it came back with. */
export function Earlier({ task, label }) {
  const earlier = task.proofs.slice(0, -1)
  if (earlier.length === 0) return null
  return (
    <section className="mt-8 border-t pt-6">
      <h2 className="type-subheading">Earlier attempts</h2>
      <ol className="mt-3 grid gap-6">
        {earlier.map((proof, i) => (
          <li key={proof.id}>
            <SentLine proof={proof} />
            <Attempt proof={proof} label={`${label}, attempt ${i + 1}`} />
            {proof.review && <Note review={proof.review} className="mt-3" />}
          </li>
        ))}
      </ol>
    </section>
  )
}
