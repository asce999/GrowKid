import { zoneOf } from './countries.js'
import { STICKERS } from './scoring.js'

/** K10: a stored badge, "<colour>:<stickerId>", as the screens draw it: the colour and the sticker's shape and kind. Left out when none. */
export const avatarOf = (stored) => {
  const [colour, id] = (stored ?? '').split(':')
  const sticker = STICKERS.find((s) => s.id === id)
  return sticker ? { colour, stickerId: id, shape: sticker.shape, kind: sticker.kind } : undefined
}

/** Rows to API shapes (plan section 6): an optional field is left out, never null, and a hash or tokenVersion never leaves. */

/**
 * A User as index.js documents it. P13: zone is the family's time zone, so the screens count days as the server does (rule 25): a
 * parent's from their country, a child's from their parent's (read with the parent's country). A moderator has none.
 */
export const asUser = ({ id, role, name, email, username, country, parent, avatar, sound }) => ({
  id, role, name, email: email ?? undefined, username: username ?? undefined, zone: zoneOf(country ?? parent?.country),
  avatar: avatarOf(avatar), sound: role === 'child' ? sound : undefined, // K10, K11: a child's
})

/** A Child as index.js documents it. K7: agreedAt only once the child has agreed. */
export const asChild = ({ id, name, username, agreedAt, avatar }) => ({ id, name, username, agreedAt: agreedAt?.toISOString(), avatar: avatarOf(avatar) })

/** K6: a Suggestion row as index.js documents it, read with its child's name. */
export const asSuggestion = (row) => ({ id: row.id, childId: row.childId, childName: row.child.name, ideaId: row.ideaId, createdAt: row.createdAt.toISOString() })

/** The review on a Proof row, as index.js's Review: present only once the parent has answered. A cheer with no kind and no line is not one. */
const asReview = (p) => ({
  result: p.result,
  note: p.reviewNote,
  by: p.reviewBy,
  at: p.reviewedAt.toISOString(),
  cheer: p.cheerKind || p.cheerLine ? { kind: p.cheerKind, line: p.cheerLine } : undefined,
})

/**
 * A Proof row as index.js's Proof. fileUrl only when `files` is set (getTask, sendProof and the review answer: section 6), and
 * never once the file is removed for age (T4). `approvedAt` is when its task was approved, for how many days it was kept.
 */
export const asProof = (p, files, approvedAt) => ({
  id: p.id,
  note: p.note,
  fileUrl: files && p.fileType && !p.removedAt ? `/api/proofs/${p.id}/file` : undefined,
  removed: p.removedAt ? { at: p.removedAt.toISOString(), afterDays: approvedAt ? Math.floor((p.removedAt - approvedAt) / 86_400_000) : undefined } : undefined, // T4
  fileName: p.fileName ?? undefined,
  fileType: p.fileType ?? undefined,
  fileSize: p.fileSize ?? undefined,
  sentAt: p.sentAt.toISOString(),
  late: p.late,
  review: p.result ? asReview(p) : undefined,
})

/** A Task row read with `taskWith` (its child's name and its proofs, oldest first) as index.js's Task. */
export const asTask = (row, { files = false } = {}) => {
  const approvedAt = row.proofs.find((proof) => proof.result === 'approved')?.reviewedAt // T4: what a removed file's days count from
  return {
    id: row.id,
    childId: row.childId,
    childName: row.child.name,
    category: row.category,
    title: row.title,
    instructions: row.instructions,
    dueAt: row.dueAt.toISOString(),
    points: row.points,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    doneLooksLike: row.doneLooksLike ?? '', // H5
    seriesId: row.seriesId ?? undefined, // H2: made by a repeating series
    proofs: row.proofs.map((proof) => asProof(proof, files, approvedAt)),
    resultSeen: row.resultSeen,
    pinned: row.pinned,
  }
}

/** A Reward as index.js documents it. */
export const asReward = ({ id, title, cost }) => ({ id, title, cost })

/** A RewardRequest row read with its child's name (`include: { child: { select: { name: true } } }`): without the parent's id. */
export const asRequest = (row) => ({
  id: row.id,
  childId: row.childId,
  childName: row.child.name,
  rewardId: row.rewardId,
  title: row.title,
  cost: row.cost,
  status: row.status,
  note: row.note,
  requestedAt: row.requestedAt.toISOString(),
  answer: row.answeredAt ? { by: row.answeredBy, at: row.answeredAt.toISOString() } : undefined,
})

/**
 * What a report keeps of the task it was sent from, copied at that moment so that a later edit or delete cannot change what was
 * reported. Words only: the task as the parent wrote it and the notes the parent sent proof back with. Never a
 * proof file, a child's note, an id or anybody's name. Takes a task as asTask gives it.
 */
export const itemOf = (task) => ({
  title: task.title,
  instructions: task.instructions,
  dueAt: task.dueAt,
  points: task.points,
  notes: task.proofs.filter((p) => p.review?.note).map((p) => p.review.note),
  proofs: task.proofs.length,
})

/**
 * A Report row as index.js documents it (rule 15). It never says who sent it, so byId never leaves (rule 16). For the moderator, a
 * kept report whose sender was deleted says so with senderGone (A11): nobody is left to read an answer to it. T2: for the moderator,
 * read with the sender's and their parent's pausedAt, it says whether the sender's family is paused: only that yes or no leaves,
 * never who.
 */
export const asReport = (row, { moderator = false } = {}) => ({
  id: row.id,
  from: row.from,
  details: row.details,
  sentAt: row.sentAt.toISOString(),
  item: row.item ?? undefined,
  resolution: row.resolvedAt ? { note: row.resolutionNote, at: row.resolvedAt.toISOString() } : undefined,
  senderGone: moderator && row.byId === null ? true : undefined,
  paused: moderator && (row.by?.pausedAt || row.by?.parent?.pausedAt) ? true : undefined,
})
