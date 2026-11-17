# Phase 9 plan, part 2: Review it, measure it

Written on 17 November 2026 by the second planning session, for the building session. It covers items 3 to 5, then the phase's verify, review, close and report. Part 1 (`phase-9-plan.md`) holds items 1 and 2 and must be built first. This phase has no questions to ask.

## 0. How to use this part

**Start here only from part 1's section 7,** or from a new session. A new session reads `final-plan.md` sections 4 and 5, then sections 0 and 1 of `phase-9-plan.md`, then this file, and does section 2's checks. It does not rerun anything in part 1.

**Read only the top of this file.** The code is in the appendix and is copied by the `x` function of part 1, section 2, step 3, run on this file: `x phase-9-plan-part-2.md <block>`. Open a block only if its run fails.

**The aim.** Items 3 and 4 are reviews of the whole repository; their findings are acted on only by the rules of sections 3 and 4. Item 5 puts numbers beside the earlier ones. A fix is allowed, a feature is not.

**What is settled.** The skills and their arguments, the triage rules, where every finding is written, the measure scripts, and the rows section 1 gains. Use them as written.

**What is proven.** On 17 November the second planning session ran the three scripts against the repository at `a615f6c` (Node 22.23.2). It changed nothing in the repository. The reviews of items 3 and 4 were not run: they are the work of this part.

| What | Outcome on 17 November |
|---|---|
| `count.mjs` (appendix `count`) | Counts by file and the totals; tried on `scoring.test.js` and `totp.test.js`. The full server suite with every part 1 edit, on node's own reporter: 228 of 228 in 485 s. |
| `npx playwright test --list` in `client/` | `Total: 2 tests in 2 files` |
| `local.mjs` (appendix `local`), 19 s | 69 routes (24 + 13 + 22 + 6 + 4); 13 models, 8 enums, 9 migrations; 48 JavaScript files, 664 kB in all; React DOM 218.4 kB; the largest other file the router, 95.6 kB; CSS 57.2 kB. An approval at 2,000 tasks: 237, 224 and 140 ms. The old replay alone, over the same 2,003 tasks: 13,814 ms. |
| `browser.mjs` (appendix `browser`), 97 s | Lighthouse performance 99, 100, 99 and 99, accessibility 100 on each, for Landing, Sign in, Overview and Today. Today's first load asked `/api/session`, `/api/counts` and `/api/today`; one refresh asked `/api/counts` and `/api/today`. The photo drawn at 13.1 MB went up as 163 kB, a JPEG of 1600 × 1200. The throwaway family was deleted. |
| The reviewer brief (appendix `reviewer`) | Written, not run: it needs the phase diff. |

**Report only what you ran.** Every number that goes into `final-plan.md` is one you produced in this session, with the command that produced it. Never copy a number from the table above.

**Spend tokens on the work.**
- The reviews return long reports. Read each skill's own summary, not the files its agents leave behind, and open a cited `file:line` only to confirm or drop that finding.
- Write each finding into `final-plan.md` as one line, never as pasted output.
- If the context is heavy after item 3, finish the item, tick it, write the state, and stop at that boundary as `final-plan.md` section 4 says. Item 4 starts the next session.
- No measurement while anything else runs: the tests, a dev server you started for another reason, or a review agent that runs commands. Item 5 times things.
- Never two test commands at once: they share one database.

## 1. Tools: when to use what

| Tool | Use it for | Not for |
|---|---|---|
| `deep-review:deep-review` | Item 3, once, with section 3's arguments. Its agents are its own; item 3 names the skill, so they are allowed besides section 4's two. Pass no model of your own. | A second run. |
| `ponytail:ponytail-audit`, `ponytail:ponytail-debt` | Item 4. | |
| `code-review`, `ponytail:ponytail-review`, `security-review` | Section 7, on the phase diff. | Items 3 and 4. |
| Agent, `model: "opus"`, `effort: "high"` | Section 7: the fresh reviewer, once per round. | |
| Playwright MCP, `impeccable`, `design:ux-copy` | Only if a fix in item 3 or 4 changes a screen or its words: that screen at 360 px and 1280 px, keyboard only, then remove `.playwright-mcp/`. | The measures: `browser.mjs` drives its own browser. |
| `context7` | Only if a fix relies on library behaviour (Express 5, Prisma 6, React 19, Vite 8). | |
| `work_state_write` | Section 8. | |

## 2. Step 0 for a new session

