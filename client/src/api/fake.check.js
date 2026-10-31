// The runnable check of what the stand-in removes and what it hands a moderator: `npm run check`.
// Both are promises made to a family, so each has a line here that fails if it breaks.
import assert from 'node:assert/strict'
import { answerIn, answerReport, erase, growthForChild, growthOf, itemOf, reportsFor, requestIn, setQuestIn } from './fake.js'
import { weekKey } from './scoring.js'

const proof = (id, extra) => ({ id, note: 'A note the child wrote', sentAt: '2026-10-01T10:00:00.000Z', late: false, ...extra })
const task = (id, childId, proofs) => ({ id, childId, title: `Task ${id}`, instructions: 'Do it.', dueAt: '2026-10-02T10:00:00.000Z', points: 20, status: 'todo', proofs })
const family = () => ({
  session: 'p1',
  users: [
    { id: 'p1', role: 'parent', name: 'Meera' }, { id: 'c1', role: 'child', parentId: 'p1', name: 'Aarav' }, { id: 'c2', role: 'child', parentId: 'p1' },
    { id: 'p2', role: 'parent' }, { id: 'c3', role: 'child', parentId: 'p2' }, { id: 'mod', role: 'moderator' },
  ],
  tasks: [
    task('t1', 'c1', [proof('f1', { fileType: 'image/png' }), proof('n1')]),
    task('t2', 'c2', [proof('f2', { fileType: 'video/mp4' })]),
    task('t3', 'c3', [proof('f3', { fileType: 'image/png' })]),
    // a1: c1's task, approved and seen, worth 100 points, so that c1 has points to spend
    { ...task('a1', 'c1', [proof('a1p', { review: { result: 'approved', note: '', by: 'Meera', at: '2026-10-01T11:00:00.000Z' } })]), status: 'approved', points: 100, resultSeen: true },
  ],
  awards: { c1: { 'first-task': {} }, c2: {}, c3: { 'first-task': {} } },
  reports: [
    // r1: a child's report about task t1, not yet answered. r2: a parent's, answered. r3: another family's.
    { id: 'r1', byId: 'c1', from: 'child', details: 'Something felt wrong.', sentAt: '2026-10-01T12:00:00.000Z', item: itemOf(task('t1', 'c1', [])) },
    { id: 'r2', byId: 'p1', from: 'parent', details: 'A question.', sentAt: '2026-10-01T13:00:00.000Z', resolution: { note: 'Answered.', at: '2026-10-02T09:00:00.000Z' } },
    { id: 'r3', byId: 'c3', from: 'child', details: 'Another family.', sentAt: '2026-10-01T14:00:00.000Z' },
  ],
  // what rewards, quests and rest days add: w1 and w9 are p1's, w2 is p2's; q1 holds 50 of c1's points
  rewards: [
    { id: 'w1', parentId: 'p1', title: 'Extra screen time', cost: 50, createdAt: '2026-10-01T09:00:00.000Z' },
    { id: 'w9', parentId: 'p1', title: 'A day out', cost: 1000, createdAt: '2026-10-01T09:00:00.000Z' },
    { id: 'w2', parentId: 'p2', title: 'Choose the film', cost: 10, createdAt: '2026-10-01T09:00:00.000Z' },
  ],
  requests: [
    { id: 'q1', childId: 'c1', parentId: 'p1', rewardId: 'w1', title: 'Extra screen time', cost: 50, status: 'requested', note: '', requestedAt: '2026-10-01T15:00:00.000Z' },
    { id: 'q2', childId: 'c3', parentId: 'p2', rewardId: 'w2', title: 'Choose the film', cost: 10, status: 'requested', note: '', requestedAt: '2026-10-01T15:00:00.000Z' },
  ],
  quests: { c1: { target: 3, bonus: 50, surprise: 'A picnic', setAt: '2026-10-01T09:00:00.000Z' }, c3: { target: 2, bonus: 10, surprise: null, setAt: '2026-10-01T09:00:00.000Z' } },
  questAwards: {
    c1: { '2026-09-28': { week: '2026-09-28', target: 3, bonus: 50, surprise: null, earnedAt: '2026-10-01T11:00:00.000Z', taskId: 'a1', taskTitle: 'Task a1' } },
    c3: { '2026-09-28': { week: '2026-09-28', target: 2, bonus: 10, surprise: null, earnedAt: '2026-10-01T11:00:00.000Z', taskId: 't3', taskTitle: 'Task t3' } },
  },
  restDays: { c1: ['2026-10-05'], c3: ['2026-10-06'] },
  settings: { p1: { leaderboard: true }, p2: { leaderboard: false } },
})

// ------------------------------------------------------------------ deleting a family
const db = family()
const files = erase(db, ['p1', 'c1', 'c2'])
assert.deepEqual(files.sort(), ['f1', 'f2']) // their proof files, and only the proofs that had a file
assert.deepEqual(db.users.map((u) => u.id), ['p2', 'c3', 'mod']) // the other family and the moderator stay
assert.deepEqual(db.tasks.map((t) => t.id), ['t3'])
assert.deepEqual(Object.keys(db.awards), ['c3'])
assert.equal(db.session, null) // and the parent is signed out
assert.ok(!/"(p1|c1|c2|t1|t2|a1|a1p|f1|f2|n1|r2|w1|w9|q1)"/.test(JSON.stringify(db))) // nothing of theirs is left anywhere, but the unanswered report
assert.deepEqual([db.rewards.map((r) => r.id), db.requests.map((r) => r.id)], [['w2'], ['q2']]) // their rewards and requests go; the other family's stay
assert.deepEqual([db.quests, db.questAwards, db.restDays, db.settings].map((held) => Object.keys(held)), [['c3'], ['c3'], ['c3'], ['p2']]) // so do their quests, quest awards, rest days and settings

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
assert.deepEqual([one.rewards.length, one.requests.map((r) => r.id)], [3, ['q2']]) // a child's request goes with them; the parent's rewards stay

