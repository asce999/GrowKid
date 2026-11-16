import { MEASURE_WORDS, iconOf, isEarned } from '../utils/stickers.js'
import Sticker from './Sticker.jsx'

// What lies ahead for a child: the levels to come, and the stickers they are closest to. Both
// only point at doing more real tasks (DESIGN.md section 10).

/**
 * The next six levels as a line of tiles, from the current one, with the sticker a level earns
 * beside it. stickers is the list from listStickers. xpForNext is what each level needs.
 */
export function GrowthPath({ level, xpForNext, stickers }) {
  return (
    <ol className="mt-4">
      {Array.from({ length: 6 }, (_, i) => level + i).map((n) => {
        const sticker = stickers.find((s) => s.measure === 'level' && s.need === n)
        const earned = sticker && isEarned(sticker)
        return (
          <li key={n} className={`path-step ${n === level ? 'path-here' : ''}`} aria-current={n === level ? 'step' : undefined}>
            <span className="path-level" aria-hidden="true">
              {n}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{n === level ? `Level ${n}: you are here` : `Level ${n}`}</p>
              <p className="type-small muted">Starts at {((n - 1) * xpForNext).toLocaleString('en-IN')} XP</p>
              {sticker && (
                <div className="mt-2 flex items-center gap-3">
                  <Sticker icon={iconOf(sticker)} shape={sticker.shape} tone={sticker.tone} slot={!earned} className="size-10" />
                  <p className="type-small font-medium">
                    {sticker.name}
                    {!earned && <span className="sr-only">, not earned yet</span>}
                  </p>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Up to three stickers the child is closest to, with how far along each is. Levels are left out:
 * the path above covers them. Draws nothing, heading included, when there is none to show.
 */
export function NextStickers({ stickers }) {
  const next = stickers
    .filter((s) => !isEarned(s) && s.have !== undefined && s.measure !== 'level')
    .sort((a, b) => (a.need - a.have) / a.need - (b.need - b.have) / b.need)
    .slice(0, 3)
  if (next.length === 0) return null
  return (
    <>
      <h2 className="type-subheading mt-10">Next stickers</h2>
      <ul className="mt-3 overflow-hidden rounded-card border bg-white">
        {next.map((s) => (
          <li key={s.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-6">
            <Sticker icon={iconOf(s)} shape={s.shape} tone={s.tone} slot className="size-12" />
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-medium">{s.name}</span>
              <span className="type-small muted">
                {s.have} of {s.need} {MEASURE_WORDS[s.measure]}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