1. `final-plan.md` section 6, Phase 9: items 1 and 2 are ticked. If not, part 1 is not finished: go back to it.
2. `git status --short` lists part 1's work: `server/test/attack.test.js` new, and changed `server/test/security.test.js`, `server/test/rules.test.js`, `server/test/boot.test.js`, `server/src/index.js`, `server/src/routes/family.js`, `server/src/routes/tasks.js`, `scripts/verify.mjs`, `Documentation/FRONTEND-SITEMAP.md` and `final-plan.md`. If any is missing, stop and report.
3. `npm run verify:quick` from the repo root. It must pass.

## 3. Item 3. `/deep-review` over the whole repository

**Run it once.** Skill tool, skill `deep-review:deep-review`, with exactly these arguments:

```text
code errors security pii concurrency perf a11y tests ts-frontend ts-backend sql server/src server/prisma server/scripts server/test client/src client/scripts client/e2e scripts
```

Why these. `code`, `errors`, `security`, `pii`, `concurrency`, `perf`, `a11y` and `tests` are the risks GrowKid has: children's data, races, speed, accessibility, coverage. `ts-frontend` and `ts-backend` cover React and Express, although the code is JavaScript. `sql` covers Prisma and the three `$queryRaw` row locks (`db.js:9`, `account.js:232`, `tasks.js:119`). Left out: `arch` (five agents, for about 20,000 lines in two folders), `types` (no TypeScript), `comments`, `l10n` (English only; Hindi is parked), `simplify` (item 4) and `review` (no pull requests).

The paths make it a path review: there is no diff, so the skill marks every finding `[PRE-EXISTING]`. That is expected, and Phase 9 owns them all. `Documentation/`, the plan files, `node_modules`, `dist` and the lock files are outside the paths on purpose.

