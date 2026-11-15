// `npm run check:size` (final plan section 3, the size budget; sitemap rule 28, P5): fails when a built file in dist/assets is over
// its budget. Run after `npm run build`. The budget is 200 kB for every file except React DOM, one library file that cannot be split
// (218 kB in November 2026): it has its own cap, so a jump there still fails (the user's decision of 15 November 2026).
import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const KB = 1000
const BUDGET = 200 * KB
const REACT_DOM_CAP = 230 * KB
const dir = fileURLToPath(new URL('../dist/assets', import.meta.url))

const over = []
for (const name of readdirSync(dir)) {
  if (!/\.(js|css)$/.test(name)) continue // fonts and images are not code
  const size = statSync(path.join(dir, name)).size
  const cap = name.startsWith('react-dom-') ? REACT_DOM_CAP : BUDGET
  if (size > cap) over.push(`${name}: ${(size / KB).toFixed(1)} kB, over ${cap / KB} kB`)
}
if (over.length) {
  console.error(`Over the size budget:\n${over.join('\n')}`)
  process.exit(1)
}
console.log('every file is within its budget')
