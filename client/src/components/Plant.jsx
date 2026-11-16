import { plantOf } from '../utils/plant.js'

// K9: the child's level drawn as a plant, the sprout mark grown up (DESIGN.md section 9). Flat shapes in the tokens only, on a
// soil bar carrying the ruler's tick marks. Worked out from the level; never a face, never a character.

const LEAF = 'M0 0C5-7 15-8 21-1C15 5 5 5 0 0Z' // one leaf, pointing right from where it meets the stem

/** level: the child's level. Decorative: the words beside it say the stage, so the drawing is hidden from screen readers. */
export default function Plant({ level, className = '' }) {
  const { stage, rings } = plantOf(level)
  const height = stage === 1 ? 0 : 14 + stage * 7 // the stem, from the soil up
  const trunk = stage >= 7 ? 3 + stage - 6 : 2.5 // a stem thickens into a trunk from the sapling on
  const top = 96 - height
  const tree = stage >= 8 // a crown from the young tree on, with only the lowest leaves left on the trunk
  const leaves = stage < 2 ? 0 : tree ? 2 : Math.min(stage, 6)
  const k = 1 + (stage - 8) * 0.18 // the crown widens with each stage
  const crown = tree ? [[48, top + 4, 15 * k], [35, top + 12, 10 * k], [61, top + 12, 10 * k], [41, top - 6, 10 * k], [55, top - 6, 10 * k]].slice(0, stage === 8 ? 3 : 5) : []
  return (
    <svg viewBox="0 -14 96 126" className={className} aria-hidden="true" focusable="false">
      <rect x="4" y="96" width="88" height="10" rx="3" fill="var(--color-navy-200)" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={10 + i * 9.5} y="96" width="1.5" height={i % 2 ? 3 : 5} fill="var(--color-navy-400)" />
      ))}
      {/* rings past level 10, on the soil around the trunk */}
      {Array.from({ length: Math.min(rings, 4) }, (_, i) => (
        <ellipse key={i} cx="48" cy="101" rx={12 + i * 8} ry={2.5 + i} fill="none" stroke="var(--color-navy-400)" strokeWidth="1.5" />
      ))}
      {stage === 1 ? (
        <ellipse cx="48" cy="93" rx="7" ry="4.5" fill="var(--color-sprout-800)" />
      ) : (
        <rect x={48 - trunk / 2} y={top} width={trunk} height={height} rx={trunk / 2} fill="var(--color-sprout-800)" />
      )}
      {Array.from({ length: leaves }, (_, i) => {
        const y = tree ? 88 - i * 12 : 92 - (i + 1) * (height / (leaves + 1))
        const right = i % 2 === 0
        const size = 0.7 + Math.min(stage, 7) * 0.08
        return <path key={i} d={LEAF} fill="var(--color-sprout-500)" transform={`translate(${48 + (right ? trunk / 2 : -trunk / 2)} ${y}) scale(${right ? size : -size} ${size}) rotate(-20)`} />
      })}
      {crown.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill={i % 2 ? 'var(--color-sprout-300)' : 'var(--color-sprout-500)'} />
      ))}
    </svg>
  )
}
