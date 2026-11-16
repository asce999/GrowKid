import assert from 'node:assert/strict'
import { STAGES, plantOf, plantText } from './plant.js'

assert.equal(STAGES.length, 10)
assert.deepEqual(plantOf(1), { stage: 1, name: 'Seed', rings: 0, next: 'Sprout' })
assert.deepEqual(plantOf(10), { stage: 10, name: 'Big tree', rings: 0, next: null })
assert.deepEqual(plantOf(13), { stage: 10, name: 'Big tree', rings: 3, next: null })
assert.equal(plantText(3), 'Level 3: Seedling')
assert.equal(plantText(11), 'Level 11: Big tree, 1 ring')
assert.equal(plantText(12), 'Level 12: Big tree, 2 rings')
console.log('plant stages hold')