**Triage, finding by finding, in the skill's order.**
1. Open the cited `file:line` and confirm the failure happens in the code as it is now. If it does not, it is dropped: count it, with one line on why, for the report.
2. If it is already accepted (part 1, section 6's "Accepted" list, or `final-plan.md` sections 3 and 7), it is "accepted already": no action. If it argues against a standing decision of section 3, ask the user with `AskUserQuestion`, as section 4 says.
3. Rate it on `final-plan.md`'s scale, not the skill's label. **High:** it exposes or loses children's data, lets one family reach another, or stops the loop (set a task, send proof, approve, reward) for a family. **Medium:** it weakens a defence that exists, or gives a wrong result that a user can recover from. **Low:** everything else.
4. **High: fix it now.** Make the smallest root-cause fix in the shared path. Write a test that fails without the fix: run it once before the fix, and say so in the report. Then run `npm run verify:quick`. If the fix needs a new feature, a dependency, a schema change or a new rule, stop and ask.
5. **Medium and low: no fix.** List it.

**Where it is written.** Under item 3 in `final-plan.md` section 6, indented under the item and in this form:

```markdown
   From `/deep-review` on <date>: <n> findings, <n> confirmed, <n> dropped, <n> accepted already.
   - **fixed, high** `server/src/x.js:12`: what failed, in one sentence. Test: `<file>`, `<test name>`.
   - **medium** `client/src/pages/X.jsx:40`: what fails, in one sentence. Belongs to Phase 5, item 3.
   - **low** `server/src/files.js` (4): the kinds, in a few words. No item.
```

Every medium gets its own line. Lows are one line per file, with their count. "Belongs to" names the `final-plan.md` item whose work the finding is about, or says "No item". Nothing is written under the other phases' items: section 4 moves nothing.

## 4. Item 4. The ponytail audit and the shortcut ledger

### 4.1 `ponytail:ponytail-audit`

Skill tool, skill `ponytail:ponytail-audit`, with the arguments `server/src server/scripts server/prisma client/src client/scripts scripts; skip node_modules, dist, Documentation and lock files`.

**Act only on `delete:` findings, and only on verified ones.** For each, Grep the name across `client/src`, `client/e2e`, `client/scripts`, `server/src`, `server/test`, `server/scripts`, `server/prisma`, `scripts`, `.github` and both `package.json` files. If nothing outside its own definition uses it, delete it. If anything does, keep it and list it.

**Never delete,** whatever the audit says: input validation, error handling, a security measure, an accessibility feature, a development switch (`?dev=`, `?clock=`, `DEV_CLOCK`), anything a test or a check imports, `stickers()` in `scoring.js` (the seed and `tasks.test.js` call it), the demo seed, or anything that `DESIGN.md` section 18 or the sitemap says exists. A dependency goes only when no file imports it and no npm script, config file or `.github/workflows/ci.yml` names it. Remove it with `npm uninstall <name>` in its folder.

**`stdlib:`, `native:`, `yagni:` and `shrink:` findings are not applied:** each rewrites working code in a phase that builds nothing. List them.

After the deletions, run `npm run verify:quick`. Lint finds an import left behind.

Write under item 4 in `final-plan.md`, indented like item 3's list: the audit's `net:` line; one line per deletion (`file`, what, lines removed); and one line per finding not applied (tag, `file`, what, and why it was kept).

### 4.2 `ponytail:ponytail-debt`

Skill tool, skill `ponytail:ponytail-debt`. Its own Grep pattern, `(#|//) ?ponytail:`, misses markers inside block comments (` * ponytail:`) and after other words on the line (`auth.js:7`). So give it this list instead, which finds all of them:

```bash
grep -rn "ponytail:" --include=*.js --include=*.jsx --include=*.mjs --include=*.css --include=*.prisma --include=*.yml --exclude-dir=node_modules --exclude-dir=dist .
```

On 17 November it found 16 markers, at `a615f6c`; the skill's own pattern finds 7 of them. Part 1 adds one, in `tasks.js`, so expect 17, fewer if item 4.1 deleted a marked line.

Put the ledger into `final-plan.md` under item 4, after 4.1's lines: a line `Shortcut ledger: <n> markers, <m> with no trigger.`, then one line per marker in the skill's form, `` `file:line`, what was simplified. ceiling: … upgrade: … ``. Mark a `no-trigger` row as such. Do not edit a marker's comment to give it one.

## 5. Item 5. Measure

**Order.** All in one go, after items 3 and 4, with nothing else running. `S` is your session's scratchpad folder.

1. Build the client as it now is: `cd client && npm run build`.
2. Test counts, server and end-to-end:

```bash
x() { tr -d '\r' < "$1" | awk -v m="<!-- extract: $2 -->" '$0==m{f=1;next} f&&/^```/{if(++c==2)exit;next} f&&c==1'; }
x phase-9-plan-part-2.md count > "$S/count.mjs"
(cd server && npm run pretest >/dev/null && node --env-file=.env.test --test --test-concurrency=1 --test-reporter="file:///$(cygpath -m "$S/count.mjs")" "test/*.test.js")
(cd client && npx playwright test --list | tail -1)
```

   The reporter is given as a `file:///` URL: a bare Windows path fails with `ERR_UNSUPPORTED_ESM_URL_SCHEME`. It prints one line per test file, then `tests N, pass N, fail 0, in N s, N files`. A failure prints `FAIL <file>: <test>`: stop and fix it before measuring further. It takes about eight minutes.
3. The measures without a browser: routes, schema, the built files, and the approval at 2,000 tasks with its "before".

```bash
x() { tr -d '\r' < "$1" | awk -v m="<!-- extract: $2 -->" '$0==m{f=1;next} f&&/^```/{if(++c==2)exit;next} f&&c==1'; }
x phase-9-plan-part-2.md local > "$S/local.mjs" && (cd server && node --env-file=.env.test "$S/local.mjs")
```

4. The measures in a browser: Lighthouse on the four screens, Today's calls for one refresh, and what a 12 MB photo goes up as. It starts the server on the development database and `vite preview` unless they already answer, makes one throwaway family through the page (so no cookie is on a command line), and deletes it at the end. Nothing goes anywhere but `127.0.0.1`, except that `npx` may fetch Lighthouse 13.6.0 from the npm registry the first time. Error reporting is off (`--no-enable-error-reporting`). It takes about two minutes.

```bash
x() { tr -d '\r' < "$1" | awk -v m="<!-- extract: $2 -->" '$0==m{f=1;next} f&&/^```/{if(++c==2)exit;next} f&&c==1'; }
x phase-9-plan-part-2.md browser > "$S/browser.mjs" && (cd client && node "$S/browser.mjs" "$S/measure")
```

   It ends with "the throwaway family is deleted" and the lines to record. If it stops before that line, the family is still there: sign in as its parent (the email starts `measure-`, the password is in the script) and delete it from Settings, or rerun the script, which makes a new family; then delete the old one the same way.

**When a number misses its goal** (section 2 of `final-plan.md`: Lighthouse performance 90 or more, every file within budget, the approval under a second): run that script once more. If the second run misses too, it is a finding for the report's "For you". Do not tune anything in this item.

**What goes into `final-plan.md` section 1.** First update the rows that exist from your runs: "Server tests" (count and seconds, from `count.mjs`), "Whole-loop test" (the `--list` count), "Client build", "Server routes" and "Schema" (from `local.mjs`), "Advisories" (part 1's `npm audit`). Leave the Lighthouse row as the baseline. Then add this table under it, headed "Before and after (Phase 9, <date>)", with your numbers in the last column:

| Measure (section 2) | Before | After Phase 9 | From |
|---|---|---|---|
| The largest JavaScript file, React DOM apart | 569 kB, the one file the app had (after Phase 3; 559.37 kB after Phase 1) | | `local.mjs` |
| React DOM | inside that one file | (cap 230 kB) | `local.mjs` |
| A child's task list with 1,000 old approvals | every task the child ever had | the window only: `speed.test.js`, P2 | the test, in `count.mjs`'s run |
| An approval for a child with 2,000 approved tasks | the replay every approval ran until Phase 2's item 10, timed alone on the same tasks: | (the middle of 3) | `local.mjs` |
| Data calls per refresh of Today | 3, each loading the child's whole history (section 1, 15 November) | (the calls of one refresh) | `browser.mjs` |
| What a 12 MB photo goes up as | the file as chosen (before Phase 4's item 10): | (size, type, width × height) | `browser.mjs` |
| Whether a refresh blanks the page | yes: `reload()` started from a skeleton (Phase 4, item 6) | no: a quiet load keeps what is on screen (`client/src/hooks/useLoad.js`); no test measures it | reading the code |
| Lighthouse, mobile: Landing, Sign in, Overview, Today | performance 100 and accessibility 100 on each (15 November) | | `browser.mjs` |
| Server tests | 161 of 161 after Phase 3 (the earliest count in section 1) | | `count.mjs` |
| End-to-end tests | 1 (Phase 1) | | `--list` |

   Fill the "Before" cells that end in a colon from the same run: the replay's time from `local.mjs`, and the drawn photo's size from `browser.mjs`. Today's refresh calls `/api/today` and also `/api/counts`, the count every page shows in the menu: write both, and say which is which.

The other goals of section 2 are held elsewhere, and get no row here: "Secure" by part 1's "Tried in Phase 9" block, UI by the screen checks of Phases 5 to 8, accessibility by the axe run inside the loop test, and "Engaging" by Phase 10's first-week walkthrough.

## 6. Verify

1. `npm run verify` from the repo root, in full. Report a failure with its output.
2. Screens: only those a fix in item 3 or 4 changed, as in section 1.
3. `npm audit` was run in part 1. Run it again only if item 4 removed a dependency.

## 7. Review

The phase diff is everything uncommitted since `a615f6c`, without the two plan files. Write it once, for every reviewer:

```bash
R="$(git rev-parse --show-toplevel)"; cd "$R"
{ git diff HEAD -- . ':!phase-9-plan.md' ':!phase-9-plan-part-2.md'
  git ls-files --others --exclude-standard | grep -v '^phase-9-plan' | while read -r f; do git diff --no-index /dev/null "$f"; done
} > "$S/phase9.diff"; grep -c '^diff --git' "$S/phase9.diff"
```

1. Skill `code-review`, with the arguments: `fixed point HEAD (a615f6c). Phase 9 is not committed, so review the diff in <S>/phase9.diff (git diff HEAD plus the untracked files), not HEAD...HEAD. Spec: final-plan.md section 6, Phase 9, with phase-9-plan.md and phase-9-plan-part-2.md.` Put your scratchpad's path in place of `<S>`.
2. Skill `ponytail:ponytail-review`, on the same diff file.
3. Skill `security-review`: `server/` changed.
4. The fresh reviewer. Write its brief, then make one Agent call:

```bash
x() { tr -d '\r' < "$1" | awk -v m="<!-- extract: $2 -->" '$0==m{f=1;next} f&&/^```/{if(++c==2)exit;next} f&&c==1'; }
x phase-9-plan-part-2.md reviewer > "$S/reviewer.md"
```

   The Agent call takes `description: "Phase 9 fresh review"`, `model: "opus"`, `effort: "high"`, and this prompt, with the repository's Windows path and the two Windows paths of your scratchpad files: `You are the fresh reviewer of GrowKid's Phase 9. The repository is <repo>. Read <reviewer.md> and do what it says. The diff is <phase9.diff>.` It gets nothing else from this session.

Fix what is confirmed, with a test where the fix is to logic, and rerun the reviewer that found it. After two fix-and-recheck rounds, bring what is still open to the user. A high finding cannot be left open: the phase's acceptance says so.

## 8. Close

- `final-plan.md` section 6: tick items 3, 4 and 5 (items 1 and 2 are ticked from part 1). Move nothing.
- `final-plan.md` section 1: section 5's rows and table.
- `final-plan.md` section 2, the "Tried in Phase 9" block of part 1: add any high finding of items 3 and 7 under "Found and fixed", in the same form.
- `README.md`, the line that starts "**Every check in one command.**": "and the two data-boundary checks" becomes "the two data-boundary checks, a check that no page builds HTML from data, and a check that the built app holds no development switch". Nothing else in the README changes.
- `Documentation/FRONTEND-SITEMAP.md` section 12: N1 is in from part 1. An assumption that a fix made gets the next id (N2, N3), in N1's form.
- `Documentation/DESIGN.md` section 18: changes only if a fix changed a screen.
- The memory note `growkid-final-plan`: Phase 9 built (date), uncommitted; F1 and any other fixes; N1 to confirm; next is Phase 10. Then `work_state_write`, list `growkid-final-plan-build`, task "Phase 9. Attack it, measure it", status `done`.
- Remove `.playwright-mcp/` from the repo root if it exists.

## 9. Report

Use `final-plan.md` section 4's format, with these in it:
1. **Done:** items 1 to 5, each with its main `file:line`; the attack tally of part 1 section 6 (tried, held, found and fixed, accepted, not tried); the counts of items 3 and 4.
2. **Checks:** the `npm run verify` summary, and say that no screen changed, or which did and how each was checked.
3. **Reviews:** findings by severity from `/deep-review`, `/code-review`, `/ponytail-review`, `/security-review` and the fresh reviewer; what was fixed; what is open.
4. **For you:** N1 (and any N2 on) to confirm; the "Accepted" list in section 2 of `final-plan.md` to read through; any measure that missed its goal; anything not tried.
5. **Next:** "Phase 10. The university documents." Then: "Commit when ready, then start a new session and say: run the next phase."

Then stop. Do not start Phase 10.

## Appendix: the code, extracted by command

Do not read below this line unless a run fails. Each block is copied by the `x` function.

<!-- extract: count -->
```js
// Final plan Phase 9, item 5. A node:test reporter: how many tests each file holds, and the totals.
// Use: node --test --test-reporter=file:///C:/path/to/this.mjs ...  (a bare Windows path is refused as a URL scheme)
import path from 'node:path'
export default async function* count(source) {
  const files = {}
  const total = { pass: 0, fail: 0 }
  const began = Date.now()
  for await (const { type, data } of source) {
    if ((type !== 'test:pass' && type !== 'test:fail') || data.details?.type === 'suite') continue
    const file = path.basename(data.file ?? 'unknown')
    files[file] ??= { pass: 0, fail: 0 }
    const outcome = type === 'test:pass' ? 'pass' : 'fail'
    files[file][outcome] += 1
    total[outcome] += 1
    if (outcome === 'fail') yield `FAIL ${file}: ${data.name}\n`
  }
  for (const [file, n] of Object.entries(files).sort()) yield `${file}: ${n.pass + n.fail}${n.fail ? ` (${n.fail} failed)` : ''}\n`
  yield `tests ${total.pass + total.fail}, pass ${total.pass}, fail ${total.fail}, in ${Math.round((Date.now() - began) / 1000)} s, ${Object.keys(files).length} files\n`
}
```

<!-- extract: local -->
```js
// Final plan Phase 9, item 5: the measures that need no browser. Run from server/, after `npm run build` in client/, with nothing
// else running (it times an approval):  node --env-file=.env.test <this file>
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const load = (file) => import(pathToFileURL(path.resolve(file)).href) // from server/, wherever this script is kept
const { db, loadChild } = await load('src/db.js')
const { stickers } = await load('src/scoring.js')
const { as, family, start } = await load('test/helpers.js')

// ---- routes, from the routers themselves; sign-out is the one route app.js registers itself
const routers = await Promise.all(['account', 'tasks', 'family', 'reports', 'series'].map(async (name) => Object.values(await load(`src/routes/${name}.js`)).find((made) => Array.isArray(made?.stack))))
const routes = routers.map((router) => router.stack.filter((layer) => layer.route).reduce((n, layer) => n + Object.keys(layer.route.methods).length, 0))
console.log(`routes: ${routes.reduce((a, b) => a + b)} in ${routers.length} routers (account, tasks, family, reports, series: ${routes.join(' + ')}), plus sign-out`)

// ---- schema
const schema = readFileSync('prisma/schema.prisma', 'utf8')
const migrations = readdirSync('prisma/migrations', { withFileTypes: true }).filter((entry) => entry.isDirectory()).length
console.log(`schema: ${schema.match(/^model /gm).length} models, ${schema.match(/^enum /gm).length} enums, ${migrations} migrations`)

// ---- the built client's files
const assets = '../client/dist/assets'
const files = readdirSync(assets).map((name) => ({ name, kB: statSync(path.join(assets, name)).size / 1000 })).sort((a, b) => b.kB - a.kB)
const show = (file) => (file ? `${file.name} ${file.kB.toFixed(1)} kB` : 'none')
const scripts = files.filter((file) => file.name.endsWith('.js'))
console.log(`client: ${scripts.length} JavaScript files, ${scripts.reduce((n, file) => n + file.kB, 0).toFixed(0)} kB in all`)
console.log(`  React DOM: ${show(scripts.find((file) => file.name.startsWith('react-dom-')))}`)
console.log(`  the largest other file: ${show(scripts.find((file) => !file.name.startsWith('react-dom-')))}`)
console.log(`  CSS: ${files.filter((file) => file.name.endsWith('.css')).map(show).join(', ')}`)

// ---- an approval for a child with 2,000 approved tasks: the call alone, three times, on the fixture tasks.test.js builds.
// Then the "before": the replay of every approval that each approval ran until Phase 2's item 10, timed alone on the same tasks.
const DAY = 86_400_000
const server = await start()
const mom = await family(server.base)
try {
  const login = { name: 'Asha', username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1' }
  const child = (await mom.api.post('/children', { ...login, consent: true })).body
  const kid = as(server.base)
  await kid.post('/session', { identifier: login.username, password: login.password })
  const kinds = ['chores', 'study', 'reading', 'creative', 'outdoors', 'health']
  const old = Array.from({ length: 2000 }, (_, i) => ({ id: randomUUID(), at: new Date(Date.now() - (2 + (i % 500)) * DAY - i * 1000), category: kinds[i % 6] }))
  await db.task.createMany({ data: old.map(({ id, at, category }) => ({ id, childId: child.id, category, title: 'Old task', instructions: 'x', dueAt: at, points: 5, status: 'approved', createdAt: at })) })
  await db.proof.createMany({ data: old.map(({ id, at }) => ({ id: randomUUID(), taskId: id, sentAt: at, late: false, result: 'approved', reviewBy: 'Test Parent', reviewedAt: at })) })
  const took = []
  for (let i = 0; i < 3; i++) {
    const task = (await mom.api.post('/tasks', { childId: child.id, category: 'chores', title: 'One more', instructions: 'Floor clear.', dueAt: new Date(Date.now() + 2 * DAY).toISOString(), points: 20 })).body
    const sent = (await kid.form(`/tasks/${task.id}/proofs`, { note: 'Done' })).body
    const began = performance.now()
    const res = await mom.api.post(`/tasks/${task.id}/review`, { proofId: sent.proofs.at(-1).id, result: 'approved' })
    took.push(Math.round(performance.now() - began))
    if (res.status !== 200) throw new Error(`the approval answered ${res.status}`)
  }
  console.log(`an approval after 2,000 approved tasks: ${took.join(', ')} ms; the middle one is ${took.toSorted((a, b) => a - b)[1]} ms`)
  const { tasks } = await loadChild(db, child.id)
  const began = performance.now()
  stickers(tasks, { zone: 'Asia/Kolkata' })
  console.log(`before Phase 2's item 10, the replay alone over the same ${tasks.length} tasks: ${Math.round(performance.now() - began)} ms`)
} finally {
  await mom.api.post('/me/delete', { password: mom.password })
  await server.close()
}
```

<!-- extract: browser -->
```js
// Final plan Phase 9, item 5: Lighthouse on four screens, the calls Today makes for one refresh, and what a 12 MB photo goes up as.
// Run from client/, after `npm run build`:  node <this file> <an empty folder for its files>
// It starts the server (development database) and `vite preview` unless they already answer, makes one throwaway family, and
// deletes it at the end. Nothing is sent anywhere but 127.0.0.1.
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

