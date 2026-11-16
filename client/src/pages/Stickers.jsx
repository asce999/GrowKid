import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import * as api from '../api/index.js'
import Badge from '../components/Badge.jsx'
import { useMedia } from '../hooks/useMedia.js'
import { ErrorState, PageLoading, Result } from '../components/states.jsx'
import Sticker from '../components/Sticker.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { useSession } from '../store/session.js'
import { errorText } from '../utils/messages.js'
import { categoryOf } from '../utils/categories.js'
import { whenText } from '../utils/format.js'
import { MEASURE_WORDS, iconOf, isEarned, tiltOf } from '../utils/stickers.js'
import { busyProps } from '../utils/forms.js'

// The sticker chart: every sticker there is, earned ones in colour and the rest as dashed,
// named slots. Slots show what is possible, and the details say how far along each one is.
// A sticker's details open beside the chart on a wide screen, and in a sheet on a phone.

/** One sticker in full: what it is, what earns it, and when it was earned. */
function Details({ sticker }) {
  const earned = isEarned(sticker)
  return (
    <div className="grid justify-items-center gap-3 text-center">
      <Sticker icon={iconOf(sticker)} shape={sticker.shape} tone={sticker.tone} locked={!earned} className="size-28" />
      <h2 className="type-subheading">{sticker.name}</h2>
      <p>{sticker.how}</p>
      {earned ? (
        <p className="type-small muted">
          Earned <time dateTime={sticker.earnedAt}>{whenText(sticker.earnedAt)}</time>, when “{sticker.taskTitle}” was approved.
        </p>
      ) : (
        <>
          {sticker.have !== undefined && (
            <p className="type-small">
              {sticker.have} of {sticker.need} {MEASURE_WORDS[sticker.measure]}
            </p>
          )}
          {sticker.missing?.length > 0 && <p className="type-small">Still to do: {sticker.missing.map((id) => categoryOf(id)?.name ?? id).join(', ')}.</p>}
          <p className="type-small muted flex items-center gap-1.5">
            <Lock className="size-4 shrink-0" aria-hidden="true" />
            Not earned yet
          </p>
        </>
      )}
    </div>
  )
}

const COLOURS = [
  ['navy', 'Navy'],
  ['sprout', 'Green'],
  ['sun', 'Gold'],
  ['ember', 'Orange'],
]

/** K10: the child's badge: one of four colours and one sticker they have earned and seen. Their family sees it beside their name. */
function BadgePicker({ stickers }) {
  const user = useSession((s) => s.user)
  const setUser = useSession((s) => s.setUser)
  const earned = stickers.filter(isEarned)
  const [colour, setColour] = useState(user?.avatar?.colour ?? 'navy')
  const [pick, setPick] = useState(user?.avatar?.stickerId ?? earned[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const chosen = earned.find((sticker) => sticker.id === pick)

  async function save(nextColour, stickerId) {
    setBusy(true)
    try {
      setUser(await api.setAvatar(nextColour, stickerId))
      setResult({ tone: 'success', text: stickerId ? 'Badge saved. Your family sees it beside your name.' : 'Badge taken off. Your first letter shows instead.' })
    } catch (error) {
      setResult({ tone: 'danger', text: errorText(noticeExpiry(error)) })
    }
    setBusy(false)
  }

  return (
    <section className="mt-10 border-t pt-6" aria-labelledby="badge-title">
      <h2 id="badge-title" className="type-subheading">
        Your badge
      </h2>
      {earned.length === 0 ? (
        <p className="muted mt-1">Earn a sticker first. Then you can put it on your badge.</p>
      ) : (
        <>
          <p className="type-small muted mt-1">Pick a colour and a sticker you have earned. Your family sees it beside your name.</p>
          <Badge avatar={chosen && { colour, shape: chosen.shape, kind: chosen.kind }} name={user?.name} className="mt-4 size-16" />
          <fieldset className="mt-4">
            <legend className="font-medium">Colour</legend>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {COLOURS.map(([id, label]) => (
                <label key={id} className="choice">
                  <input type="radio" className="sr-only" name="badge-colour" value={id} checked={colour === id} onChange={() => setColour(id)} />
                  <Badge avatar={{ colour: id, shape: 'star' }} className="size-6 border-2 border-white" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-4">
            <legend className="font-medium">Sticker</legend>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {earned.map((sticker) => (
                <label key={sticker.id} className="choice">
                  <input type="radio" className="sr-only" name="badge-sticker" value={sticker.id} checked={pick === sticker.id} onChange={() => setPick(sticker.id)} />
                  <Sticker icon={iconOf(sticker)} shape={sticker.shape} tone={sticker.tone} className="size-8" />
                  {sticker.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary" {...busyProps(busy)} disabled={!chosen} onClick={() => save(colour, pick)}>
              Save badge
            </button>
            {user?.avatar && (
              <button type="button" className="btn btn-text" {...busyProps(busy)} onClick={() => save(null, null)}>
                Take it off
              </button>
            )}
          </div>
          <Result result={result} />
        </>
      )}
    </section>
  )
}

export default function Stickers() {
  const loaded = useLoad(api.listStickers, [], { live: true })
  const [params] = useSearchParams()
  const linked = params.get('sticker') // K13: the reward moment links a new sticker to its place here
  const [chosen, setChosen] = useState(linked)
  const wide = useMedia(`(min-width: ${getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-lg').trim() || '64rem'})`) // the details sit beside the chart from here
  const sheet = useRef(null)

  if (loaded.status === 'loading') return <PageLoading rows={3} />
  if (loaded.status === 'error') return <ErrorState error={loaded.error} onRetry={loaded.reload} />
  const stickers = loaded.data
  const count = stickers.filter(isEarned).length
  const open = stickers.find((s) => s.id === chosen) ?? stickers.find(isEarned) ?? stickers[0]

  function choose(id) {
    setChosen(id)
    // beside the chart from the desktop width; below it, in a sheet
    if (!wide) sheet.current.showModal()
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
              <button type="button" className="sticker-slot" aria-pressed={open.id === sticker.id} autoFocus={sticker.id === linked} onClick={() => choose(sticker.id)}>
                <Sticker
                  icon={iconOf(sticker)}
                  shape={sticker.shape}
                  tone={sticker.tone}
                  tilt={tiltOf(i)}
                  slot={!isEarned(sticker)}
                  className="size-16"
                />
                <span className="type-small font-medium">{sticker.name}</span>
                {/* K1: how far along, on the chart itself */}
                {!isEarned(sticker) && sticker.have !== undefined ? (
                  <span className="type-small muted tabular-nums">
                    {sticker.have} of {sticker.need}
                    <span className="sr-only"> {MEASURE_WORDS[sticker.measure]}, not earned yet</span>
                  </span>
                ) : (
                  !isEarned(sticker) && <span className="sr-only">, not earned yet</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <aside className="card sticky top-24 hidden lg:block" aria-label="The sticker you chose">
          <Details sticker={open} />
        </aside>
      </div>

      <BadgePicker stickers={stickers} />

      <dialog ref={sheet} className="dialog" aria-label={open.name}>
        <Details sticker={open} />
        <button type="button" className="btn btn-secondary mt-6 w-full" onClick={() => sheet.current.close()}>
          Close
        </button>
      </dialog>
    </>
  )
}
