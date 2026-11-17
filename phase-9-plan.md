# Phase 9 plan, part 1: Attack it

Written on 16 and 17 November 2026 by the planning session, for the building session. It follows `final-plan.md` section 4. Read that section and section 5 first, then this file. This phase has no questions to ask. Build exactly this, from step 2 on.

This file covers items 1 and 2. Items 3 to 5, the acceptance list and the close are in `phase-9-plan-part-2.md`. **Do not open part 2 until section 7 of this file sends you there.**

**Phase 8 must be built and committed first.** This plan was written before Phase 8's code existed. It names Phase 8's routes and helpers as `phase-8-plan.md` defines them. If one is missing or differs (section 2 checks), stop and report. Do not adapt the plan quietly.

## 0. How to use this plan

**Read only the top of this file.** The code is in the appendix and is copied by a command, not by you. First run `Grep` for `^## Appendix` in this file to get its line number N, then Read this file with `limit` N minus 1. Open an appendix block only if its test fails and you need to see why.

**The aim.** Build nothing new. Find what the earlier phases missed, pin every defence with a test so it stays, and put numbers on what changed. A fix is allowed, a feature is not.

**What is settled.** Every design choice, name, value and sentence here is decided. Use them as written.

**What is proven.** On 17 November 2026 the planning session ran all of this against the repository at commit `c715b4e` (Node 22.23.2, the database `growkid_test`). It changed nothing in the repository: the code ran from a scratch folder, and `server/src/index.js` and `scripts/verify.mjs` were tried as patched copies.

| What | Outcome on 17 November |
|---|---|
| The route sweeps and the token tests (appendix `tokens` and `routes`) | 8 of 8 passed, over 63 routes |
| `attack.test.js` (appendix `attack`) | 5 of 6 passed. The sixth failed on finding F1 (section 5.1) and nothing else: with that one id left out it passed. |
| The crafted-file tests (appendix `rules`) | 3 of 3 passed |
| The stalled-headers test (appendix `boot`), against `index.js` with section 5.4's change | passed: `408` after 20 seconds |
| A request whose body never finishes, same server | closed after 120.2 seconds with `408` |
| A connection that sends nothing at all, same server | closed after 15.0 seconds with `408` |
| The two new `verify.mjs` checks | both pass; each failed when given a pattern that is present |
| Sign-in timing, 7 tries each | unknown account 262 ms, wrong password 265 ms |
| The file walkers on the worst 25 MB a caller can send | 201 ms at most (a JPEG whose scan is all `FF`) |

**What was not run,** because it needs Phase 8: the six routes marked "Phase 8" in the `WHO` table, the `moderator()` helper with its code step, the `ModeratorAction` clean-up line, the four rows marked `'4xx'` in the NUL test, and the timing of `/recovery`. Those are predictions. If one fails, that is a finding: record what happened.

**Report only what you ran.** Every number that goes into `final-plan.md` from this phase is one you produced in this session, with the command that produced it. The numbers in the table above are the planning session's, from before Phase 8: never copy them into a report. If an attack was not tried, say "not tried" and why.

**When a proven block fails.** Read the failure before the block. A failure that names a Phase 8 route, field or helper means Phase 8 differs from its plan: stop that item and report. Do not rewrite a proven block to make it pass.

**Spend tokens on the work, not on reading.**
- Read each step's "Read first" ranges in one parallel batch, and nothing else. Section 5 says where each defence lives.
- A full Read of some files is refused by a hook, with a message naming `smart_outline`. Do not retry it. Read with `offset` and `limit`.
- While building, run one test file: `cd server && npm run pretest && node --env-file=.env.test --test --test-concurrency=1 test/<file>.test.js 2>&1 | grep -E "^(ok|not ok|# (tests|pass|fail))|error:|expected|actual"`. Never two test commands at once: they share one database.
- `npm run verify:quick` after each item. The full `npm run verify` once, at the end of this part.
- A script that holds a backtick or a curly quote breaks in a heredoc and in `node -e`. The appendix blocks are extracted to files for that reason. Anything else of the kind: write it with Write and run it with `node`.
- Attack only `127.0.0.1`, only the test server or the development server, never another host (`final-plan.md` section 4).

## 1. Tools: when to use what

| Tool | Use it for | Not for |
|---|---|---|
| `ponytail:ponytail` | Load once, before item 1. | |
| `context7` | One check, only if the first sweep test says the route list is empty or wrong: Express 5's `router.stack`, `layer.route.path` and `layer.route.methods`. It worked on 17 November. | Node's `http` options: proven here. |
| `/code-review`, `/ponytail-review`, `/security-review`, the fresh reviewer | Part 2, on the whole phase diff. | Now. |
| Agent, `subagent_type: "Explore"`, `model: "haiku"` | Only for a wide read-only search whose output is far larger than its answer. None is planned. | |
| `work_state_write` | List `growkid-final-plan-build`: "Phase 9. Attack it, measure it" to `doing` at step 0. | |

No screen changes in this part, so the Playwright MCP, `impeccable` and `frontend-design` are not used.

## 2. Step 0: orient, check Phase 8, set up

1. `npm run verify` from the repo root. It must be green: Phase 8's item 0 fixed the one failure known on 16 November. If it is red, stop and report.
2. One parallel batch of Greps. Each must find its text. If one does not, stop and report.

| Must exist | Where |
|---|---|
| `export async function moderator(` | `server/test/helpers.js` |
| `'/recovery'`, `'/me/recovery'`, `'/me/export'`, `'/settings/keep-proof'`, `'/reports/:id/pause'`, `'/reports/:id/unpause'` | `server/src/routes/` |
| `model ModeratorAction` | `server/prisma/schema.prisma` |
| `T5: two resets at once`, `T1: a code signs in once`, `T7: a data track whose samples cannot be found` | `server/test/` |
| `^test\(` in `server/test/security.test.js`: the last three must be `'who: a missing, garbled…'`, `'a forged, tampered, stale or expired…'` and `'a moderator gets nothing outside reports…'`, in that order | section 4 cuts the file at the first of them |

3. Define the extractor in the shell you build in, from the repo root. It prints one appendix block of a plan file:

```bash
x() { tr -d '\r' < "$1" | awk -v m="<!-- extract: $2 -->" '$0==m{f=1;next} f&&/^```/{if(++c==2)exit;next} f&&c==1'; }
```

   Shell state does not last between Bash calls, so put the definition at the start of each command that uses `x`. `S` below is your session's scratchpad folder.

## 3. Step 2, documents first

This part changes one rule. In `Documentation/FRONTEND-SITEMAP.md` section 12, add one bullet as the last bullet of rule 28 ("Running on one machine"), with the same four-space indent as the bullets above it:

> - **N1, callers that stall.** Assumed (final plan Phase 9), to confirm. A caller that has not finished sending a request's headers within 15 seconds, or the whole request within 120 seconds, is cut off, so a stalled caller cannot hold one of the four upload places (L8) for minutes. A 25 MB video therefore needs a connection of about 2 megabits a second or better, which any home Wi-Fi gives.

The id is N1 because A1 to A11 are taken by the backend's assumptions. Nothing changes in DESIGN.md or on Safety and privacy.

## 4. Item 1. Every route, tried from the wrong family

**Read first:** `server/test/security.test.js:1-20` only.

**The design, which is the point of the item.** The list of routes is read from the routers, so a route added later is in every sweep without anyone remembering it. A route with no entry in `WHO` fails the first test by name. So does an entry for a route that is gone. A route that takes an `:id` must say in `OWNED` what the id names, or the first test fails.

**Change `server/test/security.test.js`** in this order.

1. Make the imports read exactly this (Phase 8 may already have changed the helpers line; `bcrypt` goes, because the test that used it goes):

```js
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import jwt from 'jsonwebtoken'
import { who } from '../src/auth.js'
import { db } from '../src/db.js'
import { account } from '../src/routes/account.js'
import { family as familyRoutes } from '../src/routes/family.js'
import { reports } from '../src/routes/reports.js'
import { series } from '../src/routes/series.js'
import { tasks } from '../src/routes/tasks.js'
import { png } from './fixtures.js'
import { as, family, moderator, start } from './helpers.js'
```

2. Replace the line `after(() => server.close())` with the block below. The order matters: node runs `after` hooks in the order they were registered, so a second hook that erased families would run after the server had closed and fail with "fetch failed". The planning session hit exactly that.

```js
const swept = [] // the families the sweeps make, erased before the server closes
after(async () => {
  await Promise.all(swept.map((mom) => mom.api.post('/me/delete', { password: mom.password })))
  await server.close()
})
```

3. Cut the file at the first of its last three tests, then append the two appendix blocks. `tokens` is the first two of those tests with item 2's token attacks added. `routes` replaces the third, whose hand-written list is the thing this item removes.

```bash
x() { tr -d '\r' < "$1" | awk -v m="<!-- extract: $2 -->" '$0==m{f=1;next} f&&/^```/{if(++c==2)exit;next} f&&c==1'; }
node -e "const fs=require('fs');const f='server/test/security.test.js';const s=fs.readFileSync(f,'utf8');const at=s.indexOf('test(\'who: ');if(at<0)throw new Error('anchor not found');fs.writeFileSync(f,s.slice(0,at))"
x phase-9-plan.md tokens >> server/test/security.test.js
x phase-9-plan.md routes >> server/test/security.test.js
grep -c "^test(" server/test/security.test.js
```

   The count must be 15: seven tests kept, two in `tokens`, six in `routes`.

**What the six tests in `routes` hold.**

| Test | What it pins |
|---|---|
| `every route is listed once, says who may call it, and says what its :id names` | The guard: a new route with no entry fails here by name. |
| `everyone a route is not for is refused before anything is looked up…` | A visitor gets `NOT_SIGNED_IN` and another role `NOT_ALLOWED`, on every route that is not public. |
| `another family's ids are NOT_FOUND on every route that takes one…` | For a parent and a child of family B, with real ids of family A; family A's lists are byte-for-byte the same afterwards. |
| `a brother's or sister's ids are NOT_FOUND to a child…` | The same boundary inside one family: every child route with an id, the pin, the two "seen" routes, and a report. |
| `an id in a body: another family's child, task, proof, reward and request…` | The ids a route list cannot see: 8 refusals, 2 writes that change nothing, and 2 reports that go without the task. |
| `every write route refuses a request without the X-GrowKid header; an id that is a NUL…` | Each hostile id gets its own family, so no caller nears the limit of 120 writes a minute, and a `429` fails the test instead of passing as "some refusal". |

**Proof.**
1. `test/security.test.js` passes: 15 tests.
2. Prove the guard bites. Add `account.get('/zz-phase9-probe', (_req, res) => res.json(1))` at the end of `server/src/routes/account.js`, run the file, see the first sweep test fail naming `GET /zz-phase9-probe`, and remove the route. Say in the report that you did.

