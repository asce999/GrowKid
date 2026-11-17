# Phase 8 plan: Trust and data

Written on 16 November 2026 by the planning session, for the building session. It follows `final-plan.md` section 4. Read that section and section 5 first, then this file, once, in full. Build exactly this, from step 2 on. Do not ask the phase's question again: section 1 below holds the answer.

## 0. How to use this plan

**What is settled.** Every design choice here is made. Where this plan names a function, a field, a status code or a sentence, use it as written.

**What is proven.** The code blocks marked *proven* were run on 16 November 2026 against Node 22.23.2 and the repository at commit `c715b4e`: the RFC 4648 and RFC 6238 vectors, a zip opened by Windows' own `Expand-Archive` and by `tar`, and the MP4 walk over built fixtures. Copy them as they are. Code not marked *proven* is exact in intent but was not run: write it, then run its test.

**What you must check yourself.** Every `file:line` was true at `c715b4e`. Lines drift as you build, so find each anchor with Grep before editing. If the text an item quotes is not in the file, or the code contradicts a claim made here, stop that item and report it. Do not redesign it, and do not guess what was meant.

**Never state a fact you did not read or run.** That covers a library's behaviour, a file's contents, a test count and a screen's look. If you have not checked it in this session, check it or say it is unchecked.

**Spend tokens on the work, not on reading.**
- Each item has a "Read first" list. Read those ranges in one parallel batch, and nothing else. Do not read the whole repository, and do not re-read a file already in context.
- A full Read of some files is refused by a hook, with a message naming `smart_outline`. Do not retry it. Read with `offset` and `limit`, which is allowed. This applies to `client/src/api/index.js` at least.
- While building, run one test file, not the suite: `cd server && npm run pretest && node --env-file=.env.test --test --test-concurrency=1 test/<file>.test.js`. Never run two test commands at once: they share one database.
- Run `npm run verify:quick` after each item, and the full `npm run verify` (about five minutes) once per part, at the end.
- Shell scripts that hold curly quotes or backticks break in a heredoc and in `node -e`. Write the script to the scratchpad with Write and run it with `node`.

