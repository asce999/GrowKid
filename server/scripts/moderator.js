// `npm run moderator`: creates, updates or removes a moderator account (A4, T1). Moderators are never made through sign-up.
// MODERATOR_EMAIL and MODERATOR_PASSWORD come from the environment, never from argv: a command line is visible to other users on the
// machine and kept in shell history. MODERATOR_TOTP=new makes a new authenticator secret; MODERATOR_REMOVE=1 removes the moderator
// with that address and needs no password. Line 1 is "created", "updated" or "removed". When a secret is made (a new moderator, one
// that has none yet, or MODERATOR_TOTP=new), line 2 is its otpauth:// link for an authenticator app. The link is shown this once only.
import { hash } from '../src/auth.js'
import { now } from '../src/clock.js'
import { db } from '../src/db.js'
import { newSecret } from '../src/totp.js'

const email = (process.env.MODERATOR_EMAIL ?? '').trim().toLowerCase()
const password = process.env.MODERATOR_PASSWORD ?? ''
const totp = process.env.MODERATOR_TOTP ?? ''
const remove = process.env.MODERATOR_REMOVE === '1'
const problems = [
  !(email.length <= 254 && /^\S+@\S+\.\S+$/.test(email)) && 'MODERATOR_EMAIL must be an email address',
  !['', 'new'].includes(totp) && 'MODERATOR_TOTP must be new or left out',
  // 20, not a parent's 8: a moderator's answer reaches the child who sent the report, so this password is a way to write to children.
  // Removing needs none.
  !remove && (password.length < 20 || Buffer.byteLength(password) > 72) && 'MODERATOR_PASSWORD must be at least 20 characters and at most 72 bytes',
].filter(Boolean)

if (problems.length) {
  console.error(`moderator: ${problems.join('; ')}`)
  process.exitCode = 1
} else {
  try {
    const existing = await db.user.findUnique({ where: { email } })
    if (remove) {
      if (existing?.role === 'moderator') {
        await db.user.delete({ where: { id: existing.id } })
        console.log('removed')
      } else {
        console.error('moderator: no moderator has that address')
        process.exitCode = 1
      }
    } else if (existing && existing.role !== 'moderator') {
      console.error('moderator: that address belongs to another kind of account')
      process.exitCode = 1
    } else {
      const passwordHash = await hash(password)
      // T1: a new moderator, and an older one with no secret yet, are always enrolled; MODERATOR_TOTP=new replaces a secret
      const secret = !existing?.totpSecret || totp === 'new' ? newSecret() : null
      const enrol = secret ? { totpSecret: secret, totpLastStep: null } : {}
      // a changed password signs the moderator out everywhere (A2)
      if (existing) await db.user.update({ where: { id: existing.id }, data: { passwordHash, tokenVersion: { increment: 1 }, ...enrol } })
      else await db.user.create({ data: { role: 'moderator', name: 'Moderator', email, passwordHash, createdAt: now(), ...enrol } })
      console.log(existing ? 'updated' : 'created')
      if (secret) console.log(`otpauth://totp/GrowKid:${encodeURIComponent(email)}?secret=${secret}&issuer=GrowKid&algorithm=SHA1&digits=6&period=30`)
    }
  } catch (error) {
    console.error('moderator: failed (%s)', error.code ?? error.name) // never the error itself: it can carry the connection string
    process.exitCode = 1
  } finally {
    await db.$disconnect()
  }
}
