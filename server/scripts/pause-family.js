// `npm run pause-family` (sitemap rule 15, C6): pauses or unpauses the family of a report's sender, for whoever runs this server.
// REPORT_ID and ACTION (pause or unpause) come from the environment, never from argv, as in moderator.js. The parent and every child
// are paused together, and their tokenVersion moves, so every device they are signed in on is signed out at once. Nothing else
// changes: their tasks, proofs and files stay as evidence until a person decides. It prints only "paused" or "unpaused".
import { now } from '../src/clock.js'
import { db } from '../src/db.js'

const reportId = (process.env.REPORT_ID ?? '').trim()
const action = process.env.ACTION ?? ''

if (!reportId || !['pause', 'unpause'].includes(action)) {
  console.error('pause-family: set REPORT_ID to a report id and ACTION to pause or unpause')
  process.exitCode = 1
} else {
  try {
    const report = await db.report.findUnique({ where: { id: reportId }, include: { by: { select: { id: true, role: true, parentId: true } } } })
    const problem = !report ? 'no report has that id' : !report.by ? 'the sender of that report has been deleted' : report.by.role === 'moderator' ? 'a moderator sent that report' : null
    if (problem) {
      console.error(`pause-family: ${problem}`)
      process.exitCode = 1
    } else {
      const parentId = report.by.role === 'parent' ? report.by.id : report.by.parentId
      await db.user.updateMany({
        where: { OR: [{ id: parentId }, { parentId }] },
        data: { pausedAt: action === 'pause' ? now() : null, tokenVersion: { increment: 1 } },
      })
      console.log(action === 'pause' ? 'paused' : 'unpaused')
    }
  } catch (error) {
    console.error('pause-family: failed (%s)', error.code ?? error.name) // never the error itself: it can carry the connection string
    process.exitCode = 1
  } finally {
    await db.$disconnect()
  }
}
