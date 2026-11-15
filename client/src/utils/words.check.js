// The runnable check of "Make one for me" and of the messages for a limit or a cap: `npm run check`.
import assert from 'node:assert/strict'
import { errorText } from './messages.js'
import { WORDS, makePassword } from './words.js'

assert.equal(WORDS.length, 150)
assert.equal(new Set(WORDS).size, 150) // a repeat would make some passwords likelier than others
assert.ok(WORDS.every((word) => /^[a-z]{3,7}$/.test(word)))
const made = Array.from({ length: 500 }, () => makePassword())
// three listed words, so 11 characters or more: over the child's minimum of 8 and under the 72-byte cap
assert.ok(made.every((password) => password.length >= 11 && password.split('-').length === 3 && password.split('-').every((word) => WORDS.includes(word))))
assert.ok(new Set(made).size > 490) // 150 x 150 x 150 choices: 500 draws almost never repeat
// never a word of the child's name or username, which the server would refuse
assert.ok(Array.from({ length: 500 }, () => makePassword('Rose Win', 'sky2015')).every((password) => !/rose|win|sky2015/.test(password)))

// a paused limit says how long to wait when the server said; a cap says which one
assert.equal(errorText({ code: 'TOO_MANY', fields: { minutes: 12 } }), 'Too many tries. Try again in 12 minutes.')
assert.equal(errorText({ code: 'TOO_MANY', fields: { minutes: 1 } }), 'Too many tries. Try again in 1 minute.')
assert.equal(errorText({ code: 'TOO_MANY' }), 'Too many tries. Wait a while, then try again.')
assert.match(errorText({ code: 'QUOTA', fields: { quota: 'children' } }), /up to 10 children/)
for (const quota of ['children', 'tasks', 'rewards', 'storage', 'disk']) assert.notEqual(errorText({ code: 'QUOTA', fields: { quota } }), errorText({ code: 'QUOTA' }))
assert.equal(errorText({ code: 'QUOTA' }), errorText({ code: 'NO_SUCH_CODE' }))

console.log('words and messages hold')
