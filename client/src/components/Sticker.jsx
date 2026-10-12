import { Lock } from 'lucide-react'

// Corner points of a star, seal or hexagon around the centre of a 96 x 96 box.
function points(count, outer, inner = outer) {
  return Array.from({ length: count * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer
    const a = (i * Math.PI) / count - Math.PI / 2
    return `${(48 + r * Math.cos(a)).toFixed(1)},${(48 + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

// Proposed meaning: seal for task counts, shield for streaks, star for a skill, hexagon for levels.
const SHAPES = {
  seal: <polygon points={points(16, 40, 35)} />,
  shield: <path d="M48 8 82 19v27c0 19-13 32-34 42C27 78 14 65 14 46V19Z" />,
  star: <polygon points={points(5, 40, 20)} />,
  hexagon: <polygon points={points(3, 40)} />,
}

const TONES = {
  sun: { shape: 'fill-sun-500 stroke-sun-500', icon: 'text-navy-950' },
  sprout: { shape: 'fill-sprout-500 stroke-sprout-500', icon: 'text-navy-950' },
  navy: { shape: 'fill-navy-800 stroke-navy-800', icon: 'text-sun-300' },
}

// A badge, shown as a sticker. A locked badge is the same shape as a dashed outline, with a
// padlock unless it is an empty slot on the chart. name is the badge's name; how is one
// sentence on how it is earned.
export default function Sticker({
  icon: Icon,
  name,
  how,
  shape = 'seal',
  tone = 'sun',
  tilt = 0,
  locked = false,
  slot = false,
  className = 'size-24',
}) {
  return (
    <figure className="flex flex-col items-center gap-2 text-center">
      <div
        className={`relative grid place-items-center ${locked || slot ? '' : 'sticker'} ${className}`}
        style={{ '--tilt': `${tilt}deg` }}
      >
        <svg viewBox="0 0 96 96" className="absolute inset-0 size-full" strokeLinejoin="round" aria-hidden="true">
          {locked || slot ? (
            <g className="fill-none stroke-navy-400" strokeWidth="2" strokeDasharray="6 6">
              {SHAPES[shape]}
            </g>
          ) : (
            <>
              <g className="fill-white stroke-white" strokeWidth="12">
                {SHAPES[shape]}
              </g>
              <g className={TONES[tone].shape} strokeWidth="4">
                {SHAPES[shape]}
              </g>
            </>
          )}
        </svg>
        {slot ? null : locked ? (
          <Lock className="relative size-[26%] text-navy-600" aria-hidden="true" />
        ) : (
          <Icon className={`relative size-[36%] ${TONES[tone].icon}`} strokeWidth={2.5} aria-hidden="true" />
        )}
      </div>
      {name && (
        <figcaption className="type-small w-32">
          <span className="block font-medium">{name}</span>
          {how && <span className="muted block">{how}</span>}
          {locked && <span className="muted block">Not earned yet</span>}
        </figcaption>
      )}
    </figure>
  )
}
