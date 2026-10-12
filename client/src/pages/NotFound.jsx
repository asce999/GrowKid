import { Link } from 'react-router-dom'
import { homeFor, useSession } from '../store/session.js'

// Shown for an address that does not exist, and for anything that belongs to another family,
// so that nothing is revealed about what does exist.
export default function NotFound() {
  const user = useSession((s) => s.user)
  return (
    <>
      <title>Page not found – GrowKid</title>
      <h1>Page not found</h1>
      <p className="muted mt-2 max-w-prose">This address does not exist, or it is not yours to open.</p>
      <Link to={user ? homeFor(user) : '/login'} className="btn btn-secondary mt-6">
        {user ? 'Go to your home page' : 'Go to sign in'}
      </Link>
    </>
  )
}
