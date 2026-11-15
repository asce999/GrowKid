// `npm run check`: P5's reload rule. Once, then not again within a minute, then again later; never with storage blocked.
import assert from 'node:assert/strict'
import { mayReloadOnce } from './reload.js'

const store = new Map()
globalThis.sessionStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
const t = 1_800_000_000_000
assert.equal(mayReloadOnce(t), true) // the first failure reloads
assert.equal(mayReloadOnce(t + 5_000), false) // the reload failed too: the crash screen, not a loop
assert.equal(mayReloadOnce(t + 61_000), true) // a failure long after (another update) may reload again

globalThis.sessionStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
}
assert.equal(mayReloadOnce(t), false) // blocked storage cannot remember, so it never reloads
console.log('reload rule holds')
