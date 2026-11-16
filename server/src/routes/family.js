import { Router } from 'express'
import { only, ownChild, signedIn } from '../auth.js'
import { now } from '../clock.js'
import { zoneOf } from '../countries.js'
import { db, loadChild, lockChild, readChildren } from '../db.js'
import { invalid, refuse, text } from '../errors.js'
import { cap, checkQuest, dayKeyIn, growthForChild, growthOf, isDay, leaderboardOf, progressOf, recentRest, screen, stickerList } from '../rules.js'
import { asChild, asRequest, asReward, asSuggestion } from '../shape.js'
import { childrenOf, makeDueTasks } from './series.js'
import { bySoonest, inWindow } from './tasks.js'

/** Growth, rewards, requests, quests, rest days and the leaderboard (plan B3, rules 13 and 17 to 24). Ported from the stand-in removed in B4. */
export const family = Router()

/** What a request is read with, so shape.js's asRequest has the child's name. */
const requestWith = { child: { select: { name: true } } }

/** The parent whose family the signed-in parent or child belongs to. A moderator has none. */
function familyOf(req) {
  const me = signedIn(req)
  if (me.role === 'moderator') refuse('NOT_ALLOWED')
  return me.role === 'parent' ? me.id : me.parentId
}

/** K3: the child's savings goal as a Reward, or null. The database clears goalRewardId when the reward is deleted. */
async function goalOf(me) {
  const reward = me.goalRewardId ? await db.reward.findUnique({ where: { id: me.goalRewardId } }) : null
  return reward && asReward(reward)
}

/**
 * K7: what Today asks a child who has not agreed to agree to: their running series and the family's rewards; null when there is
 * nothing to agree to. A child who has agreed gets only when, which their parent sees too.
 */
