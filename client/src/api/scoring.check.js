// The runnable check of the award rules: `npm run check`. A wrong award is the bug a child
// would notice first, so each rule has a line here that fails if it breaks.
import assert from 'node:assert/strict'
import { STICKERS, progress, score, stickers } from './scoring.js'

const NOW = new Date(2026, 9, 20, 15, 0) // a Tuesday afternoon; days below count back from it
const at = (daysAgo, hour = 12) => new Date(2026, 9, 20 - daysAgo, hour).toISOString()
let made = 0

/** A task due `due` days ago. sent: the days ago each proof went in. approved: the day ago it was approved, if it was. */
function task({ due, sent = [], approved, points = 20, category = 'chores' }) {
  const proofs = sent.map((daysAgo, i) => ({
    sentAt: at(daysAgo),
    review: i < sent.length - 1 ? { result: 'sentBack', at: at(daysAgo, 13) } : undefined,
  }))
  if (approved !== undefined) proofs.at(-1).review = { result: 'approved', at: at(approved, 14) }
  const status = approved !== undefined ? 'approved' : sent.length > 0 ? 'review' : 'todo'
  return { id: `t${++made}`, title: `Task ${made}`, dueAt: at(due, 18), points, category, status, proofs }
}
/** A task done and approved on the same day. */
const done = (daysAgo, extra) => task({ due: daysAgo, sent: [daysAgo], approved: daysAgo, ...extra })
/** A task whose newest proof, sent `sent` days ago, the parent has sent back. */
function sentBack({ sent, ...rest }) {
  const back = task({ ...rest, sent })
  back.status = 'sentBack'
  back.proofs.at(-1).review = { result: 'sentBack', at: at(sent.at(-1), 13) }
  return back
}
const earned = (tasks) => stickers(tasks).filter((s) => s.earnedAt).map((s) => s.id)

// ------------------------------------------------------------------ XP, points and levels
const nothing = score([], NOW)
assert.deepEqual([nothing.level, nothing.xp, nothing.xpForNext, nothing.points, nothing.waitingXp], [1, 0, 100, 0, 0])
assert.deepEqual([nothing.streak.days, nothing.streak.best, nothing.streak.week.length], [0, 0, 7])
const some = [done(2, { points: 30 }), done(1, { points: 100 }), task({ due: 0, sent: [0], points: 45 }), task({ due: -1 })]
assert.deepEqual([score(some, NOW).level, score(some, NOW).xp, score(some, NOW).points], [2, 30, 130]) // only approved tasks earn
assert.equal(score(some, NOW).waitingXp, 45) // proof in review waits; a task still to do is nothing yet
assert.equal(score([done(1, { points: 100 }), done(0, { points: 100 })], NOW).level, 3)

// ------------------------------------------------------------------ the streak
const streak = (tasks) => score(tasks, NOW).streak
assert.equal(streak([done(2), done(1), done(0)]).days, 3) // three days running
assert.equal(streak([task({ due: 2, sent: [2], approved: 0 }), done(1), done(0)]).days, 3) // approved two days late: the day sent is what counts
assert.equal(streak([done(5), done(3), done(0)]).days, 3) // days with nothing due change nothing
assert.equal(streak([done(1), task({ due: 0, sent: [0] })]).days, 1) // proof still waiting neither counts nor breaks
assert.equal(streak([done(1), task({ due: 0 })]).days, 1) // today is not over, so it is not missed
const broken = [done(4), done(3), task({ due: 2 }), done(1), done(0)]
assert.deepEqual([streak(broken).days, streak(broken).best], [2, 2]) // a task left overdue on a day ends the streak quietly
assert.deepEqual([streak([done(5), done(4), done(3), task({ due: 2 })]).days, streak([done(5), done(4), done(3), task({ due: 2 })]).best], [0, 3]) // the best is kept
assert.equal(streak([done(2), task({ due: 1, sent: [0], approved: 0 })]).days, 1) // proof sent a day late: the due day was missed
assert.equal(streak([done(2), done(1), task({ due: 1 }), done(0)]).days, 3) // a day that counts is never a missed day
assert.equal(streak([done(2), task({ due: 1, sent: [1] }), task({ due: 1 })]).days, 1) // nor is a day whose proof is still waiting
assert.equal(streak([done(2), task({ due: 1, sent: [1, 0], approved: 0 })]).days, 2) // sent back, then approved next day: nothing missed
// a parent's answer cannot end a streak: a task was due yesterday with no proof, but the child sent
// other proof yesterday, and the parent then sent it back. Yesterday was never a missed day.
const answered = [done(2), task({ due: 1 }), sentBack({ due: 0, sent: [1] })]
assert.deepEqual([streak(answered).days, streak(answered).best], [1, 1])
assert.equal(streak(answered).week[5].state, 'none') // yesterday: not missed, and no streak lost
assert.equal(streak([done(2), task({ due: 1 })]).days, 0) // with no proof sent that day it is missed, as before
assert.deepEqual(streak(broken).week.map((d) => d.state), ['none', 'none', 'done', 'done', 'missed', 'done', 'done'])

