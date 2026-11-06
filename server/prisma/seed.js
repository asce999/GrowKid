// `npm run seed`: the demo family, copied from client/src/api/fake.js:35-119, for development only.
// It refuses unless NODE_ENV is development and refuses when any user exists. It prints counts only, never a password or a hash.
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { hash } from '../src/auth.js'
import { now } from '../src/clock.js'
import { zoneOf } from '../src/countries.js'
import { db, loadChild, taskWith } from '../src/db.js'
import { approvedInWeek, dayKey, stickers, weekKey } from '../src/scoring.js'

const ZONE = zoneOf('IN')
// ponytail: India has no daylight saving, so its offset from UTC is one fixed number; another zone would need a lookup here.
const INDIA_OFFSET = 330 * 60_000

/** A time in the demo data: this many days from today in the family's zone (negative for the past), at this hour of that day there. */
export function demoAt(days, hour) {
  const [y, m, d] = dayKey(now(), ZONE).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days, Math.floor(hour), (hour % 1) * 60) - INDIA_OFFSET)
}

const PARENT = 'Meera Joshi'
const USERS = [
  { key: 'parent', role: 'parent', name: PARENT, email: 'meera@example.com', country: 'IN', password: 'growkid-demo', hour: 8 },
  { key: 'aarav', role: 'child', name: 'Aarav', username: 'aarav', password: 'plants42', hour: 8.5 },
  { key: 'diya', role: 'child', name: 'Diya', username: 'diya', password: 'books77', hour: 8.75 },
  { key: 'moderator', role: 'moderator', name: 'Moderator', email: 'moderator@example.com', password: 'growkid-demo', hour: 8 },
]

/**
 * Inserts the demo family through tx and returns the counts and the ids made. Aarav has a few days of history and one approval he has
 * not seen yet; Diya is new. His stickers come from running the award rules over his tasks, with no approval (fake.js:539-545),
 * and the quest's target is two more than he has done this week, so it reads "2 to go" whatever weekday the seed runs on.
 */
