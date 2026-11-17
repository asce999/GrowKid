import { now } from './clock.js'

/**
 * C6, T2: pauses or unpauses the family of a report's sender: the parent and every child together, and every device they are signed
 * in on is signed out. Nothing else changes. `client` is db or a transaction. Returns why it could not, or null when it did:
 * 'no-report', 'sender-gone' or 'moderator'. Only rows not yet in that state change, so unpausing a family that is not paused
 * (a page out of date) signs nobody out, and pausing again keeps the time it was first paused.
 */
export async function setPaused(client, reportId, pause) {
  const report = await client.report.findUnique({ where: { id: reportId }, include: { by: { select: { id: true, role: true, parentId: true } } } })
  if (!report) return 'no-report'
  if (!report.by) return 'sender-gone'
  if (report.by.role === 'moderator') return 'moderator'
  const parentId = report.by.role === 'parent' ? report.by.id : report.by.parentId
  await client.user.updateMany({
    where: { OR: [{ id: parentId }, { parentId }], pausedAt: pause ? null : { not: null } },
    data: { pausedAt: pause ? now() : null, tokenVersion: { increment: 1 } },
  })
  return null
}