if (!process.argv[2]) throw new Error('give a folder for the profile and the Lighthouse reports')
const out = path.resolve(process.argv[2])
mkdirSync(out, { recursive: true })
const { chromium } = createRequire(path.resolve('package.json'))('@playwright/test')
const APP = 'http://127.0.0.1:4173'
const DEBUG_PORT = 9333
const PASSWORD = 'grown-up-pass-1'
const email = `measure-${randomUUID()}@example.com`
const username = `m${randomUUID().slice(0, 8)}`

/** Starts `node ...args` in `cwd` unless `url` already answers. Resolves to a function that stops what it started. */
async function up(url, cwd, args) {
  const answers = () => fetch(url).then(() => true, () => false)
  if (await answers()) return () => {}
  const child = spawn(process.execPath, args, { cwd, stdio: 'ignore' })
  for (let i = 0; i < 150 && !(await answers()); i++) await sleep(200)
  if (!(await answers())) {
    child.kill()
    throw new Error(`${url} did not come up`)
  }
  return () => child.kill()
}

/** Runs in the page: draws a 6000 x 4500 picture of soft shapes with a light grain, and gives it to the app's own shrinkPhoto. */
async function photo(grain) {
  const canvas = document.createElement('canvas')
  canvas.width = 6000
  canvas.height = 4500
  const c = canvas.getContext('2d')
  c.fillStyle = '#b8c4a0'
  c.fillRect(0, 0, canvas.width, canvas.height)
  let seed = 7
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647 // the same picture every run
  for (let i = 0; i < 400; i++) {
    c.fillStyle = `hsla(${Math.floor(random() * 360)}, 60%, 55%, 0.35)`
    c.beginPath()
    c.arc(random() * canvas.width, random() * canvas.height, 100 + random() * 700, 0, 7)
    c.fill()
  }
  for (let y = 0; y < canvas.height; y += 500) {
    const band = c.getImageData(0, y, canvas.width, 500)
    for (let i = 0; i < band.data.length; i += 4) {
      const n = (random() - 0.5) * 2 * grain
      band.data[i] += n
      band.data[i + 1] += n
      band.data[i + 2] += n
    }
    c.putImageData(band, 0, y)
  }
  const blob = await new Promise((done) => canvas.toBlob(done, 'image/jpeg', 0.97))
  // eslint-disable-next-line no-undef -- shrinkPhoto is client/src/utils/photo.js, put in front of this function below
  const sent = await shrinkPhoto(new File([blob], 'big.jpg', { type: 'image/jpeg' }))
  const size = await createImageBitmap(sent)
  return { grain, original: blob.size, sent: sent.size, type: sent.type, width: size.width, height: size.height }
}

