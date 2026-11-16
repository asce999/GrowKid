import { useRef, useState } from 'react'
import * as api from '../../api/index.js'
import { Field } from '../../components/Field.jsx'
import { ErrorState, Message } from '../../components/states.jsx'
import { noticeExpiry, useLoad } from '../../hooks/useLoad.js'
import { addDays, dateOfKey, dayKeyOf, dayLabel } from '../../utils/format.js'
import { errorText } from '../../utils/messages.js'
import { busyProps } from '../../utils/forms.js'

// P14: day keys labelled the same on every device (dateOfKey); a day mark is the instant its day starts in the family's zone
const fullDay = dayLabel({ weekday: 'long', day: 'numeric', month: 'long' })
/** The day a number of days from today falls on, as 'YYYY-MM-DD'. */
const dayIn = (n) => addDays(dayKeyOf(api.now()), n) // P13: in the family's zone

/**
 * The rest days a parent has set for a child, and the form to add one. A rest day is never
 * missed, so it neither adds to the streak nor breaks it. onChange asks the page for fresh
 * figures, so the calendar shows the mark.
 */
export function RestDays({ child, onChange }) {
  const loaded = useLoad(() => api.listRestDays(child.id), [child.id])
  const [day, setDay] = useState('')
  const [state, setState] = useState({})
  const field = useRef(null)

  async function change(key, rest) {
    setState({ busy: true })
    try {
      loaded.set(await api.setRestDay(child.id, key, rest))
      setState({})
      onChange()
      if (rest) setDay('')
    } catch (error) {
      noticeExpiry(error)
      setState(error.code === 'INVALID' ? { range: true } : { problem: errorText(error) })
    }
    // the button that was pressed has been disabled or removed, and the focus went with it
    field.current?.focus()
  }

  return (
    <div className="mt-6 border-t pt-4 print:hidden">
      <h3 className="type-small font-semibold">Rest days</h3>
      <p className="type-small muted mt-1 max-w-prose">
        On a rest day nothing is missed, so {child.name}’s streak is safe. You can mark a day up to 7 days back.
      </p>
      {loaded.status === 'loading' ? (
        <div className="skeleton mt-3 h-16 max-w-md" />
      ) : loaded.status === 'error' ? (
        <div className="mt-3 max-w-md">
          <ErrorState error={loaded.error} onRetry={loaded.reload} />
        </div>
      ) : (
        <>
          {loaded.data.length > 0 && (
            <ul className="mt-3 grid max-w-md gap-1">
              {loaded.data.map((key) => {
                const text = fullDay.format(dateOfKey(key))
                return (
                  <li key={key} className="flex items-center justify-between gap-3">
                    <span>{text}</span>
                    <button type="button" className="btn btn-text type-small" {...busyProps(state.busy)} onClick={() => change(key, false)}>
                      Remove<span className="sr-only"> rest day: {text}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <form
            className="mt-3 grid max-w-xs gap-3"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              change(day, true)
            }}
          >
            <Field
              ref={field}
              type="date"
              label="Mark a rest day"
              min={dayIn(-7)}
              max={dayIn(90)}
              name="rest-day"
              value={day}
              onChange={(event) => {
                setDay(event.target.value)
                setState((s) => (s.busy ? s : {}))
              }}
              error={state.range ? 'Choose a day from a week ago up to three months ahead.' : null}
            />
            {state.problem && (
              <Message tone="danger" alert>
                {state.problem}
              </Message>
            )}
            <button className="btn btn-secondary justify-self-start" {...busyProps(state.busy)}>
              {state.busy ? 'Saving…' : 'Add rest day'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
