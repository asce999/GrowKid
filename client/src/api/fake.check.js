// The runnable check of what the stand-in removes and what it hands a moderator: `npm run check`.
// Both are promises made to a family, so each has a line here that fails if it breaks.
import assert from 'node:assert/strict'
import { answerReport, erase, itemOf, reportsFor } from './fake.js'

const proof = (id, extra) => ({ id, note: 'A note the child wrote', sentAt: '2026-10-01T10:00:00.000Z', late: false, ...extra })
const task = (id, childId, proofs) => ({ id, childId, title: `Task ${id}`, instructions: 'Do it.', dueAt: '2026-10-02T10:00:00.000Z', points: 20, status: 'todo', proofs })
const family = () => ({
  session: 'p1',
  users: [
    { id: 'p1', role: 'parent' }, { id: 'c1', role: 'child', parentId: 'p1' }, { id: 'c2', role: 'child', parentId: 'p1' },
    { id: 'p2', role: 'parent' }, { id: 'c3', role: 'child', parentId: 'p2' }, { id: 'mod', role: 'moderator' },
  ],
  tasks: [
    task('t1', 'c1', [proof('f1', { fileType: 'image/png' }), proof('n1')]),
    task('t2', 'c2', [proof('f2', { fileType: 'video/mp4' })]),
    task('t3', 'c3', [proof('f3', { fileType: 'image/png' })]),
  ],
  awards: { c1: { 'first-task': {} }, c2: {}, c3: { 'first-task': {} } },
  reports: [
    // r1: a child's report about task t1, not yet answered. r2: a parent's, answered. r3: another family's.
    { id: 'r1', byId: 'c1', from: 'child', details: 'Something felt wrong.', sentAt: '2026-10-01T12:00:00.000Z', item: itemOf(task('t1', 'c1', [])) },
    { id: 'r2', byId: 'p1', from: 'parent', details: 'A question.', sentAt: '2026-10-01T13:00:00.000Z', resolution: { note: 'Answered.', at: '2026-10-02T09:00:00.000Z' } },
    { id: 'r3', byId: 'c3', from: 'child', details: 'Another family.', sentAt: '2026-10-01T14:00:00.000Z' },
  ],
})

// ------------------------------------------------------------------ deleting a family
const db = family()
const files = erase(db, ['p1', 'c1', 'c2'])
assert.deepEqual(files.sort(), ['f1', 'f2']) // their proof files, and only the proofs that had a file
assert.deepEqual(db.users.map((u) => u.id), ['p2', 'c3', 'mod']) // the other family and the moderator stay
assert.deepEqual(db.tasks.map((t) => t.id), ['t3'])
assert.deepEqual(Object.keys(db.awards), ['c3'])
assert.equal(db.session, null) // and the parent is signed out
assert.ok(!/"(p1|c1|c2|t1|t2|f1|f2|n1|r2)"/.test(JSON.stringify(db))) // nothing of theirs is left anywhere, but the unanswered report

// rule 16: a child's report that nobody has answered survives, and the answered one goes
assert.deepEqual(db.reports.map((r) => r.id), ['r1', 'r3'])
assert.ok(!('byId' in db.reports[0])) // the kept report no longer says who sent it
assert.ok(!/"(p1|c1|c2|t1|f1)"/.test(JSON.stringify(db.reports[0]))) // and holds no user, family, task or file id
assert.deepEqual(Object.keys(db.reports[0]).sort(), ['details', 'from', 'id', 'item', 'sentAt']) // only its words, the role, the time and the task copy
db.session = 'mod' // the moderator opens the list
assert.deepEqual(reportsFor(db).map((r) => r.id), ['r1', 'r3']) // it is still there for the moderator
assert.equal(reportsFor(db)[0].details, 'Something felt wrong.')
answerReport(db, 'r1', 'Thank you for telling us.')
assert.deepEqual(db.reports.map((r) => r.id), ['r3']) // answering it deletes it: nobody is left to read the answer
answerReport(db, 'r3', 'Looked at it.')
assert.deepEqual(db.reports.map((r) => r.id), ['r3']) // a report whose sender still exists stays, answered, for them to read

// ------------------------------------------------------------------ removing one child
const one = family()
assert.deepEqual(erase(one, ['c1']), ['f1'])
assert.deepEqual([one.users.length, one.tasks.map((t) => t.id).join(), one.reports.map((r) => r.id).join(), one.session], [5, 't2,t3', 'r1,r2,r3', 'p1']) // r1 stays, unnamed
assert.ok(!('byId' in one.reports[0]) && one.reports[1].byId === 'p1') // the parent's own report is untouched

// ------------------------------------------------------------------ what a moderator is handed
const reported = task('t9', 'c1', [
  proof('f9', { fileType: 'image/png', fileName: 'me.png', review: { result: 'sentBack', note: 'Do it again.', by: 'Meera Joshi', at: '2026-10-01T11:00:00.000Z' } }),
  proof('n9'),
])
const item = itemOf(reported)
assert.deepEqual(Object.keys(item).sort(), ['dueAt', 'instructions', 'notes', 'points', 'proofs', 'title'])
assert.deepEqual([item.notes, item.proofs], [['Do it again.'], 2]) // the parent's words, and only a count of the proofs
assert.ok(!/me\.png|A note the child wrote|Meera|c1|f9/.test(JSON.stringify(item))) // no file, no child's note, no name, no id

console.log('stand-in rules hold')