async function agreementOf(me) {
  if (me.agreedAt) return { agreedAt: me.agreedAt.toISOString() }
  const [series, rewards] = await Promise.all([
    db.taskSeries.findMany({ where: { childId: me.id, active: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    db.reward.findMany({ where: { parentId: me.parentId }, orderBy: [{ cost: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] }),
  ])
  if (series.length === 0 && rewards.length === 0) return null
  return { series: series.map(({ id, title, weekdays, dueTime, points }) => ({ id, title, weekdays, dueTime, points })), rewards: rewards.map(asReward) }
}

// ------------------------------------------------------------------ growth

/** getGrowth: the child's score as a child may read it. */
family.get('/growth', async (req, res) => {
  const me = only(req, 'child')
  const [snapshot] = await readChildren([me.id])
  res.json({ ...growthForChild(snapshot, now()), goal: await goalOf(me) })
})

/** listGrowth: each of the parent's children by id, with the surprise open (a parent always reads it). */
family.get('/growth/children', async (req, res) => {
  const me = only(req, 'parent')
  const ids = (await db.user.findMany({ where: { parentId: me.id }, select: { id: true } })).map((child) => child.id)
  const snapshots = await readChildren(ids)
  const time = now()
  res.json(Object.fromEntries(ids.map((id, i) => [id, growthOf(snapshots[i], time)])))
})

/** getToday (P1): Today's three answers from one snapshot, so one call per refresh: the task window (P2), the growth and the stickers. */
family.get('/today', async (req, res) => {
  const me = only(req, 'child')
  await makeDueTasks(await childrenOf(req)) // H2: today's repeating tasks first
  const [[snapshot], goal, agreement, answers] = await Promise.all([
    readChildren([me.id]),
    goalOf(me),
    agreementOf(me),
    db.rewardRequest.findMany({ where: { childId: me.id, answerSeen: false }, include: requestWith, orderBy: [{ answeredAt: 'asc' }, { id: 'asc' }] }), // K2
  ])
  const time = now()
  res.json({
    tasks: snapshot.tasks.filter((task) => inWindow(task, time)).sort(bySoonest),
    growth: { ...growthForChild(snapshot, time), goal },
    stickers: stickerList(snapshot, time),
    answers: answers.map(asRequest),
    agreement,
  })
})

/** listStickers */
family.get('/stickers', async (req, res) => {
  const me = only(req, 'child')
  const [snapshot] = await readChildren([me.id])
  res.json(stickerList(snapshot, now()))
})

/** getProgress (rule 14): none of it is stored; it is read from the child's tasks. */
family.get('/children/:id/progress', async (req, res) => {
  const child = await ownChild(req, req.params.id)
  const [snapshot] = await readChildren([child.id])
  res.json(progressOf(snapshot, asChild(child), now()))
})

/** getLeaderboard (rule 23): null when the parent has it off or there are fewer than two children. */
family.get('/leaderboard', async (req, res) => {
  const me = only(req, 'child')
  const [parent, siblings] = await Promise.all([
    db.user.findUnique({ where: { id: me.parentId }, select: { leaderboard: true } }),
    db.user.findMany({ where: { parentId: me.parentId }, select: { id: true, name: true, avatar: true } }),
  ])
  if (siblings.length < 2 || !parent?.leaderboard) return res.json(null)
  const snapshots = await readChildren(siblings.map((child) => child.id))
  res.json(leaderboardOf(siblings.map((child, i) => ({ child, snapshot: snapshots[i] })), me.id, now()))
})

// ------------------------------------------------------------------ rewards and requests

/** listRewards: the family's, cheapest first. */
family.get('/rewards', async (req, res) => {
  const rows = await db.reward.findMany({ where: { parentId: familyOf(req) }, orderBy: [{ cost: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] })
  res.json(rows.map(asReward))
})

/** saveReward: a new reward when `id` is missing or empty; otherwise the parent's own with that id, or NOT_FOUND. */
family.post('/rewards', async (req, res) => {
  const me = only(req, 'parent')
  const body = req.body ?? {}
  const asked = body.id === undefined || body.id === null || body.id === '' ? null : text(body.id) // a wrong type is an id that is not theirs, not a new reward
  const existing = asked === null ? null : ((await db.reward.findFirst({ where: { id: asked, parentId: me.id } })) ?? refuse('NOT_FOUND'))
  const title = text(body.title).trim()
  const { cost } = body
  invalid({
    title: (title.length < 3 || title.length > 60) && 'length',
    cost: !(Number.isInteger(cost) && cost >= 10 && cost <= 1000 && cost % 10 === 0) && 'range',
  })
  screen(title)
  if (!existing) cap('rewards', await db.reward.count({ where: { parentId: me.id } }))
  const row = existing
    ? await db.reward.update({ where: { id: existing.id }, data: { title, cost } })
    : await db.reward.create({ data: { parentId: me.id, title, cost, createdAt: now() } })
  res.status(existing ? 200 : 201).json(asReward(row))
})

/** deleteReward: requests already made for it keep their own copy of the title and cost. */
family.delete('/rewards/:id', async (req, res) => {
  const me = only(req, 'parent')
  const { count } = await db.reward.deleteMany({ where: { id: text(req.params.id), parentId: me.id } })
  if (count === 0) refuse('NOT_FOUND')
  res.status(204).end()
})

/**
 * requestReward (rule 18): the points are held at once. The balance is read under the child's lock, so two requests at once cannot
 * spend the same points twice (plan section 7, Races).
 */
family.post('/requests', async (req, res) => {
  const me = only(req, 'child')
  const rewardId = text((req.body ?? {}).rewardId)
  const row = await db.$transaction(async (tx) => {
    await lockChild(tx, me.id)
    const reward = (await tx.reward.findFirst({ where: { id: rewardId, parentId: me.parentId } })) ?? refuse('NOT_FOUND')
    if (growthOf(await loadChild(tx, me.id), now()).shown.balance < reward.cost) refuse('NOT_ENOUGH')
    await tx.user.updateMany({ where: { id: me.id, goalRewardId: reward.id }, data: { goalRewardId: null } }) // K3: asking for the goal ends it
    return tx.rewardRequest.create({
      data: { childId: me.id, parentId: me.parentId, rewardId: reward.id, title: reward.title, cost: reward.cost, requestedAt: now() },
      include: requestWith,
    })
  })
  res.status(201).json(asRequest(row))
})

/** listRequests: a child's own, or those of the parent's family, newest first. */
family.get('/requests', async (req, res) => {
  const me = signedIn(req)
  if (me.role === 'moderator') refuse('NOT_ALLOWED')
  const rows = await db.rewardRequest.findMany({
    where: me.role === 'child' ? { childId: me.id } : { parentId: me.id },
    include: requestWith,
    orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
  })
  res.json(rows.map(asRequest))
})

/**
 * answerRequest: given or declined, once. Declining gives the points back, because a declined request no longer holds any (balanceOf).
 * The write is conditional on the status the checks saw, so two answers at once land once and the other finds REVIEWED.
 */
family.post('/requests/:id/answer', async (req, res) => {
  const me = only(req, 'parent')
  const id = text(req.params.id)
  const request = (await db.rewardRequest.findFirst({ where: { id, parentId: me.id } })) ?? refuse('NOT_FOUND')
  if (request.status !== 'requested') refuse('REVIEWED')
  const body = req.body ?? {}
  const { result } = body
  const note = text(body.note)
  invalid({ result: !['given', 'declined'].includes(result) && 'required', note: note.length > 200 && 'length' })
  if (result === 'declined') screen(note) // C7: the child reads it; a given request stores no note
  const { count } = await db.rewardRequest.updateMany({
    where: { id, parentId: me.id, status: 'requested' },
    data: { status: result, note: result === 'declined' ? note.trim() : '', answeredBy: me.name, answeredAt: now(), answerSeen: false }, // K2: new to the child
  })
  if (count === 0) refuse((await db.rewardRequest.count({ where: { id } })) ? 'REVIEWED' : 'NOT_FOUND')
  res.json(asRequest(await db.rewardRequest.findUniqueOrThrow({ where: { id }, include: requestWith })))
})

/** markAnswersSeen (K2): on the child's own requests only, so an answer that arrives meanwhile is still new. */
family.post('/requests/seen', async (req, res) => {
  const me = only(req, 'child')
  const { ids } = req.body ?? {}
  if (!Array.isArray(ids) || ids.length > 200 || !ids.every((id) => typeof id === 'string')) refuse('INVALID', { ids: 'format' })
  await db.rewardRequest.updateMany({ where: { childId: me.id, id: { in: ids } }, data: { answerSeen: true } })
  res.status(204).end()
})

/** setGoal (K3): one of the family's rewards, or null for none. Another family's reward is NOT_FOUND. */
family.put('/goal', async (req, res) => {
  const me = only(req, 'child')
  const { rewardId } = req.body ?? {}
  const reward = rewardId === null ? null : ((await db.reward.findFirst({ where: { id: text(rewardId), parentId: me.parentId } })) ?? refuse('NOT_FOUND'))
  await db.user.update({ where: { id: me.id }, data: { goalRewardId: reward?.id ?? null } })
  res.json({ goal: reward && asReward(reward) })
})

// ------------------------------------------------------------------ the agreement and suggestions (rule 29)

/** agree (K7): the child agrees to the family agreement now. */
family.post('/agree', async (req, res) => {
  const me = only(req, 'child')
  await db.user.update({ where: { id: me.id }, data: { agreedAt: now() } })
  res.status(204).end()
})

/** askAgreementAgain (K7): the parent clears the child's agreement, so Today asks again. */
family.delete('/children/:id/agreement', async (req, res) => {
  const child = await ownChild(req, req.params.id)
  await db.user.update({ where: { id: child.id }, data: { agreedAt: null } })
  res.status(204).end()
})

const suggestionWith = { child: { select: { name: true } } }
const IDEA_ID = /^[a-z0-9-]{1,40}$/

/** suggestTask (K6): an idea's id, never words; at most 3 waiting. The same idea already waiting is answered with that one. */
family.post('/suggestions', async (req, res) => {
  const me = only(req, 'child')
  const { ideaId } = req.body ?? {}
  invalid({ ideaId: !(typeof ideaId === 'string' && IDEA_ID.test(ideaId)) && 'format' })
  const [row, made] = await db.$transaction(async (tx) => {
    await lockChild(tx, me.id) // the count and the insert under one lock, so two at once cannot pass the cap
    const same = await tx.suggestion.findFirst({ where: { childId: me.id, ideaId, status: 'open' }, include: suggestionWith })
    if (same) return [same, false]
    cap('suggestions', await tx.suggestion.count({ where: { childId: me.id, status: 'open' } }))
    return [await tx.suggestion.create({ data: { childId: me.id, ideaId, createdAt: now() }, include: suggestionWith }), true]
  })
  res.status(made ? 201 : 200).json(asSuggestion(row))
})

/** listSuggestions (K6): those still waiting, oldest first: a child's own, or the parent's family's. */
family.get('/suggestions', async (req, res) => {
  const me = signedIn(req)
  if (me.role === 'moderator') refuse('NOT_ALLOWED')
  const rows = await db.suggestion.findMany({
    where: { status: 'open', ...(me.role === 'child' ? { childId: me.id } : { child: { parentId: me.id } }) },
    include: suggestionWith,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  res.json(rows.map(asSuggestion))
})

/** answerSuggestion (K6): accepted once the task is made, or declined ("Not now"); once. */
family.post('/suggestions/:id/answer', async (req, res) => {
  const me = only(req, 'parent')
  const id = text(req.params.id)
  const { result } = req.body ?? {}
  invalid({ result: !['accepted', 'declined'].includes(result) && 'required' })
  const { count } = await db.suggestion.updateMany({ where: { id, status: 'open', child: { parentId: me.id } }, data: { status: result } })
  if (count === 0) refuse((await db.suggestion.count({ where: { id, child: { parentId: me.id } } })) ? 'REVIEWED' : 'NOT_FOUND')
  res.status(204).end()
})

// ------------------------------------------------------------------ quests and rest days

/**
 * setQuest (rule 19): sets or replaces the child's quest. A request with no body at all (no Content-Type) removes it; any typed body,
 * a text/plain one or a JSON {} included, goes through the field checks, so a quest is never removed by a body that failed to parse
 * as a quest. A JSON null is refused by the JSON parser. Runs under the child's lock, so an approval (which reads the quest) and this
 * cannot interleave.
 */
family.put('/children/:id/quest', async (req, res) => {
  const child = await ownChild(req, req.params.id)
  const remove = req.get('content-type') === undefined
  const body = req.body
  const quest = await db.$transaction(async (tx) => {
    await lockChild(tx, child.id)
    if (remove) {
      await tx.quest.deleteMany({ where: { childId: child.id } })
      return null
    }
    const def = typeof body === 'object' && body !== null && !Array.isArray(body) ? body : {} // anything else fails the field checks below
    const values = checkQuest(def, await loadChild(tx, child.id), now())
    const data = { ...values, setAt: now() }
    await tx.quest.upsert({ where: { childId: child.id }, create: { childId: child.id, ...data }, update: data })
    return values
  })
  res.json(quest)
})

/** The child's rest days a parent can still change, in the family's zone (rule 25). The parent's country decides it. */
async function recentDays(req, childId) {
  const rows = await db.restDay.findMany({ where: { childId }, orderBy: { day: 'asc' } })
  return recentRest({ rest: rows.map((r) => r.day), zone: zoneOf(req.user.country) }, now())
}

/** listRestDays */
family.get('/children/:id/rest-days', async (req, res) => {
  const child = await ownChild(req, req.params.id)
  res.json(await recentDays(req, child.id))
})

/** setRestDay (rule 21): from 7 days ago up to 90 days ahead, counted from the family's today, both included. */
family.post('/children/:id/rest-days', async (req, res) => {
  const child = await ownChild(req, req.params.id)
  const { day, rest } = req.body ?? {}
  const zone = zoneOf(req.user.country)
  const time = now()
  invalid({
    day: !(typeof day === 'string' && isDay(day) && day >= dayKeyIn(-7, time, zone) && day <= dayKeyIn(90, time, zone)) && 'range',
    rest: typeof rest !== 'boolean' && 'required',
  })
  if (rest) await db.restDay.createMany({ data: [{ childId: child.id, day }], skipDuplicates: true })
  else await db.restDay.deleteMany({ where: { childId: child.id, day } })
  res.json(await recentDays(req, child.id))
})
