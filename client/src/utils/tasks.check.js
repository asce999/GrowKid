// The one runnable check for the task rules: `npm run check`. It fails if a rule breaks.
import assert from 'node:assert/strict'
import { inThisWeek, isOpen, nextTask, statusOf } from './tasks.js'

const hour = 3_600_000
const at = (hours) => new Date(Date.now() + hours * hour).toISOString()
const task = (status, dueAt, id = status) => ({ id, status, dueAt, proofs: [] })

// "Overdue" is a To do task whose due time has passed, and nothing else
assert.equal(statusOf(task('todo', at(-1))), 'overdue')
assert.equal(statusOf(task('todo', at(1))), 'todo')
assert.equal(statusOf(task('review', at(-1))), 'review')

// a task takes proof while it is to do or sent back
assert.deepEqual(['todo', 'sentBack', 'review', 'approved'].map((s) => isOpen(task(s, at(1)))), [true, true, false, false])

// next: something sent back first, then the task still to do that is due soonest (the list arrives in due order)
const inDueOrder = [task('review', at(-5)), task('todo', at(-2), 'overdue'), task('todo', at(3), 'later'), task('sentBack', at(9))]
assert.equal(nextTask(inDueOrder).status, 'sentBack')
assert.equal(nextTask(inDueOrder.slice(0, 3)).id, 'overdue')
assert.equal(nextTask([task('review', at(1)), task('approved', at(2))]), undefined)

// this week: due before next Monday, and either due since this Monday or still open
assert.equal(inThisWeek(task('todo', at(-24 * 30))), true) // long overdue, still open
assert.equal(inThisWeek(task('approved', at(-24 * 30))), false) // long done
assert.equal(inThisWeek(task('todo', at(24 * 8))), false) // more than a week away

console.log('task rules hold')
