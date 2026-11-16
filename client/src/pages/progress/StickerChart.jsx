import Sticker from '../../components/Sticker.jsx'
import { iconOf, tiltOf } from '../../utils/stickers.js'
import { dayMonth } from '../../utils/format.js'

/** The child's sticker chart, as the parent sees it: earned ones in colour, the rest as named outlines. */
export function StickerChart({ stickers, name }) {
  const earned = stickers.filter((sticker) => sticker.earnedAt)
  return (
    <section aria-labelledby="stickers-title">
      <h2 id="stickers-title" className="type-subheading">
        Stickers
      </h2>
      <p className="muted mt-1">
        {earned.length === 0 ? `${name} has not earned a sticker yet.` : `${name} has earned ${earned.length} of ${stickers.length}.`}
      </p>
      <ul className="mt-4 grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
        {stickers.map((sticker, i) => (
          <li key={sticker.id} className="grid justify-items-center gap-1 text-center">
            <Sticker
              icon={iconOf(sticker)}
              shape={sticker.shape}
              tone={sticker.tone}
              tilt={tiltOf(i)}
              slot={!sticker.earnedAt}
              className="size-14"
            />
            <span className="type-small font-medium">{sticker.name}</span>
            <span className="type-small muted">
              {sticker.earnedAt ? `Earned ${dayMonth.format(new Date(sticker.earnedAt))}` : 'Not earned yet'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