**What could go wrong.**
- A sweep answers `429`: a later phase added routes and one caller passed 120 writes a minute. Give that sweep another family. Never raise a limit.
- A run dies before its `after` hook. Its families stay in `growkid_test` with their proof files, and the last test of `tasks.test.js` ("…the upload folder ends empty") then fails for a reason that looks unrelated. Remove them with the appendix script: `x phase-9-plan.md tidy > "$S/tidy.mjs" && (cd server && node --env-file=.env.test "$S/tidy.mjs")`. It only works in a database named `*_test` and only touches families whose proof was sent in the last two hours.

## 5. Item 2. The attack pass

**Read first, one batch:** `final-plan.md:44-62` (the threat table); `server/src/routes/family.js:199-206`; `server/src/index.js:34-50`; `server/test/boot.test.js:1-12`; `scripts/verify.mjs:18-46`.

Work the five steps in order, then confirm the table in 5.6. A finding of your own that touches a standing decision of `final-plan.md` section 3 goes to the user with `AskUserQuestion`.

### 5.1 Finding F1, already found: fix it first

`POST /api/requests/seen` answers `500` when an id in `ids` holds a NUL or a lone surrogate. Reproduced on 17 November: `{ "ids": ["a\u0000b"] }` and `{ "ids": ["a\ud800b"] }` from a signed-in child each gave `500`; a plain id gave `204`. The cause: `markAnswersSeen` hands the ids to the database as they came (`server/src/routes/family.js:204`), where its twin `markResultsSeen` cleans them (`tasks.js`, `taskIds.map(text)`). Severity low: a signed-in child can make their own request fail, and nothing is read or changed.

Fix, in `server/src/routes/family.js`, the `updateMany` of `markAnswersSeen` (`text` is already imported there):

```js
  // text(): a NUL or a lone surrogate in an id would be a 500 from the database, not an id that matches nothing (Phase 9, F1)
  await db.rewardRequest.updateMany({ where: { childId: me.id, id: { in: ids.map(text) } }, data: { answerSeen: true } })
```

Its test is the line `await is(204, 'answers seen', …)` in the NUL test of `attack.test.js`. Then one Grep to show no other route has the fault: `in: ` in `server/src/routes/`. Every `in:` over values from a request body must go through `text`; ids the server read from its own rows need not.

### 5.2 `server/test/attack.test.js`, a new file