// ------------------------------------------------------------------ what a moderator is handed
const reported = task('t9', 'c1', [
  proof('f9', { fileType: 'image/png', fileName: 'me.png', review: { result: 'sentBack', note: 'Do it again.', by: 'Meera Joshi', at: '2026-10-01T11:00:00.000Z' } }),
  proof('n9'),
])
const item = itemOf(reported)
assert.deepEqual(Object.keys(item).sort(), ['dueAt', 'instructions', 'notes', 'points', 'proofs', 'title'])
assert.deepEqual([item.notes, item.proofs], [['Do it again.'], 2]) // the parent's words, and only a count of the proofs
assert.ok(!/me\.png|A note the child wrote|Meera|c1|f9/.test(JSON.stringify(item))) // no file, no child's note, no name, no id

// ------------------------------------------------------------------ asking for a reward and the answer
// c1 has 100 points, a 50-point quest bonus, and q1 holding 50 of them: 100 to spend
const shop = family()
const balance = () => growthOf(shop, 'c1').shown.balance
shop.session = 'c1'
assert.equal(balance(), 100)
assert.throws(() => requestIn(shop, 'w9'), { code: 'NOT_ENOUGH' }) // 1,000 points is more than there is
assert.equal(shop.requests.length, 2) // and nothing was asked for
assert.throws(() => requestIn(shop, 'w2'), { code: 'NOT_FOUND' }) // another family's reward does not exist for this child
const asked = requestIn(shop, 'w1')
assert.deepEqual([shop.requests.length, asked.status, balance()], [3, 'requested', 50]) // one request, and its 50 points are held at once
assert.ok(!('parentId' in asked) && asked.childName === 'Aarav') // given with the child's name, without the parent's id
shop.session = 'p2'
assert.throws(() => answerIn(shop, asked.id, 'declined'), { code: 'NOT_FOUND' }) // a parent of another family cannot answer it
shop.session = 'p1'
assert.throws(() => answerIn(shop, asked.id, 'maybe'), { code: 'INVALID' }) // only given or declined
const declined = answerIn(shop, asked.id, 'declined', 'Not before the weekend.')
assert.deepEqual([declined.status, declined.note, declined.answer.by, balance()], ['declined', 'Not before the weekend.', 'Meera', 100]) // declining gives the points back
assert.throws(() => answerIn(shop, asked.id, 'given'), { code: 'REVIEWED' }) // it is answered once

// ------------------------------------------------------------------ the sealed surprise (rule 19)
const sealedQuest = family()
const week = weekKey(new Date())
sealedQuest.quests.c1 = { target: 5, bonus: 20, surprise: 'Next week’s plan', setAt: '2026-10-01T09:00:00.000Z' } // changed after this week's quest was completed
sealedQuest.questAwards.c1[week] = { week, target: 3, bonus: 50, surprise: 'A picnic', earnedAt: '2026-10-01T11:00:00.000Z', taskId: 'a1', taskTitle: 'Task a1' }
const forChild = () => growthForChild(sealedQuest, 'c1')
assert.deepEqual([forChild().shown.quest.surprise, forChild().shown.quest.target, forChild().shown.quest.sealed], ['A picnic', 3, false]) // what they earned opens, as it was
assert.ok(!JSON.stringify(forChild()).includes('Next week’s plan')) // and the parent's change stays sealed
sealedQuest.tasks.find((t) => t.id === 'a1').resultSeen = false // not yet seen on Today
assert.deepEqual([forChild().shown.quest.surprise, forChild().shown.quest.sealed, forChild().quest.surprise], [null, true, null]) // so neither score opens it

// ------------------------------------------------------------------ setting a quest (rule 19)
const quests = family()
const sentNow = new Date().toISOString()
for (const id of ['d1', 'd2']) quests.tasks.push({ ...task(id, 'c1', [proof(`${id}p`, { sentAt: sentNow, review: { result: 'approved', note: '', by: 'Meera', at: sentNow } })]), status: 'approved', resultSeen: true })
assert.throws(() => setQuestIn(quests, 'c1', { target: 2, bonus: 10 }), (e) => e.fields.target === 'done') // two approved already: it would show as full and never pay
assert.equal(setQuestIn(quests, 'c1', { target: 3, bonus: 10 }).target, 3)
quests.questAwards.c1[week] = { week, target: 2, bonus: 10, surprise: null, earnedAt: sentNow, taskId: 'd2', taskTitle: 'Task d2' }
assert.equal(setQuestIn(quests, 'c1', { target: 2, bonus: 10 }).target, 2) // this week's is complete, so the change is for next week
assert.throws(() => setQuestIn(quests, 'c3', { target: 3, bonus: 10 }), { code: 'NOT_FOUND' }) // another family's child

console.log('stand-in rules hold')
