import { CircleCheck, CircleMinus, Hourglass } from 'lucide-react'
import { whenText } from '../utils/format.js'

// How a reward request is shown, the same to the child who asked and the parent who answers.

// Every status is icon, word and colour together (DESIGN.md section 8). Declining is not coral:
// it is not something the child has to fix.
const STATUSES = {
  requested: { look: 'tag-info', Icon: Hourglass, word: 'Waiting for a parent' },
  given: { look: 'tag-success', Icon: CircleCheck, word: 'Given' },
  declined: { look: 'tag-neutral', Icon: CircleMinus, word: 'Not this time' },
}

/** A request's status as a tag. */
export function RequestTag({ status }) {
  const { look, Icon, word } = STATUSES[status]
  return (
    <span className={`tag ${look}`}>
      <Icon className="size-4" aria-hidden="true" />
      {word}
    </span>
  )
}

/**
 * When a request was asked and answered, and the parent's note if they wrote one. It speaks to
 * the child ("Your points came back"); forParent names the child instead.
 */
export function RequestLine({ request, forParent = false }) {
  const parts = [`Asked ${whenText(request.requestedAt)}`]
  if (request.answer) parts.push(`Answered by ${request.answer.by}, ${whenText(request.answer.at)}`)
  if (request.status === 'declined') parts.push(forParent ? `${request.childName} got the points back` : 'Your points came back')
  return (
    <>
      <p className="type-small muted mt-1">{`${parts.join('. ')}.`}</p>
      {request.note && <p className="type-small mt-1 break-words">“{request.note}”</p>}
    </>
  )
}