const results = []
const say = (line) => {
  results.push(line)
  console.log(line)
}
const stopServer = await up('http://127.0.0.1:3000/api/session', path.resolve('../server'), ['--env-file=.env', 'src/index.js'])
const stopClient = await up(APP, path.resolve('.'), ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--strictPort'])
const context = await chromium.launchPersistentContext(path.join(out, 'profile'), { headless: true, channel: 'chromium', args: [`--remote-debugging-port=${DEBUG_PORT}`] })
const page = context.pages()[0] ?? (await context.newPage())
/** A call to the API from inside the page, so the session cookie lives in the browser and never on a command line. */
const api = async (method, url, body, expected) => {
  const status = await page.evaluate(
    async ([method, url, body]) => (await fetch(`/api${url}`, { method, headers: { 'X-GrowKid': '1', 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) })).status,
    [method, url, body],
  )
  if (status !== expected) throw new Error(`${method} ${url} answered ${status}, not ${expected}`)
}
async function lighthouse(name, url) {
  const file = path.join(out, `lighthouse-${name}.json`)
  const command = `npx --yes lighthouse@13.6.0 ${APP}${url} --port=${DEBUG_PORT} --disable-storage-reset --only-categories=performance,accessibility --output=json --output-path="${file}" --quiet --no-enable-error-reporting`
  // spawn, not spawnSync: Playwright must stay free to answer for the tab Lighthouse opens, or it never paints (NO_FCP)
  const code = await new Promise((done) => spawn(command, { shell: true, stdio: 'ignore' }).on('exit', done))
  if (code !== 0) return say(`Lighthouse ${name}: exited with ${code}`)
  const { categories, runtimeError, finalDisplayedUrl } = JSON.parse(readFileSync(file, 'utf8'))
  if (runtimeError) return say(`Lighthouse ${name}: ${runtimeError.code}`)
  say(`Lighthouse ${name} (${new URL(finalDisplayedUrl).pathname}): performance ${Math.round(categories.performance.score * 100)}, accessibility ${Math.round(categories.accessibility.score * 100)}`)
}

let family = false
try {
  await page.goto(APP)
  await lighthouse('landing', '/')
  await lighthouse('sign-in', '/login')

  await api('POST', '/parents', { name: 'Measure Parent', email, password: PASSWORD, country: 'IN', consent: true }, 201)
  family = true
  await api('POST', '/children', { name: 'Asha', username, password: 'child-pass-1', consent: true }, 201)
  const childId = await page.evaluate(async () => (await (await fetch('/api/children')).json())[0].id)
  const dueAt = new Date(Date.now() + 2 * 86_400_000).toISOString()
  await api('POST', '/tasks', { childId, category: 'chores', title: 'Tidy the room', instructions: 'Floor clear, bed made.', dueAt, points: 20 }, 201)
  await lighthouse('overview', '/parent')

  await api('DELETE', '/session', undefined, 204)
  await api('POST', '/session', { identifier: username, password: 'child-pass-1' }, 200)
  await lighthouse('today', '/child')

  // Today's calls: the first load, then one refresh (the page regains focus more than 15 seconds after its last load)
  const calls = []
  page.on('request', (request) => request.url().includes('/api/') && calls.push(`${request.method()} ${new URL(request.url()).pathname}`))
  await page.goto(`${APP}/child`)
  await page.waitForLoadState('networkidle')
  say(`Today, first load: ${calls.join(', ')}`)
  await sleep(16_000)
  calls.length = 0
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await sleep(3_000)
  say(`Today, one refresh: ${calls.join(', ')}`)

  // the photo, through the app's own function
  const shrink = readFileSync(path.resolve('src/utils/photo.js'), 'utf8').replace('export async function shrinkPhoto', 'async function shrinkPhoto')
  for (const grain of [6, 10, 16, 24]) {
    const made = await page.evaluate(`(async () => {\n${shrink}\nreturn (${photo.toString()})(${grain})\n})()`)
    say(`Photo, grain ±${grain}: drawn ${(made.original / 1e6).toFixed(1)} MB, sent ${(made.sent / 1000).toFixed(0)} kB as ${made.type}, ${made.width} x ${made.height}`)
    if (made.original >= 12e6) break
  }
} finally {
  if (family) {
    await api('DELETE', '/session', undefined, 204).catch(() => {})
    await api('POST', '/session', { identifier: email, password: PASSWORD }, 200)
    await api('POST', '/me/delete', { password: PASSWORD }, 204)
    console.log('the throwaway family is deleted')
  }
  await context.close()
  stopClient()
  stopServer()
}
console.log(`\n${results.join('\n')}`)
```

<!-- extract: reviewer -->
```text
# Fresh review of GrowKid's Phase 9

You review one diff of GrowKid, a university project: a React 19 and Vite client and an Express 5 server with Prisma 6 on PostgreSQL, run together on one machine. A parent sets tasks, a child sends proof, and an approval earns points and stickers. The personal data is children's: names, accounts and proof photos.

Phase 9 built nothing new. It (1) swept every route with the wrong caller and the wrong family, with the route list read from the routers; (2) attacked the app and pinned each defence with a test, fixing F1 (`POST /api/requests/seen` answered 500 for a NUL in an id) and N1 (a stalled caller could hold a connection for minutes); (3) ran a whole-repository review and fixed its high findings; (4) deleted unused code that an over-engineering audit found; (5) measured. The diff file is `git diff HEAD` plus the untracked files, without the two plan files.

## How to work

- Read the diff first. Open a repository file only to check a finding against it.
- Change no file. Run no tests, servers, `npm` or `node`: another process uses the shared test database. Use Read, Grep, Glob and read-only `git` commands.
- Report each finding once, most severe first. **High:** it exposes or loses children's data, lets one family reach another, or stops the loop (set a task, send proof, approve, reward). **Medium:** it weakens a defence that exists, or gives a wrong result a user can recover from. **Low:** the rest.
- Give each finding its `file:line`, the concrete failure (the request or input, and what then goes wrong) and the line that causes it. Check each one against the code before you report it, and drop what you cannot show.
- Then go through the acceptance list: one line per point, saying whether it holds.
- Under 600 words in all. No praise, no summary of the diff.

## The acceptance list

1. `server/test/security.test.js` reads the routes from the five routers. A route with no entry in `WHO`, an entry for a route that is gone, or a route whose `:id` has no `OWNED` entry fails the first sweep test, by name.
2. On every route that is not public, a visitor gets 401 `NOT_SIGNED_IN` and the wrong role 403 `NOT_ALLOWED`. Another family's ids are 404 `NOT_FOUND` on every route that takes one, for a parent and for a child, and nothing of that family changes. A brother's or sister's ids are 404 to a child. Another family's ids in a body are refused, or change nothing.
3. Every write route refuses a request without `X-GrowKid`. No id in an address is a 500: a NUL, a lone surrogate, a path, 300 characters or a bad escape.
4. F1: `markAnswersSeen` in `server/src/routes/family.js` cleans its ids with `text()`, and no other `in:` over values from a request body skips it.
5. N1: `server/src/index.js` cuts off a caller after 15 seconds without complete headers and 120 seconds without a complete request. A failure to listen still stops the server with its message, and the daily `tidy` timer is unchanged.
6. Each added test can fail: removing its defence makes it fail, no assertion takes any refusal where one answer is known, and a test's families are erased even when it fails.
7. `scripts/verify.mjs` fails when the built app holds a development switch, or when any client file builds HTML from data. The checks that were there are not weakened.
8. Every attack in `final-plan.md` section 2's "Tried in Phase 9" block is held by a named test, or is written under "Accepted" with a reason that is true of the code.
9. Each deletion from the over-engineering audit removed code with no caller. Nothing deleted was input validation, error handling, a security measure, an accessibility feature or a development switch.
10. Each fix from the whole-repository review is the smallest root-cause fix, in the shared path, and has a test that fails without it.
11. No feature was added: no new route, page, table, migration or dependency. No request goes to another host. No Claude or Anthropic name appears anywhere in the diff.
12. `final-plan.md` section 1 holds a "Before and after" table with a before and an after for each measure, and each cell is a value, not a placeholder.
```
