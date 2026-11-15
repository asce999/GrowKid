// `npm run check`: H13, the task ideas. Sixty, ten per category, two age bands, every field within the task rules, and no word the
// server screens for (rule 8: server/src/rules.js BLOCKED_WORDS, matched as whole words after NFKC and lower case).
import assert from 'node:assert/strict'
import { CATEGORIES } from './categories.js'
import { AGES, IDEAS } from './ideas.js'

const BLOCKED = ['secret', 'dare', "don't tell"] // keep in step with server/src/rules.js
const plain = (words) => words.normalize('NFKC').toLowerCase().replaceAll('’', "'")
const hits = (word, text) => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{M}\\p{N}])`, 'u').test(plain(text))

assert.equal(IDEAS.length, 60)
assert.equal(new Set(IDEAS.map((i) => i.id)).size, 60)
for (const { id } of CATEGORIES) assert.equal(IDEAS.filter((i) => i.category === id).length, 10, id)
for (const i of IDEAS) {
  assert.ok(Object.hasOwn(AGES, i.ages), i.id)
  assert.ok(i.title.trim().length >= 3 && i.title.length <= 80, i.id)
  assert.ok(i.instructions.trim() && i.instructions.length <= 500, i.id)
  assert.ok(i.doneLooksLike.length <= 200, i.id)
  assert.ok(Number.isInteger(i.points) && i.points >= 5 && i.points <= 100 && i.points % 5 === 0, i.id)
  for (const word of BLOCKED) assert.equal(hits(word, `${i.title} ${i.instructions} ${i.doneLooksLike}`), false, `${i.id} uses "${word}"`)
}
console.log('task ideas hold')
