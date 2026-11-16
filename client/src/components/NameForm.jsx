import { useState } from 'react'
import { useForm } from '../hooks/useForm.js'
import { busyProps } from '../utils/forms.js'
import { rules } from '../utils/rules.js'
import { Field } from './Field.jsx'
import { Message } from './states.jsx'

/**
 * Phase 7, item 17: changing a name, the parent's own (Settings) or a child's (the child's page), on useForm. save(name) sends it;
 * the form stays on the page, so busy ends after a success and "Name saved." says it worked until the name is changed again.
 */
export default function NameForm({ label, hint, initial, autoComplete = 'off', save }) {
  const { form, values, field, busy, setBusy, problem, shown, submit } = useForm({ name: initial })
  const [saved, setSaved] = useState(false)
  const errors = { name: rules.name(values.name) }

  return (
    <form
      ref={form}
      className="grid max-w-md gap-4"
      noValidate
      onSubmit={(event) =>
        submit(event, errors, async () => {
          await save(values.name)
          setSaved(true)
          setBusy(false)
        })
      }
    >
      <Field
        label={label}
        hint={hint}
        error={shown(errors, 'name')}
        value={values.name}
        onChange={(event) => {
          field('name')(event)
          setSaved(false)
        }}
        name="name"
        autoComplete={autoComplete}
      />
      {problem && (
        <Message tone="danger" alert>
          {problem}
        </Message>
      )}
      {saved && (
        <Message tone="success" role="status">
          Name saved.
        </Message>
      )}
      <button className="btn btn-primary justify-self-start" {...busyProps(busy)}>
        {busy ? 'Saving…' : 'Save name'}
      </button>
    </form>
  )
}
