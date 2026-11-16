import { useState } from 'react'
import * as api from '../api/index.js'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { CATEGORIES } from '../utils/categories.js'
import { IDEAS, ideaWords } from '../utils/ideas.js'
import { errorText } from '../utils/messages.js'
import { Field } from './Field.jsx'
import { Result } from './states.jsx'
import { busyProps } from '../utils/forms.js'

const MOST = 3 // the server's cap on waiting suggestions (rules.js CAPS.suggestions)

/**
 * K6: a child asks for a task by picking one of the task ideas. A choice from a fixed list, never a text box. Shows the
 * child's own suggestions still waiting under it.
 */
export default function AskForTask({ className = '' }) {
  const loaded = useLoad(api.listSuggestions, [])
  const [idea, setIdea] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const waiting = loaded.data ?? []

  async function ask(event) {
    event.preventDefault()
    if (!idea) return setResult({ tone: 'danger', text: 'Choose a task first.' })
    setBusy(true)
    try {
      const made = await api.suggestTask(idea)
      loaded.set((list) => (list.some((s) => s.id === made.id) ? list : [...list, made]))
      setIdea('')
      setResult({ tone: 'success', text: 'Asked. A parent will see it.' })
    } catch (error) {
      setResult({ tone: 'danger', text: errorText(noticeExpiry(error)) })
    }
    setBusy(false)
  }

  return (
    <section className={className} aria-labelledby="ask-task-title">
      <h2 id="ask-task-title" className="type-subheading">
        Ask for a task
      </h2>
      <p className="type-small muted mt-1">Choose one you would like to do. A parent decides.</p>
      {waiting.length >= MOST ? (
        <p className="mt-3">You have asked for {MOST}. When a parent answers one, you can ask for another.</p>
      ) : (
        <form onSubmit={ask} noValidate className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field as="select" label="Task" value={idea} onChange={(e) => setIdea(e.target.value)} disabled={busy}>
            <option value="">Choose a task</option>
            {CATEGORIES.map((c) => (
              <optgroup key={c.id} label={c.name}>
                {IDEAS.filter((i) => i.category === c.id).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </Field>
          <button type="submit" className="btn btn-secondary" {...busyProps(busy)}>
            {busy ? 'Asking…' : 'Ask for this task'}
          </button>
        </form>
      )}
      <Result result={result} />
      {waiting.length > 0 && (
        <ul className="mt-3 grid gap-1">
          {waiting.map((s) => (
            <li key={s.id} className="type-small break-words">
              You asked for {ideaWords(s.ideaId)}. A parent will answer.
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
