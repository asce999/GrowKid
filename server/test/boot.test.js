import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const entry = fileURLToPath(new URL('../src/index.js', import.meta.url))
const boot = (changes) => spawnSync(process.execPath, [entry], { env: { ...process.env, ...changes }, encoding: 'utf8', timeout: 20_000 })

// Each case must exit 1 AND name its own variable, so a crash for another reason cannot pass.
const broken = [
  ['NODE_ENV unset', { NODE_ENV: undefined }, 'NODE_ENV'],
  ['NODE_ENV not one of the three', { NODE_ENV: 'staging' }, 'NODE_ENV'],
  ['DATABASE_URL unset', { DATABASE_URL: undefined }, 'DATABASE_URL'],
  ['JWT_SECRET unset', { JWT_SECRET: undefined }, 'JWT_SECRET'],
  ['JWT_SECRET under 32 characters', { JWT_SECRET: 'x'.repeat(31) }, 'JWT_SECRET'],
  ['TZ unset', { TZ: undefined }, 'TZ'],
  ['TZ not a real zone', { TZ: 'Nowhere/Nothing' }, 'TZ'],
  ['PORT unset', { PORT: undefined }, 'PORT'],
  ['PORT not a number', { PORT: 'abc' }, 'PORT'],
  ['UPLOAD_DIR unset', { UPLOAD_DIR: undefined }, 'UPLOAD_DIR'],
  ['UPLOAD_DIR relative', { UPLOAD_DIR: 'uploads' }, 'UPLOAD_DIR'],
]
for (const [name, changes, variable] of broken) {
  test(`boot exits 1 with ${name}`, () => {
    const run = boot(changes)
    assert.equal(run.status, 1)
    assert.match(run.stderr, new RegExp(variable))
  })
}

test('boot succeeds with a good environment (control for the cases above)', { timeout: 20_000 }, async () => {
  const child = spawn(process.execPath, [entry], { env: { ...process.env, PORT: '0' } })
  let out = ''
  const listening = new Promise((done, fail) => {
    child.stdout.on('data', (chunk) => /listening on 127\.0\.0\.1:\d+/.test((out += chunk)) && done())
    child.on('exit', (code) => fail(new Error(`exited with ${code}`)))
  })
  try {
    await listening
  } finally {
    child.kill()
  }
})

test('A1: TZ from the env file takes effect (Asia/Kolkata is UTC+5:30)', () => {
  assert.equal(new Date(2026, 5, 1).getTimezoneOffset(), -330)
})
