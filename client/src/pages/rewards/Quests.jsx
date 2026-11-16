import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import * as api from '../../api/index.js'
import KeepWork from '../../components/KeepWork.jsx'
import { Field } from '../../components/Field.jsx'
import { Message, Result } from '../../components/states.jsx'
import { plural } from '../../utils/format.js'
import { useForm } from '../../hooks/useForm.js'
import { noticeExpiry } from '../../hooks/useLoad.js'
import { dueThisWeek } from '../../utils/tasks.js'
import { busyProps, focusFirstInvalid } from '../../utils/forms.js'
import { rules } from '../../utils/rules.js'
import { errorText } from '../../utils/messages.js'

const screenedText = (word) => `Rewards cannot use the word “${word}”.`

/** One child's quest form, filled with the quest they have or with the usual starting values. */
export function QuestForm({ child, quest, dueCount, onDone, onCancel }) {
  // Phase 7, item 17: on useForm, like the task form. The rules answer as the parent types; the server's word on a field stays until
  // that field changes.
  const { form, values, field, busy, setBusy, problem, setProblem, shown, submit, changed } = useForm({
    target: String(quest?.target ?? 5),
    bonus: String(quest?.bonus ?? 50),
    surprise: quest?.surprise ?? '',
  })
  const [refused, setRefused] = useState({})
  const errors = {
    target: refused.target || rules.questTarget(values.target),
    bonus: refused.bonus || rules.questBonus(values.bonus),
    surprise: refused.surprise || rules.questSurprise(values.surprise),
  }
  useEffect(() => {
    if (Object.values(refused).some(Boolean)) focusFirstInvalid(form.current)
  }, [refused, form])

  const set = (name) => (event) => {
    field(name)(event)
    setRefused((r) => ({ ...r, [name]: null }))
  }

  const save = (event) =>
    submit(
      event,
      errors,
      async () => {
        await api.setQuest(child.id, { target: Number(values.target), bonus: Number(values.bonus), surprise: values.surprise })
        onDone(`Quest saved. ${child.name} sees it on Today.`)
      },
      (error) => {
        if (error.code === 'INVALID') {
          setRefused({
            target:
              error.fields.target === 'done'
                ? `${child.name} has already had that many approved this week. Choose a higher number.`
                : error.fields.target && rules.questTarget(''),
            bonus: error.fields.bonus && rules.questBonus(''),
            surprise: error.fields.surprise && rules.questSurprise('x'.repeat(81)),
          })
          return true
        }
        if (error.code === 'SCREENED') {
          setRefused({ surprise: screenedText(error.fields.word) })
          return true
        }
        return false
      },
    )

  async function remove() {
    setBusy(true)
    setProblem(null)
    try {
      await api.setQuest(child.id, null)
      return onDone('Quest removed.')
    } catch (error) {
      setProblem(errorText(noticeExpiry(error)))
    }
    setBusy(false)
  }

  return (
    <form ref={form} className="mt-4 grid gap-4" onSubmit={save} noValidate aria-label={`${quest ? 'Change' : 'Set'} ${child.name}’s quest`}>
      <KeepWork dirty={changed} what={`${child.name}’s quest as you changed it`} />
      <Field
        as="select"
        label="Tasks to approve this week"
        hint={`${child.name} has ${plural(dueCount, 'task')} due this week.`} // H13: so a target nobody can reach is plain to see
        error={shown(errors, 'target')}
        name="target"
        autoFocus
        value={values.target}
        onChange={set('target')}
      >
        {Array.from({ length: 19 }, (_, i) => i + 2).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Field>
      <Field
        type="number"
        label="Bonus points"
        hint="Points to spend. They do not add XP."
        error={shown(errors, 'bonus')}
        min={10}
        max={200}
        step={5}
        name="bonus"
        value={values.bonus}
        onChange={set('bonus')}
      />
      <Field
        label="Sealed surprise (optional)"
        hint={`${child.name} sees that a surprise is waiting, but not what it is, until the quest is complete.`}
        error={shown(errors, 'surprise')}
        maxLength={80}
        name="surprise"
        autoComplete="off"
        value={values.surprise}
        onChange={set('surprise')}
      />
      {problem && (
        <Message tone="danger" alert>
          {problem}
        </Message>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" {...busyProps(busy)}>
          {busy ? 'Saving…' : 'Save quest'}
        </button>
        <button type="button" className="btn btn-text" {...busyProps(busy)} onClick={onCancel}>
          Cancel
        </button>
        {quest && (
          <button type="button" className="btn btn-text text-coral-700" {...busyProps(busy)} onClick={remove}>
            Remove quest
          </button>
        )}
      </div>
    </form>
  )
}

/** One card a child: this week's quest as it stands, and the form to set or change it. */
export function Quests({ family, growth, tasks, refresh }) {
  const [open, setOpen] = useState(null) // the child whose quest form is open: only one at a time
  const [result, setResult] = useState(null)

  function done(text) {
    setOpen(null)
    setResult({ tone: 'success', text })
    refresh()
  }
  function cancel(id) {
    flushSync(() => setOpen(null))
    document.getElementById(`quest-${id}`)?.focus()
  }

  return (
    <section aria-labelledby="quests-title">
      <h2 id="quests-title" className="type-subheading mt-10">
        Weekly quests
      </h2>
      <Result result={result} />
      <div className="mt-3 grid items-start gap-4 lg:grid-cols-2">
        {family.map((child) => {
          const quest = growth[child.id]?.quest
          return (
            <article key={child.id} className="card" aria-labelledby={`quest-title-${child.id}`}>
              <h3 id={`quest-title-${child.id}`} className="type-subheading">
                {child.name}
              </h3>
              {quest ? (
                <>
                  <p className="mt-1">{quest.completed ? 'Complete this week.' : `${quest.done} of ${quest.target} tasks this week, +${quest.bonus} points`}</p>
                  {quest.surprise && <p className="type-small muted mt-1 break-words">Sealed surprise: {quest.surprise}</p>}
                </>
              ) : (
                <p className="muted mt-1">No quest for {child.name} this week.</p>
              )}
              {open === child.id ? (
                <QuestForm child={child} quest={quest} dueCount={tasks.filter((t) => t.childId === child.id && dueThisWeek(t)).length} onDone={done} onCancel={() => cancel(child.id)} />
              ) : (
                <button type="button" id={`quest-${child.id}`} className="btn btn-secondary mt-4" onClick={() => setOpen(child.id)}>
                  {quest ? 'Change the quest' : 'Set a quest'}
                  <span className="sr-only"> for {child.name}</span>
                </button>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
