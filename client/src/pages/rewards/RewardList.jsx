import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import * as api from '../../api/index.js'
import KeepWork from '../../components/KeepWork.jsx'
import { Field } from '../../components/Field.jsx'
import { EmptyState, Result } from '../../components/states.jsx'
import { Points } from '../../components/Task.jsx'
import { useForm } from '../../hooks/useForm.js'
import { noticeExpiry } from '../../hooks/useLoad.js'
import { busyProps, focusFirstInvalid } from '../../utils/forms.js'
import { rules } from '../../utils/rules.js'
import { errorText } from '../../utils/messages.js'

const screenedText = (word) => `Rewards cannot use the word “${word}”.`

const BLANK_REWARD = { title: '', cost: '' }

/** The rewards, and the one form below them that adds a reward or changes one. */
export function RewardList({ rewards, refresh, place }) {
  const [editing, setEditing] = useState(null) // the reward the form is changing, if any
  const [round, setRound] = useState(0) // a new form after each save, so an added reward leaves it empty
  const [confirming, setConfirming] = useState(null) // the reward whose delete is being confirmed
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  function edit(reward) {
    setEditing(reward.id)
  }
  function stopEditing() {
    const id = editing
    flushSync(() => setEditing(null))
    document.getElementById(`edit-${id}`)?.focus()
  }
  function saved(reward) {
    // P12: in place, in the family's order (cheapest first; a new one after others of its cost)
    place(([family, list, ...rest]) => [family, [...list.filter((r) => r.id !== reward.id), reward].sort((a, b) => a.cost - b.cost), ...rest])
    setEditing(null)
    setRound((n) => n + 1)
    setResult({ tone: 'success', text: 'Reward saved.' })
  }

  async function remove(reward) {
    setBusy(true)
    try {
      await api.deleteReward(reward.id)
      place(([family, list, ...rest]) => [family, list.filter((r) => r.id !== reward.id), ...rest]) // P12
      if (editing === reward.id) setEditing(null)
      setResult({ tone: 'success', text: 'Reward deleted.' })
    } catch (error) {
      setResult({ tone: 'danger', text: errorText(noticeExpiry(error)) })
      refresh() // the list on screen was out of date
    }
    setConfirming(null)
    setBusy(false)
  }

  function keep(id) {
    flushSync(() => setConfirming(null))
    document.getElementById(`delete-${id}`)?.focus()
  }

  return (
    <section aria-labelledby="rewards-title">
      <h2 id="rewards-title" className="type-subheading mt-10">
        Rewards
      </h2>
      <Result result={result} />
      <div className="mt-3">
        {rewards.length === 0 ? (
          <EmptyState title="No rewards yet">Add a few things your children can choose, like picking the film on Friday.</EmptyState>
        ) : (
          <ul className="overflow-hidden rounded-card border bg-white">
            {rewards.map((reward) => (
              <li key={reward.id} className="border-b px-4 py-3 last:border-b-0 sm:px-6">
                {confirming === reward.id ? (
                  <div>
                    <p className="break-words">Delete “{reward.title}”? Requests already made keep it.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button type="button" className="btn btn-danger" {...busyProps(busy)} onClick={() => remove(reward)}>
                        Delete<span className="sr-only">: {reward.title}</span>
                      </button>
                      <button type="button" className="btn btn-text" autoFocus onClick={() => keep(reward.id)}>
                        Keep it<span className="sr-only">: {reward.title}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <p className="min-w-0 flex-1 basis-48 font-medium break-words">{reward.title}</p>
                    <Points value={reward.cost} />
                    <div className="flex items-center gap-1">
                      <button type="button" id={`edit-${reward.id}`} className="btn btn-text" onClick={() => edit(reward)}>
                        Edit<span className="sr-only">: {reward.title}</span>
                      </button>
                      <button type="button" id={`delete-${reward.id}`} className="btn btn-text" onClick={() => setConfirming(reward.id)}>
                        Delete<span className="sr-only">: {reward.title}</span>
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <RewardForm
        key={`${editing ?? 'new'}-${round}`}
        reward={rewards.find((r) => r.id === editing)}
        onSaved={saved}
        onCancel={stopEditing}
        onFailed={(text) => {
          setResult({ tone: 'danger', text })
          refresh()
        }}
      />
    </section>
  )
}

/**
 * The one form that adds a reward or, given `reward`, changes it. On useForm: the rules answer as the parent types, the server's
 * word on a field stays until that field changes, and leaving with something typed asks first (KeepWork).
 */
function RewardForm({ reward, onSaved, onCancel, onFailed }) {
  const { form, values, field, busy, shown, submit, changed } = useForm(reward ? { title: reward.title, cost: String(reward.cost) } : BLANK_REWARD)
  const [refused, setRefused] = useState({})
  const titleField = useRef(null)
  const errors = { title: refused.title || rules.rewardTitle(values.title), cost: refused.cost || rules.rewardCost(values.cost) }
  const editingId = reward?.id
  useEffect(() => {
    if (editingId) titleField.current?.focus() // Edit was pressed: straight to what it changes
  }, [editingId])
  useEffect(() => {
    if (refused.title || refused.cost) focusFirstInvalid(form.current)
  }, [refused, form])
  const set = (name) => (event) => {
    field(name)(event)
    setRefused((r) => ({ ...r, [name]: null }))
  }
  const save = (event) =>
    submit(
      event,
      errors,
      async () => onSaved(await api.saveReward({ id: reward?.id, title: values.title, cost: Number(values.cost) })),
      (error) => {
        if (error.code === 'INVALID') setRefused({ title: error.fields.title && rules.rewardTitle(''), cost: error.fields.cost && rules.rewardCost('') })
        else if (error.code === 'SCREENED') setRefused({ title: screenedText(error.fields.word) })
        else onFailed(errorText(error))
        return true
      },
    )

  return (
    <>
      <KeepWork dirty={changed} what="the reward you typed" />
      <form ref={form} className="mt-8 grid max-w-md gap-4" onSubmit={save} noValidate aria-labelledby="reward-form-title">
        <h3 id="reward-form-title" className="font-semibold">
          {reward ? 'Change the reward' : 'Add a reward'}
        </h3>
        <Field
          ref={titleField}
          label="What it is"
          hint="In words your child would use."
          error={shown(errors, 'title')}
          maxLength={60}
          name="title"
          autoComplete="off"
          value={values.title}
          onChange={set('title')}
        />
        <Field
          type="number"
          label="Cost in points"
          hint="10 to 1,000, in tens. A task is usually worth 20."
          error={shown(errors, 'cost')}
          min={10}
          max={1000}
          step={10}
          name="cost"
          value={values.cost}
          onChange={set('cost')}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" {...busyProps(busy)}>
            {busy ? 'Saving…' : reward ? 'Save reward' : 'Add reward'}
          </button>
          {reward && (
            <button type="button" className="btn btn-text" {...busyProps(busy)} onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </>
  )
}