// ------------------------------------------------------------------ each sticker's condition
assert.equal(STICKERS.length, 11)
assert.deepEqual(earned([]), [])
assert.deepEqual(earned([task({ due: 0, sent: [0] })]), []) // nothing is earned until a parent approves
assert.deepEqual(earned([done(9)]), ['first-task'])
assert.ok(!earned(Array.from({ length: 9 }, () => done(40))).includes('tasks-10'))
assert.ok(earned(Array.from({ length: 10 }, () => done(40))).includes('tasks-10'))
assert.ok(!earned(Array.from({ length: 24 }, () => done(40))).includes('tasks-25'))
assert.ok(earned(Array.from({ length: 25 }, () => done(40))).includes('tasks-25'))
const run = (days) => Array.from({ length: days }, (_, i) => done(i, { points: 5 }))
assert.ok(!earned(run(2)).includes('streak-3') && earned(run(3)).includes('streak-3'))
assert.ok(!earned(run(6)).includes('streak-7') && earned(run(7)).includes('streak-7'))
assert.ok(!earned(run(29)).includes('streak-30') && earned(run(30)).includes('streak-30'))
assert.ok(earned([done(6), done(5), done(4), task({ due: 3 }), done(0)]).includes('streak-3')) // a sticker once earned stays
assert.ok(!earned([done(1, { points: 95 })]).includes('level-2') && earned([done(1, { points: 100 })]).includes('level-2'))
assert.ok(!earned(run(4).map((t) => ({ ...t, points: 99 }))).includes('level-5')) // 396 XP is level 4
assert.ok(earned(run(4).map((t) => ({ ...t, points: 100 }))).includes('level-5'))
assert.ok(!earned(run(9).map((t) => ({ ...t, points: 99 }))).includes('level-10') && earned(run(9).map((t) => ({ ...t, points: 100 }))).includes('level-10'))
const kinds = ['chores', 'study', 'reading', 'creative', 'outdoors', 'health']
assert.ok(!earned(kinds.slice(0, 5).map((category) => done(40, { category }))).includes('all-kinds'))
assert.ok(earned(kinds.map((category) => done(40, { category }))).includes('all-kinds'))
const secondTry = () => task({ due: 40, sent: [40, 39], approved: 39 })
assert.ok(!earned([done(40), done(40), done(40), done(40), secondTry(), secondTry()]).includes('first-try-5'))
assert.ok(earned([done(40), done(40), done(40), done(40), secondTry(), done(40)]).includes('first-try-5'))

// a sticker is dated by the approval that earned it, and says which task that was
const three = [done(2), done(1), done(0)]
const third = stickers(three).find((s) => s.id === 'streak-3')
assert.deepEqual([third.taskId, third.earnedAt], [three[2].id, three[2].proofs[0].review.at])
assert.equal(stickers(three).find((s) => s.id === 'first-task').taskId, three[0].id)
assert.equal(stickers(three).find((s) => s.id === 'level-10').earnedAt, undefined)

// ------------------------------------------------------------------ progress by week
// NOW is a Tuesday, so this week began yesterday. Proof sent on Sunday and approved on Monday
// belongs to last week: the week is the one the child sent it in.
const acrossTheBoundary = task({ due: 2, sent: [2], approved: 1, points: 30 })
const weekly = progress([acrossTheBoundary, done(1), done(0), done(60), task({ due: 0, sent: [0] }), task({ due: 3 })], NOW)
assert.equal(weekly.weeks.length, 6)
assert.ok(weekly.weeks.every((week) => new Date(week.start).getDay() === 1)) // every week starts on a Monday
assert.deepEqual([weekly.weeks.at(-1).tasks, weekly.weeks.at(-1).xp], [2, 40]) // Monday and today
assert.deepEqual([weekly.weeks.at(-2).tasks, weekly.weeks.at(-2).xp], [1, 30]) // the one sent on Sunday
assert.equal(weekly.weeks.reduce((n, week) => n + week.tasks, 0), 3) // older than six weeks, waiting or undone: not in any bar
assert.equal(weekly.calendar.length, 23) // three whole weeks, then Monday and today
assert.equal(new Date(weekly.calendar[0].day).getDay(), 1)
assert.deepEqual(weekly.calendar.slice(-5).map((d) => d.state), ['none', 'missed', 'done', 'done', 'done']) // the same marks as the streak

console.log('award rules hold')