export async function insertDemo(tx) {
  const at = demoAt
  const ids = {}
  for (const { key, password, hour, ...user } of USERS) {
    // created minutes apart, so listChildren (oldest first) gives Aarav then Diya
    ids[key] = (await tx.user.create({
      data: { ...user, passwordHash: await hash(password), parentId: user.role === 'child' ? ids.parent : undefined, createdAt: at(-6, hour) },
    })).id
  }
  const proof = (note, sentAt, result, reviewedAt, reviewNote = '', cheer = {}) => ({
    id: randomUUID(), note, sentAt, late: false, result, reviewNote, reviewBy: PARENT, reviewedAt, cheerKind: cheer.kind ?? null, cheerLine: cheer.line ?? '',
  })
  const task = (childId, category, title, instructions, dueAt, points, more = {}) =>
    tx.task.create({ data: { childId, category, title, instructions, dueAt, points, createdAt: at(-6, 9), ...more }, include: taskWith })
  /** A task Aarav did some days ago: due at 6 pm, a note sent at 5 pm, approved at 8 pm. */
  const done = (days, category, title, instructions, points, said, extra = []) =>
    task(ids.aarav, category, title, instructions, at(-days, 18), points, {
      status: 'approved',
      proofs: { create: [...extra, proof(said, at(-days, 17), 'approved', at(-days, 20))] },
    })
  const hourAgo = new Date(now().getTime() - 3_600_000)
  await done(5, 'chores', 'Make your bed', 'Pull the sheet flat and put the pillow on top. Write when you did it.', 20, 'Done before school.')
  await done(4, 'study', 'Practise the 7 times table', 'Say it aloud twice, then write it out once.', 30, 'Wrote it out. 7 x 8 is the hard one.')
  await done(3, 'reading', 'Read one chapter aloud', 'Read chapter 3 to someone at home. Write who listened.', 20, 'Read it to Dadi.')
  await done(2, 'creative', 'Draw the view from your window', 'Use the whole page. Send a photo of the drawing.', 20, 'Here is all of it.', [
    proof('My drawing.', at(-2, 16), 'sentBack', at(-2, 16.5), 'The drawing is cut off in the photo. Send one that shows the whole page.'),
  ])
  // approved an hour ago, and not seen yet, with a cheer
  await task(ids.aarav, 'outdoors', 'Cycle to the park and back', 'Wear your helmet. Write how long it took.', at(-1, 18), 30, {
    status: 'approved',
    resultSeen: false,
    proofs: { create: [proof('Twenty minutes there and back.', at(-1, 17), 'approved', hourAgo, '', { kind: 'effort', line: 'Twenty minutes there and back is quick. Well done.' })] },
  })
  await task(ids.aarav, 'chores', 'Water the balcony plants', 'Give each pot one full mug. Send a photo when you are done.', at(-1, 18), 30)
  await task(ids.aarav, 'reading', 'Read 20 pages of your library book', 'Read from where you stopped. Write one line about what happened.', at(1, 19), 20)
  await task(ids.diya, 'chores', 'Tidy the study desk', 'Books on the shelf, pencils in the stand. Send a photo of the desk.', at(2, 17), 20)

  // the stickers each child's tasks earn, as the rules give them
  let awards = 0
  const snapshots = {}
  for (const key of ['aarav', 'diya']) {
    snapshots[key] = await loadChild(tx, ids[key])
    const { zone, tasks } = snapshots[key]
    const earned = stickers(tasks, { rest: [], questAwards: [], zone }).filter((s) => s.earnedAt)
    await tx.award.createMany({ data: earned.map((s) => ({ childId: ids[key], stickerId: s.id, earnedAt: new Date(s.earnedAt), taskId: s.taskId, taskTitle: s.taskTitle })) })
    awards += earned.length
  }

  // three rewards, one request already given, and a weekly quest for Aarav
  const rewards = []
  for (const [title, cost] of [['15 minutes of extra screen time', 50], ['Choose the film on Friday', 100], ['A trip to the park café', 300]]) {
    rewards.push(await tx.reward.create({ data: { parentId: ids.parent, title, cost, createdAt: at(-6, 9) } }))
  }
  await tx.rewardRequest.create({
    data: {
      childId: ids.aarav, parentId: ids.parent, rewardId: rewards[0].id, title: rewards[0].title, cost: rewards[0].cost, status: 'given',
      requestedAt: at(-2, 17), answeredBy: PARENT, answeredAt: at(-2, 19),
    },
  })
  const { zone, tasks } = snapshots.aarav
  await tx.quest.create({
    data: {
      childId: ids.aarav, bonus: 50, surprise: 'Ice cream after school on Saturday', setAt: at(-6, 9),
      target: Math.max(2, approvedInWeek(tasks, weekKey(now(), zone), zone) + 2),
    },
  })
  const family = { child: { parentId: ids.parent } }
  const counts = {
    users: USERS.length,
    tasks: await tx.task.count({ where: family }),
    proofs: await tx.proof.count({ where: { task: family } }),
    awards,
    rewards: rewards.length,
    requests: await tx.rewardRequest.count({ where: { parentId: ids.parent } }),
    quests: await tx.quest.count({ where: { childId: ids.aarav } }),
  }
  return { counts, ids }
}

async function main() {
  if (process.env.NODE_ENV !== 'development') {
    console.error('seed: refusing, NODE_ENV is not development')
    process.exitCode = 1
    return
  }
  try {
    if ((await db.user.count()) > 0) {
      console.error('seed: refusing, users already exist')
      process.exitCode = 1
      return
    }
    // hashing four passwords at cost 12 takes a few seconds, so the transaction gets longer than Prisma's 5
    const { counts } = await db.$transaction(insertDemo, { timeout: 60_000 })
    console.log('seed: created', JSON.stringify(counts))
  } catch (error) {
    console.error('seed: failed (%s)', error.code ?? error.name) // never the error itself: it can carry the connection string
    process.exitCode = 1
  } finally {
    await db.$disconnect()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main() // not when a test imports insertDemo
