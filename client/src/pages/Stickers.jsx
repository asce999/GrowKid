import { useRef, useState } from 'react'
import { Lock } from 'lucide-react'
import * as api from '../api/index.js'
import { ErrorState, PageLoading } from '../components/states.jsx'
import Sticker from '../components/Sticker.jsx'
import { useLoad } from '../hooks/useLoad.js'
import { whenText } from '../utils/format.js'
import { STICKER_ICONS, isEarned, tiltOf } from '../utils/stickers.js'

// The sticker chart: every sticker there is, earned ones in colour and the rest as dashed,
// named slots. Slots show what is possible and nothing more: no bar creeping towards one.
// A sticker's details open beside the chart on a wide screen, and in a sheet on a phone.

/** One sticker in full: what it is, what earns it, and when it was earned. */
function Details({ sticker }) {
  const earned = isEarned(sticker)
  return (
    <div className="grid justify-items-center gap-3 text-center">
      <Sticker icon={STICKER_ICONS[sticker.shape]} shape={sticker.shape} tone={sticker.tone} locked={!earned} className="size-28" />
      <h2 className="type-subheading">{sticker.name}</h2>
      <p>{sticker.how}</p>
      {earned ? (
        <p className="type-small muted">
          Earned <time dateTime={sticker.earnedAt}>{whenText(sticker.earnedAt)}</time>, when “{sticker.taskTitle}” was approved.
        </p>
      ) : (
        <p className="type-small muted flex items-center gap-1.5">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          Not earned yet
        </p>
      )}
    </div>
  )
}

export default function Stickers() {
  const loaded = useLoad(api.listStickers, [], { live: true })
  const [chosen, setChosen] = useState(null)
  const sheet = useRef(null)

  if (loaded.status === 'loading') return <PageLoading rows={3} />
  if (loaded.status === 'error') return <ErrorState error={loaded.error} onRetry={loaded.reload} />
  const stickers = loaded.data
  const count = stickers.filter(isEarned).length
  const open = stickers.find((s) => s.id === chosen) ?? stickers.find(isEarned) ?? stickers[0]

  function choose(id) {
    setChosen(id)
    // beside the chart from the desktop width; below it, in a sheet
    const wide = getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-lg')
    if (!window.matchMedia(`(min-width: ${wide})`).matches) sheet.current.showModal()
  }

  return (
    <>
      <title>Stickers – GrowKid</title>
      <h1>Stickers</h1>
      <p className="muted mt-2">
        {count === 0 ? 'None earned yet. Each one says what earns it.' : `${count} of ${stickers.length} earned. Each one says what earns it.`}
      </p>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <ul className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-6 lg:gap-x-1">
          {stickers.map((sticker, i) => (
            <li key={sticker.id}>
              <button type="button" className="sticker-slot" aria-pressed={open.id === sticker.id} onClick={() => choose(sticker.id)}>
                <Sticker
                  icon={STICKER_ICONS[sticker.shape]}
                  shape={sticker.shape}
                  tone={sticker.tone}
                  tilt={tiltOf(i)}
                  slot={!isEarned(sticker)}
                  className="size-16"
                />
                <span className="type-small font-medium">{sticker.name}</span>
                {!isEarned(sticker) && <span className="sr-only">, not earned yet</span>}
              </button>
            </li>
          ))}
        </ul>
        <aside className="card sticky top-24 hidden lg:block" aria-label="The sticker you chose">
          <Details sticker={open} />
        </aside>
      </div>

      <dialog ref={sheet} className="dialog" aria-label={open.name}>
        <Details sticker={open} />
        <button type="button" className="btn btn-secondary mt-6 w-full" onClick={() => sheet.current.close()}>
          Close
        </button>
      </dialog>
    </>
  )
}
