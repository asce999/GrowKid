import { useId, useState } from 'react'
import { FileText } from 'lucide-react'
import { fileSizeText, plural } from '../utils/format.js'
import { Message, RetryButton } from './states.jsx'

/**
 * One proof: the photo, video or file, and the note. The family's own pictures are the real
 * imagery, so a photo is never cropped. Large for the parent; small for the child, who made it.
 * label says who sent it and for which task. P9: a photo loads when it nears the screen; a video fetches only its first details. onRetry reloads the task if the file will not show.
 */
export default function Proof({ proof, label, small = false, onRetry }) {
  const [broken, setBroken] = useState(false)
  const id = useId() // Try again brings the focus back here, to the file it loaded again
  const type = proof.fileType ?? ''
  const image = type.startsWith('image/')
  // a video this browser cannot play, QuickTime often, is offered as a file to open instead
  const video = type.startsWith('video/') && !broken
  const look = `rounded-card border bg-navy-100 object-contain ${small ? 'max-h-56' : 'max-h-[75vh] w-full'}`

  return (
    <div id={id} tabIndex={-1} className="grid justify-items-start gap-3">
      {proof.removed ? (
        // T4: deleted for age; the days are from the approval to the removal
        <Message>
          {image ? 'Photo' : type.startsWith('video/') ? 'Video' : 'File'} removed
          {proof.removed.afterDays === undefined ? '' : ` after ${plural(proof.removed.afterDays, 'day')}`}. The note and the result are kept.
        </Message>
      ) : proof.fileType && (!proof.fileUrl || (image && broken)) ? (
        <Message tone="warning">
          <p>The file did not load.</p>
          {onRetry && (
            <RetryButton onRetry={onRetry} target={`#${CSS.escape(id)}`} />
          )}
        </Message>
      ) : image ? (
        <img src={proof.fileUrl} alt={label} className={look} loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : video ? (
        <video src={proof.fileUrl} aria-label={label} className={look} controls preload="metadata" onError={() => setBroken(true)} />
      ) : proof.fileType ? (
        <a href={proof.fileUrl} target="_blank" rel="noreferrer" className="btn btn-secondary max-w-full">
          <FileText className="size-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{proof.fileName}</span>
          <span className="font-normal whitespace-nowrap">{fileSizeText(proof.fileSize)}</span>
        </a>
      ) : null}
      {proof.note && (
        <div>
          <p className="type-small muted">Note</p>
          <p className="break-words whitespace-pre-line">{proof.note}</p>
        </div>
      )}
    </div>
  )
}
