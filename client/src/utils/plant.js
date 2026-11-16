/** K9: the plant's ten stages, one per level, seed to tree. Past level 10 it stays the last and counts a ring a level. */
export const STAGES = ['Seed', 'Sprout', 'Seedling', 'Young plant', 'Leafy plant', 'Bush', 'Sapling', 'Young tree', 'Tall tree', 'Big tree']

/** The plant for a level: its stage (1 to 10), the stage's name, the rings past level 10, and the next stage's name (null at the last). */
export function plantOf(level) {
  const stage = Math.min(Math.max(1, level), STAGES.length)
  return { stage, name: STAGES[stage - 1], rings: Math.max(0, level - STAGES.length), next: STAGES[stage] ?? null }
}

/** "Level 3: Seedling", "Level 12: Big tree, 2 rings". */
export function plantText(level) {
  const { name, rings } = plantOf(level)
  return `Level ${level}: ${name}${rings ? `, ${rings} ${rings === 1 ? 'ring' : 'rings'}` : ''}`
}
