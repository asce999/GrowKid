import { Link } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import * as api from '../api/index.js'
import { EmptyState, ErrorState, Message, PageLoading } from '../components/states.jsx'
import { useLoad } from '../hooks/useLoad.js'
import { useOnce } from '../hooks/useOnce.js'
import { initialOf } from '../utils/format.js'

export default function Family() {
  const children = useLoad(api.listChildren)
  const [note, dismiss] = useOnce()

  return (
    <>
      <title>Family – GrowKid</title>
      <h1>Family</h1>
      <p className="muted mt-2 max-w-prose">Each child signs in with the username and password you set here.</p>

      {note?.added && (
        <section className="mt-6 rounded-card border-2 border-navy-800 bg-white p-4 sm:p-6" role="status">
          <h2 className="type-subheading flex items-center gap-2">
            <KeyRound className="size-5" aria-hidden="true" />
            {note.added.name} can now sign in
          </h2>
          <dl className="mt-4 grid max-w-sm grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            <dt className="muted">Username</dt>
            <dd className="font-semibold">{note.added.username}</dd>
            <dt className="muted">Password</dt>
            <dd className="font-semibold">{note.added.password}</dd>
          </dl>
          <Message tone="warning" className="mt-4">
            Write these down or tell {note.added.name} now. The password is not shown again. If it is lost, you can
            set a new one from this page.
          </Message>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/parent/tasks/new" className="btn btn-primary">
              Create the first task
            </Link>
            <button type="button" className="btn btn-text" onClick={dismiss}>
              I have noted them
            </button>
          </div>
        </section>
      )}
      {note?.removed && (
        <Message tone="success" className="mt-6">
          {note.removed} was removed, along with their tasks, proofs and progress.
        </Message>
      )}

      <div className="mt-6">
        {children.status === 'loading' && <PageLoading rows={2} />}
        {children.status === 'error' && <ErrorState error={children.error} onRetry={children.reload} />}
        {children.status === 'ready' && children.data.length === 0 && (
          <EmptyState
            title="No children yet"
            action={
              <Link to="/parent/family/new" className="btn btn-primary">
                Add a child
              </Link>
            }
          >
            Add a child and choose the username and password they will sign in with.
          </EmptyState>
        )}
        {children.status === 'ready' && children.data.length > 0 && (
          <>
            <ul className="rounded-card border bg-white">
              {children.data.map((child) => (
                <li key={child.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-6">
                  <span className="avatar" aria-hidden="true">
                    {initialOf(child.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{child.name}</p>
                    <p className="type-small muted truncate">Signs in as {child.username}</p>
                  </div>
                  <Link to={`/parent/family/${child.id}`} className="btn btn-text">
                    Edit<span className="sr-only"> {child.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/parent/family/new" className={`btn mt-6 ${note?.added ? 'btn-secondary' : 'btn-primary'}`}>
              Add a child
            </Link>
          </>
        )}
      </div>
    </>
  )
}
