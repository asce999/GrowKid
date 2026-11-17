import assert from 'node:assert/strict'
import { test } from 'node:test'
import { base32, codeAt, stepAt, stepOf, unbase32 } from '../src/totp.js'

/** T1: the moderator's authenticator codes, checked against the RFCs' own vectors. No server. */

test('T1: base32 round-trips the RFC 4648 vectors, and a letter outside the alphabet is refused', () => {
  for (const [plain, coded] of [['', ''], ['f', 'MY'], ['fo', 'MZXQ'], ['foo', 'MZXW6'], ['foob', 'MZXW6YQ'], ['fooba', 'MZXW6YTB'], ['foobar', 'MZXW6YTBOI']]) {
    assert.equal(base32(Buffer.from(plain)), coded, plain)
    assert.equal(unbase32(coded).toString(), plain, coded)
  }
  assert.equal(unbase32('abc'), null)
  assert.equal(base32(Buffer.alloc(20, 7)).length, 32)
  assert.equal(base32(Buffer.alloc(10, 7)).length, 16)
})

test('T1: codeAt gives the RFC 6238 SHA-1 codes', () => {
  const secret = base32(Buffer.from('12345678901234567890'))
  for (const [seconds, code] of [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']]) {
    assert.equal(codeAt(secret, Math.floor(seconds / 30)), code, String(seconds))
  }
})

test('T1: stepOf takes this step and one either side, never a used one, and only six digits', () => {
  const secret = base32(Buffer.from('12345678901234567890'))
  const ms = 1_700_000_000_000
  const s = stepAt(ms)
  for (const step of [s - 1, s, s + 1]) assert.equal(stepOf(secret, codeAt(secret, step), null, ms), step)
  assert.equal(stepOf(secret, codeAt(secret, s - 2), null, ms), null)
  assert.equal(stepOf(secret, codeAt(secret, s), s, ms), null) // used already
  assert.equal(stepOf(secret, codeAt(secret, s), s - 1, ms), s)
  const code = codeAt(secret, s)
  assert.equal(stepOf(secret, `${code.slice(0, 3)} ${code.slice(3)}`, null, ms), s) // spaces inside do not matter
  for (const typed of ['12345', '1234567', 'abcdef', '', undefined, 123456]) assert.equal(stepOf(secret, typed, null, ms), null, String(typed))
  assert.equal(stepOf(null, code, null, ms), null)
})
