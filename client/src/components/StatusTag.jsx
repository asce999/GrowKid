import { Circle, CircleAlert, CircleCheck, Clock, Hourglass, Undo2 } from 'lucide-react'
import { STATUS_WORDS } from '../utils/tasks.js'

// Every status is icon, word and colour together (DESIGN.md section 8).
const STATUSES = {
  todo: { Icon: Circle, look: 'tag-neutral' },
  review: { Icon: Hourglass, look: 'tag-info' },
  approved: { Icon: CircleCheck, look: 'tag-success' },
  sentBack: { Icon: Undo2, look: 'tag-danger' },
  dueSoon: { Icon: Clock, look: 'tag-warning' },
  overdue: { Icon: CircleAlert, look: 'tag-danger' },
}

export default function StatusTag({ status }) {
  const { Icon, look } = STATUSES[status]
  return (
    <span className={`tag ${look}`}>
      <Icon className="size-4" aria-hidden="true" />
      {STATUS_WORDS[status]}
    </span>
  )
}
