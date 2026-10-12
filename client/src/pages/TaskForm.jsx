import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Star } from 'lucide-react'
import * as api from '../api/index.js'
import { Field } from '../components/Field.jsx'
import { ErrorState, Message, PageLoading } from '../components/states.jsx'
import { AddChildFirst, TaskCard } from '../components/Task.jsx'
import { noticeExpiry, useLoad } from '../hooks/useLoad.js'
import { CATEGORIES } from '../utils/categories.js'
import { focusFirstInvalid, submitProblem } from '../utils/forms.js'
import { toLocalInput } from '../utils/format.js'
import { rules } from '../utils/rules.js'
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

function Form({ family, task }) {
  const navigate = useNavigate()
  const [asked] = useSearchParams()
  const [values, setValues] = useState(() => {
    if (task) {
      const { childId, category, title, instructions, points } = task
      return { childId, category, title, instructions, due: toLocalInput(task.dueAt), points }
    }
    const only = family.length === 1 ? family[0] : family.find((c) => c.id === asked.get('child'))
    return { childId: only?.id ?? '', category: '', title: '', instructions: '', due: '', points: 20 }
  })
  const [tried, setTried] = useState(false)
  const [screened, setScreened] = useState(null) // the word content screening refused
  const [problem, setProblem] = useState(null)
  const [busy, setBusy] = useState(false)
  const form = useRef(null)
  const pointsId = useId()
  // once the refused word is marked on its field, go to that field
  useEffect(() => {
    if (screened) focusFirstInvalid(form.current)
  }, [screened])

  const set = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }))
    if (field === 'title' || field === 'instructions') setScreened(null)
  }
  const child = family.find((c) => c.id === values.childId)
  const who = child?.name ?? 'your child'
  const uses = (text) => (screened && text.toLowerCase().includes(screened) ? `Take out “${screened}”.` : null)
  const errors = {
    childId: child ? null : 'Choose who this task is for.',
    category: values.category ? null : 'Choose what kind of task this is.',
    title: rules.taskTitle(values.title) ?? uses(values.title),
    instructions: rules.taskInstructions(values.instructions) ?? uses(values.instructions),
    due: rules.due(values.due, who, !task || values.due !== toLocalInput(task.dueAt)),
  }
  const shown = (field) => (tried ? errors[field] : null)
  const back = task ? `/parent/tasks/${task.id}` : '/parent/tasks'

  async function submit(event) {
    event.preventDefault()
    setTried(true)
    setProblem(null)
    if (Object.values(errors).some(Boolean)) return focusFirstInvalid(form.current)
    setBusy(true)
    const details = {
      childId: values.childId,
      category: values.category,
      title: values.title,
      instructions: values.instructions,
      dueAt: new Date(values.due).toISOString(),
      points: values.points,
    }
    try {
      if (task) {
        await api.updateTask(task.id, details)
        navigate(back, { state: { saved: true } })
      } else {
        const made = await api.createTask(details)
        navigate(back, { state: { created: { title: made.title, childName: made.childName } } })
      }
    } catch (error) {
      noticeExpiry(error)
      if (error.code === 'SCREENED') setScreened(error.fields.word)
      else setProblem(submitProblem(error))
      setBusy(false)
    }
  }

  const due = values.due && !Number.isNaN(new Date(values.due).getTime()) ? new Date(values.due).toISOString() : null
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
            label="Due"
            hint={`${who === 'your child' ? 'Your child' : who} can still send proof after this, and it is then marked as late.`}
            error={shown('due')}
            type="datetime-local"
            name="due"
            value={values.due}
            onChange={set('due')}
          />
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
  const loaded = useLoad(() => Promise.all([api.listChildren(), taskId ? api.getTask(taskId) : null]), [taskId])

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
  return <Form key={taskId ?? 'new'} family={family} task={task} />
}
