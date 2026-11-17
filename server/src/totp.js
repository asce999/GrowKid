import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** T1: time-based one-time codes (RFC 6238: SHA-1, 30-second steps, 6 digits), and the base32 (RFC 4648, no padding) a secret is written in. */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Bytes as base32: 20 bytes are 32 characters, 10 bytes are 16. */
export function base32(bytes) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
    value &= (1 << bits) - 1
  }
  return bits ? out + ALPHABET[(value << (5 - bits)) & 31] : out
}

/** Base32 as bytes, or null when a character is not in the alphabet. */
export function unbase32(text) {
  let bits = 0
  let value = 0
  const out = []
  for (const letter of text) {
    const index = ALPHABET.indexOf(letter)
    if (index < 0) return null
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
    value &= (1 << bits) - 1
  }
  return Buffer.from(out)
}

const STEP_MS = 30_000
/** The 30-second step a moment falls in. The real clock: an authenticator app knows nothing of the development clock. */
export const stepAt = (ms = Date.now()) => Math.floor(ms / STEP_MS)

/** The six digits for one step. */
export function codeAt(secret, step) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const mac = createHmac('sha1', unbase32(secret)).update(counter).digest()
  const at = mac[19] & 15
  return String((mac.readUInt32BE(at) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

/**
 * The step a typed code belongs to, or null. This step and one either side count, so a clock half a minute out still works; a step
 * at or before `lastStep` never does, so a code cannot be used twice. All three are compared, whichever matches.
 */
export function stepOf(secret, typed, lastStep, ms = Date.now()) {
  const code = typeof typed === 'string' ? typed.replace(/\s/g, '') : ''
  if (!secret || !/^\d{6}$/.test(code)) return null
  const now = stepAt(ms)
  let found = null
  for (const step of [now - 1, now, now + 1]) {
    if (step > (lastStep ?? -1) && timingSafeEqual(Buffer.from(code), Buffer.from(codeAt(secret, step))) && found === null) found = step
  }
  return found
}

/** A new secret: 20 random bytes, as 32 base32 characters. */
export const newSecret = () => base32(randomBytes(20))