```bash
x() { tr -d '\r' < "$1" | awk -v m="<!-- extract: $2 -->" '$0==m{f=1;next} f&&/^```/{if(++c==2)exit;next} f&&c==1'; }
x phase-9-plan.md attack > server/test/attack.test.js
```

Run it. All 6 must pass.

| Test | What it tries |
|---|---|
| `a form-encoded, text/plain or multipart body is read as no body…` | The three content types a form on another site can send, each carrying the right sign-in details, a sign-up, a task, a setting and a quest. Nobody is signed in and nothing is stored. |
| `__proto__ and constructor in a body change no object and no row` | Raw JSON with both keys, to sign-up and to a task. The app runs in the test's own process, so a polluted prototype would show. |
| `a body that unpacks or nests far past the limit is refused…` | 8 MB of spaces gzipped to a few kB, and 18 kB of nested brackets. |
| `a NUL and a lone surrogate in any text field or id…` | 40 writes: every text field of every route, every id a body carries, two query strings, and four Phase 8 routes (the `'4xx'` rows). Then every row of the family is read back and holds no NUL. |
| `no write takes a field it does not name…` | 33 fields a caller has no business sending (`role`, `status`, `tokenVersion`, `pausedAt`, `parentId`, `passwordHash`, `totpSecret`, `recoveryHash`, `keepProofDays`, `reviewBy`, `resolvedAt` and the rest), on 20 writes. Each row is read back with `db` and holds the server's values. |
| `two uploads at once at the edge of the quota…` | Accepted behaviour, pinned: both may land, the family is over by one file at most, and the next upload is `QUOTA`. |

If a `'4xx'` row answers `5xx`, Phase 8's route has the same fault as F1: fix it the same way, in that route, and say so under "Found and fixed".

Then add the comment that makes the quota race a marked shortcut. In `server/src/routes/tasks.js`, above the line `const held = await db.proof.aggregate(` in `sendProof`:

```js
    // ponytail: summed before the transaction and without a lock, so uploads at the same moment can each pass: the family ends over
    // by the files in flight, at most 4 of 25 MB (L8). Take the parent's row lock around the sum and the insert if that matters.
```

### 5.3 The crafted-file tests

```bash
x() { tr -d '\r' < "$1" | awk -v m="<!-- extract: $2 -->" '$0==m{f=1;next} f&&/^```/{if(++c==2)exit;next} f&&c==1'; }
x phase-9-plan.md rules >> server/test/rules.test.js
```

The three tests use only names `rules.test.js` already imports and defines. They go at the end of the file. Run it: every test passes, 3 more than before.

### 5.4 Slow callers (N1)

Node's defaults leave a caller 60 seconds to finish its headers and 300 seconds to finish the request. A child's upload holds one of four places (L8) for as long as its request lasts, so four stalled uploads would close uploading for five minutes at a time.

1. `server/src/index.js`: add `import http from 'node:http'` above the `node:path` import, and replace the four lines of the `app.listen(` call (from `const server = app.listen(` to its closing `})`) with:

```js
// N1: a caller that stalls is cut off: 15 seconds for a request's headers, 120 for the whole request (Node's own 60 and 300 would let
// four stalled uploads hold every upload place for five minutes). Checked every 5 seconds.
const server = http.createServer({ headersTimeout: 15_000, requestTimeout: 120_000, connectionsCheckingInterval: 5_000 }, app)
server.once('error', (err) => fail(`cannot listen (${err.code ?? 'error'})`))
server.listen(Number(env.PORT), '127.0.0.1', () => console.log(`GrowKid server listening on 127.0.0.1:${server.address().port}`))
```

   Phase 8 put its `tidy` timer after this call. Keep it there, untouched.
2. `server/test/boot.test.js`: add `import { once } from 'node:events'` and `import net from 'node:net'` to its imports, in alphabetical place, then append the test:

```bash
x() { tr -d '\r' < "$1" | awk -v m="<!-- extract: $2 -->" '$0==m{f=1;next} f&&/^```/{if(++c==2)exit;next} f&&c==1'; }
x phase-9-plan.md boot >> server/test/boot.test.js
```

   Run the file. The new test takes about 20 seconds.
3. Once, by hand, the body that never finishes. It takes two minutes, so it is not in the suite:

```bash
x() { tr -d '\r' < "$1" | awk -v m="<!-- extract: $2 -->" '$0==m{f=1;next} f&&/^```/{if(++c==2)exit;next} f&&c==1'; }
x phase-9-plan.md stall > "$S/stall.mjs" && (cd server && node --env-file=.env.test "$S/stall.mjs")
```

   Run it in the background and go on with 5.5. It prints one line, such as `closed after 120.2 s: HTTP/1.1 408 Request Timeout`. Record your line under "Accepted" in 6.

### 5.5 Two checks in `scripts/verify.mjs`, and two measurements

Five edits to `scripts/verify.mjs`:

1. `const boundary = (pattern) => () => {` becomes `const boundary = (pattern, everywhere = false) => () => {`.
2. In that function, `inside[0] === 'api'` becomes `(!everywhere && inside[0] === 'api')`.
3. Above `const has = `, add:

```js
/** Phase 9: no development switch may be left in the built app: the demo sign-ins, the clock header, the dev-mode key. Resolves to the built files that hold one. */
const builtWithout = (pattern) => () => {
  const dist = path.join(root, 'client', 'dist')
  const found = readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(js|css|html)$/.test(entry.name) && pattern.test(readFileSync(path.join(entry.parentPath, entry.name), 'utf8')))
    .map((entry) => `client/dist/${path.relative(dist, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')} holds a development switch`)
  return found.length ? found.join('\n') : null
}

```

4. In `checks`, after the `'client build'` line: `['built app: no development switch', builtWithout(/growkid-demo|X-Clock-Days|growkid\.dev/), true],`
5. In `checks`, after the `'boundary: axios only…'` line: `['boundary: no page builds HTML from data', boundary(/dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write/, true), true],`

The first new check is the grep that CI has (`.github/workflows/ci.yml`) and has never run. If either check finds a line, that is a finding: read the line and fix the cause. Never weaken a pattern.

Then the two measurements:

```bash
x() { tr -d '\r' < "$1" | awk -v m="<!-- extract: $2 -->" '$0==m{f=1;next} f&&/^```/{if(++c==2)exit;next} f&&c==1'; }
x phase-9-plan.md timing > "$S/timing.mjs" && (cd server && node --env-file=.env.test "$S/timing.mjs")
(cd client && npm audit 2>&1 | tail -3); (cd server && npm audit 2>&1 | tail -5)
```

`timing.mjs` prints the median of 7 tries for sign-in (unknown account, wrong password) and for `/recovery` (unknown email, an account with no code, a wrong code), and for each group how many times slower the slowest is than the fastest. A group passes at 1.25 or less. Over that is a finding: the faster answer skipped a compare, so find the path that returns early.

### 5.6 Every attack, and what holds it

One Grep batch confirms each "exists" test by its opening words; the full `npm run verify` in section 7 runs them all. Do not run those files one by one.

**Tokens**

| # | Attack | Held by |
|---|---|---|
| 1 | No token, a garbled one, `alg: none`, another secret, HS384 with the right secret, expired, a changed payload, a changed signature, an old `tokenVersion`, an unknown user | exists: `security.test.js`, the two tests in `tokens` |
| 2 | A's genuine token with `sub` changed to B's id, signature kept | added to `tokens`: `'another user, signature kept'` |
| 3 | A genuine signature over a `sub` that is a number, null, true, an object or a list; over no claims at all; over the version as text or no version; a cookie that cookie-parser turns into an object | added to `tokens` |
| 4 | A paused family's old token | exists: `safety.test.js`, `C6: pause-family pauses…` |

**Requests**

| # | Attack | Held by |
|---|---|---|
| 5 | A write with no `X-GrowKid` header, on every write route | `routes`, sixth test |
| 6 | A form-encoded, `text/plain` or multipart body | `attack`, first test |
| 7 | `__proto__` and `constructor` in the JSON | `attack`, second test |
| 8 | A NUL and a lone surrogate in every text field and every id a body carries | `attack`, fourth test. **Found F1**, fixed in 5.1. |
| 9 | A NUL, a lone surrogate, a path, 300 characters or a bad escape as the `:id` in the address | `routes`, sixth test |
| 10 | A body over the size limit | exists: `security.test.js`, `a 30 kb body is 400 INVALID`. Unpacked or nested past it: `attack`, third test |

**Role and field**

| # | Attack | Held by |
|---|---|---|
| 11 | A child on each parent route, a parent on each child route, a moderator on each family route, a visitor on each | `routes`, second test |
| 12 | Another family's id on every route that takes one | `routes`, third test |
| 13 | Another family's id in a body | `routes`, fifth test |
| 14 | A brother's or sister's id, in the address and in a body | `routes`, fourth test |
| 15 | A field the write does not name | `attack`, fifth test |

**Races**

| # | Attack | Held by |
|---|---|---|
| 16 | Two approvals at once | exists: `tasks.test.js`, `approving twice at once…` |
| 17 | Two reward requests at once at the edge of the balance | exists: `family.test.js`, `two reward requests at once…` |
| 18 | A proof sent while the family or the task is deleted | exists: `account.test.js`, `erase waits for a transaction…`; `tasks.test.js`, `a proof sent while the task is deleted…` |
| 19 | Two uploads at once at the edge of the quota | Accepted and pinned: `attack`, sixth test, and the `ponytail:` comment of 5.2 |
| 20 | The same recovery code twice at once; the same moderator code twice at once | Phase 8: `T5: two resets at once…`, `T1: a code signs in once…` |

**Files**

| # | Attack | Held by |
|---|---|---|
| 21 | A file that claims one type and is another | exists: `tasks.test.js`, `sendProof: the type comes from the bytes…` |
| 22 | Thousands of tiny PNG chunks, JPEG segments, WebP chunks or MP4 boxes | exists: `rules.test.js`, `C1: a file of more parts than the cap…` |
| 23 | An MP4 box that runs past its parent, has a size under 8, a 64-bit size past the file or under its own head, or a head cut short | `rules`, first test |
| 24 | An MP4 box of size 0 that is not the last | `rules`, second test: it runs to the end, as the format says, so what follows a `udta` of size 0 is blanked with it. The other order is accepted (section 6). |
| 25 | A JPEG with a second picture after the first | exists: `rules.test.js`, `JPEG: the stored file ends at the first EOI…` |
| 26 | A path in the proof id | `routes`, sixth test: the file is opened by the id from the database, never by the text in the address |
| 27 | A crafted GPS track | Phase 8: `T7: a data track whose samples cannot be found is FILE_TYPE` |
| 28 | A proof file opened as its own page | exists: `safety.test.js`, `C4: a proof file carries its own CSP and CORP…` |
| 29 | A PNG chunk of 4 GB, a WebP whose sizes point past the file, a JPEG segment of length 0, 1 or 65,535, a file of 0 to 4 bytes of each type | `rules`, third test |
| 30 | A 25 MB file built to make a walker slow | Measured, no test: 201 ms at most on 17 November. The cap on parts (row 22) is what bounds it. Say "measured by the planning session, not rerun". |

**Guessing and naming**

| # | Question | Outcome to record |
|---|---|---|
| 31 | Does sign-in take the same time for an unknown account and a wrong password? | Your two medians from `timing.mjs`. The test exists: `account.test.js`, `signIn: an unknown account and a wrong password…` |
| 32 | Does `/recovery` take the same time for an unknown email, an account with no code, and a wrong code? | Your three medians. Not run by the planning session. |
| 33 | What does sign-up reveal? | `EMAIL_TAKEN`. Accepted (section 6). |
| 34 | What does adding a child reveal? | `USERNAME_TAKEN`, across families. Accepted. |
| 35 | What does a moderator's sign-in reveal? | `NEEDS_CODE` says the password was right. Accepted. |
| 36 | What does `PAUSED` reveal? | Nothing before the right password or code. exists: `safety.test.js` C6; Phase 8 `T5: a paused family is refused…` |

**Slow callers**

| # | Attack | Held by |
|---|---|---|
| 37 | A request that never finishes its headers, or a connection that says nothing | fixed in 5.4; `boot`: `a caller that never finishes its headers is cut off with 408…` |
| 38 | A request that never finishes its body | fixed in 5.4; tried by hand with `stall.mjs`, not in the suite |
| 39 | An upload that stalls after its headers | exists: `tasks.test.js`, `the server receives at most 4 proof files at once… (L8)`: its place comes back when the response closes |

**The rest of the threat table**

| # | Row of the table | Held by |
|---|---|---|
| 40 | A child on the shared device reads the parent's cached pages | exists: `security.test.js`, `every /api answer says no-store…`; `client/src/hooks/pageCache.check.js` |
| 41 | A made-up forwarded address | exists: `account.test.js`, `a made-up X-Forwarded-For does not dodge the limit… (F1)` |
| 42 | Flooding sign-in | exists: `account.test.js`, `signIn is limited to 10 tries…`, `signIn also allows 50 failed tries…`, `signIn pauses one account after 30 failed tries… (L1, L2)` |
| 43 | Whoever reads the server's log | exists: `security.test.js`, `a failure is logged without its message… (F7)`; `safety.test.js`, `C9: …` |
| 44 | Moving the clock | exists: `boot.test.js`, the three clock cases |
| 45 | A page that builds HTML from data | the new `verify.mjs` check; none did on 17 November |
| 46 | A development switch left in the built app | the new `verify.mjs` check; none was on 17 November |
| 47 | Dependencies | `npm audit` in both folders. Expected: client 0, server 3 high in Prisma's command-line tool, accepted in `README.md` |

## 6. What to write into `final-plan.md`

Under the threat table in section 2, add a block headed "Tried in Phase 9 (date)", with three lists. Write each line from what you ran.

- **Held, and now pinned by a test:** one line per group of 5.6 (tokens, requests, role and field, races, files, slow callers, the rest), with the test files and how many attacks of the group held.
- **Found and fixed:** F1, with its test, and anything you found. Each line says what the attack was, what happened, and the fix's `file:line`.
- **Accepted, and why.** Confirm each by its test or by reading the named code before you write it. Drop any that is no longer true and add any you found:
  - Sign-up says an email is taken, and adding a child says a username is taken: with no email to send to, nothing else can say why. Both are limited (20 an hour).
  - A moderator's sign-in says when the password was right, because a second step cannot hide the first. Tries count against the sign-in limits.
  - Whoever knows a username can lock that account for up to an hour (L1).
  - Two requests at the same moment can pass a cap by one (L6), and uploads can pass the storage quota by the files in flight, at most 4 of 25 MB.
  - The limits are kept in memory, so they start again when the server restarts.
  - A program on the same computer that calls the server's own port, without the proxy, can name any address (F1 of rule 28).
  - A copied session token works until it expires or the account's `tokenVersion` moves (`auth.js`, the `ponytail:` note). "Sign out other devices" moves it.
  - A WebM video is stored as sent.
  - An MP4 box of size 0 placed in front of a `udta` holds that `udta` as its contents, so it is not blanked. To a reader that follows the format the file has no `udta`. Only a file built by hand has this, and what it keeps is the uploader's own.
  - A request body that never finishes is cut off after 120 seconds: your `stall.mjs` line. Tried once by hand, not in the suite.
  - A caller that reads an answer slowly is not cut off, and the server caps neither connections nor answers in flight. Not tried. On one machine behind Vite's proxy, accepted.
  - The machine itself: whoever has the Windows account has the database, the photos and `server/.env`.
  - The server's 3 advisories are in Prisma's command-line tool, not in anything that answers a request.

Keep a tally for the phase report as you go: attacks tried (the rows of 5.6 you confirmed or ran), held, found and fixed, accepted, not tried.

## 7. End of part 1

1. `npm run verify` from the repo root, in full. It must pass with its two new checks. The server tests take about a minute longer than before.
2. In `final-plan.md` section 6, Phase 9: tick items 1 and 2. Move nothing.
3. If the context is light, Read `phase-9-plan-part-2.md` and go on. If it is heavy, stop here: update the memory note `growkid-final-plan` ("Phase 9 part 1 built: items 1 and 2; F1 fixed; N1 added"), and report "Phase 9, part 1" in `final-plan.md` section 4's format, with the tally. The next session reads `final-plan.md` sections 4 and 5, sections 0 and 1 of this file, and then part 2. It does not rerun anything in this file.

## Appendix: the code, extracted by command

Do not read below this line unless a test fails. Each block is copied by the `x` function of section 2.

<!-- extract: tokens -->
```js
test('who: a missing, garbled, unsigned, wrongly signed or unknown-user token is not signed in', async () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const claims = { sub: '00000000-0000-4000-8000-000000000000', v: 0 }
  const tokens = [
    undefined,
    'not-a-token',
    `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`, // alg: none
    jwt.sign(claims, 'x'.repeat(32), { algorithm: 'HS256' }), // another secret
    jwt.sign(claims, process.env.JWT_SECRET, { algorithm: 'HS256' }), // genuine, but no such user
    // genuine, but the user is named by something that is not text: never looked up, so never a 500
    ...[5, null, true, { id: claims.sub }, [claims.sub]].map((sub) => jwt.sign({ sub, v: 0 }, process.env.JWT_SECRET, { algorithm: 'HS256' })),
    jwt.sign('just text', process.env.JWT_SECRET, { algorithm: 'HS256' }), // genuine, and no claims at all
  ]
  for (const token of tokens) {
    const req = { cookies: { growkid: token } }
    let called = 0
    await who(req, null, () => called++)
    assert.equal(req.user, null)
    assert.equal(called, 1)
  }
  // cookie-parser turns a cookie that starts "j:" into an object: not a token either
  const req = { cookies: { growkid: { sub: claims.sub, v: 0 } } }
  await who(req, null, () => {})
  assert.equal(req.user, null)
})

test('a forged, tampered, stale or expired session cookie is not signed in; the genuine one is', async () => {
  const mom = await family(server.base)
  const dad = await family(server.base) // another family, whose id a forger would want
  const session = async (token) => (await fetch(`${server.base}/session`, { headers: { cookie: `growkid=${token}` } })).json()
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const claims = { sub: mom.user.id, v: 0 }
  const secret = process.env.JWT_SECRET
  const genuine = jwt.sign(claims, secret, { algorithm: 'HS256', expiresIn: '7d' })
  assert.equal((await session(genuine))?.id, mom.user.id)

  const [head, payload, signature] = genuine.split('.')
  const flipped = signature.slice(0, 10) + (signature[10] === 'A' ? 'B' : 'A') + signature.slice(11)
  const forged = {
    'alg none': `${b64({ alg: 'none', typ: 'JWT' })}.${payload}.`,
    'alg none, signature kept': `${b64({ alg: 'none', typ: 'JWT' })}.${payload}.${signature}`,
    'payload changed, signature kept': `${head}.${b64({ ...claims, v: 1 })}.${signature}`,
    'another user, signature kept': `${head}.${b64({ ...JSON.parse(Buffer.from(payload, 'base64url')), sub: dad.user.id })}.${signature}`,
    'signature changed': `${head}.${payload}.${flipped}`,
    'another secret': jwt.sign(claims, 'x'.repeat(32), { algorithm: 'HS256', expiresIn: '7d' }),
    'another algorithm, right secret': jwt.sign(claims, secret, { algorithm: 'HS384', expiresIn: '7d' }),
    expired: jwt.sign(claims, secret, { algorithm: 'HS256', expiresIn: -10 }),
    'the version as text': jwt.sign({ ...claims, v: '0' }, secret, { algorithm: 'HS256', expiresIn: '7d' }),
    'no version': jwt.sign({ sub: mom.user.id }, secret, { algorithm: 'HS256', expiresIn: '7d' }),
    'a cookie-parser object': `j:${JSON.stringify(claims)}`,
  }
  for (const [name, token] of Object.entries(forged)) assert.equal(await session(encodeURIComponent(token)), null, name)
  assert.equal((await session(encodeURIComponent(genuine)))?.id, mom.user.id) // the encoding above changes nothing for a real token

  // An older tokenVersion: the token above was genuine, and stops counting once the password change has raised the user to version 1.
  assert.equal((await mom.api.put('/me/password', { current: mom.password, next: 'another-pass-1' })).status, 204)
  assert.equal(await session(genuine), null, 'older tokenVersion')
  const renewed = jwt.sign({ ...claims, v: 1 }, secret, { algorithm: 'HS256', expiresIn: '7d' })
  assert.equal((await session(renewed))?.id, mom.user.id)
  assert.equal((await mom.api.post('/me/delete', { password: 'another-pass-1' })).status, 204)
  assert.equal((await dad.api.post('/me/delete', { password: dad.password })).status, 204)
})

```

<!-- extract: routes -->
```js
// ------------------------------------------------------------------ every route, from the routers themselves (final plan Phase 9)

const ROUTES = [account, tasks, familyRoutes, reports, series].flatMap((router) =>
  router.stack.filter((layer) => layer.route).flatMap((layer) => Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`)),
)

/** Who may call each route: p a parent, c a child, m a moderator; 'public' needs no sign-in. Everyone else is refused before anything is looked up. */
const WHO = {
  'GET /session': 'public', 'POST /session': 'public', 'POST /parents': 'public', 'GET /countries': 'public',
  'POST /recovery': 'public', // Phase 8
  'PATCH /me': 'p', 'PUT /me/password': 'p', 'POST /me/sessions/end': 'p', 'POST /me/delete': 'p', 'GET /settings': 'p', 'PUT /settings': 'p', 'PUT /settings/country': 'p',
  'PUT /settings/keep-proof': 'p', 'POST /me/recovery': 'p', 'POST /me/export': 'p', // Phase 8
  'GET /children': 'p', 'POST /children': 'p', 'GET /children/:id': 'p', 'PATCH /children/:id': 'p', 'DELETE /children/:id': 'p', 'PUT /children/:id/password': 'p', 'POST /children/:id/sessions/end': 'p',
  'POST /tasks': 'p', 'PUT /tasks/:id': 'p', 'DELETE /tasks/:id': 'p', 'POST /tasks/:id/review': 'p', 'GET /growth/children': 'p', 'GET /children/:id/progress': 'p',
  'POST /rewards': 'p', 'DELETE /rewards/:id': 'p', 'POST /requests/:id/answer': 'p', 'DELETE /children/:id/agreement': 'p', 'POST /suggestions/:id/answer': 'p',
  'PUT /children/:id/quest': 'p', 'GET /children/:id/rest-days': 'p', 'POST /children/:id/rest-days': 'p', 'GET /series': 'p', 'POST /series': 'p', 'PUT /series/:id': 'p', 'DELETE /series/:id': 'p',
  'PUT /me/avatar': 'c', 'PUT /me/sound': 'c', 'POST /tasks/:id/proofs': 'c', 'GET /proofs/mine': 'c', 'POST /tasks/seen': 'c', 'PUT /pin': 'c', 'GET /growth': 'c', 'GET /today': 'c',
  'GET /stickers': 'c', 'GET /leaderboard': 'c', 'POST /requests': 'c', 'POST /requests/seen': 'c', 'PUT /goal': 'c', 'POST /agree': 'c', 'POST /suggestions': 'c',
  'GET /tasks': 'pc', 'GET /tasks/history': 'pc', 'GET /tasks/:id': 'pc', 'GET /proofs/:id/file': 'pc', 'GET /counts': 'pc', 'GET /rewards': 'pc', 'GET /requests': 'pc', 'GET /suggestions': 'pc',
  'POST /reports': 'pc', 'GET /reports/mine': 'pcm', 'GET /reports': 'm', 'POST /reports/:id/resolve': 'm',
  'POST /reports/:id/pause': 'm', 'POST /reports/:id/unpause': 'm', // Phase 8
}
/** What the :id in a path names, by how the path starts. The sweeps send an id of that kind. */
const OWNED = [['/children/', 'child'], ['/tasks/', 'task'], ['/proofs/', 'proof'], ['/rewards/', 'reward'], ['/requests/', 'request'], ['/series/', 'series'], ['/suggestions/', 'suggestion'], ['/reports/', 'report']]
const kindOf = (route) => OWNED.find(([prefix]) => route.split(' ')[1].startsWith(prefix))?.[1]
/** A route that checks its body before it looks the id up needs a body that passes, or the sweep would see INVALID, not NOT_FOUND. */
const BODIES = { 'POST /suggestions/:id/answer': { result: 'declined' } }
const VERB = { GET: 'get', POST: 'post', PUT: 'put', PATCH: 'patch', DELETE: 'del' }
const call = (who, route, id = randomUUID()) => {
  const [method, pattern] = route.split(' ')
  return who[VERB[method]](pattern.replace(':id', id), method === 'GET' || method === 'DELETE' ? undefined : BODIES[route])
}

/** A parent and one child, each signed in on their own client. */
async function household() {
  const mom = await family(server.base)
  swept.push(mom)
  return { mom, ...(await addChild(mom, 'Asha')) }
}
async function addChild(mom, name) {
  const login = { name, username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1' }
  const child = (await mom.api.post('/children', { ...login, consent: true })).body
  const kid = as(server.base)
  assert.equal((await kid.post('/session', { identifier: login.username, password: login.password })).status, 200)
  return { kid, child }
}

const due = () => new Date(Date.now() + 2 * 86_400_000).toISOString()
const taskFor = (child, title = 'Tidy the room') => ({ childId: child.id, category: 'chores', title, instructions: 'Floor clear.', dueAt: due(), points: 20 })
const made = async (sending) => {
  const res = await sending
  assert.ok(res.status === 200 || res.status === 201, `set-up: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}
/** One of everything a family holds, by the kind of id: an open task, an approved proof with a file, a reward, a request, a series, a suggestion, a report. */
async function everything({ mom, kid, child }) {
  const done = await made(mom.api.post('/tasks', taskFor(child)))
  const proof = (await made(kid.form(`/tasks/${done.id}/proofs`, { note: 'Done' }, { bytes: png(), name: 'p.png' }))).proofs.at(-1)
  await made(mom.api.post(`/tasks/${done.id}/review`, { proofId: proof.id, result: 'approved' }))
  assert.equal((await kid.post('/tasks/seen', { taskIds: [done.id] })).status, 204) // so the points can be spent
  const open = await made(mom.api.post('/tasks', taskFor(child, 'Water the plants')))
  const reward = await made(mom.api.post('/rewards', { title: 'Pick the film', cost: 10 }))
  const request = await made(kid.post('/requests', { rewardId: reward.id }))
  const repeating = await made(mom.api.post('/series', { ...taskFor(child, 'Feed the cat'), weekdays: 127, dueTime: '23:59' }))
  const suggestion = await made(kid.post('/suggestions', { ideaId: 'chores-2' }))
  const report = await made(mom.api.post('/reports', { details: 'A report of our own.' }))
  const ids = { child: child.id, task: open.id, proof: proof.id, reward: reward.id, request: request.id, series: repeating.id, suggestion: suggestion.id, report: report.id }
  for (const [kind, id] of Object.entries(ids)) assert.match(String(id), /^[0-9a-f-]{36}$/, kind)
  const state = async () => JSON.stringify(await Promise.all(['/children', '/tasks', '/rewards', '/requests', '/series', '/suggestions', '/settings', '/growth/children', `/tasks/${done.id}`, `/tasks/${open.id}`].map(async (path) => (await mom.api.get(path)).body)))
  return { ids, done, open, reward, request, proof, state }
}

test('every route is listed once, says who may call it, and says what its :id names', () => {
  assert.equal(new Set(ROUTES).size, ROUTES.length, 'no route twice')
  assert.deepEqual(ROUTES.filter((route) => !(route in WHO)), [], 'a route with no entry in WHO: say who may call it')
  assert.deepEqual(Object.keys(WHO).filter((route) => !ROUTES.includes(route)), [], 'an entry in WHO for a route that is gone')
  for (const [route, who] of Object.entries(WHO)) assert.match(who, /^(public|p?c?m?)$/, `${route}: who is 'public' or some of p, c and m`)
  for (const route of ROUTES.filter((r) => r.includes(':'))) {
    assert.match(route, /^\S+ [^:]*:id[^:]*$/, `${route}: a route has one parameter, named :id`)
    assert.ok(kindOf(route), `say in OWNED what the :id of ${route} names`)
  }
})

test('everyone a route is not for is refused before anything is looked up: a visitor NOT_SIGNED_IN, another role NOT_ALLOWED', async () => {
  const mod = await moderator(server.base)
  try {
    const { mom, kid } = await household()
    const callers = { p: mom.api, c: kid, m: mod.api }
    for (const [route, who] of Object.entries(WHO)) {
      if (who === 'public') continue
      const visitor = await call(as(server.base), route)
      assert.deepEqual([visitor.status, visitor.body], [401, { code: 'NOT_SIGNED_IN' }], `${route} signed out`)
      for (const [letter, caller] of Object.entries(callers)) {
        if (who.includes(letter)) continue
        const res = await call(caller, route)
        assert.deepEqual([res.status, res.body], [403, { code: 'NOT_ALLOWED' }], `${route} as ${letter}`)
      }
    }
  } finally {
    await db.moderatorAction.deleteMany({ where: { moderatorId: mod.id } })
    await db.user.delete({ where: { id: mod.id } })
  }
})

test("another family's ids are NOT_FOUND on every route that takes one, for a parent and for a child, and nothing of that family changes", async () => {
  const a = await household()
  const b = await household()
  const theirs = await everything(a)
  try {
    const before = await theirs.state()
    for (const route of ROUTES.filter((r) => r.includes(':id') && WHO[r] !== 'm')) {
      const answers = []
      for (const who of [b.mom.api, b.kid]) {
        const res = await call(who, route, theirs.ids[kindOf(route)])
        answers.push(`${res.status} ${res.body?.code}`)
      }
      assert.ok(answers.every((answer) => answer === '404 NOT_FOUND' || answer === '403 NOT_ALLOWED'), `${route}: ${answers}`)
      assert.ok(answers.includes('404 NOT_FOUND'), `${route}: the role it is for must not find it (${answers})`)
    }
    assert.equal(await theirs.state(), before, 'nothing of the first family changed')
    assert.equal((await a.kid.get(`/proofs/${theirs.proof.id}/file`)).status, 200)
  } finally {
    await db.report.deleteMany({ where: { id: theirs.ids.report } }) // an unanswered report outlives its family
  }
})

test("a brother's or sister's ids are NOT_FOUND to a child on every route a child may call with one, and in a body they change nothing", async () => {
  const home = await household()
  const sister = await addChild(home.mom, 'Bela')
  const hers = await everything({ mom: home.mom, ...sister })
  try {
    const before = await hers.state()
    for (const route of ROUTES.filter((r) => r.includes(':id') && WHO[r].includes('c'))) {
      const res = await call(home.kid, route, hers.ids[kindOf(route)])
      assert.deepEqual([res.status, res.body], [404, { code: 'NOT_FOUND' }], route)
    }
    const pin = await home.kid.put('/pin', { taskId: hers.open.id })
    assert.deepEqual([pin.status, pin.body], [404, { code: 'NOT_FOUND' }], 'pin')
    assert.equal((await home.kid.post('/tasks/seen', { taskIds: [hers.done.id, hers.open.id] })).status, 204)
    assert.equal((await home.kid.post('/requests/seen', { ids: [hers.request.id] })).status, 204)
    const report = await home.kid.post('/reports', { details: 'About my sister’s task.', taskId: hers.open.id })
    assert.deepEqual([report.status, report.body.item], [201, undefined]) // the report goes, without her task
    await db.report.deleteMany({ where: { id: report.body.id } })
    assert.equal(await hers.state(), before, 'nothing of hers changed')
    assert.deepEqual((await home.kid.get('/tasks')).body, [])
    assert.deepEqual((await home.kid.get('/requests')).body, [])
    assert.deepEqual((await home.kid.get('/proofs/mine')).body, [])
  } finally {
    await db.report.deleteMany({ where: { id: hers.ids.report } })
  }
})

test("an id in a body: another family's child, task, proof, reward and request are NOT_FOUND, or change nothing", async () => {
  const a = await household()
  const b = await household()
  const theirs = await everything(a)
  const sent = [theirs.ids.report]
  try {
    // two things of family A's that wait to be seen: an approval, and an answer to the request
    const unseen = await made(a.mom.api.post('/tasks', taskFor(a.child, 'Read a page')))
    const waiting = (await made(a.kid.form(`/tasks/${unseen.id}/proofs`, { note: 'Read it' }))).proofs.at(-1)
    await made(a.mom.api.post(`/tasks/${unseen.id}/review`, { proofId: waiting.id, result: 'approved' }))
    await made(a.mom.api.post(`/requests/${theirs.request.id}/answer`, { result: 'given' }))
    assert.deepEqual((await a.kid.get('/counts')).body, { results: 1, answers: 1 })
    // family B's own task in review, to answer with family A's proof id, and one to move
    const own = await made(b.mom.api.post('/tasks', taskFor(b.child)))
    await made(b.kid.form(`/tasks/${own.id}/proofs`, { note: 'Done' }))
    const moving = await made(b.mom.api.post('/tasks', taskFor(b.child, 'To move')))
    const before = await theirs.state()

    const refusals = [
      ['a task for their child', () => b.mom.api.post('/tasks', taskFor(a.child)), 404, 'NOT_FOUND'],
      ['a series for their child', () => b.mom.api.post('/series', { ...taskFor(a.child), weekdays: 127, dueTime: '23:59' }), 404, 'NOT_FOUND'],
      ['a task moved to their child', () => b.mom.api.put(`/tasks/${moving.id}`, taskFor(a.child)), 404, 'NOT_FOUND'],
      ['their reward, changed', () => b.mom.api.post('/rewards', { id: theirs.reward.id, title: 'Ours now', cost: 10 }), 404, 'NOT_FOUND'],
      ['their proof, approved through our task', () => b.mom.api.post(`/tasks/${own.id}/review`, { proofId: theirs.proof.id, result: 'approved' }), 409, 'REVIEWED'],
      ['their reward, asked for', () => b.kid.post('/requests', { rewardId: theirs.reward.id }), 404, 'NOT_FOUND'],
      ['their reward, as a goal', () => b.kid.put('/goal', { rewardId: theirs.reward.id }), 404, 'NOT_FOUND'],
      ['their task, pinned', () => b.kid.put('/pin', { taskId: theirs.open.id }), 404, 'NOT_FOUND'],
    ]
    for (const [label, send, status, code] of refusals) {
      const res = await send()
      assert.deepEqual([res.status, res.body], [status, { code }], label)
    }
    assert.equal((await b.kid.post('/tasks/seen', { taskIds: [unseen.id] })).status, 204)
    assert.equal((await b.kid.post('/requests/seen', { ids: [theirs.request.id] })).status, 204)
    for (const who of [b.mom.api, b.kid]) {
      const report = await who.post('/reports', { details: 'About a task that is not ours.', taskId: theirs.open.id })
      sent.push(report.body.id)
      assert.deepEqual([report.status, report.body.item], [201, undefined]) // the report goes, without their task
    }
    assert.deepEqual((await a.kid.get('/counts')).body, { results: 1, answers: 1 }, 'both still wait for their own child')
    assert.equal(await theirs.state(), before, 'nothing of the first family changed')
  } finally {
    await db.report.deleteMany({ where: { id: { in: sent } } })
  }
})

test('every write route refuses a request without the X-GrowKid header; an id that is a NUL, a lone surrogate, a path, far too long or badly escaped is never a 500', async () => {
  for (const route of ROUTES.filter((r) => !r.startsWith('GET '))) {
    const [method, pattern] = route.split(' ')
    const res = await fetch(`${server.base}${pattern.replace(':id', randomUUID())}`, { method })
    assert.deepEqual([res.status, await res.json()], [403, { code: 'NOT_ALLOWED' }], route)
  }
  for (const id of ['%00', '%ED%A0%80', '..%2F..%2F.env', 'a'.repeat(300), '%ZZ']) {
    const { mom, kid } = await household() // a family for each id, so no caller nears the limit of 120 writes a minute
    for (const route of ROUTES.filter((r) => r.includes(':id'))) {
      for (const who of [mom.api, kid]) {
        const res = await call(who, route, id)
        assert.ok(res.status >= 400 && res.status < 500 && res.status !== 429, `${route} with ${id}: ${res.status}`)
      }
    }
  }
})
```

<!-- extract: attack -->
```js
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { gzipSync } from 'node:zlib'
import { db } from '../src/db.js'
import { STORAGE_BYTES } from '../src/rules.js'
import { png } from './fixtures.js'
import { as, family, moderator, start } from './helpers.js'

/** Final plan Phase 9, item 2: the attack pass. Each attack here was tried against the running app; the test keeps it failed. */

let server
const made = [] // every family this file makes, erased at the end
before(async () => {
  server = await start()
})
after(async () => {
  await Promise.all(made.map((mom) => mom.api.post('/me/delete', { password: mom.password })))
  await server.close()
})

const due = () => new Date(Date.now() + 2 * 86_400_000).toISOString()
const taskOf = (child, more) => ({ childId: child.id, category: 'chores', title: 'Tidy the room', instructions: 'Floor clear.', dueAt: due(), points: 20, ...more })
/** The answer's status must be `expected`; '4xx' takes any refusal. Returns the body. */
const is = async (expected, label, sending) => {
  const res = await sending
  if (expected === '4xx') assert.ok(res.status >= 400 && res.status < 500, `${label}: ${res.status}`)
  else assert.equal(res.status, expected, label)
  return res.body
}

/** A parent and one child, each signed in on their own client. */
async function household() {
  const mom = await family(server.base)
  made.push(mom)
  const login = { name: 'Asha', username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1' }
  const child = await is(201, 'add a child', mom.api.post('/children', { ...login, consent: true }))
  const kid = as(server.base)
  await is(200, 'the child signs in', kid.post('/session', { identifier: login.username, password: login.password }))
  return { mom, kid, child }
}
/** A task of this household with a note sent as proof, waiting for review. */
async function inReview({ mom, kid, child }, more) {
  const task = await is(201, 'task', mom.api.post('/tasks', taskOf(child, more)))
  const sent = await is(201, 'proof', kid.form(`/tasks/${task.id}/proofs`, { note: 'Done' }))
  return { id: task.id, proofId: sent.proofs.at(-1).id }
}

// ------------------------------------------------------------------ requests

test('a form-encoded, text/plain or multipart body is read as no body, never as fields, and never a 500', async () => {
  const { mom, child } = await household()
  const visitor = as(server.base)
  for (const type of ['application/x-www-form-urlencoded', 'text/plain', 'multipart/form-data; boundary=x']) {
    const header = { 'content-type': type }
    // the three types a form on another site can send: the right details in them sign nobody in
    const form = `identifier=${encodeURIComponent(mom.email)}&password=${encodeURIComponent(mom.password)}`
    assert.deepEqual(await is(401, type, visitor.post('/session', form, header)), { code: 'WRONG_DETAILS' })
    assert.deepEqual(await is(401, type, visitor.post('/session', JSON.stringify({ identifier: mom.email, password: mom.password }), header)), { code: 'WRONG_DETAILS' })
    const signUp = JSON.stringify({ name: 'Form Parent', email: `form-${randomUUID()}@example.com`, password: 'grown-up-pass-1', country: 'IN', consent: true })
    assert.equal((await is(400, type, visitor.post('/parents', signUp, header))).code, 'INVALID')
    assert.deepEqual(await is(404, type, mom.api.post('/tasks', JSON.stringify(taskOf(child)), header)), { code: 'NOT_FOUND' }) // no childId was read
    assert.equal((await is(400, type, mom.api.put('/settings', JSON.stringify({ leaderboard: true }), header))).code, 'INVALID')
    assert.equal((await is(400, type, mom.api.put(`/children/${child.id}/quest`, JSON.stringify({ target: 2, bonus: 10 }), header))).code, 'INVALID') // a typed body never removes a quest
  }
  assert.equal((await mom.api.get('/settings')).body.leaderboard, false)
  assert.deepEqual((await mom.api.get('/tasks')).body, [])
})

test('__proto__ and constructor in a body change no object and no row', async () => {
  const { mom, child } = await household()
  const evil = '"__proto__":{"role":"moderator","status":"approved","polluted":true},"constructor":{"prototype":{"polluted":true}}'
  const email = `proto-${randomUUID()}@example.com`
  const visitor = as(server.base)
  await is(201, 'sign-up', visitor.post('/parents', `{"name":"Proto Parent","email":"${email}","password":"grown-up-pass-1","country":"IN","consent":true,${evil}}`))
  made.push({ api: visitor, password: 'grown-up-pass-1' })
  const parent = await db.user.findUniqueOrThrow({ where: { email } })
  assert.deepEqual([parent.role, parent.tokenVersion, parent.pausedAt, parent.parentId], ['parent', 0, null, null])
  const task = await is(201, 'task', mom.api.post('/tasks', `{"childId":"${child.id}","category":"chores","title":"Tidy the room","instructions":"Floor clear.","dueAt":"${due()}","points":20,${evil}}`))
  assert.equal((await db.task.findUniqueOrThrow({ where: { id: task.id } })).status, 'todo')
  await is(404, 'only the attack', mom.api.post('/tasks', `{${evil}}`)) // every field is missing, so no child is named
  await is(401, 'a body that is a list', visitor.post('/session', `[{${evil}}]`))
  // the app runs in this process, so a polluted prototype would show here
  assert.equal({}.polluted, undefined)
  assert.equal({}.role, undefined)
  assert.equal(Object.hasOwn(Object.prototype, 'polluted'), false)
})

test('a body that unpacks or nests far past the limit is refused, never a 500', async () => {
  const headers = { 'x-growkid': '1', 'content-type': 'application/json', 'content-encoding': 'gzip' }
  const bomb = gzipSync(Buffer.alloc(8 * 1024 * 1024, 0x20)) // 8 MB of spaces, a few kB packed
  assert.ok(bomb.length < 20 * 1024, 'under the limit as sent')
  const res = await fetch(`${server.base}/session`, { method: 'POST', headers, body: bomb })
  assert.deepEqual([res.status, await res.json()], [400, { code: 'INVALID' }])
  const deep = `${'['.repeat(9_000)}${']'.repeat(9_000)}` // 18 kB of nesting
  await is('4xx', 'deep nesting', as(server.base).post('/session', deep))
  await is('4xx', 'deep nesting in a field', as(server.base).post('/session', `{"identifier":${deep},"password":${deep}}`))
})

const DIRTY = 'ab\u0000cd\ud800ef' // a NUL and a lone surrogate: PostgreSQL refuses the first, Prisma the second
const CLEAN = 'abcd�ef' // what errors.js text() makes of it

test('a NUL and a lone surrogate in any text field or id are never a 500, and no NUL is stored', async () => {
  const home = await household()
  const { mom, kid, child } = home
  const mod = await moderator(server.base)
  try {
    // accounts
    const visitor = as(server.base)
    const signedUp = await is(201, 'sign-up', visitor.post('/parents', { name: DIRTY, email: `dirty-${randomUUID()}\u0000@example.com`, password: 'grown-up-pass-1', country: 'IN', consent: true }))
    made.push({ api: visitor, password: 'grown-up-pass-1' })
    assert.equal(signedUp.name, CLEAN)
    await is(400, 'sign-up, every field', as(server.base).post('/parents', { name: DIRTY, email: DIRTY, password: DIRTY, country: DIRTY, consent: DIRTY }))
    await is(401, 'sign-in', as(server.base).post('/session', { identifier: DIRTY, password: DIRTY }))
    await is(403, 'change password', mom.api.put('/me/password', { current: DIRTY, next: DIRTY }))
    await is(400, 'country', mom.api.put('/settings/country', { country: DIRTY }))
    await is(400, 'leaderboard', mom.api.put('/settings', { leaderboard: DIRTY }))
    await is(400, "a child's username", mom.api.post('/children', { name: 'Kid', username: DIRTY, password: 'child-pass-1', consent: true }))
    assert.equal((await is(201, "a child's name", mom.api.post('/children', { name: DIRTY, username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1', consent: true }))).name, CLEAN)
    assert.equal((await is(200, 'rename a child', mom.api.patch(`/children/${child.id}`, { name: DIRTY }))).name, CLEAN)
    await is(400, "a child's new password", mom.api.put(`/children/${child.id}/password`, { password: DIRTY }))
    await is(400, 'rest day', mom.api.post(`/children/${child.id}/rest-days`, { day: DIRTY, rest: true }))
    // tasks, series, rewards, the quest
    const words = { title: DIRTY, instructions: DIRTY, doneLooksLike: DIRTY }
    const task = await is(201, 'task', mom.api.post('/tasks', taskOf(child, words)))
    assert.deepEqual([task.title, task.instructions, task.doneLooksLike], [CLEAN, CLEAN, CLEAN])
    await is(200, 'edit a task', mom.api.put(`/tasks/${task.id}`, taskOf(child, words)))
    await is(404, "a task's child", mom.api.post('/tasks', taskOf({ id: DIRTY })))
    await is(400, "a task's kind and time", mom.api.post('/tasks', taskOf(child, { category: DIRTY, dueAt: DIRTY })))
    await is(201, 'series', mom.api.post('/series', { ...taskOf(child, words), weekdays: 127, dueTime: '23:59' }))
    await is(400, "a series' time", mom.api.post('/series', { ...taskOf(child), weekdays: 127, dueTime: DIRTY }))
    const reward = await is(201, 'reward', mom.api.post('/rewards', { title: DIRTY, cost: 10 }))
    assert.equal(reward.title, CLEAN)
    await is(404, "a reward's id", mom.api.post('/rewards', { id: DIRTY, title: 'Pick the film', cost: 10 }))
    assert.equal((await is(200, 'quest', mom.api.put(`/children/${child.id}/quest`, { target: 5, bonus: 10, surprise: DIRTY }))).surprise, CLEAN)
    // proof and review
    const earned = await inReview(home)
    const approved = await is(200, 'a cheer', mom.api.post(`/tasks/${earned.id}/review`, { proofId: earned.proofId, result: 'approved', cheer: { kind: 'proud', line: DIRTY } }))
    assert.equal(approved.proofs.at(-1).review.cheer.line, CLEAN)
    await is(204, 'results seen', kid.post('/tasks/seen', { taskIds: [earned.id, DIRTY] }))
    const open = await is(201, 'task', mom.api.post('/tasks', taskOf(child)))
    const sent = await is(201, "a proof's note", kid.form(`/tasks/${open.id}/proofs`, { note: DIRTY }))
    assert.equal(sent.proofs.at(-1).note, CLEAN)
    const back = await is(200, 'a send-back note', mom.api.post(`/tasks/${open.id}/review`, { proofId: sent.proofs.at(-1).id, result: 'sentBack', note: DIRTY }))
    assert.equal(back.proofs.at(-1).review.note, CLEAN)
    await is(409, "a review's proof id", mom.api.post(`/tasks/${open.id}/review`, { proofId: DIRTY, result: 'approved' }))
    // the child's own writes
    await is(404, "a request's reward", kid.post('/requests', { rewardId: DIRTY }))
    const request = await is(201, 'request', kid.post('/requests', { rewardId: reward.id }))
    assert.equal((await is(200, 'a decline note', mom.api.post(`/requests/${request.id}/answer`, { result: 'declined', note: DIRTY }))).note, CLEAN)
    await is(204, 'answers seen', kid.post('/requests/seen', { ids: [request.id, DIRTY] })) // F1: this id was a 500 until Phase 9
    await is(404, 'goal', kid.put('/goal', { rewardId: DIRTY }))
    await is(404, 'pin', kid.put('/pin', { taskId: DIRTY }))
    await is(400, 'suggestion', kid.post('/suggestions', { ideaId: DIRTY }))
    await is(400, 'badge', kid.put('/me/avatar', { colour: DIRTY, stickerId: DIRTY }))
    // reports
    const report = await is(201, 'report', kid.post('/reports', { details: DIRTY, taskId: DIRTY }))
    assert.equal(report.details, CLEAN)
    assert.equal((await is(200, "a moderator's answer", mod.api.post(`/reports/${report.id}/resolve`, { note: DIRTY }))).resolution.note, CLEAN)
    // query strings
    await is(200, 'history paging', mom.api.get('/tasks/history?offset=%00&limit=%ED%A0%80'))
    await is(200, 'my proofs paging', kid.get('/proofs/mine?offset=%00&limit=a%00b'))
    // Phase 8's routes
    await is('4xx', 'recovery', as(server.base).post('/recovery', { email: DIRTY, code: DIRTY, password: DIRTY }))
    await is('4xx', 'a new recovery code', mom.api.post('/me/recovery', { password: DIRTY }))
    await is('4xx', 'export', mom.api.post('/me/export', { password: DIRTY }))
    await is('4xx', 'keep proof', mom.api.put('/settings/keep-proof', { days: DIRTY }))

    const ours = { OR: [{ id: mom.user.id }, { parentId: mom.user.id }] }
    const stored = await Promise.all([
      db.user.findMany({ where: ours }),
      db.task.findMany({ where: { child: { parentId: mom.user.id } }, include: { proofs: true } }),
      db.taskSeries.findMany({ where: { child: { parentId: mom.user.id } } }),
      db.reward.findMany({ where: { parentId: mom.user.id } }),
      db.rewardRequest.findMany({ where: { parentId: mom.user.id } }),
      db.quest.findMany({ where: { child: { parentId: mom.user.id } } }),
      db.report.findMany({ where: { by: ours } }),
    ])
    assert.equal(JSON.stringify(stored).includes('\\u0000'), false, 'no NUL in any row')
    assert.equal(JSON.stringify(stored).includes(CLEAN.slice(0, 4)), true, 'and the rows read are the ones written')
  } finally {
    await db.moderatorAction.deleteMany({ where: { moderatorId: mod.id } })
    await db.user.delete({ where: { id: mod.id } })
  }
})

// ------------------------------------------------------------------ role and field

test('no write takes a field it does not name: a role, a status, a version, a pause, a family, a hash, a time or a result sent in a body is never stored', async () => {
  const home = await household()
  const other = await household()
  const { mom, kid, child } = home
  const long = '2020-01-01T00:00:00.000Z'
  const recent = (at) => at > new Date('2026-01-01')
  const EXTRA = {
    id: randomUUID(), role: 'moderator', status: 'approved', tokenVersion: 99, pausedAt: long, parentId: other.mom.user.id, passwordHash: 'x', totpSecret: 'x',
    totpLastStep: 1, recoveryHash: 'x', consentAt: long, consentVersion: 'x', keepProofDays: 365, agreedAt: long, avatar: 'navy:first-task', goalRewardId: randomUUID(),
    createdAt: long, resultSeen: false, pinned: true, seriesId: randomUUID(), seriesDay: '2020-01-01', removedAt: long, reviewBy: 'Someone Else', reviewedAt: long,
    late: true, answeredBy: 'Someone Else', answeredAt: long, answerSeen: true, byId: other.mom.user.id, from: 'child', resolvedAt: long, resolutionNote: 'x', sentAt: long,
  }
  const user = (id) => db.user.findUniqueOrThrow({ where: { id } })

  // sign-up
  const visitor = as(server.base)
  const email = `extra-${randomUUID()}@example.com`
  await is(201, 'sign-up', visitor.post('/parents', { ...EXTRA, name: 'Extra Parent', email, password: 'grown-up-pass-1', country: 'IN', consent: true, leaderboard: true }))
  made.push({ api: visitor, password: 'grown-up-pass-1' })
  const signedUp = await db.user.findUniqueOrThrow({ where: { email } })
  assert.deepEqual(
    [signedUp.role, signedUp.tokenVersion, signedUp.pausedAt, signedUp.parentId, signedUp.leaderboard, signedUp.avatar, signedUp.goalRewardId, signedUp.agreedAt, signedUp.totpSecret ?? null, signedUp.keepProofDays ?? 90],
    ['parent', 0, null, null, false, null, null, null, null, 90],
  )
  assert.notEqual(signedUp.id, EXTRA.id)
  assert.match(signedUp.passwordHash, /^\$2/)
  assert.notEqual(signedUp.recoveryHash, 'x')
  assert.ok(recent(signedUp.consentAt) && recent(signedUp.createdAt) && signedUp.consentVersion !== 'x')

  // the parent's own row: only the field each route names moves
  const parent = await user(mom.user.id)
  await is(200, 'name', mom.api.patch('/me', { ...EXTRA, name: 'New Name', email: `x-${email}`, username: 'changed1', country: 'US', leaderboard: true }))
  assert.deepEqual(await user(mom.user.id), { ...parent, name: 'New Name' })
  await is(200, 'leaderboard', mom.api.put('/settings', { ...EXTRA, leaderboard: true, country: 'US', name: 'Other' }))
  await is(200, 'country', mom.api.put('/settings/country', { ...EXTRA, country: 'US', leaderboard: false, name: 'Other' }))
  assert.deepEqual(await user(mom.user.id), { ...parent, name: 'New Name', leaderboard: true, country: 'US' })

  // a child's row
  const added = await is(201, 'add a child', mom.api.post('/children', { ...EXTRA, name: 'Second', username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1', consent: true }))
  const second = await user(added.id)
  assert.deepEqual([second.role, second.parentId, second.tokenVersion, second.pausedAt, second.avatar, second.agreedAt, second.goalRewardId], ['child', mom.user.id, 0, null, null, null, null])
  assert.ok(added.id !== EXTRA.id && recent(second.consentAt) && recent(second.createdAt))
  const first = await user(child.id)
  await is(200, 'rename a child', mom.api.patch(`/children/${child.id}`, { ...EXTRA, name: 'Renamed', username: 'changed1' }))
  await is(200, 'sound', kid.put('/me/sound', { ...EXTRA, sound: false, name: 'Hacker' }))
  assert.deepEqual(await user(child.id), { ...first, name: 'Renamed', sound: false })

  // a task, its proof and its review
  const task = await is(201, 'task', mom.api.post('/tasks', { ...EXTRA, ...taskOf(child) }))
  await is(200, 'edit a task', mom.api.put(`/tasks/${task.id}`, { ...EXTRA, ...taskOf(child, { title: 'Edited' }) }))
  const row = await db.task.findUniqueOrThrow({ where: { id: task.id } })
  assert.deepEqual([row.status, row.resultSeen, row.pinned, row.seriesId, row.seriesDay, row.childId, row.title], ['todo', true, false, null, null, child.id, 'Edited'])
  assert.ok(task.id !== EXTRA.id && recent(row.createdAt))
  const sent = await is(201, 'proof', kid.form(`/tasks/${task.id}/proofs`, { note: 'Done', result: 'approved' }))
  const proofId = sent.proofs.at(-1).id
  const proof = await db.proof.findUniqueOrThrow({ where: { id: proofId } })
  assert.deepEqual([proof.result, proof.reviewBy, proof.reviewedAt, proof.late], [null, null, null, false])
  await is(200, 'review', mom.api.post(`/tasks/${task.id}/review`, { ...EXTRA, proofId, result: 'approved', points: 100 }))
  const reviewed = await db.proof.findUniqueOrThrow({ where: { id: proofId } })
  assert.ok(reviewed.reviewBy === 'New Name' && recent(reviewed.reviewedAt))
  assert.equal((await db.task.findUniqueOrThrow({ where: { id: task.id } })).points, 20)
  await is(204, 'results seen', kid.post('/tasks/seen', { ...EXTRA, taskIds: [task.id] }))

  // a series and the quest
  const series = await is(201, 'series', mom.api.post('/series', { ...EXTRA, ...taskOf(child), weekdays: 1, dueTime: '23:59' }))
  await is(200, 'edit a series', mom.api.put(`/series/${series.id}`, { ...EXTRA, ...taskOf(added), weekdays: 1, dueTime: '23:59' })) // the child cannot change
  const seriesRow = await db.taskSeries.findUniqueOrThrow({ where: { id: series.id } })
  assert.ok(seriesRow.childId === child.id && series.id !== EXTRA.id && recent(seriesRow.createdAt))
  await is(200, 'quest', mom.api.put(`/children/${child.id}/quest`, { ...EXTRA, childId: added.id, setAt: long, target: 5, bonus: 10 }))
  const quest = await db.quest.findUniqueOrThrow({ where: { childId: child.id } })
  assert.ok(recent(quest.setAt))
  assert.equal(await db.quest.count({ where: { childId: added.id } }), 0)

  // a reward, a request and its answer
  const { id: _id, ...noId } = EXTRA // a reward's own `id` means "change that one"
  const reward = await is(201, 'reward', mom.api.post('/rewards', { ...noId, title: 'Pick the film', cost: 10 }))
  const rewardRow = await db.reward.findUniqueOrThrow({ where: { id: reward.id } })
  assert.ok(rewardRow.parentId === mom.user.id && recent(rewardRow.createdAt))
  const request = await is(201, 'request', kid.post('/requests', { ...EXTRA, rewardId: reward.id, cost: 0, title: 'Free', childId: added.id }))
  const asked = await db.rewardRequest.findUniqueOrThrow({ where: { id: request.id } })
  assert.deepEqual([asked.status, asked.cost, asked.title, asked.childId, asked.parentId, asked.answeredBy, asked.answerSeen], ['requested', 10, 'Pick the film', child.id, mom.user.id, null, true])
  assert.ok(request.id !== EXTRA.id && recent(asked.requestedAt))
  await is(200, 'answer', mom.api.post(`/requests/${request.id}/answer`, { ...EXTRA, result: 'given', note: 'kept only for a decline' }))
  const answered = await db.rewardRequest.findUniqueOrThrow({ where: { id: request.id } })
  assert.deepEqual([answered.status, answered.note, answered.answeredBy, answered.answerSeen, answered.cost], ['given', '', 'New Name', false, 10])
  assert.ok(recent(answered.answeredAt))

  // a report
  const report = await is(201, 'report', mom.api.post('/reports', { ...EXTRA, details: 'Something is wrong.', item: { title: 'made up' } }))
  try {
    const sentReport = await db.report.findUniqueOrThrow({ where: { id: report.id } })
    assert.deepEqual([sentReport.byId, sentReport.from, sentReport.resolvedAt, sentReport.resolutionNote, sentReport.item], [mom.user.id, 'parent', null, null, null])
    assert.ok(report.id !== EXTRA.id && recent(sentReport.sentAt))
  } finally {
    await db.report.deleteMany({ where: { id: report.id } }) // an unanswered report outlives its family
  }
})

// ------------------------------------------------------------------ races

test('two uploads at once at the edge of the quota: both may land, and the family is over by no more than the files in flight', async () => {
  const { mom, kid, child } = await household()
  const login = { name: 'Bela', username: `k${randomUUID().slice(0, 8)}`, password: 'child-pass-1' }
  const sister = await is(201, 'a second child', mom.api.post('/children', { ...login, consent: true })) // one upload at a time per child (L8), so the race needs two
  const sis = as(server.base)
  await is(200, 'she signs in', sis.post('/session', { identifier: login.username, password: login.password }))
  const [mine, hers, held, later] = await Promise.all([child, sister, child, child].map((who) => is(201, 'task', mom.api.post('/tasks', taskOf(who)))))
  const picture = png()
  // a row that says the family holds all of its 2 GiB but the room for one picture: only the size is counted, so no file is behind it
  await db.proof.create({ data: { id: randomUUID(), taskId: held.id, fileType: 'video/mp4', fileSize: STORAGE_BYTES - picture.length, sentAt: new Date(), late: false } })
  const file = { bytes: picture, name: 'p.png' }
  const answers = await Promise.all([kid.form(`/tasks/${mine.id}/proofs`, {}, file), sis.form(`/tasks/${hers.id}/proofs`, {}, file)])
  for (const res of answers) assert.ok(res.status === 201 || (res.status === 409 && res.body.fields.quota === 'storage'), `${res.status}`)
  const landed = answers.filter((res) => res.status === 201).length
  assert.ok(landed >= 1, 'one always fits')
  const total = async () => (await db.proof.aggregate({ _sum: { fileSize: true }, where: { task: { child: { parentId: mom.user.id } } } }))._sum.fileSize
  assert.equal(await total(), STORAGE_BYTES + (landed - 1) * picture.length) // over by the second file at most
  // once the race is over the quota holds again
  const after = await kid.form(`/tasks/${later.id}/proofs`, {}, file)
  assert.deepEqual([after.status, after.body], [409, { code: 'QUOTA', fields: { quota: 'storage' } }])
})
```

<!-- extract: rules -->
```js

// ------------------------------------------------------------------ crafted files (final plan Phase 9)

test('MP4: a box that runs past its parent, a size under 8, a 64-bit size past the file or under its own head, and a head cut short are FILE_TYPE', () => {
  const bad = refusedAs('FILE_TYPE')
  const ftyp = box('ftyp', Buffer.from('isom0000isom'))
  /** A box whose size field says `size`, whatever it holds. */
  const sized = (size, type, ...parts) => {
    const made = box(type, ...parts)
    made.writeUInt32BE(size)
    return made
  }
  /** A file whose moov has a 64-bit size field saying `size`. */
  const wide = (size) => {
    const head = Buffer.alloc(16)
    head.writeUInt32BE(1)
    head.write('moov', 4, 'latin1')
    head.writeBigUInt64BE(size, 8)
    return Buffer.concat([ftyp, head, track()])
  }
  const real = 16 + track().length
  strip(wide(BigInt(real)), 'video/mp4') // the control: the true size parses
  assert.throws(() => strip(Buffer.concat([ftyp, box('moov', track(), sized(999, 'udta', Buffer.from(SECRET))), box('mdat')]), 'video/mp4'), bad, 'a udta longer than its moov')
  assert.throws(() => strip(Buffer.concat([ftyp, box('moov', sized(999, 'trak', track().subarray(8)))]), 'video/mp4'), bad, 'a trak longer than its moov')
  for (const size of [2, 4, 7]) assert.throws(() => strip(Buffer.concat([ftyp, box('moov', track(), sized(size, 'udta'))]), 'video/mp4'), bad, `a size of ${size}`)
  for (const size of [BigInt(real + 1), 1n << 40n, 0xffffffffffffffffn, 8n, 0n]) assert.throws(() => strip(wide(size), 'video/mp4'), bad, `a 64-bit size of ${size}`)
  assert.throws(() => strip(Buffer.concat([ftyp, Buffer.from([0, 0, 0, 1]), Buffer.from('moov')]), 'video/mp4'), bad, 'a 64-bit size that is not there')
  assert.throws(() => strip(Buffer.concat([ftyp, box('moov', track()), Buffer.from([0, 0, 0])]), 'video/mp4'), bad, 'three bytes left over')
})

test('MP4: a box of size 0 that is not the last runs to the end, as the format says, so what follows a udta of size 0 is blanked with it', () => {
  const start = [box('ftyp', Buffer.from('isom0000isom')), box('moov', box('mvhd', Buffer.alloc(100)), track())]
  const udta = location()
  udta.writeUInt32BE(0) // size 0: to the end of the file
  const original = Buffer.concat([...start, udta, box('mdat', Buffer.from('frames'))])
  const stored = strip(original, 'video/mp4')
  assert.equal(stored.length, original.length)
  assert.equal(has(stored, SECRET), false)
  assert.equal(has(stored, 'frames'), false) // inside the udta, by the format's own rule
  // Accepted (Phase 9): the other way round, a box of size 0 in front of a udta holds that udta as its contents, so no udta is found
  // and its bytes stay. To a reader that follows the format there is no udta in that file either. Only a file built by hand has
  // this, and what it keeps is the uploader's own.
})

test('lengths that point past the file are FILE_TYPE, never a 500', () => {
  const bad = refusedAs('FILE_TYPE')
  const header = png()
  header.writeUInt32BE(0xffffffff, 8) // the first chunk says it is 4 GB long
  assert.throws(() => strip(header, 'image/png'), bad)
  assert.throws(() => strip(png().subarray(0, 10), 'image/png'), bad) // ends inside a chunk's length
  assert.throws(() => strip(png(chunk('tEXt', Buffer.alloc(5))).subarray(0, 40), 'image/png'), bad) // ends inside a chunk
  for (const [at, size] of [[4, webp().length], [4, 0xffffffff], [4, 3], [16, 0xffffffff], [16, 0xfffffff0]]) {
    const picture = webp()
    picture.writeUInt32LE(size, at) // 4: the RIFF size; 16: the first chunk's size
    assert.throws(() => strip(picture, 'image/webp'), bad, `WebP ${at} ${size}`)
  }
  assert.throws(() => strip(Buffer.from('RIFF\0\0\0\0WEBP'), 'image/webp'), bad) // a RIFF size of nothing
  const start = Buffer.from([0xff, 0xd8])
  for (const length of [0, 1, 0xffff]) assert.throws(() => strip(Buffer.concat([start, Buffer.from([0xff, 0xe1, length >> 8, length & 255]), Buffer.from('Exif\0\0')]), 'image/jpeg'), bad, `JPEG ${length}`)
  assert.throws(() => strip(Buffer.concat([start, segment(0xe0, 'JFIF'), Buffer.from([0xff])]), 'image/jpeg'), bad) // ends inside a marker
  for (const [bytes, type] of [[Buffer.alloc(0), 'image/jpeg'], [Buffer.alloc(0), 'image/png'], [Buffer.alloc(0), 'image/webp'], [Buffer.alloc(0), 'video/mp4'], [Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg'], [Buffer.from('89504e47', 'hex'), 'image/png']]) {
    assert.throws(() => strip(bytes, type), bad, `${type} of ${bytes.length} bytes`)
  }
})
```

<!-- extract: boot -->
```js

test('a caller that never finishes its headers is cut off with 408 within 25 seconds, and an ordinary request is answered (N1)', { timeout: 45_000 }, async () => {
  const child = spawn(process.execPath, [entry], { env: { ...process.env, PORT: '0' } })
  let out = ''
  const listening = new Promise((done, fail) => {
    child.stdout.on('data', (chunk) => {
      const found = /listening on 127\.0\.0\.1:(\d+)/.exec((out += chunk))
      if (found) done(Number(found[1]))
    })
    child.on('exit', (code) => fail(new Error(`exited with ${code}`)))
  })
  try {
    const port = await listening
    const began = Date.now()
    const socket = net.connect(port, '127.0.0.1')
    socket.write('GET /api/session HTTP/1.1\r\nHost: x\r\n') // the headers never end
    let answer = ''
    socket.on('data', (chunk) => (answer += chunk))
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/session`)).status, 200) // meanwhile, a caller that does finish is served
    await once(socket, 'close')
    const seconds = (Date.now() - began) / 1000
    assert.match(answer, /^HTTP\/1\.1 408 /)
    assert.ok(seconds >= 14 && seconds < 25, `cut off after ${seconds} s`)
  } finally {
    child.kill()
  }
})
```

<!-- extract: stall -->
```js
// By hand, once (final plan Phase 9, N1): a request whose body never finishes. Run from server/: node --env-file=.env.test <this file>
import { spawn } from 'node:child_process'
import net from 'node:net'

const child = spawn(process.execPath, ['src/index.js'], { env: { ...process.env, PORT: '0' } })
let out = ''
const port = await new Promise((done, fail) => {
  child.stdout.on('data', (chunk) => {
    const found = /listening on 127\.0\.0\.1:(\d+)/.exec((out += chunk))
    if (found) done(Number(found[1]))
  })
  child.on('exit', (code) => fail(new Error(`the server exited with ${code}`)))
})
const began = Date.now()
const socket = net.connect(port, '127.0.0.1')
socket.write('POST /api/session HTTP/1.1\r\nHost: x\r\nX-GrowKid: 1\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{"id"') // 5 of 100 bytes, then nothing
let answer = ''
socket.on('data', (chunk) => (answer += chunk))
socket.on('close', () => {
  console.log(`closed after ${((Date.now() - began) / 1000).toFixed(1)} s: ${answer.split('\r\n')[0] || 'no answer'}`)
  child.kill()
})
```

<!-- extract: timing -->
```js
// Final plan Phase 9, "Guessing and naming": does an answer's time tell an account that exists from one that does not?
// Run from server/: node --env-file=.env.test <this file>. Each case is tried 7 times from its own address; the median is printed.
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const load = (file) => import(pathToFileURL(path.resolve(file)).href) // from server/, wherever this script is kept
const { db } = await load('src/db.js')
const { as, family, start } = await load('test/helpers.js')

const server = await start()
const mom = await family(server.base)
const TRIES = 7
const median = (list) => list.toSorted((a, b) => a - b)[Math.floor(list.length / 2)]
async function time(label, route, body) {
  const api = as(server.base) // its own address, so no limit fills
  const took = []
  let status
  for (let i = 0; i < TRIES; i++) {
    const began = performance.now()
    status = (await api.post(route, body)).status
    took.push(performance.now() - began)
  }
  console.log(`${label}: ${Math.round(median(took))} ms (answer ${status})`)
  return median(took)
}
const within = (name, list) => console.log(`${name}: the slowest is ${(Math.max(...list) / Math.min(...list)).toFixed(2)} times the fastest (pass when 1.25 or less)`)

const real = console.warn
console.warn = () => {} // the security log's lines
try {
  within('sign-in', [
    await time('sign-in, unknown account', '/session', { identifier: `nobody-${Date.now()}@example.com`, password: 'not-the-password' }),
    await time('sign-in, wrong password', '/session', { identifier: mom.email, password: 'not-the-password' }),
  ])
  if ((await as(server.base).post('/recovery', {})).status === 404) console.log('recovery: no such route (Phase 8 is not built)')
  else {
    const bare = await family(server.base)
    await db.user.update({ where: { id: bare.user.id }, data: { recoveryHash: null } })
    const guess = { code: 'ABCDEFGHIJKLMNOP', password: 'another-pass-1' }
    try {
      within('recovery', [
        await time('recovery, unknown email', '/recovery', { ...guess, email: `nobody-${Date.now()}@example.com` }),
        await time('recovery, an account with no code', '/recovery', { ...guess, email: bare.email }),
        await time('recovery, wrong code', '/recovery', { ...guess, email: mom.email }),
      ])
    } finally {
      await bare.api.post('/me/delete', { password: bare.password })
    }
  }
} finally {
  console.warn = real
  await mom.api.post('/me/delete', { password: mom.password })
  await server.close()
}
```

<!-- extract: tidy -->
```js
// Only after a test run died before its clean-up: removes from growkid_test the families whose proof files are still in the test
// upload folder, with the files. Run from server/: node --env-file=.env.test <this file>
import assert from 'node:assert/strict'
import { readdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const { db } = await import(pathToFileURL(path.resolve('src/db.js')).href)
assert.match(decodeURIComponent(new URL(process.env.DATABASE_URL).pathname), /_test$/, 'only ever in a database named *_test')
const dir = process.env.UPLOAD_DIR
const fresh = [] // every file is looked up before any family goes: one family may hold several
for (const name of await readdir(dir)) {
  const proof = await db.proof.findUnique({ where: { id: name }, include: { task: { include: { child: true } } } })
  if (proof && Date.now() - proof.sentAt <= 2 * 3_600_000) fresh.push({ name, parentId: proof.task.child.parentId })
  else console.log(`${name.slice(0, 8)}: left alone (${proof ? 'older than two hours' : 'no proof names it'})`)
}
const parents = [...new Set(fresh.map((file) => file.parentId))]
const gone = await db.user.deleteMany({ where: { OR: [{ id: { in: parents } }, { parentId: { in: parents } }] } })
await Promise.all(fresh.map((file) => unlink(path.join(dir, file.name))))
console.log(`removed ${gone.count} users of ${parents.length} families, and ${fresh.length} files`)
console.log(`files left in the folder: ${(await readdir(dir)).length}`)
await db.$disconnect()
```
