import { useEffect, useId, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Star } from 'lucide-react'
import * as api from '../api/index.js'
import { Field } from '../components/Field.jsx'
import { ErrorState, Message, PageLoading } from '../components/states.jsx'
import { AddChildFirst, TaskCard } from '../components/Task.jsx'
import { useForm } from '../hooks/useForm.js'
import { useLoad } from '../hooks/useLoad.js'
import { CATEGORIES } from '../utils/categories.js'
import { focusFirstInvalid } from '../utils/forms.js'
import { addDays, dayKeyOf, fromLocalInput, toLocalInput, weekdayOf } from '../utils/format.js'
import { AGES, IDEAS } from '../utils/ideas.js'
import { rules } from '../utils/rules.js'
import { repeatText } from '../utils/tasks.js'
import NotFound from './NotFound.jsx'

// Create a task, or edit one: the same form. The fields come in the order a parent thinks of
// them, and on a wide screen the child's task card fills in beside the form as they type.

const backLink = 'inline-flex min-h-11 items-center font-medium text-navy-800 underline underline-offset-4'

/** A task with proof sent can no longer be edited (FRONTEND-SITEMAP.md section 12, rule 2). */
function Locked({ task }) {
  return (
    <>
      <title>Edit task – GrowKid</title>
      <Link to={`/parent/tasks/${task.id}`} className={backLink}>
        {task.title}
      </Link>
      <h1>Edit task</h1>
      <Message className="mt-6 max-w-prose">
        <p className="font-semibold">This task can no longer be edited</p>
        <p>
          {task.childName} has sent proof for it, so it has to stay as it was when they did it. You can still delete
          it until it is approved.
        </p>
      </Message>
      <Link to={`/parent/tasks/${task.id}`} className="btn btn-secondary mt-6">
        Back to the task
      </Link>
    </>
  )
}

/** H13: the quick due times, in the family's zone (P13), as datetime-local values: today and tomorrow at 6 pm, and the coming Saturday at 10 am. */
function quickDues() {
  const today = dayKeyOf(api.now())
  const saturday = addDays(today, (5 - weekdayOf(today) + 7) % 7) // weekdayOf: Monday 0, Saturday 5
  return [
    ['Today 6 pm', `${today}T18:00`],
    ['Tomorrow 6 pm', `${addDays(today, 1)}T18:00`],
    ['Saturday 10 am', `${saturday}T10:00`],
  ].map(([label, value]) => ({ label, value, past: new Date(fromLocalInput(value)) <= api.now() }))
}

