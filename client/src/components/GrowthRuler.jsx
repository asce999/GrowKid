import { useEffect, useState } from 'react'
import { Hourglass } from 'lucide-react'
import { LOCALE } from '../utils/format.js'

const count = (n) => n.toLocaleString(LOCALE)

/** How long a part of the reward moment takes: the token, or nothing with reduced motion on. */
function ms(token) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--duration-${token}`))
}

/**
 * Level progress as a growth ruler: where you are, what is next and how far.
 * xp is the XP earned inside this level; xpForNext is what the level needs. waitingXp is XP
 * from proofs a parent has not approved yet: it is drawn after the marker as a dashed stretch.
 *
 * from is the level and XP the child last saw. Given one that differs, the ruler starts there
 * and grows to where it is now, once, with the XP number counting up beside it: the first part
 * of the reward moment (DESIGN.md section 10). A level passed on the way fills the ruler, lands
 * the new level number on an empty one, then grows again from the start, with a pause between
 * each step. onGrown is called when the ruler has arrived, or at once if it had nowhere to go.
 */
export default function GrowthRuler({ level, xp, xpForNext, waitingXp = 0, from, onGrown }) {
  // where the ruler is drawn while it is growing; null once it simply shows what it was given
  const [moving, setMoving] = useState(from && (from.level !== level || from.xp !== xp) ? from : null)
  const at = moving ?? { level, xp }

  useEffect(() => {
    if (!moving) {
      onGrown?.()
      return
    }
    const grow = ms('grow')
    const pause = ms('pause')
    const landed = grow + pause + ms('reward') + pause // the ruler has filled and the new level number has landed
    const steps =
      from.level < level
        ? [[0, { level: from.level, xp: xpForNext }], [grow + pause, { level, xp: 0 }], [landed, { level, xp }], [landed + (xp > 0 ? grow : 0)]]
        : [[0, { level, xp }], [grow]]
    const arrive = () => {
      setMoving(null)
      onGrown?.()
    }
    let timers = []
    // the first step waits a moment, so the starting place is drawn before anything moves
    const start = () => (timers = steps.map(([after, next]) => setTimeout(() => (next ? setMoving(next) : arrive()), after + 50)))
    // nothing plays in a tab nobody is looking at: it waits to be seen
    if (document.visibilityState === 'visible') start()
    else document.addEventListener('visibilitychange', start, { once: true })
    return () => {
      timers.forEach(clearTimeout)
      document.removeEventListener('visibilitychange', start)
    }
    // once, when the ruler appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const room = Math.max(1, xpForNext)
  const part = Math.min(1, Math.max(0, at.xp / room))
  const waiting = Math.min(1 - part, Math.max(0, waitingXp / room))
  const levelChanged = moving && moving.level !== from.level
  return (
    // A new level gets a new ruler: it starts empty and at nought, and never runs backwards. The
    // two XP numbers are drawn by CSS from --xp, so that they can count while the ruler grows.
    <div key={at.level} className={`xp-count ${moving ? 'xp-growing' : ''}`} style={{ '--xp': at.xp, '--xp-room': xpForNext }}>
      <div className="flex items-baseline justify-between gap-4">
        <span className={`type-game ${levelChanged ? 'land origin-left' : ''}`}>
          Level {at.level}
        </span>
        <span>
          <span className="type-game xp-now" aria-hidden="true" />
          <span className="sr-only">{count(at.xp)}</span>{' '}
          <span className="type-small muted">of {count(xpForNext)} XP</span>
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div
          className="ruler ruler-growth flex-1"
          style={{ '--at': `${part * 100}%`, '--waiting': `${waiting * 100}%` }}
        >
          <progress value={Math.max(0, at.xp)} max={room} aria-label={`Progress to level ${at.level + 1}`} />
          <span className="ruler-clip">
            <span className="ruler-fill" style={{ scale: `${part} 1` }} />
          </span>
          {waiting > 0 && <span className="ruler-waiting" />}
        </div>
        <span className="ruler-goal" aria-hidden="true">
          {at.level + 1}
        </span>
      </div>
      <p className="type-small muted mt-3">
        <span className="xp-left" aria-hidden="true" />
        <span className="sr-only">{count(Math.max(0, xpForNext - at.xp))}</span> XP to level {at.level + 1}
      </p>
      {waitingXp > 0 && (
        <p className="type-small mt-1 flex items-center gap-1.5 font-medium">
          <Hourglass className="size-4 shrink-0" aria-hidden="true" />
          {count(waitingXp)} XP waiting for a parent to approve
        </p>
      )}
    </div>
  )
}
