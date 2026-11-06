// `npm run moderator`: creates or updates the moderator account (A4). Moderators are never made through sign-up.
// MODERATOR_EMAIL and MODERATOR_PASSWORD come from the environment, never from argv: a command line is visible to other users on the
// machine and kept in shell history. It prints only "created" or "updated".
import { hash } from '../src/auth.js'
import { now } from '../src/clock.js'
import { db } from '../src/db.js'

const email = (process.env.MODERATOR_EMAIL ?? '').trim().toLowerCase()
const password = process.env.MODERATOR_PASSWORD ?? ''
const problems = [
  !(email.length <= 254 && /^\S+@\S+\.\S+$/.test(email)) && 'MODERATOR_EMAIL must be an email address',
  (password.length < 12 || Buffer.byteLength(password) > 72) && 'MODERATOR_PASSWORD must be at least 12 characters and at most 72 bytes',
].filter(Boolean)

if (problems.length) {
  console.error(`moderator: ${problems.join('; ')}`)
  process.exitCode = 1
} else {
  try {
    const existing = await db.user.findUnique({ where: { email } })
    if (existing && existing.role !== 'moderator') {
      console.error('moderator: that address belongs to another kind of account')
      process.exitCode = 1
    } else {
      const passwordHash = await hash(password)
      // a changed password signs the moderator out everywhere (A2)
      if (existing) await db.user.update({ where: { id: existing.id }, data: { passwordHash, tokenVersion: { increment: 1 } } })
      else await db.user.create({ data: { role: 'moderator', name: 'Moderator', email, passwordHash, createdAt: now() } })
      console.log(existing ? 'updated' : 'created')
    }
  } catch (error) {
    console.error('moderator: failed (%s)', error.code ?? error.name) // never the error itself: it can carry the connection string
    process.exitCode = 1
  } finally {
    await db.$disconnect()
  }
}