/** H13: a parent's ideas, ten for the category chosen in the form, by age. Picking one fills the form; nothing is stored. */
function Ideas({ category, onPick }) {
  const ideas = IDEAS.filter((i) => i.category === category)
  return (
    <details className="rounded-card border bg-white p-4">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-navy-800 underline underline-offset-4">Pick an idea</summary>
      {ideas.length === 0 ? (
        <p className="muted mt-2">Choose a category first, and ten ideas for it show here.</p>
      ) : (
        Object.entries(AGES).map(([ages, name]) => (
          <div key={ages} className="mt-3">
            <h3 className="type-small muted font-medium">{name}</h3>
            <ul className="mt-1 grid gap-1">
              {ideas
                .filter((i) => i.ages === ages)
                .map((i) => (
                  <li key={i.id}>
                    <button type="button" className="btn btn-text min-h-11 justify-start px-0 text-left" onClick={() => onPick(i)}>
                      {i.title}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </details>
  )
}

function Form({ family, task, latest }) {
  const navigate = useNavigate()
  const [asked] = useSearchParams()
  const location = useLocation()
  const { form, values, setValues, busy, problem, shown: shownOf, submit: send } = useForm(() => {
    if (task) {
      const { childId, category, title, instructions, doneLooksLike, points } = task
      return { childId, category, title, instructions, doneLooksLike, due: toLocalInput(task.dueAt), points, repeat: 'never', days: 0, time: '18:00' }
    }
    const copy = location.state?.copy // H4: Duplicate fills the form with everything but the due time
    if (copy && family.some((c) => c.id === copy.childId)) {
      const { childId, category, title, instructions, doneLooksLike, points } = copy
      return { childId, category, title, instructions, doneLooksLike, due: '', points, repeat: 'never', days: 0, time: '18:00' }
    }
    const only = family.length === 1 ? family[0] : family.find((c) => c.id === asked.get('child'))
    // H13: the category and points start as the parent's most recently created task had them; the due time starts empty
    return { childId: only?.id ?? '', category: latest?.category ?? '', title: '', instructions: '', doneLooksLike: '', due: '', points: latest?.points ?? 20, repeat: 'never', days: 0, time: '18:00' }
  })
  const [screened, setScreened] = useState(null) // the word content screening refused
  const pointsId = useId()
  // once the refused word is marked on its field, go to that field
  useEffect(() => {
    if (screened) focusFirstInvalid(form.current)
  }, [screened, form])

  const set = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }))
    if (field === 'title' || field === 'instructions' || field === 'doneLooksLike') setScreened(null)
  }
  const repeats = !task && values.repeat !== 'never' // H1: only a new task can repeat
  const child = family.find((c) => c.id === values.childId)
  const who = child?.name ?? 'your child'
  const uses = (text) => (screened && text.toLowerCase().includes(screened) ? `Take out “${screened}”.` : null)
  const errors = {
    childId: child ? null : 'Choose who this task is for.',
    category: values.category ? null : 'Choose what kind of task this is.',
    title: rules.taskTitle(values.title) ?? uses(values.title),
    instructions: rules.taskInstructions(values.instructions) ?? uses(values.instructions),
    doneLooksLike: uses(values.doneLooksLike),
    due: repeats ? null : rules.due(values.due, who, !task || values.due !== toLocalInput(task.dueAt)),
    days: values.repeat === 'days' && values.days === 0 ? 'Choose at least one day.' : null,
    time: repeats && !/^\d{2}:\d{2}$/.test(values.time) ? 'Choose the time it is due each day.' : null,
  }
  const shown = (field) => shownOf(errors, field)
  const back = task ? `/parent/tasks/${task.id}` : '/parent/tasks'

  const submit = (event) => {
    const { childId, category, title, instructions, doneLooksLike, points } = values
    const details = { childId, category, title, instructions, doneLooksLike, points, dueAt: fromLocalInput(values.due) } // P13: the family's wall clock
    return send(
      event,
      errors,
      async () => {
        // K6: a task made from a child's suggestion answers it; one answered meanwhile (REVIEWED) changes nothing
        const answered = () => location.state?.suggestionId && api.answerSuggestion(location.state.suggestionId, 'accepted').catch(() => {})
        if (repeats) {
          const weekdays = values.repeat === 'daily' ? 127 : values.days
          await api.createSeries({ childId, category, title, instructions, doneLooksLike, points, weekdays, dueTime: values.time })
          await answered()
          navigate(back, { state: { created: { title: title.trim(), childName: who, repeats: repeatText(weekdays) } } })
        } else if (task) {
          await api.updateTask(task.id, details)
          navigate(back, { state: { saved: true } })
        } else {
          const made = await api.createTask(details)
          await answered()
          navigate(back, { state: { created: { title: made.title, childName: made.childName } } })
        }
      },
      (error) => error.code === 'SCREENED' && (setScreened(error.fields.word), true),
    )
  }

  const due = repeats ? null : fromLocalInput(values.due)
  const heading = task ? 'Edit task' : 'Create task'

  return (
    <>
      <title>{`${heading} – GrowKid`}</title>
      <Link to={back} className={backLink}>
        {task ? task.title : 'Tasks'}
      </Link>
      <h1>{heading}</h1>

      <div className="mt-6 grid items-start gap-12 lg:grid-cols-[minmax(0,28rem)_minmax(0,24rem)]">
        <form ref={form} className="grid gap-5" onSubmit={submit} noValidate>
          <Field as="select" label="Child" error={shown('childId')} name="childId" value={values.childId} onChange={set('childId')}>
            {family.length > 1 && <option value="">Choose a child</option>}
            {family.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Field>
          <fieldset aria-describedby={shown('category') ? 'category-error' : undefined}>
            <legend className="font-medium">Category</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {CATEGORIES.map(({ id, name, Icon }) => (
                <label key={id} className="choice">
                  <input
                    type="radio"
                    className="sr-only"
                    name="category"
                    value={id}
                    checked={values.category === id}
                    onChange={set('category')}
                    aria-invalid={shown('category') ? 'true' : undefined}
                  />
                  <Icon className="size-6 shrink-0" aria-hidden="true" />
                  {name}
                </label>
              ))}
            </div>
            {shown('category') && (
              <p id="category-error" className="type-small mt-2 text-coral-700">
                {errors.category}
              </p>
            )}
          </fieldset>
          {!task && (
            <Ideas
              category={values.category}
              onPick={(i) => {
                setValues((v) => ({ ...v, title: i.title, instructions: i.instructions, doneLooksLike: i.doneLooksLike, points: i.points }))
                setScreened(null)
                form.current?.querySelector('input[name="title"]')?.focus() // the filled title is read out, ready to change
              }}
            />
          )}
          <Field
            label="Title"
            hint="A few plain words, like “Water the balcony plants”."
            error={shown('title')}
            name="title"
            value={values.title}
            onChange={set('title')}
            maxLength={80}
            autoComplete="off"
          />
          <Field
            as="textarea"
            label="What to do"
            hint={`Say what has to be done and what proof to send. ${500 - values.instructions.length} characters left.`}
            error={shown('instructions')}
            name="instructions"
            value={values.instructions}
            onChange={set('instructions')}
            rows={4}
            maxLength={500}
          />
          <Field
            as="textarea"
            label="What done looks like (optional)"
            hint={`What ${who === 'your child' ? 'your child' : who} should show, like “The pot is wet and the leaves are clean”. Fewer proofs get sent back when it is clear.`}
            error={shown('doneLooksLike')}
            name="doneLooksLike"
            value={values.doneLooksLike}
            onChange={set('doneLooksLike')}
            rows={2}
            maxLength={200}
          />
          {!task && (
            <fieldset>
              <legend className="font-medium">Repeat</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[['never', 'Never'], ['daily', 'Every day'], ['days', 'Chosen days']].map(([value, name]) => (
                  <label key={value} className="choice">
                    <input type="radio" className="sr-only" name="repeat" value={value} checked={values.repeat === value} onChange={set('repeat')} />
                    {name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {values.repeat === 'days' && !task && (
            <fieldset aria-describedby={shown('days') ? 'days-error' : undefined}>
              <legend className="font-medium">On these days</legend>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                  <label key={day} className="choice px-0">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={Boolean(values.days & (1 << i))}
                      onChange={() => setValues((v) => ({ ...v, days: v.days ^ (1 << i) }))}
                      aria-invalid={shown('days') ? 'true' : undefined}
                    />
                    {day}
                  </label>
                ))}
              </div>
              {shown('days') && (
                <p id="days-error" className="type-small mt-2 text-coral-700">
                  {errors.days}
                </p>
              )}
            </fieldset>
          )}
          {repeats ? (
            <Field
              label="Due each day at"
              hint={`A task is made each day it repeats, due at this time. ${who === 'your child' ? 'Your child' : who} can still send proof later, and it is marked as late.`}
              error={shown('time')}
              type="time"
              name="time"
              value={values.time}
              onChange={set('time')}
            />
          ) : (
            <Field
              label="Due"
              hint={`${who === 'your child' ? 'Your child' : who} can still send proof after this, and it is then marked as late.`}
              error={shown('due')}
              type="datetime-local"
              name="due"
              value={values.due}
              onChange={set('due')}
            />
          )}
          {!repeats && (
            <div className="-mt-2 flex flex-wrap gap-2" role="group" aria-label="Quick due times">
              {quickDues().map(({ label, value, past }) => (
                <button
                  key={label}
                  type="button"
                  className="btn btn-secondary min-h-11 px-3"
                  disabled={past}
                  aria-pressed={values.due === value}
                  onClick={() => setValues((v) => ({ ...v, due: value }))}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-2">
            <label htmlFor={pointsId} className="font-medium">
              Points
            </label>
            <div className="flex items-center gap-4">
              <input
                id={pointsId}
                type="range"
                className="min-h-11 flex-1"
                min={5}
                max={100}
                step={5}
                name="points"
                value={values.points}
                onChange={(event) => setValues((v) => ({ ...v, points: Number(event.target.value) }))}
                aria-describedby={`${pointsId}-hint`}
              />
              <output htmlFor={pointsId} className="type-data flex w-20 items-center justify-end gap-1.5">
                <Star className="icon-earned size-5 shrink-0" aria-hidden="true" />
                {values.points}
              </output>
            </div>
            <p id={`${pointsId}-hint`} className="type-small muted">
              What the task is worth, from 5 to 100. Nothing is awarded until you approve the proof.
            </p>
          </div>

          {screened && (
            <Message tone="danger" alert>
              A task cannot use “{screened}”. GrowKid screens tasks for the wording of harmful challenges. Change it and
              save again.
            </Message>
          )}
          {problem && (
            <Message tone="danger" alert>
              {problem}
            </Message>
          )}
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : task ? 'Save changes' : 'Create task'}
            </button>
            <Link to={back} className="btn btn-text">
              Cancel
            </Link>
          </div>
        </form>

        <aside className="sticky top-[calc(var(--banner-h)+2.5rem)] hidden lg:block" aria-labelledby="preview-title">
          <h2 id="preview-title" className="type-subheading">
            What {who} will see
          </h2>
          <p className="type-small muted mt-1">The task as it appears on Today.</p>
          <div className="mt-4">
            <TaskCard
              task={{
                status: 'todo',
                category: values.category,
                title: values.title.trim() || 'The title',
                instructions: values.instructions.trim() || 'What to do',
                dueAt: due,
                points: values.points,
              }}
            >
              <span className="btn btn-lg btn-primary mt-6 w-full" aria-hidden="true">
                Send proof
              </span>
            </TaskCard>
          </div>
        </aside>
      </div>
    </>
  )
}

export default function TaskForm() {
  const { taskId } = useParams()
  // a new task also reads the list, for the parent's most recently created task (H13)
  const loaded = useLoad(() => Promise.all([api.listChildren(), taskId ? api.getTask(taskId) : null, taskId ? [] : api.listTasks()]), [taskId])

  if (loaded.status === 'loading') return <PageLoading rows={4} />
  if (loaded.status === 'error') {
    return loaded.error.code === 'NOT_FOUND' ? <NotFound /> : <ErrorState error={loaded.error} onRetry={loaded.reload} />
  }
  const [family, task] = loaded.data
  if (task?.proofs.length > 0) return <Locked task={task} />
  if (family.length === 0) {
    return (
      <>
        <title>Create task – GrowKid</title>
        <h1>Create task</h1>
        <div className="mt-6">
          <AddChildFirst />
        </div>
      </>
    )
  }
  const latest = loaded.data[2].reduce((a, b) => (!a || b.createdAt > a.createdAt ? b : a), null)
  return <Form key={taskId ?? 'new'} family={family} task={task} latest={latest} />
}
