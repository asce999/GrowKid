// `npm run verify`: every check that defines done, in one command. One line per check, the output of a failed check only, and a
// non-zero exit on any failure. `--quick` skips the two slow ones: the server tests and the end-to-end test.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const quick = process.argv.includes('--quick')

/** Runs an npm script in client/ or server/. Resolves to the output when it failed, and to nothing when it passed. */
const npm = (dir, script) => () => {
  // shell: npm is npm.cmd on Windows, which spawn cannot start directly. Both arguments are fixed strings from the list below.
  const run = spawnSync(`npm run ${script}`, { cwd: path.join(root, dir), shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return run.status === 0 ? null : `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? run.error.message : ''}`.trim() || `exit ${run.status}`
}

/** The data boundary: `pattern` may appear in client/src only inside client/src/api/. Resolves to the lines that break it. */
const boundary = (pattern) => () => {
  const src = path.join(root, 'client', 'src')
  const found = []
  for (const entry of readdirSync(src, { recursive: true, withFileTypes: true })) {
    const file = path.join(entry.parentPath, entry.name)
    const inside = path.relative(src, file).split(path.sep)
    if (!entry.isFile() || inside[0] === 'api' || !/\.(js|jsx)$/.test(entry.name)) continue
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (pattern.test(line)) found.push(`client/src/${inside.join('/')}:${i + 1}: ${line.trim()}`)
    })
  }
  return found.length ? found.join('\n') : null
}

const has = (...parts) => existsSync(path.join(root, ...parts))

// [name, check, whether it runs]. A check that a later phase adds joins the list once its file exists.
const checks = [
  ['server lint', npm('server', 'lint'), true],
  ['server tests', npm('server', 'test'), !quick],
  ['client lint', npm('client', 'lint'), true],
  ['client check', npm('client', 'check'), true],
  ['client build', npm('client', 'build'), true],
  ['client size', npm('client', 'check:size'), has('client', 'scripts', 'size-check.js')],
  ['end-to-end', npm('client', 'e2e'), !quick && has('client', 'playwright.config.js')],
  ['boundary: browser storage only in client/src/api', boundary(/localStorage|sessionStorage|indexedDB/), true],
  ['boundary: axios only in client/src/api', boundary(/from ['"]axios['"]/), true],
]

let failed = 0
for (const [name, check, runs] of checks) {
  if (!runs) {
    console.log(`skip  ${name}`)
    continue
  }
  const started = Date.now()
  const output = check()
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  if (output === null) {
    console.log(`ok    ${name} (${seconds} s)`)
  } else {
    failed += 1
    console.log(`FAIL  ${name} (${seconds} s)\n${output}\n`)
  }
}
console.log(failed ? `\n${failed} of the checks failed` : '\nEvery check passed')
process.exitCode = failed ? 1 : 0
