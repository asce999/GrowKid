import { useState } from 'react'
import { flushSync } from 'react-dom'
import * as api from '../../api/index.js'
import { Field } from '../../components/Field.jsx'
import { RequestLine, RequestTag } from '../../components/Request.jsx'
import { Result } from '../../components/states.jsx'
import { Points } from '../../components/Task.jsx'
import { noticeExpiry } from '../../hooks/useLoad.js'
import { whenText } from '../../utils/format.js'
import { busyProps } from '../../utils/forms.js'
import { errorText } from '../../utils/messages.js'

/** Requests waiting, oldest first, and the last ten that were answered. */
export function Requests({ requests, growth, refresh, place }) {
  const [declining, setDeclining] = useState(null) // the request whose decline note is open
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const waiting = requests.filter((r) => r.status === 'requested').sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
  const answered = requests
    .filter((r) => r.status !== 'requested')
    .sort((a, b) => b.answer.at.localeCompare(a.answer.at))
    .slice(0, 10)

  async function answer(request, outcome, text = '') {
    setBusy(true)
    try {
      const answered = await api.answerRequest(request.id, outcome, text)
      // P12: the answer in place, not the page fetched again; a decline gives the points back to the child's balance
      place(([family, rewards, all, growth, ...rest]) => {
        const child = growth[answered.childId]
        const back = outcome === 'declined' && child ? { ...growth, [answered.childId]: { ...child, balance: child.balance + answered.cost } } : growth
        return [family, rewards, all.map((r) => (r.id === answered.id ? answered : r)), back, ...rest]
      })
      setResult({
        tone: 'success',
        text:
          outcome === 'given'
            ? `Given. Tell ${request.childName} when it is ready.`
            : `Declined. ${request.childName} got the ${request.cost} points back.`,
      })
    } catch (error) {
      noticeExpiry(error)
      if (error.code === 'SCREENED') {
        // C7: the note stays open, marked, so the parent can change the word and decline again
        flushSync(() => {
          setNoteError(`The note cannot use “${error.fields.word}”. Change it, then decline.`)
          setBusy(false)
        })
        document.getElementById(`requests-${request.id}`)?.querySelector('textarea')?.focus() // the marked field, read out with its error
        return
      }
      // answered already, in another tab or on another device: show it as it stands
      setResult(
        error.code === 'REVIEWED'
          ? { tone: 'info', text: 'That request had already been answered. This is how it stands now.' }
          : { tone: 'danger', text: errorText(error) },
      )
      await refresh() // the list on screen was out of date
    }
    window.dispatchEvent(new Event('growkid:counts')) // the page stays put, so the navigation's number has to be told
    setDeclining(null)
    setBusy(false)
  }

  function cancel(id) {
    flushSync(() => setDeclining(null))
    document.getElementById(`decline-${id}`)?.focus()
  }

  return (
    <>
      <section aria-labelledby="waiting-title">
        <h2 id="waiting-title" className="type-subheading mt-8">
          Requests waiting
        </h2>
        <Result result={result} />
        {waiting.length === 0 ? (
          <p className="muted mt-1">No requests are waiting.</p>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-card border bg-white">
            {waiting.map((request) => (
              <li key={request.id} id={`requests-${request.id}`} className="border-b px-4 py-3 last:border-b-0 sm:px-6">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <p className="min-w-0 flex-1 basis-48 font-medium break-words">
                    {request.childName} asked for {request.title}
                  </p>
                  <Points value={request.cost} />
                </div>
                <p className="type-small muted mt-1">
                  Asked {whenText(request.requestedAt)}. {request.childName} has {growth[request.childId]?.balance ?? 0} points left after this.
                </p>
                {declining === request.id ? (
                  <form
                    className="mt-3 grid max-w-md gap-3"
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault()
                      answer(request, 'declined', note.trim())
                    }}
                  >
                    <Field
                      as="textarea"
                      label={`A note for ${request.childName} (optional)`}
                      rows={2}
                      maxLength={200}
                      name="note"
                      autoFocus
                      error={noteError}
                      value={note}
                      onChange={(event) => {
                        setNote(event.target.value)
                        setNoteError(null)
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <button className="btn btn-primary" {...busyProps(busy)}>
                        Decline
                      </button>
                      <button type="button" className="btn btn-text" {...busyProps(busy)} onClick={() => cancel(request.id)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" className="btn btn-approve" {...busyProps(busy)} onClick={() => answer(request, 'given')}>
                      Give<span className="sr-only">: {request.title} to {request.childName}</span>
                    </button>
                    <button
                      type="button"
                      id={`decline-${request.id}`}
                      className="btn btn-secondary"
                      {...busyProps(busy)}
                      onClick={() => {
                        setNote('')
                        setNoteError(null)
                        setDeclining(request.id)
                      }}
                    >
                      Decline<span className="sr-only">: {request.title} for {request.childName}</span>
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {answered.length > 0 && (
        <section aria-labelledby="answered-title">
          <h2 id="answered-title" className="type-subheading mt-10">
            Answered
          </h2>
          <ul className="mt-3 overflow-hidden rounded-card border bg-white">
            {answered.map((request) => (
              <li key={request.id} className="border-b px-4 py-3 last:border-b-0 sm:px-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="min-w-0 flex-1 basis-48 font-medium break-words">
                    {request.childName}: {request.title}
                  </p>
                  <RequestTag status={request.status} />
                </div>
                <RequestLine request={request} forParent />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