**Size.** This phase is large. If the context grows heavy, stop at an item boundary as `final-plan.md` section 4 says. The natural split is after item 3: part 1 is items 0 to 3 (the moderator), part 2 is items 4 to 7 (the family's data).

## 1. Answers and decisions recorded

| Question or choice | Answer | Whose |
|---|---|---|
| The source for the real screening word list | None. **Item 8 is skipped.** Leave it unticked and write "skipped: no list was given (16 November 2026)" beside it. | The user, 16 November 2026 |
| May a moderator with no authenticator secret sign in? | No. That includes the seeded demo moderator, until the user enrols it by hand (section 9). | This plan, T1 |
| May a report be answered while its family is paused? | No: `LOCKED`. Nobody in the family could read the answer, and the list would lose the only place to unpause from. | This plan, T2 |
| Is the moderator's record removed when a family is deleted? | No. It holds the moderator's id, a report id, an action and a time, and nothing of the family's. This is the one new table that `erase()` leaves alone; Privacy says so. | This plan, T3 |
| What "N" is in "Photo removed after N days" | The whole days from the task's approval to the removal, worked out from two stored times. It equals the family's setting when the server runs daily, and it stays true if the setting changes later. | This plan, T4 |
| Which clock deletes old proof files | The real one, never the development clock. A clock moved a year ahead would delete every family's files for good. | This plan, T4 |

Each row marked "This plan" is an assumption. Record it in sitemap section 12 under its id and name it in the phase report for the user to confirm.

## 2. What step 0 will find

`npm run verify` is red at `c715b4e` between 18:00 and midnight, local time, and green before 18:00. One check fails: `client/e2e/routes.spec.js`, on `/` at 320 px ("wider than the screen").

The cause was found and confirmed on 16 November. Landing's sample task (`client/src/pages/Landing.jsx:125-141`) is due tomorrow at 18:00, so after 18:00 today it is within 24 hours and shows the "Due soon" tag (Phase 7, item 5). The tag is longer than "To do", and the task card's top row does not wrap (`client/src/components/Task.jsx:81`), so the card grows 4 px wider than a 320 px screen. Swapping the tag's words for "To do" in the page removed the overflow; the tag is the only cause. Every task card has the same row, so Today has the same fault for a child whose task is due soon.

So: if step 0's `npm run verify` fails with exactly that one failure, do not stop. Build item 0 first, then go on. Any other failure: stop and report, as section 4 says. If it passes because it is before 18:00, build item 0 all the same.

## 3. Tools: when to use what

| Tool | Use it for | Not for |
|---|---|---|
| `ponytail:ponytail` | Load once, before item 0. | |
| `context7` | Three checks only, before you rely on them: Express 5 `res.write(chunk, callback)` on a response and what the callback gets when the caller has gone (item 6); axios 1.x, how a refusal arrives when `responseType` is `'blob'` (item 6); React Router 7 `lazy` on a route, only if the existing pattern in `router.jsx` does not fit (item 5). | Anything else. `node:crypto`, `node:zlib` and `node:fs` are proven here. |
| `impeccable`, then `frontend-design` | Load each once, before the first screen change (item 1). `Documentation/DESIGN.md` is the authority. Only the tokens work: Tailwind's default colour, type, radius, shadow and breakpoint scales are off. | The `21st-*` skills. Never. |
| `design:ux-copy` | Once, after item 7, over every new sentence a person reads. The copy in this plan is the draft; change a sentence only where the skill finds a real fault, and keep its meaning. | Calling it per string. |
| Playwright MCP | Section 7's screen checks, once the build is done. | Checking logic that a server test already proves. |
| `web-design-guidelines` | Once, in step 4, over the changed client files. | |
| `/code-review`, `/ponytail-review`, `/security-review` | Step 5, on the phase diff. | |
| Agent, `model: "opus"`, `effort: "high"` | One fresh reviewer in step 5. Give it `git diff` plus the untracked files and section 8 of this plan, and nothing from this conversation. | Building. Build inline. |
| Agent, `subagent_type: "Explore"`, `model: "haiku"` | Only if a wide read-only search is needed. None is planned. | |
| `work_state_write` | List `growkid-final-plan-build`: mark "Phase 8. Trust and data" `doing` at step 0 and `done` at step 6. | |

Servers for the browser checks: start each with `exec`, so TaskStop really stops it: `cd server && exec node --env-file=.env src/index.js` and `cd client && exec node node_modules/vite/bin/vite.js --host 127.0.0.1 --strictPort`. Stop both before any `prisma` command: a running server holds the engine file and `prisma generate` fails with `EPERM`.

## 4. Step 2, documents first

Write these before any code. One edit pass per file.

### 4.1 `Documentation/FRONTEND-SITEMAP.md`

1. **Section 2**, the inventory table: the Authentication row becomes `Sign in; Sign up; Set a new password | 3`, and the total becomes **22**. Add "Set a new password" to the Low row of the cost table.
2. **Section 3**, the route map: add after the `/signup` row: `` | `/forgot` | Set a new password | Public | A parent sets a new password with their email and their recovery code | ``. Add `/forgot` to the Public line under "Access". In "Redirects", `/`, `/login` or `/signup` becomes `/`, `/login`, `/signup` or `/forgot`.
3. **Section 12, rule 5**, the Location bullet: replace "The GPS route some action cameras record in a separate video track is not removed (known limit, files.js)." with "Since final plan Phase 8 the GPS route some action cameras record in a separate video track is blanked too (rule 30, T7)."
4. **Rule 15**: in "Pausing a family", replace "; the moderator's page still only answers" with "; since final plan Phase 8 a moderator can do the same from Reports (rule 30, T2)". In "Resolved", after "A moderator has no other power in this version." add "Since final plan Phase 8 a moderator can also pause the sender's family (rule 30, T2), and a moderator signs in with a second step (T1)."
5. **Rule 16**, end of its first paragraph, add: "Since final plan Phase 8 a parent can download a copy of the family's data first (rule 30, T6); deleting keeps the record of what a moderator did (T3), which holds nothing of the family's."
6. **Rule 27**, end of its first paragraph, add: "Since final plan Phase 8 a parent who forgets their password resets it with a recovery code (rule 30, T5)."
7. **Rule 28, C9**, add: "Since final plan Phase 8 the same line is written when a moderator's code is refused, when a family is paused or unpaused from Reports, when a password is reset with a recovery code, and when a reset is tried for a paused family."
8. **Section 14**: the row "Email verification, Forgot password, Reset password | D2" becomes "Email verification, password reset by an emailed link | D2. A parent resets a forgotten password with a recovery code instead (rule 30, T5)".
9. **Add rule 30** after rule 29, exactly:

> 30. **Trust and data.** Assumed (final plan Phase 8), each to confirm.
>     - **T1, the moderator's second step.** A moderator signs in with the password and then a 6-digit code from an authenticator app (TOTP, RFC 6238: SHA-1, 30-second steps). The right password with no code is refused with a new code, NEEDS_CODE (401), and Sign in then shows a code field; a wrong or used code is refused the same way, with `fields.code` set to `wrong`. A code works once. The step before and the step after the current one are accepted, so a clock half a minute out still works. The secret is made by `npm run moderator` and printed once, as an `otpauth://` link, to the terminal of whoever runs the server; a moderator with no secret cannot sign in. Tries count against the sign-in limits (rule 27). The same script removes a moderator.
>     - **T2, pausing from the moderator's page.** A moderator can pause and unpause the family of a waiting report's sender from Reports, each behind a confirm step, with the same effect as the server script (C6). The report then carries a "Family paused" tag. The moderator still sees no name. A report cannot be answered while its family is paused, because nobody in the family could read the answer: it is refused as LOCKED. A report whose sender is gone can pause nobody (NOT_FOUND).
>     - **T3, the moderator's record, and a list with no hidden end.** Every answer, pause and unpause is recorded: which moderator, which report, what and when; no words and no names. Nothing in the app changes or deletes a record, and deleting a family keeps it, because it holds no id of the family's. Whoever runs the server reads it from the database. The moderator's list says how many reports wait in all and shows them 200 at a time, oldest first, with Next and Previous.
>     - **T4, how long proof files are kept.** A proof's photo or video is deleted once its task's approval is older than the family's setting: 30 days, 90 days (the start value) or 365 days, chosen by the parent in Settings. The task, the note, the review and the points stay, and every earlier attempt's file of that task goes with it. The server does this when it starts and once a day, by the real clock, never the development clock. A removed file no longer counts toward the family's 2 GiB, leaves My proofs (K5), and its proof says "Photo removed after 92 days", the days from the approval to the removal, to the parent and to the child alike. Choosing a shorter time deletes older files within a day, and Settings asks first.
>     - **T5, a forgotten parent password.** Signing up makes a recovery code: 16 letters and digits, shown once on Overview as four groups of four; only its hash is stored. Settings makes a new one behind the password, which stops the old one, and says when a parent has none. `/forgot` takes the email, the code and a new password. A wrong code, an unknown email, a child's username and an account with no code all get the same refusal (WRONG_DETAILS), and tries count against the sign-in limits. A right code sets the password (checked as L4 checks it), signs every device out and is used up; the page tells the parent to sign in and make a new one. A paused family is refused (PAUSED). The email is still not verified, so the code is the only proof of who is asking. A child's password is still reset by their parent.
>     - **T6, a copy of the family's data.** From Settings, behind the password, a parent downloads a .zip. It holds `family.json` (the parent's account and settings, each child with their tasks, the details of their proofs, the reviews, stickers, quests and rest days, and the family's rewards, requests, repeating tasks and task suggestions, and the parent's own reports) and a `proofs` folder with every proof file still kept. It holds what the parent can already see: not a child's report (rule 15), not a child's savings goal (K3), and never a password. Tries share the limit of changing the password (rule 27).
>     - **T7, a route recorded beside a video.** In an MP4 or QuickTime video, a track of data recorded alongside the picture (handler `meta`, `text` or `gpmd`: an action camera's GPS route, timed text) is blanked. Its samples are overwritten with zeros where they lie, and the track becomes an empty box, so the file keeps its size. A video whose data track cannot be read that way, a fragmented one included, is refused as FILE_TYPE.
>     - **T8, the word list.** Not built: the user chose on 16 November 2026 to supply no list, so rule 8's three words stay.

### 4.2 `client/src/pages/Privacy.jsx` (the wording; the code edit is part of each item)

- **Lines 86-91**, the first two paragraphs of "What a moderator can and cannot see", become:
  - "A moderator reads reports and can do two things: answer them, and pause the family a report came from. A moderator cannot open any family’s pages. A moderator signs in with a password and a second code that changes every 30 seconds."
  - "If a report shows that a child may not be safe, a moderator, or the person who runs GrowKid, can pause the family that sent it. While a family is paused, nobody in it can sign in, and nothing of theirs is deleted or changed: it is kept as it was until a person decides what happens next. GrowKid keeps a record of each time a moderator answers a report or pauses a family: which moderator, which report and when. The record holds no words and no names."
- **Lines 132-133**: "A WebM video is kept as sent, and so is the GPS route that some action cameras record alongside the picture." becomes "A WebM video is kept as sent. The GPS route that some action cameras record alongside the picture is blanked out of MP4 and QuickTime videos."
- **After the proof-files paragraph** (ends line 134), add: "A proof’s photo or video is deleted 90 days after its task is approved. A parent can change that to 30 days or a year in Settings. The task, the note and the result stay."
- **After the consent paragraph** (ends line 139), add: "A parent gets a recovery code when they sign up, and can make a new one in Settings. With the code and their email they can set a new password if they forget theirs. GrowKid stores the code scrambled, as it does a password, and cannot show it again. GrowKid does not check that an email address is real, so without the code a parent’s password cannot be reset."
- **"How to delete it"**, end of its first paragraph, add: "Before deleting, a parent can download a copy of the family’s data from Settings: one file with what this page lists, and the photos and videos still kept." End of its second paragraph, add: "Deletion also keeps the record of what a moderator did, which names no one."
- `UPDATED` (line 22) and `PRIVACY_VERSION` (`server/src/rules.js:11`) both become the date of the day you build, in the two formats already used there.

### 4.3 `Documentation/DESIGN.md` section 18

- "Settings is seven plain sections ... name, password, signed-in devices, country, family leaderboard, notifications on this computer (H12), deleting" becomes ten: name, password, recovery code (T5), signed-in devices, country, family leaderboard, proof photos and videos (T4), notifications on this computer (H12), a copy of the family's data (T6), deleting. Add: "Shortening how long proof files are kept asks first in a dialog whose act is red, because files are lost."
- "The moderator's page is a work list." Add: "Since Phase 8 a report can pause its sender's family from a quiet button behind a confirm step; a paused report carries a warning tag, 'Family paused' with the pause icon, and shows Unpause in place of the answer box. The page says how many reports wait in all, and moves through them 200 at a time."
- A new bullet under "How the serious pages apply it": "**A code shown once is a card, not a dialog.** A recovery code appears once, on Overview after sign-up and in Settings after making one, in the same card a new child's password uses: the code in four groups, a Copy button, a warning that it is not shown again, and one button to put it away."
- A new bullet under "How tasks and proof apply it": "**A removed file says so in words.** Where a proof's photo or video has been deleted (T4), a plain message says 'Photo removed after 92 days', and the note and the result stay."
- "Sign in and Sign up sit beside a navy band" becomes "Sign in, Sign up and Set a new password sit beside a navy band".
- The component table: `components/Proof.jsx` adds "and a message where the file has been removed (T4)"; add a row `components/RecoveryCode.jsx | A recovery code shown once: four groups, Copy, and the warning (T5)`.
- "What the code has today": "every one of the 21 pages" becomes 22, and add one sentence starting "Since Phase 8:" that lists the seven things built. Write it in step 6, from what was built.

## 5. The schema, in one migration

Edit `server/prisma/schema.prisma`, then run the migration once, before item 1's code.

`User` (after `sound`, line 76):

```prisma
  totpSecret     String? // T1: a moderator's authenticator secret, base32; never leaves the server
  totpLastStep   Int? // T1: the last 30-second step a code was accepted for, so a code works once
  recoveryHash   String? // T5: a parent's recovery code, hashed as a password is
  keepProofDays  Int             @default(90) // T4: a parent's setting, 30, 90 or 365
```

`Proof` (after `cheerLine`, line 154):

```prisma
  removedAt  DateTime? // T4: when the file was deleted for age; the row stays
```

After the `Report` model:

```prisma
enum ModeratorActionKind {
  answer
  pause
  unpause
}

/// T3: what a moderator did, and when. No relations on purpose: a row outlives the moderator and the report. No code updates or deletes one.
model ModeratorAction {
  id          String              @id @default(uuid())
  moderatorId String
  action      ModeratorActionKind
  reportId    String
  at          DateTime

  @@index([reportId])
}
```

Command, in `server/`, with no server running: `npx prisma migrate dev --name phase8_trust`. Every change is a nullable column, a column with a default, or a new table, so no data-loss question is expected. If it stops for a terminal anyway, use the route Phase 5 used: make the folder `prisma/migrations/<UTC timestamp>_phase8_trust/`, write `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` into its `migration.sql`, then `npx prisma migrate deploy` and `npx prisma generate`. Never `migrate reset`, and never Prisma's consent variable. Proof: `npx prisma migrate status` says the database is up to date.

## 6. The items, in build order

### Item 0. Restore green: the task card at 320 px

**Read first:** `client/src/components/Task.jsx:77-100`; `client/e2e/routes.spec.js:49-53`.

**Change.**
1. `Task.jsx:81`: `className="flex items-center gap-3"` becomes `className="flex flex-wrap items-center gap-x-3 gap-y-2"`, so the points drop to a second line when the row is too narrow.
2. `routes.spec.js:51`: `const open = await task('Read a chapter', 3)` becomes `await task('Read a chapter', 0.1)`, with the comment "due in about two hours, so its card carries the longer Due soon tag at every hour of the day". The spec then guards the fault whatever the time.

**Proof.** `cd client && npx playwright test routes.spec.js` passes. Before 18:00 the old code passes too, so the proof is the new fixture: confirm the spec fails with step 2 alone and passes with both. Remove `client/test-results/` afterwards.

### Item 1. A second step for the moderator (T1)

**Read first:** `server/src/routes/account.js:43-59`; `server/scripts/moderator.js` (all, 38 lines); `server/test/helpers.js` (all); `server/test/scripts.test.js:88-128`; `client/src/pages/SignIn.jsx` (all); `client/src/components/Field.jsx` (all); `client/src/api/errors.js` and `errors.check.js`; `client/src/api/index.js:227-240,750-764`; `client/e2e/routes.spec.js:71-75`. Grep `role: 'moderator'` in `server/test/` for the hand-made moderators.

**Server.**

1. New file `server/src/totp.js`. *Proven.*

```js
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** T1: time-based one-time codes (RFC 6238: SHA-1, 30-second steps, 6 digits), and the base32 (RFC 4648, no padding) a secret is written in. */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Bytes as base32: 20 bytes are 32 characters, 10 bytes are 16. */
export function base32(bytes) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
    value &= (1 << bits) - 1
  }
  return bits ? out + ALPHABET[(value << (5 - bits)) & 31] : out
}

/** Base32 as bytes, or null when a character is not in the alphabet. */
export function unbase32(text) {
  let bits = 0
  let value = 0
  const out = []
  for (const letter of text) {
    const index = ALPHABET.indexOf(letter)
    if (index < 0) return null
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
    value &= (1 << bits) - 1
  }
  return Buffer.from(out)
}

const STEP_MS = 30_000
/** The 30-second step a moment falls in. The real clock: an authenticator app knows nothing of the development clock. */
export const stepAt = (ms = Date.now()) => Math.floor(ms / STEP_MS)

/** The six digits for one step. */
export function codeAt(secret, step) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const mac = createHmac('sha1', unbase32(secret)).update(counter).digest()
  const at = mac[19] & 15
  return String((mac.readUInt32BE(at) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

/**
 * The step a typed code belongs to, or null. This step and one either side count, so a clock half a minute out still works; a step
 * at or before `lastStep` never does, so a code cannot be used twice. All three are compared, whichever matches.
 */
export function stepOf(secret, typed, lastStep, ms = Date.now()) {
  const code = typeof typed === 'string' ? typed.replace(/\s/g, '') : ''
  if (!secret || !/^\d{6}$/.test(code)) return null
  const now = stepAt(ms)
  let found = null
  for (const step of [now - 1, now, now + 1]) {
    if (step > (lastStep ?? -1) && timingSafeEqual(Buffer.from(code), Buffer.from(codeAt(secret, step))) && found === null) found = step
  }
  return found
}

/** A new secret: 20 random bytes, as 32 base32 characters. */
export const newSecret = () => base32(randomBytes(20))
```

2. `server/src/errors.js`: add `NEEDS_CODE: 401, // T1: a moderator's password was right; the authenticator's code is missing or wrong (fields.code 'wrong')` after `NOT_SIGNED_IN`.
3. `server/src/routes/account.js`, sign-in: replace line 56 (`if (user.role === 'moderator') securityLog('moderator-sign-in', req)`) with the block below, and import `stepOf` from `../totp.js`. Update the handler's doc comment.

```js
  if (user.role === 'moderator') {
    // T1: the password was right; now the code. Only then, so a wrong password never says a code is wanted.
    const { code } = req.body ?? {}
    if (code === undefined || code === '') refuse('NEEDS_CODE')
    const step = stepOf(user.totpSecret, code, user.totpLastStep)
    // conditional on the step still being unused: the same code sent twice at the same moment signs in once
    const used = step === null ? { count: 0 } : await db.user.updateMany({ where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] }, data: { totpLastStep: step } })
    if (used.count === 0) {
      securityLog('moderator-code-refused', req) // C9: a stolen password being tried shows here
      refuse('NEEDS_CODE', { code: 'wrong' })
    }
    securityLog('moderator-sign-in', req) // C9
  }
```

   `asUser` names its fields, so `totpSecret` never leaves. Do not add it there.
4. `server/scripts/moderator.js`. Read two more variables, never argv: `MODERATOR_TOTP` and `MODERATOR_REMOVE`.
   - `MODERATOR_TOTP` must be unset, empty or `new`; anything else is a problem ("MODERATOR_TOTP must be new or left out").
   - `MODERATOR_REMOVE=1` with a valid `MODERATOR_EMAIL` and no password needed: delete that user only when its role is `moderator`, print `removed`; otherwise print to stderr "moderator: no moderator has that address" and exit 1. Check this branch before the password problem.
   - Otherwise, as today, plus: `const secret = !existing?.totpSecret || process.env.MODERATOR_TOTP === 'new' ? newSecret() : null`. When `secret` is set, add `{ totpSecret: secret, totpLastStep: null }` to the create or update data. So a new moderator, and an older one that has no secret yet, are always enrolled; `new` replaces a secret.
   - Output: line 1 is `created` or `updated`, as today. When `secret` is set, line 2 is the link and nothing else: `` `otpauth://totp/GrowKid:${encodeURIComponent(email)}?secret=${secret}&issuer=GrowKid&algorithm=SHA1&digits=6&period=30` ``.
   - Update the header comment: what it prints, and that the link is shown once.
5. `server/.env.example`: under the moderator lines add, commented out, `# MODERATOR_TOTP=new` ("makes a new authenticator secret and prints its otpauth:// link once; a new moderator gets one anyway") and `# MODERATOR_REMOVE=1` ("removes the moderator with that address").

**Client.**

1. `client/src/api/errors.js`: add `NEEDS_CODE` to the comment list ("a moderator's sign-in needs the code from their authenticator app; `fields.code` is 'wrong' when the one sent did not match") and to the `ApiErrorCode` type. Update `errors.check.js` if it lists the codes.
2. `client/src/api/index.js`: `signIn`'s doc and type take an optional `code`, and name NEEDS_CODE. In `listDemoSignIns`, delete the Moderator line (761): that account cannot sign in until the user enrols it.
3. `client/src/utils/messages.js`: `TEXT.NEEDS_CODE = 'Type the 6-digit code from your authenticator app.'`.
4. `client/src/pages/SignIn.jsx`:
   - State: `const [code, setCode] = useState('')` and `const [needsCode, setNeedsCode] = useState(false)`, plus `const codeBox = useRef(null)`.
   - Changing the identifier or the password sets `needsCode` false and `code` to `''`: the code step belongs to the details it followed.
   - `submit`: when `needsCode` and `code.trim()` is empty, set the problem to `TEXT.NEEDS_CODE`'s sentence and focus the code field. Call `signIn({ identifier, password, ...(needsCode && { code }) })`.
   - In `catch`, before the existing branch: when `error.code === 'NEEDS_CODE'`, draw at once with `flushSync(() => { setNeedsCode(true); setBusy(false); setProblem(error.fields?.code === 'wrong' ? 'That code did not match. Wait for the next code in your app, then try again.' : null) })`, then `codeBox.current?.querySelector('input')?.focus()`, and return. Import `flushSync` from `react-dom`.
   - Under the password field, when `needsCode`: `<Message role="status">Your password is right. Now type the code from your authenticator app.</Message>` and, inside `<div ref={codeBox}>`, a `Field` with `label="Code"`, `hint="6 digits. It changes every 30 seconds."`, `name="code"`, `inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={7}`, the value and its `onChange`. Confirm in `Field.jsx` that it passes these props to the input; if it does not, stop this item and report.
   - The button reads "Sign in" throughout.
5. `client/e2e/routes.spec.js:71-75`: replace the demo-moderator block. Make a throwaway moderator with the script and remove it in `finally`:

```js
    // the moderator's page: a moderator is only ever made by the server's script, so the spec runs it, signs in with a code, and removes it again
    const modEnv = { ...process.env, MODERATOR_EMAIL: `e2e-mod-${stamp}@example.com`, MODERATOR_PASSWORD: `e2e-moderator-${stamp}-${stamp}` }
    const serverDir = fileURLToPath(new URL('../../server/', import.meta.url))
    const made = spawnSync(process.execPath, ['--env-file=.env', 'scripts/moderator.js'], { cwd: serverDir, env: modEnv, encoding: 'utf8' })
    const secret = new URL(made.stdout.trim().split(/\r?\n/)[1]).searchParams.get('secret')
```

   then `POST /api/session` with `{ identifier, password, code: codeAt(secret, stepAt()) }`, expect 200, and `check(mod, '/admin/reports')`. Import `spawnSync` from `node:child_process`, `fileURLToPath` from `node:url`, and `{ codeAt, stepAt }` from `'../../server/src/totp.js'` (it imports only `node:crypto`). In the spec's `finally`, run the script again with `MODERATOR_REMOVE: '1'`. Never print `made.stdout`. Declare `modEnv` before the `try` so `finally` can reach it. If `.github/workflows/ci.yml`'s end-to-end job does not write `server/.env`, say so in the report; do not change CI's secrets.

**Tests.**

- `server/test/helpers.js`: export `moderator(base)`, and use it in place of every hand-made moderator (`security.test.js:141-145`, `reports.test.js:16-19`, the C9 test in `safety.test.js`). Each sign-in in a test clears the last step first, so two sign-ins in the same 30 seconds both work:

```js
/** A moderator made straight in the database (the script has its own test), with a secret. signIn() gives a signed-in client. */
export async function moderator(base) {
  const email = `mod-${randomUUID()}@example.com`
  const secret = newSecret()
  const { id } = await db.user.create({ data: { role: 'moderator', name: 'Mod', email, passwordHash: await bcrypt.hash('moderator-pass', 4), totpSecret: secret } })
  const signIn = async (api = as(base)) => {
    await db.user.update({ where: { id }, data: { totpLastStep: null } })
    assert.equal((await api.post('/session', { identifier: email, password: 'moderator-pass', code: codeAt(secret, stepAt()) })).status, 200)
    return api
  }
  return { id, email, secret, password: 'moderator-pass', signIn, api: await signIn() }
}
```

- New `server/test/totp.test.js` (unit, no server):
  - `'T1: base32 round-trips the RFC 4648 vectors, and a letter outside the alphabet is refused'`: `''`, `f`→`MY`, `fo`→`MZXQ`, `foo`→`MZXW6`, `foob`→`MZXW6YQ`, `fooba`→`MZXW6YTB`, `foobar`→`MZXW6YTBOI`; `unbase32('abc')` is null; 20 bytes give 32 characters and 10 give 16.
  - `'T1: codeAt gives the RFC 6238 SHA-1 codes'`: secret `base32(Buffer.from('12345678901234567890'))`, step `Math.floor(seconds / 30)`: 59→`287082`, 1111111109→`081804`, 1111111111→`050471`, 1234567890→`005924`, 2000000000→`279037`, 20000000000→`353130`.
  - `'T1: stepOf takes this step and one either side, never a used one, and only six digits'`: at a fixed `ms`, the codes for `s-1`, `s`, `s+1` each return their step; `s-2` is null; `lastStep = s` refuses the code for `s`; `lastStep = s-1` accepts it; spaces inside the code are ignored; `'12345'`, `'1234567'`, `'abcdef'`, `''`, `undefined`, `123456` (a number) and a null secret are null.
- `server/test/account.test.js`:
  - `'T1: a moderator with the right password and no code gets NEEDS_CODE and no cookie; a wrong code is NEEDS_CODE with code wrong; the right code signs in; a wrong password never asks for a code'`.
  - `'T1: a code signs in once: the same code again is refused, and the same code sent twice at once gives one 200'`.
  - `'T1: a moderator with no secret cannot sign in, and a parent or a child is never asked for a code'`.
- `server/test/scripts.test.js`, the moderator test: `created.stdout` is two lines, `created` and a link matching `/^otpauth:\/\/totp\/GrowKid:.+\?secret=[A-Z2-7]{32}&issuer=GrowKid&algorithm=SHA1&digits=6&period=30$/`; sign in with a code from its secret; an update without `MODERATOR_TOTP` prints `updated` only and the secret still works; with `MODERATOR_TOTP=new` it prints a new link and the old secret's code is refused; `MODERATOR_TOTP=later` exits 1; `MODERATOR_REMOVE=1` prints `removed` and the row is gone; `MODERATOR_REMOVE=1` on a parent's address exits 1 and the parent can still sign in. Sign-ins here need `db.user.update({ data: { totpLastStep: null } })` between them, as the helper does.
- The C9 test in `safety.test.js`: a refused code logs one `security moderator-code-refused` line that holds no email.

**Proof.** `node --env-file=.env.test --test --test-concurrency=1 test/totp.test.js test/account.test.js test/scripts.test.js test/security.test.js test/safety.test.js`, after `npm run pretest`.

**What could go wrong.** A test that signs a moderator in twice within 30 seconds without clearing `totpLastStep` fails on the second: that is the replay rule working. `timingSafeEqual` throws on unequal lengths; the six-digit check before it prevents that.

### Item 2. Pause from the moderator's page (T2)

**Read first:** `server/src/routes/reports.js` (all); `server/scripts/pause-family.js` (all); `server/src/shape.js:100-112`; `server/test/safety.test.js:93-166`; `client/src/pages/Reports.jsx` (all); `client/src/api/index.js:729-748`. `ConfirmDialog` needs no read: its props are `title`, `children` (the text), `keep`, `confirm`, `busyText`, `danger` and `act`; it opens with `ref.current.open()`, closes with `ref.current.close()`, and shows a refusal thrown by `act` inside itself.

**Server.**

1. New file `server/src/pause.js`, shared by the script and the routes:

```js
import { now } from './clock.js'

/**
 * C6, T2: pauses or unpauses the family of a report's sender: the parent and every child together, and every device they are signed
 * in on is signed out. Nothing else changes. `client` is db or a transaction. Returns why it could not, or null when it did:
 * 'no-report', 'sender-gone' or 'moderator'.
 */
export async function setPaused(client, reportId, pause) {
  const report = await client.report.findUnique({ where: { id: reportId }, include: { by: { select: { id: true, role: true, parentId: true } } } })
  if (!report) return 'no-report'
  if (!report.by) return 'sender-gone'
  if (report.by.role === 'moderator') return 'moderator'
  const parentId = report.by.role === 'parent' ? report.by.id : report.by.parentId
  await client.user.updateMany({ where: { OR: [{ id: parentId }, { parentId }] }, data: { pausedAt: pause ? now() : null, tokenVersion: { increment: 1 } } })
  return null
}
```

2. `server/scripts/pause-family.js`: call `setPaused(db, reportId, action === 'pause')` and map its three answers to the three messages the script prints today (lines 17). Its tests in `safety.test.js` must pass unchanged.
3. `server/src/shape.js`, `asReport`: add `paused: moderator && (row.by?.pausedAt || row.by?.parent?.pausedAt) ? true : undefined,`. Say in its comment that only this yes or no leaves, never who.
4. `server/src/routes/reports.js`:
   - `const forModerator = { by: { select: { pausedAt: true, parent: { select: { pausedAt: true } } } } }`, used by every read that feeds `asReport(row, { moderator: true })`: the list, the row `resolveReport` returns, and the two new routes.
   - `resolveReport`: read `report` with `include: forModerator`, and after the `resolvedAt` check add `if (report.by?.pausedAt || report.by?.parent?.pausedAt) refuse('LOCKED') // T2: nobody in a paused family could read the answer`.
   - Two routes after it, one handler:

```js
/**
 * pauseFamily and unpauseFamily (rule 30, T2): the family of the report's sender, as scripts/pause-family.js does it. A report that is
 * gone, or whose sender is, is NOT_FOUND. The act and its record (T3) land together.
 */
const pausing = (action) => async (req, res) => {
  const me = only(req, 'moderator')
  const id = text(req.params.id)
  const row = await db.$transaction(async (tx) => {
    if (await setPaused(tx, id, action === 'pause')) refuse('NOT_FOUND')
    await tx.moderatorAction.create({ data: { moderatorId: me.id, action, reportId: id, at: now() } })
    return tx.report.findUniqueOrThrow({ where: { id }, include: forModerator })
  })
  securityLog(`family-${action}`, req) // C9
  res.json(asReport(row, { moderator: true }))
}
reports.post('/reports/:id/pause', pausing('pause'))
reports.post('/reports/:id/unpause', pausing('unpause'))
```

   Import `securityLog` from `../auth.js` and `setPaused` from `../pause.js`. Update the file's and `sendReport`'s comments, which say the moderator can only answer.

**Client.**

1. `client/src/api/index.js`: the `Report` typedef gains `@property {boolean} [paused]  the moderator's copy only: the sender's family is paused (T2)`. Add `pauseFamily(id)` and `unpauseFamily(id)`, each `call('post', ...)` returning the `Report`, documented with NOT_FOUND. `resolveReport`'s doc gains "LOCKED also while the sender's family is paused".
2. `client/src/pages/Reports.jsx`:
   - `ReportRow`: when `report.paused`, a tag in the summary, after the "sent this" line: `<span className="tag tag-warning"><PauseCircle className="size-4 shrink-0" aria-hidden="true" />Family paused</span>` (`PauseCircle` from `lucide-react`). Confirm `tag-warning` exists in `index.css`; it is the class the "Due soon" tag uses.
   - A new component `Pausing({ report, onChanged, onStale })` rendered under `Item`, before the answer. It holds a `ConfirmDialog` ref.
     - Not paused, and not `senderGone`: `<button type="button" className="btn btn-secondary">Pause this family…</button>`. Dialog: title "Pause this family?", text "Everyone in the family that sent this report is signed out and cannot sign in until you unpause it. Nothing of theirs is deleted or changed. You cannot answer this report while the family is paused, because they could not read the answer.", `keep="Do not pause"`, `confirm="Pause this family"`, `busyText="Pausing…"`. Not `danger`: nothing is lost.
     - Paused: a `Message` "This family is paused. Nobody in it can sign in. Unpause it before you answer, so that they can read the answer." and `<button className="btn btn-secondary">Unpause this family…</button>`. Dialog: title "Unpause this family?", text "They can sign in again with the same passwords. Nothing was deleted or changed while they were paused.", `keep="Keep it paused"`, `confirm="Unpause this family"`, `busyText="Unpausing…"`.
     - `act`: call the API, close the dialog, `onChanged(report, paused)`. A `NOT_FOUND` closes the dialog and calls `onStale()`.
   - `Reports`: `<Answer>` renders only when `!report.paused`. `onChanged` puts the returned report in the list as `resolve` does, sets the note ("Paused. Nobody in that family can sign in." or "Unpaused. They can sign in again."), and focuses it through the existing `said` ref.

**Tests** (`server/test/reports.test.js`):
- `'T2: a moderator pauses and unpauses the family of a report\'s sender: every device is signed out, sign-in is PAUSED, the report says paused and names nobody, nothing is deleted, and unpausing restores sign-in'`. Assert the paused report's keys are within `id, from, details, sentAt, item, paused`.
- `'T2: pause and unpause are the moderator\'s alone; an unknown report and one whose sender is gone are NOT_FOUND'`.
- `'T2: a report cannot be answered while its family is paused (LOCKED), and can be once it is unpaused'`.
- `'T2: both reports of one family say paused, whichever of them it was paused from'`.

**Proof.** `test/reports.test.js` and `test/safety.test.js` pass.

### Item 3. The moderator's record, and a list that cannot hide a report (T3)

**Read first:** nothing new on the server. Client: `client/src/hooks/useLoad.js:25-40` and `client/src/hooks/pageCache.js` (20 lines), to see how a loader with inputs is keyed.

**Server** (`server/src/routes/reports.js`):
1. `resolveReport`: inside the transaction, after the conditional update succeeds, `await tx.moderatorAction.create({ data: { moderatorId: me.id, action: 'answer', reportId: id, at: now() } })`. Keep `const me = only(req, 'moderator')`.
2. `listReports` answers a page and the total. Export `number` from `./tasks.js` (line 26) and import it.

```js
const REPORTS_PAGE = 200
/**
 * listReports (T3): how many reports wait in all, and 200 of them from `offset`, oldest first. The total is always said, so a flood
 * from one family cannot hide another child's report behind the end of the list. An answered report is never sent again: its sender
 * reads it through listMyReports.
 */
reports.get('/reports', async (req, res) => {
  only(req, 'moderator')
  const where = { resolvedAt: null }
  const [waiting, rows] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({ where, include: forModerator, orderBy: [{ sentAt: 'asc' }, { id: 'asc' }], skip: number(req.query.offset, 0), take: REPORTS_PAGE }),
  ])
  res.json({ waiting, reports: rows.map((row) => asReport(row, { moderator: true })) })
})
```

3. No other code touches `moderatorAction`. `erase()` in `account.js` stays as it is.

**Client.**
1. `client/src/api/index.js`: `export const REPORTS_PAGE = 200` and `listReports = (offset = 0) => call('get', `/reports?offset=${offset}`)`, typed `Promise<{ waiting: number, reports: Report[] }>`.
2. `client/src/pages/Reports.jsx`: `const [offset, setOffset] = useState(0)`; `useLoad(() => api.listReports(offset), [offset], { live: true })`. Every use of `loaded.data` as an array becomes `loaded.data.reports`, and `loaded.set` keeps the shape (`{ ...loaded.data, reports: ... }`). The line under the heading counts `loaded.data.waiting`, the total. When `waiting > REPORTS_PAGE`, add under it "Showing 1 to 200 of 431." (from `offset`, the page's length and `waiting`), and under the list two `btn btn-secondary` buttons, "Previous 200" (hidden at `offset === 0`) and "Next 200" (hidden when `offset + reports.length >= waiting`). Each sets the offset, sets the local 50-at-a-time `limit` back to 50, and moves focus to the `h1` (give it `tabIndex={-1}` and a ref). If a page comes back empty while `offset > 0`, set the offset to `Math.max(0, offset - REPORTS_PAGE)`.

**Tests.**
- Every test that reads `(await moderator.get('/reports')).body` as an array now reads `.body.reports`. `seenByModerator` at `reports.test.js:47` is one; grep `get('/reports')` in `server/test/` for the rest.
- `'T3: answering, pausing and unpausing each leave one row: which moderator, which report, what and when'`.
- `'T3: the list says how many wait and pages through them 200 at a time, oldest first'`: insert 205 senderless reports with `db.report.createMany` (`from: 'child'`, increasing `sentAt`), read offset 0 and 200, delete them by id.
- `'T3: deleting a family keeps the record of what the moderator did'`.
- `'T3: no code changes or deletes the record'`: read every `.js` under `server/src` and `server/scripts` and assert none matches `/moderatorAction\.(update|updateMany|delete|deleteMany|upsert)/`.
- Each test file removes the `ModeratorAction` rows of its own moderator at the end (`db.moderatorAction.deleteMany({ where: { moderatorId } })`), which a test may do.

**README.** Add to the moderator part: the record is read with SQL, `SELECT * FROM "ModeratorAction" ORDER BY at;`, and nothing in the app changes it.

### Item 4. Proof files are deleted after a while (T4)

**Read first:** `server/src/routes/tasks.js:161-224`; `server/src/shape.js:37-67`; `server/src/index.js:34-43`; `server/src/routes/account.js:34,188-207`; `client/src/components/Proof.jsx` (all); `client/src/pages/Settings.jsx:138-195,376-441`; `client/src/pages/Growth.jsx:150-175`. Grep `asProof(` in `server/src` to confirm `asTask` is its only caller.

**Server.**
1. `server/src/rules.js`: `/** T4: how many days a family may keep a proof's file after its task is approved. */ export const KEEP_PROOF_DAYS = [30, 90, 365]`.
2. `server/src/files.js`: import `KEEP_PROOF_DAYS` from `./rules.js` and `readFile` from `node:fs/promises`. Add:

```js
/** T4: at most this many files go per setting in one run; the next run, a day later or at the next start, takes the rest. */
const MOST_REMOVED = 1000

/**
 * T4: deletes the file of every proof whose task was approved longer ago than its family keeps proof files, and marks the proof
 * removed; the row, the note and the review stay. The file goes first and the mark second, so a run that stops between them is put
 * right by the next: the proof is still unmarked, its file is already gone, and it is marked then. A file that will not unlink stays
 * unmarked and is tried again. `time` is the real time, never the development clock: a clock moved a year ahead would delete every
 * family's files for good. Returns how many were removed.
 * ponytail: 1,000 per setting per run; raise it or loop if a server ever holds more old files than that.
 */
export async function removeOldProofFiles(time) {
  let removed = 0
  for (const days of KEEP_PROOF_DAYS) {
    const before = new Date(+time - days * 86_400_000)
    const old = await db.proof.findMany({
      where: { fileType: { not: null }, removedAt: null, task: { status: 'approved', child: { parent: { keepProofDays: days } }, proofs: { some: { result: 'approved', reviewedAt: { lt: before } } } } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: MOST_REMOVED,
    })
    const gone = []
    for (const { id } of old) {
      try {
        await unlink(stored(id))
        gone.push(id)
      } catch (error) {
        if (error.code === 'ENOENT') gone.push(id)
      }
    }
    removed += (await db.proof.updateMany({ where: { id: { in: gone }, removedAt: null }, data: { removedAt: time } })).count
  }
  return removed
}

/** T6: a kept proof's bytes, for the family's export. */
export const readProofFile = (id) => readFile(stored(id))
```

3. `server/src/index.js`, after the `app.listen` call: take `removeOldProofFiles` from the same `import('./files.js')` as `sweepOrphans`, then

```js
// T4: old proof files go at start-up and once a day, by the real clock. unref: the timer never keeps the process alive.
const tidy = () =>
  removeOldProofFiles(new Date()).then(
    (count) => count && console.log(`GrowKid removed ${count} proof file${count === 1 ? '' : 's'} older than their family keeps them`),
    (error) => console.error(`GrowKid could not remove old proof files (${error.code ?? error.name})`),
  )
tidy()
setInterval(tidy, 86_400_000).unref()
```

4. `server/src/shape.js`: `asProof = (p, files, approvedAt)`; `fileUrl` needs `&& !p.removedAt`; add `removed: p.removedAt ? { at: p.removedAt.toISOString(), afterDays: approvedAt ? Math.floor((p.removedAt - approvedAt) / 86_400_000) : undefined } : undefined, // T4`. In `asTask`: `const approvedAt = row.proofs.find((proof) => proof.result === 'approved')?.reviewedAt` and pass it.
5. `server/src/routes/tasks.js`: add `removedAt: null` to three `where`s: the storage sum (line 172), `listMyProofs` (line 202), and the file route (line 221). Say why in the two comments.
6. `server/src/routes/account.js`: `const settings = ({ leaderboard, country, keepProofDays, recoveryHash }) => ({ leaderboard, country, keepProofDays, recovery: Boolean(recoveryHash) })` (`recovery` is item 5's). New route after `setCountry`:

```js
/** setKeepProofDays (T4): how long a proof's file is kept after its task is approved: 30, 90 or 365 days. */
account.put('/settings/keep-proof', async (req, res) => {
  const me = only(req, 'parent')
  const { days } = req.body ?? {}
  if (!KEEP_PROOF_DAYS.includes(days)) refuse('INVALID', { days: 'required' })
  res.json(settings(await db.user.update({ where: { id: me.id }, data: { keepProofDays: days } })))
})
```

**Client.**
1. `client/src/api/index.js`: `Proof` typedef gains `@property {{ at: string, afterDays?: number }} [removed]  the file was deleted for age (T4); fileUrl is then absent`. `Settings` typedef gains `keepProofDays: 30 | 90 | 365` and `recovery: boolean`. Add `setKeepProofDays = (days) => call('put', '/settings/keep-proof', { days })`.
2. `client/src/components/Proof.jsx`: a first branch, before the "did not load" one: when `proof.removed`, `<Message>` with `` `${image ? 'Photo' : type.startsWith('video/') ? 'Video' : 'File'} removed${proof.removed.afterDays === undefined ? '' : ` after ${plural(proof.removed.afterDays, 'day')}`}. The note and the result are kept.` `` (`plural` from `utils/format.js`). The note below it renders as before.
3. `client/src/pages/Growth.jsx`: one quiet line under the gallery's heading: "GrowKid removes photos and videos a while after a task is approved. Your parent chooses how long."
4. `client/src/pages/Settings.jsx`: a section "Proof photos and videos" between Country and Family leaderboard, component `KeepProof({ settings })`, built like `Country`: a `Field as="select"` labelled "Keep proof photos and videos for" with options 30 days, 90 days, 1 year (365), the hint "A proof’s photo or video is deleted this long after its task is approved. The task, the note and the result stay.", and a "Save" button. Saving a shorter time than the saved one opens a `ConfirmDialog` first, with `danger`: title "Delete older photos and videos?", text "Files from tasks approved more than {N} days ago are deleted within a day. They cannot be brought back. To keep them, download your family’s data first.", `keep="Keep them"`, `confirm="Save and delete older files"`, `busyText="Saving…"`. Success: "Saved."

**Tests** (new `server/test/trust.test.js`; it erases its families at the end, as `safety.test.js` does):
- `'T4: a file is deleted once its task\'s approval is older than the family keeps files, the earlier attempt\'s file goes with it, the proof says removed after how many days, and a newer task and another family\'s longer setting are left alone'`. Age a proof with `db.proof.update({ data: { reviewedAt } })`; call `removeOldProofFiles(new Date())`; check the file is gone from `UPLOAD_DIR`, `getTask` gives `removed.afterDays` 91 and no `fileUrl`, and the file route is 404.
- `'T4: a removed file frees its room in the quota and leaves My proofs, and a second run removes nothing'`.
- `'T4: a file that will not unlink stays unmarked'`: swap the stored file for a folder of the same name, run, assert `removedAt` is null, remove the folder.
- `'T4: the setting is 30, 90 or 365 and nothing else, for a parent only; getSettings holds it'`.

**What could go wrong.** The boot tests start the real server, so `tidy` runs against the test database at each of them. That is correct behaviour; no test file should rely on a 91-day-old file surviving a boot.

### Item 5. A forgotten parent password, by recovery code (T5)

**Read first:** `server/src/auth.js:96-110`; `server/src/routes/account.js:15-34,70-89,106-120`; `client/src/store/session.js` (all); `client/src/pages/SignUp.jsx:83-102`; `client/src/pages/Family.jsx:21-49` (the card to copy); `client/src/pages/Overview.jsx`, its first 60 lines; `client/src/pages/SignIn.jsx:100-108`; `client/src/components/CopyButton.jsx` (26 lines); `client/src/router.jsx:11-52`; `client/src/components/Shells.jsx`, the `AuthShell` function only (grep it).

**Server.**
1. `server/src/auth.js:103`: `identifierOf` reads `req.body?.identifier ?? req.body?.email`, so the reset route shares the three sign-in limits and their counts.
2. `server/src/routes/account.js`:
   - `import { randomBytes } from 'node:crypto'`, `import { base32 } from '../totp.js'`.
   - `const newRecoveryCode = () => base32(randomBytes(10)) // T5: 16 characters, 80 bits` and `const typedCode = (v) => text(v).toUpperCase().replace(/[^A-Z2-7]/g, '') // dashes, spaces and case do not matter`.
   - `signUp`: `const recoveryCode = newRecoveryCode()`; the create's data gains `recoveryHash: await hash(recoveryCode)`; the answer is `{ ...asUser(user), recoveryCode }`. It is the only time the code leaves.
   - New, after `changePassword`:

```js
/** makeRecoveryCode (T5): a new code behind the password; the one before stops working. Shown once: only its hash is kept. */
account.post('/me/recovery', passwordLimit, async (req, res) => {
  const me = only(req, 'parent')
  if (!(await matches(text((req.body ?? {}).password), me.passwordHash))) refuse('WRONG_PASSWORD')
  const recoveryCode = newRecoveryCode()
  await db.user.update({ where: { id: me.id }, data: { recoveryHash: await hash(recoveryCode) } })
  res.json({ recoveryCode })
})

/**
 * resetPassword (T5): a parent's email, their recovery code and a new password. An unknown email, a child's username, an account with
 * no code and a wrong code are one answer, each after one real compare, so nothing says which it was. Everything about the account
 * (paused, the password's own rules) is checked only after the right code. The write is conditional on the code still being the
 * one checked, so two requests with one code change the password once.
 */
account.post('/recovery', signInIpLimit, signInLimit, signInAccountLimit, async (req, res) => {
  const body = req.body ?? {}
  const found = await findAccount(text(body.email).trim().toLowerCase())
  const parent = found?.role === 'parent' ? found : null
  if (!(await matches(typedCode(body.code), parent?.recoveryHash))) refuse('WRONG_DETAILS')
  if (paused(parent)) {
    securityLog('paused-recovery', req) // C9
    refuse('PAUSED')
  }
  const password = text(body.password)
  invalid({ password: passwordProblem(password, 8, personal(parent.name, localPart(parent.email))) })
  const { count } = await db.user.updateMany({
    where: { id: parent.id, recoveryHash: parent.recoveryHash },
    data: { passwordHash: await hash(password), tokenVersion: { increment: 1 }, recoveryHash: null },
  })
  if (count === 0) refuse('WRONG_DETAILS')
  securityLog('password-recovered', req) // C9
  res.status(204).end()
})
```

   The recovery code is hashed at the same cost as a password on purpose: an unknown account is compared against `DUMMY_HASH`, which is cost 12, and a cheaper hash would let timing say which accounts have a code.

**Client.**
1. `client/src/api/index.js`: `signUp` resolves to `User & { recoveryCode: string }` (say so). Add `makeRecoveryCode = (password) => call('post', '/me/recovery', { password })` and `resetPassword = async (details) => { await call('post', '/recovery', details) }`, typed `{ email, code, password }`, documented with WRONG_DETAILS, PAUSED, TOO_MANY and INVALID `fields.password`.
2. `client/src/store/session.js`: add `recoveryCode: null` ("T5: the code a sign-up answered with, in memory only, until Overview has shown it") and `clearRecoveryCode: () => set({ recoveryCode: null })`. `signUp` becomes `const { recoveryCode, ...user } = await api.signUp(details); set({ user, ended: null, recoveryCode })`. `signIn`, `signOut`, `deleteFamily` and `expire` also set `recoveryCode: null`, so it never outlives the person.
3. New `client/src/components/RecoveryCode.jsx`: `export default function RecoveryCode({ code, onSaved })`. The same card as `Family.jsx:22-48`: `role="status"`, heading "Your recovery code" with the `KeyRound` icon, the code as `code.match(/.{4}/g).join('-')` in `type-data` and `font-semibold`, `<CopyButton text={grouped} what="code" />`, a warning `Message`: "Write this down and keep it somewhere safe. It is the only way to set a new password if you forget yours, and it is not shown again. It works once; you can make a new one in Settings.", and a `btn btn-text` button "I have saved it" calling `onSaved`.
4. `client/src/pages/Overview.jsx`: at the top of the page's content, `{recoveryCode && <RecoveryCode code={recoveryCode} onSaved={…} />}`, from `useSession`. `onSaved` clears it and moves focus to `#main`. It is a card, not a dialog: the loop test must still see the Overview heading straight after sign-up.
5. `client/src/pages/Settings.jsx`: a section "Recovery code" between Password and Signed-in devices, component `Recovery({ settings })`, on `useForm({ password: '' })`. Text when `has` (a local state starting at `settings.recovery`): "You have a recovery code. It lets you set a new password if you forget yours. If you have lost it, make a new one; the old one then stops working." Otherwise a warning `Message`: "You have no recovery code. Without one, a forgotten password cannot be reset." Then a `PasswordField` "Your password" (`autoComplete="current-password"`) and a `btn btn-secondary` "Make a new code". `WRONG_PASSWORD` shows on the field: "That is not your password. No code was made." On success: clear the password, set `has` true, and show `<RecoveryCode>` until "I have saved it".
6. New `client/src/pages/Forgot.jsx`, default export, in `AuthShell` like Sign in, on `useForm({ email: '', code: '', password: '' })`:
   - `<title>Set a new password – GrowKid</title>`, `h1` "Set a new password", a line under it: "For parents. You need the recovery code you saved when you made your account."
   - Fields: Email (as on Sign up); "Recovery code" with hint "16 letters and numbers. Dashes and spaces do not matter.", `autoComplete="off"`, `autoCapitalize="characters"`, `spellCheck="false"`; `PasswordField` "New password" with the same `Requirement` as Sign up, `autoComplete="new-password"`.
   - Errors before sending: `rules.email`, "Type your recovery code." when empty, `rules.parentPassword`.
   - On refusal: `WRONG_DETAILS` shows "That email and recovery code do not match. Check both and try again." as the form's alert; a guessable password uses `refusedPassword(error, 'password', values.password)` on the field, as `Settings.jsx:60-63` does; anything else is `submitProblem`.
   - On success the form is replaced by a success `Message`, focused: "Your password is changed, and that recovery code is used up." then a `btn btn-primary` link "Sign in" to `/login`, and "After you sign in, make a new recovery code in Settings."
   - The aside: two entries, "Parents" / "Use the recovery code from when you made your account, or a newer one from Settings." and "Children" / "Ask your parent. They can set a new password for you from Family."
   - Under the form: "No recovery code? Then a parent’s password cannot be reset in this version." and a link back to Sign in.
7. `client/src/router.jsx`: `Forgot: page(() => import('./pages/Forgot.jsx'))`, the route `{ path: '/forgot', lazy: pages.Forgot }` beside `/signup` inside `SignedOutOnly`, and the route-count comment (line 34) goes up by one.
8. `client/src/pages/SignIn.jsx:104-107`: the paragraph becomes "If you are a child, ask your parent. They can set a new password for you. If you are a parent, " then a `Link` to `/forgot`, "set a new password with your recovery code", then ".".
9. `client/e2e/routes.spec.js:43`: add `'/forgot'` to the signed-out list.

**Tests.**
- `server/test/helpers.js`, `family()`: `const { recoveryCode, ...user } = res.body` and return `{ api, user, recoveryCode, ...parent }`, so tests that compare `user` with the session still hold. Fix `account.test.js:52` for the new field.
- `server/test/trust.test.js`:
  - `'T5: sign-up answers with a recovery code once: 16 base32 characters, stored only as a hash, and never in the session or the settings'`.
  - `'T5: the email, the code and a new password reset a forgotten password: the old password and every device stop, the new one signs in, and the code is used up'`.
  - `'T5: a wrong code, an unknown email, a child\'s username and an account with no code are the same WRONG_DETAILS, and each costs a real compare'` (mirror how `account.test.js:127` shows the compare).
  - `'T5: the code is read whatever its case, dashes or spaces'`.
  - `'T5: a guessable new password is INVALID only after the right code, and the code still works afterwards'`.
  - `'T5: a parent makes a new code behind the password; the old one stops; settings say whether one exists'`.
  - `'T5: a paused family is refused as PAUSED, and wrong tries share the sign-in limits: the 11th from one address at one email is TOO_MANY'`.
  - `'T5: two resets at once with one code change the password once'`.

**What could go wrong.** Sign-up now hashes twice, so each test family costs about a quarter of a second more and the suite gets slower. Do not lower the cost to win it back.

### Item 6. A copy of the family's data (T6)

**Read first:** `server/src/db.js:14-47`; `server/src/routes/series.js:56-58`; `server/src/routes/account.js:163-186`; `client/src/api/index.js:180-223`; `client/src/pages/Settings.jsx:278-320`. Run the two `context7` checks named in section 3 now.

**Server.**
1. New file `server/src/zip.js`. *Proven:* the file it writes opens in Windows Explorer's own unzip and in `tar`.

```js
import { crc32 } from 'node:zlib'

/**
 * T6: a .zip written by hand, a part at a time, with no dependency: every entry is stored (not compressed), so its checksum and
 * size are known before its header is written. `write` takes a Buffer and resolves once it has gone. Names are UTF-8.
 * ponytail: no zip64, so under 4 GiB in all (a family's 2 GiB quota keeps it there) and under 65,536 entries (the caller caps them).
 */
export function zipWriter(write, at = new Date()) {
  const time = (at.getUTCHours() << 11) | (at.getUTCMinutes() << 5) | (at.getUTCSeconds() >> 1)
  const date = ((at.getUTCFullYear() - 1980) << 9) | ((at.getUTCMonth() + 1) << 5) | at.getUTCDate()
  const central = []
  let offset = 0
  return {
    /** One entry: its local header, its name, its bytes. */
    async add(name, bytes) {
      const file = Buffer.from(name)
      const local = Buffer.alloc(30)
      local.writeUInt32LE(0x04034b50, 0)
      local.writeUInt16LE(20, 4) // the version needed to read it
      local.writeUInt16LE(0x0800, 6) // the name is UTF-8
      local.writeUInt16LE(time, 10)
      local.writeUInt16LE(date, 12)
      local.writeUInt32LE(crc32(bytes), 14)
      local.writeUInt32LE(bytes.length, 18)
      local.writeUInt32LE(bytes.length, 22)
      local.writeUInt16LE(file.length, 26)
      const entry = Buffer.alloc(46)
      entry.writeUInt32LE(0x02014b50, 0)
      entry.writeUInt16LE(20, 4)
      entry.writeUInt16LE(20, 6)
      local.copy(entry, 8, 6, 30) // flags to name length: the same 24 bytes in both headers
      entry.writeUInt32LE(offset, 42)
      central.push(entry, file)
      offset += 30 + file.length + bytes.length
      await write(local)
      await write(file)
      await write(bytes)
    },
    /** The list of entries and the end record. Without them the file does not open, which is right for an export cut short. */
    async end() {
      const tail = Buffer.alloc(22)
      tail.writeUInt32LE(0x06054b50, 0)
      tail.writeUInt16LE(central.length / 2, 8)
      tail.writeUInt16LE(central.length / 2, 10)
      tail.writeUInt32LE(central.reduce((total, part) => total + part.length, 0), 12)
      tail.writeUInt32LE(offset, 16)
      for (const part of central) await write(part)
      await write(tail)
    },
  }
}
```

2. `server/src/routes/series.js:56`: export `asSeries`.
3. `server/src/routes/account.js`, after `deleteFamily`. Imports: `path` from `node:path`; `NAMES`, `readProofFile` from `../files.js`; `asReport`, `asRequest`, `asReward`, `asSuggestion` from `../shape.js`; `asSeries` from `./series.js`; `zipWriter` from `../zip.js`. Check that importing `./series.js` here makes no import cycle that breaks start-up (`series.js` imports `auth`, `db`, `rules`, `scoring`; none imports `account.js`).

```js
/** T6: the most proof files one export packs; a zip without zip64 holds 65,535 entries. Oldest first, and family.json says how many were left out. */
const MOST_EXPORT_FILES = 65_000
const extension = (type) => path.extname(NAMES[type] ?? 'proof.pdf') // a PDF stored before PDFs were dropped (C2)

/**
 * exportFamily (T6): a .zip of what this parent can already see. family.json, in the API's own shapes, and proofs/<id>.<ext> for each
 * proof file still kept, read and written one at a time, so memory holds one file. Never a hash or a secret; never a child's report
 * (rule 15) or a child's savings goal (K3), which are not the parent's to read. family.json goes last, so what it says about the
 * files is what was packed. If the caller leaves, or a write fails, the response is cut and the zip does not open.
 * ponytail: the browser holds the whole zip before saving it; a one-time download link would stream to disk if that ever matters.
 */
account.post('/me/export', passwordLimit, async (req, res) => {
  const me = only(req, 'parent')
  if (!(await matches(text((req.body ?? {}).password), me.passwordHash))) refuse('WRONG_PASSWORD')
  const children = await db.user.findMany({ where: { parentId: me.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
  const ids = children.map((child) => child.id)
  const oldestFirst = [{ createdAt: 'asc' }, { id: 'asc' }]
  const [snapshots, series, suggestions, rewards, requests, mine, files] = await Promise.all([
    readChildren(ids),
    db.taskSeries.findMany({ where: { childId: { in: ids } }, orderBy: oldestFirst }),
    db.suggestion.findMany({ where: { childId: { in: ids } }, include: { child: { select: { name: true } } }, orderBy: oldestFirst }),
    db.reward.findMany({ where: { parentId: me.id }, orderBy: oldestFirst }),
    db.rewardRequest.findMany({ where: { parentId: me.id }, include: { child: { select: { name: true } } }, orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }] }),
    db.report.findMany({ where: { byId: me.id }, orderBy: [{ sentAt: 'asc' }, { id: 'asc' }] }),
    db.proof.findMany({ where: { fileType: { not: null }, removedAt: null, task: { childId: { in: ids } } }, select: { id: true, fileType: true }, orderBy: [{ sentAt: 'asc' }, { id: 'asc' }] }),
  ])
  const stamp = ({ consentAt, consentVersion, createdAt }) => ({ consentAt: consentAt?.toISOString(), consentVersion: consentVersion ?? undefined, createdAt: createdAt.toISOString() })

  res.status(200).set({ 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="growkid-family.zip"' })
  const write = (bytes) => new Promise((done, fail) => res.write(bytes, (error) => (error ? fail(error) : done())))
  try {
    const zip = zipWriter(write, now())
    let packed = 0
    for (const { id, fileType } of files.slice(0, MOST_EXPORT_FILES)) {
      const bytes = await readProofFile(id).catch(() => null) // a file that is missing is counted below, not fatal
      if (!bytes) continue
      await zip.add(`proofs/${id}${extension(fileType)}`, bytes)
      packed += 1
    }
    const family = {
      exportedAt: now().toISOString(),
      parent: { ...asUser(me), ...settings(me), ...stamp(me) },
      children: children.map((child, i) => ({
        ...asChild(child), ...stamp(child),
        tasks: snapshots[i].tasks, restDays: snapshots[i].rest, quest: snapshots[i].quest, questAwards: snapshots[i].questAwards, stickers: snapshots[i].awards,
      })),
      series: series.map(asSeries), suggestions: suggestions.map(asSuggestion), rewards: rewards.map(asReward), requests: requests.map(asRequest),
      reports: mine.map((row) => asReport(row)),
      files: { packed, notPacked: files.length - packed },
    }
    await zip.add('family.json', Buffer.from(JSON.stringify(family, null, 2)))
    await zip.end()
    res.end()
  } catch {
    res.destroy()
  }
})
```

   This block was not run as a whole. The `context7` check must confirm that `res.write`'s callback receives an error once the caller has gone; if it does not, guard each write with `if (res.destroyed) throw new Error('gone')` first.

**Client.**
1. `client/src/api/index.js`, after `deleteFamily`. The download happens here, because only this folder may hold it:

```js
/**
 * Downloads a copy of the family's data as growkid-family.zip (T6): family.json and the proof files still kept. Rejects
 * WRONG_PASSWORD, and TOO_MANY after too many tries. No timeout: it takes as long as the files take.
 * @type {(password: string) => Promise<void>}
 */
export const exportFamily = async (password) => {
  let blob
  try {
    blob = (await http.post('/me/export', { password }, { responseType: 'blob', timeout: 0 })).data
  } catch (error) {
    const sent = error?.response?.data
    if (sent instanceof Blob) error.response.data = await sent.text().then(JSON.parse).catch(() => ({})) // a refusal arrives as a blob too
    throw toApiError(error)
  }
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: 'growkid-family.zip' })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
```

2. `client/src/pages/Settings.jsx`: a section "A copy of your family’s data" between Notifications and Delete, component `Download()`, on `useForm({ password: '' })`. Text: "Download everything GrowKid holds for your family as one .zip file: a file named family.json with every task, note, score and setting, and a folder with the photos and videos still kept. It is yours to keep; nothing changes here." A `PasswordField` "Your password" and a `btn btn-secondary` "Download" (busy: "Preparing…"). `WRONG_PASSWORD` on the field: "That is not your password. Nothing was downloaded." Success, `role="status"`: "The download has started. Open the .zip to find family.json and the proofs folder." Then set busy false and clear the password.
3. `Settings.jsx:309-316`, in `DeleteFamily`: "To keep a record, save a report from Progress first." becomes "To keep a copy, download your family’s data above first."

**Tests** (`server/test/trust.test.js`). Read the zip back with this reader. *Proven* against the writer.

```js
/** The entries of a stored-only zip, by name, each checked against its checksum. */
function unzip(b) {
  const end = b.length - 22
  assert.equal(b.readUInt32LE(end), 0x06054b50)
  const files = {}
  let at = b.readUInt32LE(end + 16)
  for (let i = 0; i < b.readUInt16LE(end + 10); i++) {
    assert.equal(b.readUInt32LE(at), 0x02014b50)
    const [size, nameLength, local] = [b.readUInt32LE(at + 24), b.readUInt16LE(at + 28), b.readUInt32LE(at + 42)]
    const name = b.toString('utf8', at + 46, at + 46 + nameLength)
    const data = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28)
    files[name] = b.subarray(data, data + size)
    assert.equal(crc32(files[name]), b.readUInt32LE(at + 16), name)
    at += 46 + nameLength + b.readUInt16LE(at + 30) + b.readUInt16LE(at + 32)
  }
  return files
}
```

- `'T6: the export needs the password and is the parent\'s alone: a wrong password, a child, a moderator and a visitor are refused'`.
- `'T6: the zip holds each kept proof file byte for byte and family.json with the family\'s tasks, rewards and settings'`: compare each `proofs/<id>.<ext>` with the stored file.
- `'T6: family.json holds no hash, secret or token, nothing of another family, no child\'s report and no child\'s savings goal'`: assert the JSON text matches none of `passwordHash`, `recoveryHash`, `totpSecret`, `tokenVersion`, `goalRewardId`, a marker written in the child's report, and a marker in a second family's task.
- `'T6: a file removed for age is left out, and its proof in family.json says removed'`.
- `'T6: export tries share the password limit'`.

**Proof, beyond the tests.** Once, by hand: export a throwaway family in the built app (`npm run preview`), open the .zip in Windows Explorer, and open `family.json`. That is the phase's acceptance line. Watch the console: the built app's Content-Security-Policy applies only there, and a blocked blob download would show as a violation. If it is blocked, stop the item and report; do not loosen the policy.

### Item 7. The GPS route in video tracks (T7)

**Read first:** `server/src/files.js:141-193`; `server/test/fixtures.js:98-116`; `server/test/rules.test.js:79-104,140-160`.

**Change.** In `server/src/files.js`, replace `stripBoxes` and its doc comment (lines 159-193) with this, and add `DATA_TRACKS` above it. *Proven* against the fixtures below: `meta`, `gpmd` and `text` tracks, `co64`, one chunk per sample, and each refusal.

```js
/** T7: the handler kinds of a track that holds no picture or sound, only data recorded beside them: an action camera's GPS route, timed text. */
const DATA_TRACKS = ['meta', 'text', 'gpmd']

/**
 * A5: only a file with a video track is a video. moov/trak/mdia/hdlr names each track's kind: 12 bytes after the `hdlr` tag come the
 * version and flags, pre_defined, then the handler type, which is `vide` for video. M4A audio and AVIF image sequences have none.
 * A6: renames the udta and meta boxes inside moov and inside each trak (C3), and the udta, meta and uuid boxes at the top of the file,
 * to `free` and blanks what they held: same size, and players skip a free box. That is where phones put the place the video was filmed.
 * C3: zeroes the creation and modification times in mvhd, tkhd and mdhd.
 * T7: a data track's samples are blanked where they lie, found through its sample table (stsz the sizes, stsc how many to a chunk,
 * stco or co64 where each chunk starts), and then the track itself becomes a free box. Everything is read from `b` and written to
 * `out`, so blanking never changes what is parsed. A data track whose table is missing or runs past the file, or a fragmented file
 * (moof) with a data track, whose samples the table does not list, is FILE_TYPE: nothing is stored with a route in it. `budget`
 * bounds the work: every byte is blanked at most once in all, however the tables are written.
 */
function stripBoxes(b) {
  const count = parts()
  const inside = (parents) => parents.flatMap((p) => boxes(b, p.at + p.head, p.at + p.size, count)) // each level read once, so counted once
  const named = (list, ...types) => list.filter((box) => types.includes(box.type))
  const within = (list, parent) => list.filter((box) => box.at > parent.at && box.at < parent.at + parent.size)
  const top = boxes(b, 0, b.length, count)
  const moov = named(top, 'moov')
  const inMoov = inside(moov)
  const traks = named(inMoov, 'trak')
  const inTraks = inside(traks)
  const mdias = named(inTraks, 'mdia')
  const inMdias = inside(mdias)
  const handlers = named(inMdias, 'hdlr')
  const kindOf = (box) => (box.size >= box.head + 12 ? ascii(b, box.at + box.head + 8, 4) : '')
  if (moov.length === 0 || !handlers.some((box) => kindOf(box) === 'vide')) bad()
  const out = Buffer.from(b)

  const dataTraks = traks.filter((trak) => within(handlers, trak).some((box) => DATA_TRACKS.includes(kindOf(box))))
  if (dataTraks.length && named(top, 'moof').length) bad()
  const u32 = (at) => b.readUInt32BE(at)
  let budget = b.length
  for (const trak of dataTraks) {
    const tables = inside(named(inside(named(within(inMdias, trak), 'minf')), 'stbl'))
    const [stsz] = named(tables, 'stsz')
    const [stsc] = named(tables, 'stsc')
    const [stco] = named(tables, 'stco', 'co64')
    if (!stsz || !stsc || !stco) bad()
    const z = stsz.at + stsz.head // version and flags, one size for all (or 0), the count, then a size each
    const c = stsc.at + stsc.head // version and flags, the count, then (first chunk, samples per chunk, description) each
    const o = stco.at + stco.head // version and flags, the count, then an offset each
    const wide = stco.type === 'co64'
    if (stsz.size < stsz.head + 12 || stsc.size < stsc.head + 8 || stco.size < stco.head + 8) bad()
    const [fixed, samples, runs, chunks] = [u32(z + 4), u32(z + 8), u32(c + 4), u32(o + 4)]
    if ((fixed === 0 && stsz.size < stsz.head + 12 + samples * 4) || stsc.size < stsc.head + 8 + runs * 12 || stco.size < stco.head + 8 + chunks * (wide ? 8 : 4)) bad()
    let sample = 0
    let run = 0
    for (let chunk = 0; chunk < chunks; chunk++) {
      while (run + 1 < runs && u32(c + 8 + (run + 1) * 12) <= chunk + 1) run++ // the last run that starts at or before this chunk
      const perChunk = runs ? u32(c + 8 + run * 12 + 4) : 0
      let length = 0
      for (let i = 0; i < perChunk && sample < samples; i++, sample++) length += fixed || u32(z + 12 + sample * 4)
      const from = wide ? Number(b.readBigUInt64BE(o + 8 + chunk * 8)) : u32(o + 8 + chunk * 4)
      if (from + length > b.length || (budget -= length) < 0) bad()
      out.fill(0, from, from + length)
    }
  }

  for (const box of [...named(top, 'udta', 'meta', 'uuid'), ...named(inMoov, 'udta', 'meta'), ...named(inTraks, 'udta', 'meta'), ...dataTraks]) {
    out.write('free', box.at + 4, 'latin1')
    out.fill(0, box.at + box.head, box.at + box.size) // the rename alone would leave the place name readable inside the file
  }
  // after the version byte and three flag bytes: two 32-bit times in version 0, two 64-bit ones in version 1
  for (const box of [...named(inMoov, 'mvhd'), ...named(inTraks, 'tkhd'), ...named(inMdias, 'mdhd')]) {
    const at = box.at + box.head
    const length = b[at] === 1 ? 16 : 8
    if (box.size < box.head + 4 + length) bad()
    out.fill(0, at + 4, at + 4 + length)
  }
  return out
}
```

The `ponytail:` line about per-track GPS (line 165) goes with the old comment: the limit it named is closed.

**Fixtures** (`server/test/fixtures.js`, after `mp4`). *Proven.*

```js
const be32 = (...numbers) => Buffer.concat(numbers.map((n) => {
  const four = Buffer.alloc(4)
  four.writeUInt32BE(n)
  return four
}))
const be64 = (n) => {
  const eight = Buffer.alloc(8)
  eight.writeBigUInt64BE(BigInt(n))
  return eight
}

/** T7: a data track (`handler`: meta, text or gpmd) whose samples of these sizes sit in chunks at these offsets, `perChunk` samples to a chunk. */
export const routeTrack = (handler, sizes, offsets, { perChunk = sizes.length, wide = false, tables = ['stsz', 'stsc', 'stco'] } = {}) => {
  const all = {
    stsz: box('stsz', be32(0, 0, sizes.length, ...sizes)),
    stsc: box('stsc', be32(0, 1, 1, perChunk, 1)),
    stco: wide ? box('co64', be32(0, offsets.length), ...offsets.map(be64)) : box('stco', be32(0, offsets.length, ...offsets)),
  }
  return box('trak', box('tkhd', Buffer.alloc(84)), box('mdia', box('mdhd', Buffer.alloc(24)), box('hdlr', Buffer.alloc(8), Buffer.from(handler), Buffer.alloc(12)), box('minf', box('stbl', ...tables.map((name) => all[name])))))
}

/** T7: an MP4 with a video track and a data track whose route (two samples, each holding SECRET) lies in mdat after the frames. `options.offsets` puts the chunks elsewhere. */
export const withRoute = (handler = 'meta', options = {}, extraTop = []) => {
  const route = [Buffer.from(`${SECRET}-one`), Buffer.from(`${SECRET}-two!`)]
  const build = (offsets) => [
    box('ftyp', Buffer.from('isom'), Buffer.alloc(4), Buffer.from('isom')),
    box('moov', box('mvhd', Buffer.alloc(100)), track('vide'), routeTrack(handler, route.map((r) => r.length), offsets, options)),
    ...extraTop,
  ]
  const before = Buffer.concat(build(options.perChunk === 1 ? [0, 0] : [0])).length + 8 + 'frames'.length // mdat's header, then the frames
  const offsets = options.offsets ?? (options.perChunk === 1 ? [before, before + route[0].length] : [before])
  return Buffer.concat([...build(offsets), box('mdat', Buffer.from('frames'), ...route)])
}
```

**Tests.**
- `server/test/rules.test.js`:
  - `'T7: a data track (meta, text or gpmd) loses its samples where they lie and becomes a free box; the picture stays and the size is the same'`: for `withRoute('meta')`, `('gpmd')`, `('text')`, `('meta', { wide: true })` and `('meta', { perChunk: 1 })`: the stored file has the input's length, does not include `SECRET`, still includes `frames`, includes none of `stsz`, `stco`, `co64`, and moov's children read `mvhd`, `trak`, `free`. The input does include `SECRET`.
  - `'T7: a data track whose samples cannot be found is FILE_TYPE'`: `withRoute('meta', { offsets: [0xfffffff0] })`, `{ tables: ['stsz', 'stsc'] }`, `{ tables: ['stsc', 'stco'] }`, `withRoute('meta', {}, [box('moof', Buffer.alloc(8))])`, and a track whose 50 chunks each claim nearly the whole file (`routeTrack('meta', Array(50).fill(size - 10), Array(50).fill(0), { perChunk: 1 })` in a file with a video track and an `mdat` of `size` zero bytes).
  - `'T7: a video with no data track is stored exactly as before'`: a file of `ftyp`, `moov(mvhd, track('vide'), track('soun'))`, `mdat` equals its own stored bytes.
- `server/test/tasks.test.js`: `'T7: an uploaded video with a GPS track is stored without the route'`: upload `withRoute()`, read the stored file from `UPLOAD_DIR`, assert no `SECRET`.

**What could go wrong.** A real video's chapter or subtitle track uses the `text` handler and is blanked too; that is the item as written. A video or sound track that points at a blanked track through a `tref` box keeps a reference to a track that is now a free box; players skip it. No real action-camera file was available to play back, so say in the report that playback of a real GPS video is for the user to try.

### Item 8. The real screening word list

Skipped. See section 1.

## 7. Step 4, verify

1. `npm run verify` from the repo root. Report a failure with its output.
2. Screens, with the Playwright MCP, at 360 px and 1280 px, then keyboard only. Use a throwaway family and a throwaway moderator, and remove both afterwards. The demo family stays; never run `npm run seed`.

| Screen | What to see |
|---|---|
| Sign in | A moderator's right password brings the code field with focus in it; a wrong code says so and keeps both fields; the right code lands on Reports. A parent and a child never see the field. |
| Set a new password (`/forgot`) | Each error on its own field; a wrong code and an unknown email read the same; success shows the Sign in link. |
| Overview after sign-up | The recovery code card; Copy; "I have saved it" removes it; a reload does not bring it back. |
| Settings | The three new sections; the shorter-time dialog; a new recovery code shown once; the download starts. |
| Reports | Pause, the tag, the answer box replaced by Unpause; Unpause brings the box back. Paging appears only past 200, so check it by inserting rows as the test does, then remove them. |
| A task with a removed file (parent's and child's page) | "Photo removed after N days", with the note and the result. Mark one proof of the throwaway family removed with a script in the scratchpad that sets `removedAt` on that proof id only; do not run `removeOldProofFiles` against the development database by hand. |
| Growth | The new line under the gallery. |

   The throwaway moderator: run the script with `MODERATOR_EMAIL`, `MODERATOR_PASSWORD` and no argv, take the secret from its second line, make a code with `node -e` importing `./src/totp.js`, and finish with `MODERATOR_REMOVE=1`. Remove `.playwright-mcp/` from the repo root afterwards.
3. `design:ux-copy` once over the new copy, then the `web-design-guidelines` audit of the changed client files.

## 8. The acceptance list

Hand this list, with the diff, to the fresh reviewer.

- A moderator cannot sign in without a valid code; a replayed code fails; a wrong password never asks for a code; a moderator with no secret cannot sign in.
- Pausing and unpausing from Reports signs the whole family out and back in, changes nothing else, and shows the moderator no name; a paused family's report cannot be answered.
- Every answer, pause and unpause leaves one record; no code path updates or deletes one; deleting a family keeps it.
- The moderator's list states the total and reaches every report.
- An old file is deleted and shown as removed; the row, the note and the review stay; the real clock decides, never the development clock; a shorter setting asks first.
- Recovery works once and the code then dies; a wrong code, an unknown email and an account with no code are indistinguishable; a paused family is refused.
- The export opens in Windows Explorer and holds `family.json`; it holds no hash or secret, no child's report, no child's savings goal and nothing of another family.
- The GPS fixture comes out without its track data, at the same size; a data track that cannot be read is refused.
- No new route takes free text from a child. Every new table is named on Safety and privacy. `ModeratorAction` is the one table `erase()` leaves, and Privacy says so.
- Nothing new leaves the machine: no dependency was added, and no request goes to another host.
- Sitemap rule 30, DESIGN.md section 18 and Safety and privacy say what the code does.

## 9. Steps 5 to 7: review, close, report

**Review.** `/code-review`, `/ponytail-review` and `/security-review` on the phase diff, and the one fresh reviewer. Fix what is confirmed. After two fix-and-recheck rounds, bring what is still open to the user.

**Close.**
- `final-plan.md`: tick items 1 to 7 and move nothing; note item 8 as skipped; in section 3's "Open, for you" table, write the Phase 8 answer. In section 1's table, update the server tests (count and seconds, from `npm test`), the routes (count them from the routers, not from this plan), and the schema row (models, enums, migrations, counted from `schema.prisma` and the migrations folder).
- `README.md`: the moderator part (the second step, the link printed once, `MODERATOR_TOTP=new`, `MODERATOR_REMOVE=1`, the record's SQL), and that the demo moderator needs enrolling.
- DESIGN.md section 18, "What the code has today".
- The memory note `growkid-final-plan`, and `work_state_write` to mark the phase `done`.

**Report,** in `final-plan.md` section 4's format. Under "For you", list:
- The assumptions to confirm: T1 to T7, and the six rows of section 1.
- To use the demo moderator again, enrol it once: in `server/`, set `MODERATOR_EMAIL=moderator@example.com`, a new `MODERATOR_PASSWORD` of 20 or more characters and `MODERATOR_TOTP=new` for one `npm run moderator`, and add the printed secret to an authenticator app as a time-based key (SHA-1, 6 digits, 30 seconds). The old demo password no longer signs it in.
- Play back one real action-camera video with a GPS track after uploading it, if one is at hand (item 7).
- CI is still unverified; the end-to-end job now runs the moderator script.

Then name Phase 9 and stop. Do not start it.
