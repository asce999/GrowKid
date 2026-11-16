import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

/** Phase 7, item 3: copies a password shown once to this device's clipboard, and says whether it worked. */
export default function CopyButton({ text, what = 'password' }) {
  const [said, setSaid] = useState('')
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setSaid('Copied')
    } catch {
      setSaid('Could not copy. Write it down instead.')
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <button type="button" className="btn btn-secondary" onClick={copy}>
        {said === 'Copied' ? <Check className="size-5 shrink-0" aria-hidden="true" /> : <Copy className="size-5 shrink-0" aria-hidden="true" />}
        Copy {what}
      </button>
      <span className="type-small" role="status">
        {said}
      </span>
    </span>
  )
}
