// `npm run check`: P6, the page cache is emptied whenever the signed-in person changes, and only then.
import assert from 'node:assert/strict'
import { forgetOnUserChange, keyFor, recall, remember, size } from './pageCache.js'

// a store shaped like zustand's: subscribe(listener(now, before))
let state = { user: { id: 'parent' } }
const listeners = []
const store = { subscribe: (fn) => listeners.push(fn) }
const become = (user) => {
  const before = state
  state = { user }
  for (const fn of listeners) fn(state, before)
}
forgetOnUserChange(store)

const load = () => 'tasks'
const key = keyFor('/parent', load, ['a'])
assert.notEqual(key, keyFor('/parent', load, ['b'])) // another question
assert.notEqual(key, keyFor('/child', load, ['a'])) // another page
remember(key, ['the parent’s tasks'])
become({ id: 'parent' }) // the same person (a refreshed session): kept
assert.deepEqual(recall(key), ['the parent’s tasks'])
become(null) // signed out, expired or deleted: gone
assert.equal(size(), 0)
remember(key, ['again'])
become({ id: 'child' }) // another person on the same device: gone
assert.equal(recall(key), undefined)
console.log('page cache rule holds')
