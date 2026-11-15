import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import * as api from '../api/index.js'
import { Field } from '../components/Field.jsx'
import { RequestLine, RequestTag } from '../components/Request.jsx'
import { EmptyState, ErrorState, Message, PageLoading, Result } from '../components/states.jsx'
import { AddChildFirst, Points } from '../components/Task.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { whenText } from '../utils/format.js'
import { dueThisWeek } from '../utils/tasks.js'
import { focusFirstInvalid } from '../utils/forms.js'
import { errorText } from '../utils/messages.js'

// The parent's side of the reward shop: requests to answer, the rewards children can ask for, and
// each child's weekly quest. Nothing here reloads the page after a change (that would lose the
// parent's place): the new figures are put in place instead.

const load = () => Promise.all([api.listChildren(), api.listRewards(), api.listRequests(), api.listGrowth(), api.listTasks()])

const screenedText = (word) => `Rewards cannot use the word “${word}”.`

/** Requests waiting, oldest first, and the last ten that were answered. */
function Requests({ requests, growth, refresh, place }) {
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
      place(([family, rewards, all, growth]) => {
        const child = growth[answered.childId]
        const back = outcome === 'declined' && child ? { ...growth, [answered.childId]: { ...child, balance: child.balance + answered.cost } } : growth
        return [family, rewards, all.map((r) => (r.id === answered.id ? answered : r)), back]
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
                      <button className="btn btn-primary" disabled={busy}>
                        Decline
                      </button>
                      <button type="button" className="btn btn-text" disabled={busy} onClick={() => cancel(request.id)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" className="btn btn-approve" disabled={busy} onClick={() => answer(request, 'given')}>
                      Give<span className="sr-only">: {request.title} to {request.childName}</span>
                    </button>
                    <button
                      type="button"
                      id={`decline-${request.id}`}
                      className="btn btn-secondary"
                      disabled={busy}
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

const BLANK_REWARD = { title: '', cost: '' }

/** The rewards, and the one form below them that adds a reward or changes one. */
function RewardList({ rewards, refresh, place }) {
  const [values, setValues] = useState(BLANK_REWARD)
  const [editing, setEditing] = useState(null) // the reward the form is changing, if any
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(null) // the reward whose delete is being confirmed
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const form = useRef(null)
  const titleField = useRef(null)

  // after a refused save, go to the first field that says why
  useEffect(() => {
    if (errors.title || errors.cost) focusFirstInvalid(form.current)
  }, [errors])

  const set = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }))
    setErrors((e) => ({ ...e, [field]: null }))
  }
  function reset() {
    setEditing(null)
    setValues(BLANK_REWARD)
    setErrors({})
  }
  function edit(reward) {
    setEditing(reward.id)
    setValues({ title: reward.title, cost: String(reward.cost) })
    setErrors({})
    titleField.current?.focus()
  }
  function stopEditing() {
    const id = editing
    reset()
    document.getElementById(`edit-${id}`)?.focus()
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const saved = await api.saveReward({ id: editing ?? undefined, title: values.title, cost: Number(values.cost) })
      // P12: in place, in the family's order (cheapest first; a new one after others of its cost)
      place(([family, list, ...rest]) => [family, [...list.filter((r) => r.id !== saved.id), saved].sort((a, b) => a.cost - b.cost), ...rest])
      reset()
      setResult({ tone: 'success', text: 'Reward saved.' })
    } catch (error) {
      noticeExpiry(error)
      if (error.code === 'INVALID') {
        setErrors({
          title: error.fields.title && 'Give the reward a name of 3 to 60 characters.',
          cost: error.fields.cost && 'Choose 10 to 1,000 points, in tens.',
        })
      } else if (error.code === 'SCREENED') {
        setErrors({ title: screenedText(error.fields.word) })
      } else {
        setResult({ tone: 'danger', text: errorText(error) })
        refresh()
      }
    }
    setBusy(false)
  }

  async function remove(reward) {
    setBusy(true)
    try {
      await api.deleteReward(reward.id)
      place(([family, list, ...rest]) => [family, list.filter((r) => r.id !== reward.id), ...rest]) // P12
      if (editing === reward.id) reset()
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
                      <button type="button" className="btn btn-danger" disabled={busy} onClick={() => remove(reward)}>
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

      <form ref={form} className="mt-8 grid max-w-md gap-4" onSubmit={save} noValidate aria-labelledby="reward-form-title">
        <h3 id="reward-form-title" className="font-semibold">
          {editing ? 'Change the reward' : 'Add a reward'}
        </h3>
        <Field
          ref={titleField}
          label="What it is"
          hint="In words your child would use."
          error={errors.title}
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
          error={errors.cost}
          min={10}
          max={1000}
          step={10}
          name="cost"
          value={values.cost}
          onChange={set('cost')}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save reward' : 'Add reward'}
          </button>
          {editing && (
            <button type="button" className="btn btn-text" disabled={busy} onClick={stopEditing}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  )
}

/** One child's quest form, filled with the quest they have or with the usual starting values. */
function QuestForm({ child, quest, dueCount, onDone, onCancel }) {
  const [values, setValues] = useState({
    target: String(quest?.target ?? 5),
    bonus: String(quest?.bonus ?? 50),
    surprise: quest?.surprise ?? '',
  })
  const [errors, setErrors] = useState({})
  const [problem, setProblem] = useState(null)
  const [busy, setBusy] = useState(false)
  const form = useRef(null)

  useEffect(() => {
    if (Object.values(errors).some(Boolean)) focusFirstInvalid(form.current)
  }, [errors])

  const set = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }))
    setErrors((e) => ({ ...e, [field]: null }))
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setProblem(null)
    try {
      await api.setQuest(child.id, { target: Number(values.target), bonus: Number(values.bonus), surprise: values.surprise })
      return onDone(`Quest saved. ${child.name} sees it on Today.`)
    } catch (error) {
      noticeExpiry(error)
      if (error.code === 'INVALID') {
        setErrors({
          target:
            error.fields.target === 'done'
              ? `${child.name} has already had that many approved this week. Choose a higher number.`
              : error.fields.target && 'Choose 2 to 20 tasks.',
          bonus: error.fields.bonus && 'Choose 10 to 200 points, in fives.',
          surprise: error.fields.surprise && 'Keep the surprise to 80 characters.',
        })
      } else if (error.code === 'SCREENED') {
        setErrors({ surprise: screenedText(error.fields.word) })
      } else {
        setProblem(errorText(error))
      }
    }
    setBusy(false)
  }

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
      <Field
        as="select"
        label="Tasks to approve this week"
        hint={`${child.name} has ${dueCount} ${dueCount === 1 ? 'task' : 'tasks'} due this week.`} // H13: so a target nobody can reach is plain to see
        error={errors.target}
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
        error={errors.bonus}
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
        error={errors.surprise}
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
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save quest'}
        </button>
        <button type="button" className="btn btn-text" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        {quest && (
          <button type="button" className="btn btn-text text-coral-700" disabled={busy} onClick={remove}>
            Remove quest
          </button>
        )}
      </div>
    </form>
  )
}

/** One card a child: this week's quest as it stands, and the form to set or change it. */
function Quests({ family, growth, tasks, refresh }) {
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

export default function ParentRewards() {
  const loaded = useLoad(load, [], { live: true })
  // not loaded.reload: that would swap the page for the skeleton and lose the parent's place
  const refresh = () => load().then(loaded.set).catch(noticeExpiry)

  if (loaded.status === 'loading') return <PageLoading rows={4} />
  if (loaded.status === 'error') return <ErrorState error={loaded.error} onRetry={loaded.reload} />
  const [family, rewards, requests, growth, tasks] = loaded.data

  return (
    <>
      <title>Rewards – GrowKid</title>
      <h1>Rewards</h1>
      <p className="muted mt-2">Your children spend points on these. Spending never lowers their level or the points they have earned.</p>
      {family.length === 0 ? (
        <div className="mt-6">
          <AddChildFirst />
        </div>
      ) : (
        <>
          <Requests requests={requests} growth={growth} refresh={refresh} place={loaded.set} />
          <RewardList rewards={rewards} refresh={refresh} place={loaded.set} />
          <Quests family={family} growth={growth} tasks={tasks} refresh={refresh} />
        </>
      )}
    </>
  )
}
