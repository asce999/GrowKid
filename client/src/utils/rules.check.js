import assert from 'node:assert/strict'
import { rules } from './rules.js'

// Phase 7, item 2: the reward and quest forms answer before sending, as the server would (rules 18 and 19).
assert.ok(rules.rewardCost('')) // empty is not 0
assert.ok(rules.rewardCost('15'))
assert.ok(rules.rewardCost('1010'))
assert.equal(rules.rewardCost('20'), null)
assert.equal(rules.rewardTitle('  Ice cream '), null)
assert.ok(rules.rewardTitle('ab'))
assert.ok(rules.questTarget('1'))
assert.equal(rules.questTarget('20'), null)
assert.ok(rules.questBonus('12'))
assert.equal(rules.questBonus('15'), null)
assert.ok(rules.questSurprise('x'.repeat(81)))
assert.equal(rules.questSurprise(''), null)
console.log('form rules hold')
