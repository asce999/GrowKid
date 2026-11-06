/** Rows to API shapes (plan section 6): an optional field is left out, never null, and a hash or tokenVersion never leaves. */

/** A User as index.js documents it. */
export const asUser = ({ id, role, name, email, username }) => ({
  id, role, name, email: email ?? undefined, username: username ?? undefined,
})

/** A Child as index.js documents it. */
export const asChild = ({ id, name, username }) => ({ id, name, username })

/** The review on a Proof row, as index.js's Review: present only once the parent has answered. A cheer with no kind and no line is not one. */
const asReview = (p) => ({
  result: p.result,
  note: p.reviewNote,
  by: p.reviewBy,
  at: p.reviewedAt.toISOString(),
  cheer: p.cheerKind || p.cheerLine ? { kind: p.cheerKind, line: p.cheerLine } : undefined,
})

/** A Proof row as index.js's Proof. fileUrl only when `files` is set (getTask, sendProof and the review answer: section 6). */
export const asProof = (p, files) => ({
  id: p.id,
  note: p.note,
  fileUrl: files && p.fileType ? `/api/proofs/${p.id}/file` : undefined,
  fileName: p.fileName ?? undefined,
  fileType: p.fileType ?? undefined,
  fileSize: p.fileSize ?? undefined,
  sentAt: p.sentAt.toISOString(),
  late: p.late,
  review: p.result ? asReview(p) : undefined,
})

/** A Task row read with `taskWith` (its child's name and its proofs, oldest first) as index.js's Task. */
export const asTask = (row, { files = false } = {}) => ({
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
  proofs: row.proofs.map((proof) => asProof(proof, files)),
  resultSeen: row.resultSeen,
  pinned: row.pinned,
})

/** A Reward as index.js documents it. */
export const asReward = ({ id, title, cost }) => ({ id, title, cost })

/** A RewardRequest row read with its child's name (`include: { child: { select: { name: true } } }`): without the parent's id (fake.js:690-693). */
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
 * reported (fake.js:842-849). Words only: the task as the parent wrote it and the notes the parent sent proof back with. Never a
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
 * kept report whose sender was deleted says so with senderGone (A11): nobody is left to read an answer to it.
 */
export const asReport = (row, { moderator = false } = {}) => ({
  id: row.id,
  from: row.from,
  details: row.details,
  sentAt: row.sentAt.toISOString(),
  item: row.item ?? undefined,
  resolution: row.resolvedAt ? { note: row.resolutionNote, at: row.resolvedAt.toISOString() } : undefined,
  senderGone: moderator && row.byId === null ? true : undefined,
})
