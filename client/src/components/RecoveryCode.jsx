import { KeyRound } from 'lucide-react'
import CopyButton from './CopyButton.jsx'
import { Message } from './states.jsx'

/**
 * T5: a recovery code shown once, on Overview after sign-up and in Settings after making a new one. A card, not a dialog: the same
 * card a new child's password uses on Family. `Heading` is h3 where the card sits under a section's own h2.
 */
export default function RecoveryCode({ code, onSaved, Heading = 'h2', className = '' }) {
  const grouped = code.match(/.{4}/g).join('-')
  return (
    <section className={`rounded-card border-2 border-navy-800 bg-white p-4 sm:p-6 ${className}`} role="status">
      <Heading className="type-subheading flex items-center gap-2">
        <KeyRound className="size-5" aria-hidden="true" />
        Your recovery code
      </Heading>
      <p className="type-data mt-4 font-semibold break-words">{grouped}</p>
      <div className="mt-3">
        <CopyButton text={grouped} what="code" />
      </div>
      <Message tone="warning" className="mt-4">
        Write this down and keep it somewhere safe. It is the only way to set a new password if you forget yours, and it is not shown
        again. It works once; you can make a new one in Settings.
      </Message>
      <div className="mt-4">
        <button type="button" className="btn btn-text" onClick={onSaved}>
          I have saved it
        </button>
      </div>
    </section>
  )
}
