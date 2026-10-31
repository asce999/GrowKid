import { MessageCircle } from 'lucide-react'
import { CHEERS } from '../utils/cheers.js'
import { Field } from './Field.jsx'

/** A parent's cheer with an approval: the icon, the words, and their own line if they wrote one. */
export function Cheer({ cheer, className = '' }) {
  if (!cheer) return null
  // a line with no kind has no words of its own, so it gets the plain speech bubble
  const { words, Icon } = CHEERS[cheer.kind] ?? { Icon: MessageCircle }
  return (
    <p className={`flex items-start gap-2 ${className}`}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">
        {words && <span className="font-semibold">{words}</span>}
        {cheer.line && (words ? ' ' : '') + `“${cheer.line}”`}
      </span>
    </p>
  )
}

/**
 * The parent's side of a cheer: one of the six kinds or none, and a line of their own. value is
 * { kind, line } and onChange gets the whole of it back. child is the name the hint uses.
 */
export function CheerPicker({ value, onChange, child }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="font-medium">
        Add a cheer <span className="muted font-normal">(optional)</span>
      </legend>
      {/* the right-hand column of Task detail is narrow from lg, so four to a row there */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-4">
        <label className="choice">
          <input type="radio" name="cheer" className="sr-only" checked={!value.kind} onChange={() => onChange({ ...value, kind: null })} />
          None
        </label>
        {Object.entries(CHEERS).map(([kind, { words, Icon }]) => (
          <label key={kind} className="choice">
            <input type="radio" name="cheer" className="sr-only" checked={value.kind === kind} onChange={() => onChange({ ...value, kind })} />
            <Icon className="size-5" aria-hidden="true" />
            {words}
          </label>
        ))}
      </div>
      <Field
        label="A line from you (optional)"
        hint={`${child} sees it with the approval.`}
        maxLength={120}
        name="cheer-line"
        autoComplete="off"
        value={value.line}
        onChange={(event) => onChange({ ...value, line: event.target.value })}
      />
    </fieldset>
  )
}
