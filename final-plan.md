# GrowKid: final plan

Rewritten on 15 November 2026. This one file is both the list of work and the brief a build session runs from. It replaces the plan of 8 November and the brief of the same date (`prompt.md`), and it carries every decision they held. Both are kept beside it as `*.bak.md` until you delete them.

How to use it:
- **You:** open a fresh Claude Code session on Opus 5.5 at high effort for each phase and say "Run the next phase of final-plan.md". Commit when the phase report comes back, then start the next session. Phases 8 and 9 take two sessions each: first a Fable 5.2 session ("Plan phase 8 of final-plan.md"), then the Opus session that builds from its plan. Section 4 says how.
- **The session:** read section 4 before anything else. It says how a phase runs.

Sizes are rough: **S** is under half a day, **M** is up to two days, **L** is more. Security items carry a severity: **high** puts children's data or the whole app at risk, **medium** weakens a defence that exists, **low** is hardening. Source tags: **audit** is the code audit of 8 November, **new** was found in the re-read of 15 November, **todo #n** is `complete-todo-list.md`.

Every `file:line` below was true on 8 November. Lines drift as phases land, so grep before editing.

## 1. Where things stand

Checked against the code and rerun on 15 November 2026.

| Measure | Today | Source |
|---|---|---|
| Server tests | 161 of 161 pass, in about 220 s (after Phase 3) | `npm test` |
| Whole-loop test | 1 of 1 passes in about 20 s, with no serious or critical axe finding on any page it visits and no Content-Security-Policy violation | `npm run e2e` in `client/` |
| Every check | passes | `npm run verify` |
| Server lint, client lint, client check | clean | `npm run lint`, `npm run check` |
| Client build | after Phase 4: one file per page, the largest of the app's own 95 kB (the router library) and React DOM 218 kB, all within budget (`npm run check:size`); after Phase 3, one JS file of 569 kB, CSS 55 kB; 559.37 kB after Phase 1, larger than before it because of the dependency updates and the self-hosted font rules | `npm run build` |
| Server routes | 47 in four routers, plus sign-out (Phase 4 replaced the three count routes with `/counts`, and added `/today` and `/tasks/history`) | `server/src/routes/` |
| Schema | 11 models, 6 enums, 5 migrations (Phase 3 added `pausedAt`, `consentAt` and `consentVersion` to `User`; Phase 4 three indexes; Phase 5 `TaskSeries`, and `doneLooksLike`, `seriesId` and `seriesDay` on `Task`) | `server/prisma/schema.prisma` |
| Advisories | client 0, server 3 high (Prisma's command-line tool, accepted in `README.md`) | `npm audit` |
| Lighthouse baseline (mobile, version 13.6.0, built app) | 15 November, all four in one run: Landing, Sign in, Overview and Today each performance 100, accessibility 100. An earlier run in Lighthouse's own Chrome gave Landing 95 and Sign in 97. | `npx lighthouse@13.6.0 --port=<n> --disable-storage-reset`, attached to a Playwright Chromium (`channel: 'chromium'`) in which a throwaway family signed in through the API, so no cookie is on a command line; spawned without blocking Node, or the tab never paints (`NO_FCP`) |
| Committed | everything up to B4 (`cc7ce83`) and the first plan (`d8ca718`) | `git log` |

What exists:
- The React client and the Express server are built and run together on one machine. The whole loop works: a parent sets a task, the child sends proof, the parent approves or sends it back, and the child gets the reward moment, a streak, stickers, a reward shop, a weekly quest and cheers.
- No route reaches another family's data, every write names its fields, racing writes take the child's row lock, uploads are typed from their bytes and stripped of location, and no secret is in the git history. The audit of 8 November confirmed all of this, and the re-read of 15 November agrees.
- University documents: `Documentation/GrowKid-Project-Report.docx`, `Documentation/Presentation/GrowKid-Final-Presentation.pptx` (19 slides) and `Documentation/GrowKid-Project-Tracker.xlsx`. They replaced the five milestone documents, which are deleted in the working tree. They describe the code as of B4.

What is not built: every open item from Phase 6 on. Phases 2 to 5 were built on 15 November 2026 and are not committed yet. Phase 1 was built on 15 November 2026, and its last item (the Lighthouse scores of the two signed-in screens) was measured the same evening. Its findings below are fixed, except that the repository still sits inside OneDrive until you move it.

What the re-read found that the old plan did not have (all in Phase 1):
- **The sign-in limits by address can be walked around.** Express trusts `X-Forwarded-For` from loopback (`server/src/app.js:15`), and Vite's proxy is set up to pass the header through as the browser sent it (`client/vite.config.js:9` sets no `xfwd`). So anyone can send a different made-up address with every try, and both address limits never fill. This is read from the code, not yet run; Phase 1's test settles it.
- **Anyone can move the server's clock.** The `X-Clock-Days` header is honoured whenever `NODE_ENV` is not `production` (`server/src/app.js:31`). With hosting dropped, development is the only mode the app ever runs in, so a signed-in child can shift every family's days.
- **API answers can be cached by the browser.** No `/api` response says `no-store`, and parent and child often share one device.
- **The repository sits inside OneDrive.** `server/.env` is git-ignored but OneDrive still uploads it, and it would upload proof photos too if `UPLOAD_DIR` pointed inside a synced folder. That breaks the standing rule that children's data goes to no outside service.
- **Today asks three routes that each load the child's whole history** (`client/src/pages/Today.jsx:153`), every minute.

## 2. What "better" means, and how each goal is checked

You asked for five things. Each has a definition a session can test, so "done" is not a matter of opinion.

**Secure.** No software can promise that nobody ever gets through, and a plan that said so would be lying to you. What this plan does instead: it names who might attack, closes each known path with a test that fails if the path reopens, and then attacks the finished app in Phase 9.

| Who | What they try | Closed in |
|---|---|---|
| A stranger at the sign-in page | guess a child's password, from one address or many | Phases 1 and 2 |
| A signed-in parent or child | reach another family, fill the disk, stall the server, move the clock | Phases 1, 2 and 3 |
| A child on the family's shared device | read the parent's cached pages, reuse a session | Phases 1 and 2 |
| Someone on the same Wi-Fi during a phone demo | spoof headers, flood sign-in | Phase 1 |
| A crafted file | stall the parser, carry a location, run script in a viewer | Phase 3 |
| Whoever holds a stolen moderator password | write to children through report answers | Phases 1 and 8 |
| Whoever reads the server's log | find children's words | Phase 1 |

Out of reach of code: the machine itself. Whoever has the Windows account has the database, the photos and `server/.env`. Section 3 lists what you do about that.

Done means: every row has a passing test or a written acceptance in this file, and the Phase 9 attack pass ends with no high finding open.

**Fast.**
- No JavaScript file over 200 kB, React DOM excepted (capped at 230 kB); before Phase 4, one file of 569 kB.
- A child with 1,000 approved tasks gets a default task list without them, and an approval for a child with 2,000 approved tasks finishes in under a second on this machine.
- Today makes one data call per refresh, not three.
- A 12 MB phone photo goes up as a few hundred kB.
- A refresh never blanks the page.
- Lighthouse performance of 90 or more on Landing, Sign in, Today and Overview, measured on the built app.

**Engaging.** Fun here comes from ownership, choice and visible growth, not from tricks. Every feature keeps DESIGN.md §12.7 and §13: nothing left to chance, no countdowns, no guilt, nothing for just opening the app, and every award arrives through the reward moment on Today (rule 13). Done means each feature in Phases 5 and 6 passes that list, and the first-week walkthrough in Phase 10 shows a child something new to do or see on each of seven days.

**UI and UX.** Done means every screen passes the screen check (360 px, 1280 px, keyboard only), the `web-design-guidelines` audit and an `impeccable` critique with no high finding open, and DESIGN.md describes what the code does.

**AX.** I read this as accessibility, and I also covered the agent's experience, since Fable builds the rest.
- *Accessibility:* WCAG 2.2 level AA. The end-to-end test runs axe on every page it visits and fails on a serious or critical issue; the whole loop works by keyboard; pages reflow at 320 px and at 200% zoom; reduced motion and forced colours are honoured.
- *Agent:* one command runs every check (`npm run verify`), a session can start a phase from one sentence, and `CLAUDE.md`, this file and the memory notes agree.

## 3. Decisions

**Standing.** Do not reopen these.
- No chance-based rewards for children; a sealed surprise instead.
- Children's data (names, accounts, proof photos) never goes to an outside service.
- No hosting and no deployment (14 November 2026). The client and server run on one local machine, and Vite proxies `/api` to the server, so there is one origin and no CORS.
- The PDF report is the browser's print of Progress.
- The synopsis and the poster are final. The stack stays as the synopsis names it: Prisma 6, bcrypt, JWT, Multer.

**Yours, of 8 November 2026.** Carried over unchanged.
- One phase per go-ahead. You commit.
- PDF is dropped from the proof types. A PDF already stored stays viewable, as a download.
- A proof's file is deleted 90 days after its task is approved; the parent can choose 30, 90 or 365 days.
- A parent resets a forgotten password with a recovery code. There is no email (D2 stands).
- Repeating tasks are approved (rule 9), and so is the child's own weekly chart (DESIGN.md §11).
- Still declined: the family goal, a parent PIN on a shared device, email, Prisma 7 and a second parent. Say so if you change your mind on any of them.

**Changed by this rewrite.** Each follows from "no hosting" or from your message of 15 November. Tell me if one is wrong.
1. **Opus 5.5 at high effort builds,** from Phase 3 on (your message of 15 November, after Fable 5.2 built Phases 1 and 2: faster, and fewer tokens). The session plans, builds and verifies inline. For Phases 8 and 9, a Fable 5.2 session writes a detailed plan first and Opus builds from it. `CLAUDE.md` says so.
2. **No web push.** You approved a push with no payload on 8 November, before hosting was dropped. A push to the same computer the app runs on does nothing useful, and it would make a parent's browser contact Google's or Apple's push service. Phase 5 replaces it with a count in the tab's title and a notification the open page raises itself, which uses no outside service.
3. **The end-to-end test comes first,** in Phase 1, so every later phase is guarded by it.
4. **The development clock is opt-in** (`DEV_CLOCK=1`), because development mode is now the only mode.
5. **Parked, because they only matter to a hosted product:** the web app manifest and icons, `robots.txt`, share tags, offline support, load testing, usage numbers, Hindi, the pilot, and the legal, retention and breach work. Section 7 keeps the list for the report's future-work chapter.

**Settled values.** A session uses these as written and records each in sitemap §12 when its phase lands. You may change one in this table before its phase runs.

| What | Value |
|---|---|
| Per-account sign-in limit | 30 failed tries an hour on the identifier alone (rule 27) |
| Child password minimum | 8 characters, with a "Make one for me" button: three short words joined by `-` |
| Adding a child, resetting a child's password | 20 an hour per parent |
| Write limit | 120 non-GET requests a minute per user; a signed-out caller is keyed by address |
| Proof uploads | 30 an hour per child; 4 at once in total, 1 per child |
| Family caps | 10 children; 300 tasks per child that are not approved; 50 rewards; 20 repeating series per child |
| Storage quota | 2 GiB per family, the sum of `Proof.fileSize` |
| Free-space floor | refuse a proof when the upload volume would have under 2 GiB free |
| Part cap in the file strippers | 10,000 parts; 20,000 for PNG |
| Moderator password minimum | 20 characters |
| New error codes | `QUOTA` (409, with `fields.quota` one of `children`, `tasks`, `rewards`, `series`, `storage`, `disk`); `PAUSED` (403); `NEEDS_CODE` (401) |
| Task list window | tasks not yet approved, plus approved ones whose approval was in the last 30 days, plus any with `resultSeen: false`. History pages hold 50. |
| Photo resize before upload | longest edge 1,600 px, JPEG at quality 0.85, only when the original is larger |
| Focus refresh | at most one quiet refresh every 15 seconds |
| Size budget | no file in `client/dist/assets` over 200 kB, except the React DOM library file, which cannot be split and is capped at 230 kB (your decision of 15 November 2026, in Phase 4) |
| Privacy version | the date the Safety and privacy page last changed, a constant in `server/src/rules.js`, stamped on consent |
| "Due soon" | a task still to do whose due time is within the next 24 hours |

**Open, for you.** Each is asked at the start of its phase, in one question, with the recommended answer first.

| Phase | Decision | Recommended |
|---|---|---|
| 1 | Move the repository out of OneDrive, or leave it and accept that `server/.env` is uploaded | Move it |
| 5 | The contact address for Landing, and whether it names the four team members and the guide | Yours to give |
| 6 | Six new stickers, one per kind of task (14 becomes 20; rule 3 changes) | Yes |
| 6 | A plant that grows one stage per level, with named levels (reverses "after the pilot") | Yes |
| 6 | A badge the child picks: one of four colours and one sticker they have earned | Yes |
| 6 | Sound and a short vibration on the reward moment, with a mute switch (reverses the psychology plan) | Yes |
| 6 | "Say thanks": a child answers a cheer with one of three fixed replies | Yes |
| 8 | The source for the real screening word list | Skip the item if you have none |
| 10 | The submission date, the meetings held since 14 November, and who did which task | Yours to give |

**For you to do by hand.** No session can do these.
- Keep the Windows account that runs GrowKid behind a password, and turn on device encryption (BitLocker) if the machine has it.
- Make the moderator's password with a password manager.
- Close the tracker workbook in Excel before Phase 10; an open workbook cannot be saved over.
- Real-device and screen-reader checks: Phase 7 hands you an exact checklist.

## 4. How a phase runs

This section is the brief. It is written for an Opus 5.5 session at high effort that plans, builds and verifies the phase itself.

**Phases 8 and 9 are planned first, by Fable 5.2.** Each takes two sessions.
- **The planning session (Fable 5.2)** runs steps 0 and 1 below, reads everything the phase touches, and writes `phase-8-plan.md` or `phase-9-plan.md` in the repo root. It edits no code and no other document, runs no migration, and stops when the plan is written. The plan leaves the builder nothing to decide. For each item, in build order, it gives:
  - the files and functions to change, at the lines they are on that day
  - the exact change, with the code where the logic is subtle: the TOTP check, the zip writer, the MP4 track walk, the route list built from the routers
  - the migration's name and its schema lines
  - each test by name, with what it asserts, and each sentence to add to the sitemap, DESIGN.md and the Privacy page
  - what could go wrong, and the command that proves the item works
  
  It also records the answers to the phase's questions.
- **The building session (Opus 5.5, high effort)** reads the plan file after this section and builds exactly it, from step 2 on, without asking the phase's questions again. Where the plan and the code disagree, stop that item and report; do not redesign it. If the plan file is missing, stop and say so.

**How to work.**
- You are the planner and the builder. Each item gives the goal, the reason, and the values already settled. Where an item names a function or an approach, that is a settled default, there so nobody decides it twice. If the code shows a default cannot hold, stop that item and report; do not force it and do not redesign it quietly.
- Read what the phase touches, in full, before editing. Do not read the whole repository, and do not re-read what is already in context.
- Run independent reads, searches and checks in parallel.
- Keep going inside a phase without checking in. Stop only for the reasons listed under "When to stop".
- Build the simplest thing that works, and reuse what the repo has. Never trimmed: input validation, error handling that prevents data loss, security measures, accessibility. Mark a deliberate shortcut with a `ponytail:` comment naming its ceiling.
- Write the test with the item, not at the end of the phase.
- If the context grows heavy, finish the item in hand, tick it, write the state, and stop at that item boundary. Report it as "Phase N, part 1". The next session picks up the first unticked item.
- Report what happened. A failing check is reported with its output. Nothing is called done without the check that shows it.

**The steps.**

0. **Orient.** Read `CLAUDE.md`, then sections 3 to 5 of this file and your phase in section 6. Run a `claude-mem` search on the phase's area. Run `npm run verify` (from Phase 2 on) so you start from green; if it is red before you touch anything, stop and say so. Mark the phase `doing` with `work_state_write` in the list `growkid-final-plan-build`; Phase 1 creates the list, with every phase as `todo`.
1. **Ask, if the phase lists questions.** One `AskUserQuestion` call for all of them, recommended answer first. Do not use an address, a name, a date or a word list you were not given.
2. **Documents first.** Before code, write every rule the phase changes into `Documentation/FRONTEND-SITEMAP.md` §12, `Documentation/DESIGN.md` where a token, component or rule changes, and the wording the Safety and privacy page must carry. One unambiguous sentence per rule, and an id for each new assumption. Then build exactly those sentences.
3. **Build, in the order the items are listed.**
   - Load `ponytail:ponytail` first.
   - Confirm any library behaviour you rely on through `context7` before you rely on it: React 19, React Router 7, Vite 8, Tailwind 4, Express 5, Prisma 6, express-rate-limit 8, multer 2, helmet 8, `@playwright/test`.
   - For a screen: `impeccable` for direction, `frontend-design` for the build, with DESIGN.md as the authority. Tailwind's default scales are switched off, so only the tokens work. Use `design:ux-copy` for every new piece of copy. Do not use the `21st-*` skills.
   - For a schema change: `npx prisma migrate dev --name <phase>-<what>` in `server/`. The tests migrate `growkid_test` themselves. Never run `migrate reset`, and never set Prisma's AI-consent variable.
4. **Verify it yourself.**
   - `npm run verify` from the repo root. Until Phase 1 has built it, run the commands in `CLAUDE.md` one by one.
   - Screens, with the Playwright MCP: 360 px and 1280 px, then a keyboard-only pass, on every screen the phase changed. Use a throwaway family for anything destructive and delete it afterwards. Stop the dev servers with TaskStop, never by port. Remove `.playwright-mcp/` from the repo root.
   - A UI phase also gets a `web-design-guidelines` audit of the changed files.
5. **Review.**
   - `/code-review` and `/ponytail-review` on the phase diff.
   - `/security-review` whenever `server/` changed.
   - Phases 2, 3, 8 and 9 also get one fresh reviewer: an Agent call with `model: "opus"` and `effort: "high"`, given only the diff (`git diff` plus the untracked files) and the phase's acceptance list, never this conversation. It returns findings ranked by severity, each with `file:line` and a concrete failure, each checked against the code.
   - Fix what is confirmed. After two fix-and-recheck rounds, bring what is still open to the user.
6. **Close.** Tick `- [x]` for what is done and move nothing. Update the table in section 1 if a measure changed. Record each assumption in sitemap §12. Bring DESIGN.md §18's "What the code has today" up to date. Update the memory note `growkid-final-plan` and mark the phase `done`.
7. **Report, then stop.** Use the format below. Never start the next phase.

**Subagents.** This file authorises exactly these Agent calls: the fresh reviewer in step 5, and `subagent_type: "Explore"` with `model: "haiku"` (no `effort`) for a wide read-only search whose output is far larger than its answer. Build inline. If an Agent call is refused because a hook changed its input, reissue it once with exactly the input the error quotes.

**Security testing is authorised.** GrowKid is the user's own code on the user's own machine. Attacking it to test a defence is part of the work: forged tokens, spoofed headers, crafted files, racing requests. Aim only at `127.0.0.1`, only at the test or development server, and never at any other host.

**When to stop inside a phase.** Ask with `AskUserQuestion` when:
- the code shows an item's design cannot hold
- a check still fails after two fix rounds
- an item would need a dependency, an outside service or a rule this file does not name
- a finding touches a standing decision in section 3

Never work around a refusal: Prisma's reset guard, a hook, a denied tool call, or the test database's name check.

**The phase report.** Keep it short.
1. **Done:** the items ticked, each with its main `file:line`.
2. **Checks:** the `npm run verify` summary; the screens checked at 360 px and 1280 px; the keyboard pass.
3. **Reviews:** findings by severity, what was fixed, what is still open.
4. **For you:** assumptions added to sitemap §12 to confirm; decisions the next phase needs; anything to do by hand.
5. **Next:** the next phase's name, then "Commit when ready, then start a new session and say: run the next phase."

## 5. Rules for every phase

- **Never:** hosting, deployment, a Caddyfile, systemd, a VM, or anything declined in section 3.
- **Children's data never leaves the machine.** No analytics, no third-party script, no outside font after Phase 1, no push service, and no child's name or photo in anything a browser sends elsewhere.
- **Git:** no commit, push or branch. No Claude or Anthropic name anywhere in the repository, in a commit message or in a document. This overrides any attribution reminder.
- **Secrets:** never read or print a `.env` value. To add one, use a script that appends it and prints only "added".
- **Dependencies:** only these may be added: `@fontsource/lexend` and `@fontsource/baloo-2` (client); `@playwright/test` and `@axe-core/playwright` (client, dev). Anything else: stop and ask.
- **The data boundary:** pages and components reach data only through `client/src/api/index.js`, and nothing outside `client/src/api/` touches browser storage.
- **Every new table** is removed by `erase()` (`server/src/routes/account.js:101`) and named on the Safety and privacy page (rule 16).
- **Every new text a parent writes for a child** goes through `screen()`. A child never gets a new free-text channel: a child's new inputs are choices from fixed lists.
- **Nothing watched in secret:** whatever a parent can see about a child, the child can see too (DESIGN.md §12.2).
- **The demo family stays.** Never run `npm run seed` again.
- **Tests:** server tests use `node:test`; client checks follow `client/src/utils/tasks.check.js`. Never run two `npm test` at once: they share one database, which is never reset.
- **Never edit** `Documentation/GrowKid-Synopsis.pdf` or the poster. Write no planning document beyond what a phase names.

## 6. The phases

Ten phases. Each ends with the tests for what it added, the checks, and the reviews of section 4. Phase 10 may be run early, after any phase, if a submission date arrives first: it documents whatever is built by then.

| Phase | What | Size |
|---|---|---|
| 1 | Foundations: one check command, the safety net, and the cheap fixes | M |
| 2 | Accounts, sign-in and limits | M to L |
| 3 | Files and child safety | M to L |
| 4 | Speed | L |
| 5 | Parents take it seriously | L |
| 6 | Children want to come back | L |
| 7 | Polish and accessibility | L |
| 8 | Trust and data | L |
| 9 | Attack it, measure it | M |
| 10 | The university documents | M to L |

### Phase 1. Foundations

The cheap, high-value fixes, and the two tools every later phase leans on: one command for the checks, and a test of the whole loop.

**Ask first:** whether the repository moves out of OneDrive (item 11).

1. - [x] **One command for every check.** A root `package.json` with `npm run verify`, running `scripts/verify.mjs`: server lint, server tests, client lint, check, build, the size check (once Phase 4 adds it), the end-to-end test (item 12), and the two boundary greps, each of which must find nothing: `localStorage|sessionStorage|indexedDB` outside `client/src/api/`, and `from 'axios'` outside `client/src/api/`. It prints one line per check and the output of a failed check only, and exits non-zero on any failure. `npm run verify:quick` skips the server tests and the end-to-end test. **(S, new)**
2. - [x] **Dependency fixes.** `npm audit fix` (never `--force`) and `npm update` in `client/`; `npm update` in `server/`, keeping Prisma at 6. Vite 8.2.0 to 8.2.2 lets its dev server serve files outside the project and, on Windows, run a command through its open-in-editor link. That matters here, because `npm run dev` is how the app runs. The server's 3 advisories are in the Prisma command-line tool's config loader, not in anything that handles a request; they stay until Prisma 7, which is declined. Write that acceptance into `README.md`. Record the totals in section 1. **(S, todo #10, high for the client)**
3. - [x] **Self-host the fonts.** Today every visit sends a child's address and browser details to Google. Add `@fontsource/lexend` (400, 500, 600) and `@fontsource/baloo-2` (700, 800), imported once in `client/src/main.jsx`. Delete the Google `<link>` tags and the `ponytail:` comment in `client/index.html:13-19`. Remove the Google Fonts sentence from Privacy and update DESIGN.md §18's font note. The network panel must show no request to `googleapis.com` or `gstatic.com`. **(S, todo #9, high)**
4. - [x] **Fix the doubled phrase on Privacy:** "Photos and Photos and most phone videos" (`client/src/pages/Privacy.jsx:118-119`). **(S, audit)**
5. - [x] **Make the address limits real.** Set `xfwd: true` on Vite's `/api` proxy and add the same proxy under `preview` (`client/vite.config.js:9`), so the proxy appends the caller's real address and Express, which trusts only loopback, reads that one. Confirm the option through `context7` first; if Vite 8 has no such option, set `trust proxy` to `false` instead and say so. Test: a sign-in carrying a made-up `X-Forwarded-For` is still counted against the real address. **(S, new, high)**
6. - [x] **Make the development clock opt-in.** Mount the `X-Clock-Days` reader (`server/src/app.js:31-37`) only when `DEV_CLOCK=1` and `NODE_ENV` is not `production`. Document it in `server/.env.example`. Append `DEV_CLOCK=1` to `server/.env.test` and to `server/.env` by script, without printing either file. Test: with the switch off, the header changes nothing. **(S, new, high)**
7. - [x] **`Cache-Control: no-store` on every `/api` answer,** in one middleware in `server/src/app.js`, so a child who presses Back on the shared device is not shown the parent's pages from the cache. Test one JSON route and one refusal. **(S, new, medium)**
8. - [x] **Headers for the built app.** Add `preview.headers` to `client/vite.config.js`: a Content-Security-Policy that allows only the app's own scripts, styles, fonts, images and media (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, plus `blob:` and `data:` for images and media, and whatever inline-style allowance the build really needs, found by running it), `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`. The built app, through `npm run preview` with the server on `npm start`, is the mode the demo runs in; say so in `README.md`. The end-to-end test runs once against that mode and fails on any CSP violation in the console. **(S, new, medium)**
9. - [x] **Keep children's words out of the log.** The 500 handler logs `err.stack` (`server/src/app.js:76`), whose first line is the error's message, and Prisma's default format can quote a task title or a proof note there. Create the client with `errorFormat: 'minimal'` (`server/src/db.js:5`). Log the method, the path, `err.name`, `err.code` and the stack without its first line. A test throws an error carrying a marker string and checks the marker never reaches the log. **(S, audit, low)**
10. - [x] **A longer moderator password.** The moderator's answer reaches the child who sent the report, so a stolen moderator password is a way to write to children. Ask for 20 characters in `server/scripts/moderator.js:12`, its test and `.env.example`. **(S, audit, medium)**
11. - [x] **Keep proof files and secrets off synced folders.** At start-up (`server/src/index.js:21`), refuse an `UPLOAD_DIR` that is inside the repository or under any folder named by the `OneDrive`, `OneDriveConsumer` or `OneDriveCommercial` environment variables. Test it in `boot.test.js`. If the user chose to move the repository, give them the exact steps and stop the phase there until they have; do not move it yourself. **(S, new, high)**
12. - [x] **A test of the whole loop.** `@playwright/test` and `@axe-core/playwright` in `client/`; config in `client/playwright.config.js`, which starts both servers; the test in `client/e2e/loop.spec.js`; `npm run e2e`. The flow: sign up a throwaway family, add a child, create a task, sign in as the child in a second context, upload a fixture JPEG, approve it, see the reward moment, ask for a reward, give it, delete the family. Run axe on each page visited and fail on a serious or critical issue. If axe finds issues that exist today, fix the ones that are one-line and list the rest in Phase 7's accessibility item, with the test recording them as known until then. **(M, todo #34)**
13. - [x] **CI.** `.github/workflows/ci.yml` on Node 22. Client job: `npm ci`, lint, check, build, a grep that `dist` holds no `growkid-demo`, `X-Clock-Days` or `growkid.dev`, and `npm audit --audit-level=high`. Server job: a `postgres:16` service, `.env.test` written from job variables with a generated 64-character `JWT_SECRET`, `npm ci`, lint, test, and `npm audit --audit-level=critical` with a comment saying why not `high`. An end-to-end job. `.github/dependabot.yml` for security updates only. CI cannot run until you push, so run the same steps locally and report CI itself as unverified. **(S to M, todo #15)**
14. - [x] **Housekeeping.**
    - `README.md:13` still says deployment to Oracle Cloud is next. Say what is true.
    - Delete `specs/`, `reviews/` and `.workflow-context/`, only after `ls -A` shows each empty.
    - Remove the unused `VITE_API_URL` line from `client/.env` with `sed`, without printing the file.
    - Fix the stale comment about "the one VM" (`server/src/auth.js:81`). **(S, todo #3)**
15. - [x] **Record the baseline.** Run Lighthouse (`npx lighthouse`, which needs no install) against the built app for Landing, Sign in, Today and Overview, and add the four performance and accessibility scores to the table in section 1. Phase 9 measures again, and Phase 10 reports both. **(S, new)**

Acceptance:
- `npm run verify` passes and prints one line per check
- no request leaves for Google
- a made-up forwarded address does not dodge a limit, and the clock header does nothing without the switch
- the marker never reaches the log
- the loop test passes with no serious axe finding that is not listed

### Phase 2. Accounts, sign-in and limits

Server first, then the small client parts. Two threats shape this phase: a stranger trying a child's password, and one account using up what every family shares.

1. - [x] **A sign-in limit per account, whatever the address.** Both limits include the address (`server/src/auth.js:83-87`), so a known child username can be tried from many addresses without a pause. Add a third limiter keyed on the trimmed, lower-cased identifier alone, counting failures only, mounted on `POST /api/session` after the other two. The cost is that someone who knows a username can lock that account for up to an hour; rule 27 says so. A `TOO_MANY` answer carries `fields.minutes`, the minutes until the window resets, from `req.rateLimit.resetTime`. **(S, audit, high)**
2. - [x] **The message says how long to wait.** Sign in, Settings and Report a problem show "Try again in N minutes" (`client/src/utils/messages.js`). **(S, review)**
3. - [x] **Limit adding a child and resetting a child's password.** Both hash at cost 12 in plain JavaScript on the server's one thread (`server/src/routes/account.js:169,199`), so one parent sending many at once slows every sign-in. Adding a child also answers `USERNAME_TAKEN`, which lets any parent account test which usernames exist. One limiter on both routes. **(S, audit, medium)**
4. - [x] **Refuse guessable passwords.**
   - Fetch the top 1,000 of SecLists' MIT-licensed `Passwords/Common-Credentials/10k-most-common.txt` with `curl` into `server/src/common-passwords.txt`, with a one-line source note in `README.md`. Read it once at start-up into a `Set`.
   - Refuse, case-insensitively, a password in the set (`fields.password = 'common'`), and one that contains the child's username or any word of three or more letters from the person's name (`'personal'`). For a parent, the part of the email before the `@` counts too.
   - Child minimum 8, mirrored in `client/src/utils/rules.js`. The 72-byte cap stays.
   - "Make one for me" on the child form: three words from a list of 150 short, kind, everyday words in `client/src/utils/words.js`, chosen with `crypto.getRandomValues`, joined by `-`.
   - Update the tests that make 6- or 7-character child passwords. Rule 27 changes. **(S, audit, medium)**
5. - [x] **Sign out every device.** Signing out clears this device's cookie but not a copy of it (`server/src/auth.js:7`). `POST /api/me/sessions/end` raises the parent's `tokenVersion` conditionally, as `changePassword` does (`server/src/routes/account.js:86-89`), and issues a fresh cookie so this device stays signed in. `POST /api/children/:id/sessions/end` raises the child's. Settings gets "Sign out other devices"; the child's page gets "Sign <name> out everywhere". Each has a confirm step and a result message. **(S, audit, low)**
6. - [x] **Caps per family and a storage quota.** Nothing limits children, tasks or rewards (`server/src/routes/account.js:157`, `routes/tasks.js:50`, `routes/family.js:76`). Each open task takes a 25 MB proof, and a sent-back task takes proof again, so one free account could fill the disk in an afternoon. Constants in `server/src/rules.js`, refused with `QUOTA`:
   - children, on add
   - not-yet-approved tasks, on create and when a task moves to another child
   - rewards, on create
   - storage, in `sendProof` before the file is written: the family's `fileSize` sum plus this file. The quota, not the task cap, is what protects the disk.
   - A plain message for each `fields.quota` value in the client.
   - The count-then-insert race is accepted, with a `ponytail:` comment. **(M, audit, high)**
7. - [x] **A write limit per user.** Only sign-in, sign-up, passwords and reports are limited today. One limiter in `server/src/app.js`, after `who`, on every non-GET `/api` request; `DELETE /api/session` is registered earlier and stays unlimited. A tighter one on the proof route. **(S, audit, medium)**
8. - [x] **Bound the memory uploads use.** Proofs are held in memory and stripping copies them again (`server/src/files.js:63,95,120,155`). A slow upload can hold its buffer for up to Node's 300-second request timeout, and ten at once take about 500 MB. A counter in `server/src/routes/tasks.js`: take a slot in `mayReceiveProof` after its checks, release it once on `res.on('close')`, and refuse with `TOO_MANY` when none is free. **(S, audit, medium)**
9. - [x] **Keep free space for the database.** An exported `hasRoom(dir, bytes, floor)` in `server/src/files.js`, built on `fs.statfs`, refusing with `QUOTA` and `disk` before `saveFile`. Unit-test it with a huge floor and a zero floor. **(S, audit, medium)**
10. - [x] **Approvals that stay fast.** `recordApproval` works out stickers by replaying every approval over all of the child's tasks (`server/src/routes/tasks.js:167`, `scoring.js:204-218`), inside the approval's transaction, holding the child's lock, under Prisma's 5-second timeout. After a few thousand tasks each approval stalls, and then that child's approvals fail every time. Call `recordOf(snapshot.tasks, at, { rest, quests: questAwards.length, zone })` once and award every sticker whose `record[measure] >= need` and that is not in `snapshot.awards`. The result is the same, because a new award is dated by this approval anyway. Keep `stickers()`, which the seed uses. Tests: on the existing fixtures the new path earns exactly the set `stickers()` earns, and an approval for a child with 2,000 approved tasks finishes in under a second. **(S to M, audit, medium)**
11. - [x] **Tests:** one per limit and cap above, and `updateTask` refusing another family's `childId` (`server/src/routes/tasks.js:64`), the one write that would put a stranger's words in front of someone else's child. **(S, audit)**

Acceptance: every item's behaviour has a passing test; rule 27 and the new codes are in sitemap §12; Sign in, Settings, the child form and Family pass the screen check.

### Phase 3. Files and child safety

Server, plus the client changes these items need. One more threat sits here: whoever signs up as the parent receives the child's photos, and nothing checks that they are the parent.

1. - [x] **Cap the parts a file may have.** The strippers walk a file part by part with no limit (`server/src/files.js:56-138`). A 25 MB file of minimum-size parts makes millions of objects in one synchronous walk, which stalls the server. Count parts inside `stripJpeg`, `stripPng`, `stripWebp` and `boxes()`; past the cap, `FILE_TYPE`. **(S, audit, medium)**
2. - [x] **PDF proofs: dropped.** A PDF is stored as sent, with its author fields and any photos inside it, so the promise that no location is stored does not hold for it, and it can carry scripts a reader may run. Remove PDF from `sniff()`, from `FILE_TYPES` in `client/src/api/index.js`, and from `PROOF_TYPES` and its copy in `client/src/pages/ChildTask.jsx`. Rule 5, the sitemap and Privacy now say "a photo or a video". A PDF stored before this is served with `Content-Disposition: attachment; filename="proof.pdf"`. **(S, audit, medium)**
3. - [x] **Details that survive stripping.**
   - Drop PNG's `tIME` chunk (`server/src/files.js:94`).
   - Blank the `udta` and `meta` boxes inside each `trak`; `files.js:156` reaches only the top level and `moov`.
   - Zero the creation and modification times in `mvhd`, `tkhd` and `mdhd`: the two 32-bit fields after version and flags in version 0, the two 64-bit fields in version 1.
   - Store `fileName` from the sniffed type, not from the upload: `photo.jpg`, `photo.png`, `photo.webp`, `video.mp4`, `video.mov`, `video.webm`. A camera's own name (`IMG_20261105_…`) carries the date.
   - Add fixtures to the files tests. **(S, audit, low)**
4. - [x] **State the file headers in one place.** `sendProofFile` (`server/src/files.js:202-213`) relies on Helmet's defaults for everything but the type. Set `Content-Security-Policy: default-src 'none'; img-src 'self'; media-src 'self'; sandbox` and `Cross-Origin-Resource-Policy: same-origin` on that response itself. They matter when a file opens as its own page (`client/src/components/Proof.jsx:35`). **(S, audit, low)**
5. - [x] **Sweep orphaned files.** A file stays with no row if the server stops between writing the file and its row (`server/src/routes/tasks.js:122-138`), or when an unlink fails after a delete. `sweepOrphans()` in `server/src/files.js`, called in `server/src/index.js` before `listen`: remove every file in `UPLOAD_DIR` whose name is not the id of a Proof row with a file, and log only the count. Test it on a temporary folder. **(S, audit, low)**
6. - [x] **Let a family be paused: the operator script.** A moderator can only answer (A10), and `asReport` drops the sender, so an adult a child reports keeps the account and the child's photos.
   - `pausedAt DateTime?` on `User`.
   - `npm run pause-family` runs `server/scripts/pause-family.js`. It reads `REPORT_ID` and `ACTION=pause|unpause` from the environment, never from argv, finds the family of the report's sender, sets or clears `pausedAt` on the parent and every child, raises their `tokenVersion`, and prints only "paused" or "unpaused".
   - `who` treats a paused user, or a user whose parent is paused, as signed out. Sign-in answers `PAUSED`: "This family's account is paused while a report is looked at."
   - Rows and files stay as evidence until a person decides.
   - A10, rule 15 and the moderator part of Privacy change. **(S, audit, high)**
7. - [x] **Screening that works, and covers every note.** The list itself waits for Phase 8.
   - Export `matchesWord(word, text)`: NFKC, lower case, `’` to `'`, the word escaped, and `(?<![\p{L}\p{M}\p{N}])…(?![\p{L}\p{M}\p{N}])` with the `u` flag. That works for Hindi, where `\b` does not. `screen()` uses it (`server/src/rules.js:20`).
   - Screen the cheer line and the send-back note (`server/src/routes/tasks.js:183-197`) and the decline note (`routes/family.js:144`). They skip the check today, so "don't tell" can reach a child there.
   - Tests: a word holding regex characters; a Devanagari word at a word edge and inside another word. **(S to M, todo #20, audit)**
8. - [x] **Record consent.** `consentAt DateTime?` and `consentVersion String?` on `User`. Sign-up requires `consent: true` (`INVALID`, `consent: 'required'`) and stamps both on the parent; adding a child requires the parent's tick and stamps both on the child. Sign up and the child form get a required checkbox. Privacy gets an "Updated" line with the date. One migration for items 6 and 8. India's DPDP Rules ask for verifiable parental consent from about May 2027; this records consent and does not verify it, and Privacy says so plainly. **(S, audit, medium)**
9. - [x] **A quiet security log.** One line, with no name, email, username or address, when a limiter trips, a paused account tries to sign in, or a moderator signs in: the event and the route only. It is how misuse gets noticed. A test checks the line holds no identifier. **(S, new, low)**
10. - [x] **Tests** for everything above.

Acceptance:
- a PDF upload is refused, and a stored one downloads
- the stripped fixtures carry no `tIME`, no track metadata and no times
- a paused child cannot sign in, and unpausing restores it
- a cheer line with a blocked word is refused
- sign-up without consent is refused

### Phase 4. Speed

Do the server changes first; the client changes read from them.

1. - [x] **One call for Today.** Today asks for the tasks, the growth and the stickers at once (`client/src/pages/Today.jsx:153`), and the server loads the child's whole history for each (`server/src/db.js:18`). `GET /api/today` answers `{ tasks, growth, stickers }` from one snapshot. Today uses it; the three routes stay for the pages that need one of them. **(S to M, new)**
2. - [x] **Stop sending the whole history on every poll.** `GET /api/tasks` returns every task the family ever had, with every proof (`server/src/routes/tasks.js:29-32`). By default, return the window in section 3. `GET /api/tasks/history?offset=&limit=` returns approved tasks, newest due first, 50 at most. Scoring still reads everything. Test: a family with 1,000 approved tasks gets a default list without them. **(M, audit)**
3. - [x] **One counts route.** The parent's shell asks two count routes on every page change, every focus and every minute (`client/src/components/Shells.jsx:67-86,153-158`). `GET /api/counts` answers `{ proofs, requests }` for a parent and `{ results }` for a child. The shell makes one call. Delete the three old count routes, their API functions and their tests. **(S, audit)**
4. - [x] **Indexes for the queries that run most:** `Task(childId, status)`, `RewardRequest(parentId, status)` and `Report(resolvedAt, sentAt)`, in one migration, checked with `EXPLAIN` on the demo data. **(S, audit)**
5. - [x] **Split the bundle by route.** Routes use React Router's `lazy` (`client/src/router.jsx`). When a chunk fails to load, reload the page once; the once-only flag is kept by a function in `client/src/api/`, since only that folder may touch storage, and `Crashed` (`client/src/components/Guards.jsx:52-58`) uses it. `client/scripts/size-check.js` fails when any file in `dist/assets` is over the budget; `npm run check:size`; add it to `verify`. **(S, todo #13)**
6. - [x] **Keep a page on screen while it refreshes.** `useLoad` starts every visit from a skeleton, and `reload()` blanks the page (`client/src/hooks/useLoad.js:36`), so Try again and a stale answer lose the scroll and the focus.
   - Keep the last answer for each loader and its inputs in a module-level cache, show it, and refresh quietly.
   - **Empty that cache whenever the signed-in user changes:** sign-in, sign-out, expiry, delete. Otherwise a child sees the parent's last pages on the shared device. Test it.
   - Refresh on focus at most every 15 seconds.
   - Tasks becomes live, like Overview (`client/src/pages/Tasks.jsx:32`). **(M, audit)**
7. - [x] **Say when a refresh fails.** A quiet refresh that fails keeps the old data without a word (`useLoad.js:32`), so a parent can act on a stale list. After two failures in a row, show "Could not refresh. Showing what was here at 10:42." **(S, audit)**
8. - [x] **Lists that end.** Tasks, Growth's history and the moderator's Reports show 50 at a time with "Show more" (`Tasks.jsx:186`, `Growth.jsx:105`, `Reports.jsx:187`). Report a problem downloads every task to find one (`Report.jsx:107`); make it call `getTask`. **(M, audit)**
9. - [x] **Lighter proof media.** Photos get `loading="lazy"` and `decoding="async"`; videos get `preload="metadata"` (`client/src/components/Proof.jsx:31,33`). Earlier attempts load only when opened (`Review.jsx:79`). **(S, audit)**
10. - [x] **Smaller photos, sent faster.** Before a photo is sent (`ChildTask.jsx:82`), resize it with `createImageBitmap(file, { imageOrientation: 'from-image' })`, a canvas and `toBlob`, to the values in section 3. Videos go as they are. The server's stripping stays the guarantee. **(M, audit)**
11. - [x] **Cancel an upload.** `sendProof` takes `{ signal }`. ChildTask shows Cancel, and stops the upload when the child leaves the page (`ChildTask.jsx:94`). **(S, audit)**
12. - [x] **Put answers in place.** Rewards and the parent's Rewards wait for the answer and then fetch everything again (`ParentRewards.jsx:33-57`, `Rewards.jsx:30-42`). Put the returned item in the list, as Today does (`Today.jsx:191-196`). **(S, audit)**
13. - [x] **Days in the family's zone.** Some client day sums use the device's zone while the server uses the family's: the streak reminder, the rest-day limits, `whenText`, `inThisWeek`, the due-time field and `dayIn` (`utils/format.js:11-17,31`, `utils/tasks.js:35-41`, `TaskForm.jsx:93`, `Progress.jsx:74-78`). `GET /api/session` adds `zone` (a child's comes from the parent), and one helper in `format.js` uses it. Move the streak-reminder rule (rule 24) out of `Today.jsx:56` into `utils/` with a check. **(M, review, audit)**
14. - [x] **Day marks a day early west of UTC.** `new Date('YYYY-MM-DD')` reads the day as midnight UTC and shows it in the device's zone (`Streak.jsx:23-25`, `Progress.jsx:191-198`), so a family in the Americas sees Monday's mark under Sunday. Add `dateOfKey()` to `format.js`; `Progress.jsx:123` already does it right. **(S, audit)**
15. - [x] **Requests that cannot hang or misroute.** `encodeURIComponent` on every id in `client/src/api/index.js` (`:257` and the calls like it). A 20-second axios timeout, with none on `sendProof`. **(S, review)**

Built on 15 November 2026 in two parts. Item 5's budget changed with your decision: React DOM, one library file that cannot be split (218 kB), is capped at 230 kB instead of 200 kB.

Acceptance: the size check passes; the 1,000-task test passes; the screen check shows no skeleton flash on refresh; after sign-out and a different sign-in, no page shows the earlier user's data.

### Phase 5. Parents take it seriously

Children copy their parents. If setting and reviewing tasks is quick, the parent keeps doing it, and the child keeps getting answers.

**Ask first:** the contact address for Landing, and whether Landing names the four team members and the guide.

1. - [x] **One form hook and one confirm dialog,** extracted now because this phase builds new forms. The same tried, errors, busy and first-invalid-field code repeats in about ten forms, and the confirm dialog with its focus restore in about eight places (`ChildForm.jsx`, `TaskForm.jsx`, `SignUp.jsx`, `Settings.jsx`, `ParentRewards.jsx`). Extract `useForm` and `ConfirmDialog`, move the forms this phase touches onto them, and leave the rest for Phase 7. **(M, audit)**
2. - [x] **Repeating tasks** (rule 9 is replaced). Parents stop retyping chores.
   - **Model:** `TaskSeries` with `id`, `childId` (cascade), `category`, `title`, `instructions`, `points`, `weekdays` (a 7-bit integer, Monday = 1), `dueTime` (`HH:MM`), `active` and `createdAt`. `Task` gets `seriesId String?` (set to null when its series is deleted) and `seriesDay String?`, with `@@unique([seriesId, seriesDay])`.
   - **Making the day's task:** `makeDueTasks(tx, childId, zone, time)` runs under `lockChild` at the start of the task list routes, for each child the caller can see. It makes today's task only if today is one of the series' weekdays and the task does not exist yet. It never backfills a missed day, so a day nobody opened costs no streak. Record that as an assumption.
   - **Due time:** today at `dueTime` in the family's zone, through one helper in `server/src/scoring.js`.
   - **Routes:** `GET`, `POST`, `PUT` and `DELETE /api/series`, parent only, own children only, text screened, capped per section 3.
   - **Edits and stopping:** a change touches later days only. Stopping a series keeps the tasks it made.
   - **Client:** TaskForm gets "Repeat: Never, Every day, Chosen days" with weekday choices and a time. Tasks shows "Repeats Mon, Wed". TaskDetail offers "Stop repeating".
   - Test: a series makes exactly one task a day under concurrent loads. **(M, todo #26)**
3. - [x] **Duplicate task.** On the parent's TaskDetail, "Duplicate" opens TaskForm filled in through navigation state, with the due time empty. Client only. **(S, todo #12)**
4. - [x] **"What done looks like"** on each task. `doneLooksLike String @default("")` on `Task` and `TaskSeries`, up to 200 characters, screened. Shown above the child's proof form and on the parent's review. Fewer proofs get sent back when the child knows what is being asked. **(S)**
5. - [x] **A library of task ideas.** `client/src/utils/ideas.js`: 60 ideas, 10 per category, each marked for ages 8 to 10 or 11 to 14, each with `id`, `category`, `ages`, `title`, `instructions`, `doneLooksLike` and `points`. Every text passes `screen()`. TaskForm's "Pick an idea" fills the form. Nothing is stored. **(M, todo #25)**
6. - [x] **A faster task form.** The due field starts empty (`TaskForm.jsx:184`). Chips for "Today 6 pm", "Tomorrow 6 pm" and "Saturday 10 am"; a chip in the past is disabled. The category and points start from the parent's most recently created task, read from the list. No storage. **(S, audit)**
7. - [x] **Review the next proof without going back.** Approve and Send back return to Overview (`TaskDetail.jsx:47`), so five waiting proofs cost five trips. After an answer, go to the oldest other proof waiting, in Overview's order, carrying the result message; with none left, go to Overview. The task page offers "Back to overview". **(S, audit)**
8. - [x] **Show how long proof has waited.** Overview shows "Waiting since" plus `whenText(sentAt)` on each proof. **(S, audit)**
9. - [x] **Quick send-back reasons.** Sending back needs a typed note (rule 10). Three chips fill the note and stay editable: "The photo is blurry", "Part of it is missing", "Nearly there, try once more". **(S, audit)**
10. - [x] **Say when a quest cannot be reached.** The quest form takes a target above the tasks the child has this week (`ParentRewards.jsx:354-379`). Show "Diya has 3 tasks due this week" beside it. **(S, audit)**
11. - [x] **A first-run checklist on Overview.** Three steps, each ticked from data the page already has: add a child, set a first task, add a first reward. It goes away when all three are done. No storage. **(S, new)**
12. - [x] **A weekly summary for parents.** A card on Overview from Monday to Wednesday: for each child, last week's approved tasks out of tasks due, and the streak. **(M)**
13. - [x] **A reminder when a reward request has waited too long.** A request older than two days goes to the top of Overview with its age. **(S)**
14. - [x] **A nudge that uses no outside service.** The count of things waiting goes into the tab's title: "(2) Overview – GrowKid". A switch in Settings, "Tell me on this computer when something is waiting", asks for notification permission on that tap only; after that, when a refresh finds the count has gone up while the tab is hidden, the page raises a notification that says "Something is waiting in GrowKid" and nothing more. No service worker and no push service. Rule 7 and sitemap §14 change first. **(S to M, replaces todo #30)**
15. - [x] **Landing: who built it, and a contact address,** as the user answered. DESIGN.md §18's footer note changes. **(S)**
16. - [x] **A phone on the same Wi-Fi can open the app.** `npm run dev:lan` in `client/` runs Vite with `--host`; the server stays on `127.0.0.1` behind the proxy. `README.md` says to use it only on a network you trust and only for as long as the demo lasts. It is how the real-device checks in Phase 7 are done. **(S, new)**

Acceptance: the series test passes; every changed screen passes the screen check and the `web-design-guidelines` audit; a notification holds no name.

### Phase 6. Children want to come back

A child calls something a chore when it is handed to them, looks the same every day, and leaves nothing behind. Each item gives the child one of three things instead: a choice, something that is theirs, or growth they can see. Nothing here is left to chance, counts down, or rewards opening the app.

**Ask first:** the five Phase 6 decisions in section 3, in one question. Build only what is approved.

The phase may be split after item 7. Items 1 to 7 need no decision.

1. - [ ] **Sticker progress on the chart itself.** "7 of 10" shows only after a tap (`client/src/pages/Stickers.jsx:28`). Show "have of need" under each sticker not yet earned. The server adds `missing` (the category names) to the "All six kinds" entry of `stickerList`. **(S, audit)**
2. - [ ] **Hear back about a reward.** After asking, the child reads "A parent will answer soon" (`Rewards.jsx:34`), and the answer shows only if they open Rewards again. `RewardRequest.answerSeen Boolean @default(true)`, set false when the request is answered. `POST /api/requests/seen` takes ids, own requests only. `GET /api/counts` gives a child `answers` too, and the badge adds them. Today's reward moment shows them after stickers and quests (rule 13). **(S, audit)**
3. - [ ] **A savings goal.** `User.goalRewardId String?` on the child; `PUT /api/goal` takes `{ rewardId | null }`. Today shows the goal as a short ruler with the points still to go. A deleted reward clears it. **(S to M)**
4. - [ ] **A weekly chart for the child, with their best week** (DESIGN.md §11 changes). `growthForChild` adds `weeks`, worked out from the tasks as shown so rule 13 holds, and `bestWeek`, the most tasks approved in any week. Growth reuses Progress's weeks component and says "Your best week: 7 tasks". The child is compared with nobody but themselves. **(S, audit)**
5. - [ ] **My proofs.** Growth lists approved tasks as text (`Growth.jsx:35-39,105`). `GET /api/proofs/mine?offset=&limit=24`, child only, returns approved proofs that still have a file, with `fileUrl`, the task title and the cheer. Growth shows them as a gallery with `loading="lazy"`. They are the child's own work and files they can already open. **(M, audit)**
6. - [ ] **Ask for a task.** A child cannot suggest anything today. `Suggestion` holds `id`, `childId` (cascade), `ideaId` (matching `^[a-z0-9-]{1,40}$`), `status` and `createdAt`; at most 3 open per child. The child picks from the Phase 5 ideas on Today's empty state (`Today.jsx:242`) and on Rewards. Overview shows the parent "<name> suggested <idea title>" with "Make it a task" (TaskForm filled in) or "Not now". An unknown `ideaId` shows as "an idea from the list". A fixed list means no free text to screen. **(M, audit)**
7. - [ ] **A family agreement.** `User.agreedAt DateTime?` on the child. Today shows "Our agreement": the child's repeating series and the family's rewards, with "I agree" (`POST /api/agree`). The child's page shows the parent "Agreed on …" and "Ask again", which clears it. No free text. **(M)**
8. - [ ] **Six new stickers, one per kind of task** (if approved; rule 3 and DESIGN.md §10 change first). Each is earned when 10 tasks of that kind are approved, a star in the kind's own icon. `recordFor` counts by category. The chart goes from 14 to 20, and so does every "14" in the copy, Landing included. A child who already has 10 gets the sticker with their next approval. **(S to M, new)**
9. - [ ] **A plant that grows, and named levels** (if approved; DESIGN.md §9 and §10 change first). GrowKid's mark is a sprout, so the child's level becomes one: ten stages from a seed to a tree, each with a name, drawn as one SVG component from the tokens with the stage as a prop. Past level 10 it keeps the last stage and counts rings. It is on Growth, large, and it grows one stage inside the reward moment when a level is passed. It is worked out from the level, so nothing new is stored. It has no face, no name and no voice: it is not a mascot (DESIGN.md §13). **(M, new)**
10. - [ ] **A badge the child picks** (if approved). One of four token colours and one sticker they have earned and seen. `User.avatar String?`, checked against the fixed lists; `PUT /api/me/avatar`, child only. It shows in the child's shell, on the parent's Overview and Family, and on the leaderboard. **(S to M, new)**
11. - [ ] **Sound and a short vibration on the reward moment** (if approved; DESIGN.md §10 changes first). Three short tones made with the Web Audio API, with no audio file and no dependency: the ruler rising, a level, a sticker landing. `navigator.vibrate` where the device has it. `User.sound Boolean @default(true)` with a mute switch in the child's menu. Never with reduced motion on, never outside the reward moment, and silent when the browser has not yet allowed sound. **(S)**
12. - [ ] **Say thanks** (if approved). On an approved task that came with a cheer, the child can answer with one of three fixed replies. `Proof.thanks` is an enum; the parent sees it on the task and on Overview. It makes the cheer a conversation without giving a child a text box. **(S to M, new)**
13. - [ ] **A reward moment worth watching.** With `impeccable` for direction and inside DESIGN.md's motion rules (transform and opacity, no overshoot, once, nothing with reduced motion): a passed level gets its own beat, each new sticker ends with a link to its place in the chart, and the moment reads well at 360 px. Change DESIGN.md §10 and §18 first if the sequence changes. **(M, new)**
14. - [ ] **A prompt for a weekly family check-in.** A card on Progress from Friday to Sunday, with three questions from a fixed list. No storage. **(S)**
15. - [ ] **A chart for the fridge.** On Progress, "Print a fridge chart" renders a print-only section, this week's tasks with boxes to tick and the earned stickers, and calls `print()`. No new route. **(S, audit)**

Acceptance:
- no new route takes free text from a child (grep the new routes)
- every new table is in `erase()` and on Privacy
- every award still arrives through the reward moment on Today, and none of DESIGN.md §13 is broken
- every changed screen passes the screen check and the audit

### Phase 7. Polish and accessibility

The app is already clean. This phase removes the places where it drops what a person typed, loses their place, or shuts someone out.

**Forms and messages**
1. - [ ] **Do not lose typed work.** Cancel, Back or a link drops a typed task, a note, a chosen file or a report without asking (`TaskForm.jsx:124`, `ChildTask.jsx:47-69`, `ParentRewards.jsx:291`, `Report.jsx:169`). While a form has changes, ask first, with React Router's `useBlocker` and `beforeunload`. **(M, audit)**
2. - [ ] **Check reward and quest forms before sending.** They send `Number('')` and repeat the server's limits as fixed text (`ParentRewards.jsx:206,214-215,359-370`). Add their rules to `utils/rules.js`, as the task form has. **(S, audit)**
3. - [ ] **A new child's password: a Copy button, and no copy left behind.** Add Copy where the password is shown once (`Family.jsx:29`, `ChildForm.jsx:187`). Pass it in memory, not in the browser's history state (`ChildForm.jsx:45`), where it survives a reload. **(S, audit)**
4. - [ ] **Deleting the family on a broken connection** says "Nothing was deleted", although it may have been. Say what is known. **(S, review)**
5. - [ ] **The "Due soon" state,** by the rule in section 3. It is the one task state DESIGN.md §18 lists as not built. **(S, new)**

**Accessibility**
6. - [ ] **Focus goes somewhere useful.**
   - Focus stays on Save after Settings saves, and in the older forms.
   - "Try again" in ErrorState, Report and Proof moves focus to what it loaded.
   - Resolving a report focuses the confirmation, not `<main>`.
   - A success message that arrives with a page change gets focus or `role="status"` (`Tasks.jsx:75-84`, `Overview.jsx:44-53`, `TaskDetail.jsx:239-243`, `Family.jsx:45`, `ChildForm.jsx:152`).
   - After a child's password is reset, focus moves to the new password (`ChildForm.jsx:183-190`).
   - "Clear the filters" (`Tasks.jsx:152`) and "See your reports" (`Report.jsx:152`) move focus to what they show. **(S to M, review, audit)**
7. - [ ] **Busy buttons keep focus.** Sixteen buttons use `disabled={busy}`, which drops focus to the page and leaves it lost after a failure. One `SubmitButton` with `aria-disabled`, as Sign out already does (`Shells.jsx:101-104`). **(S to M, audit)**
8. - [ ] **Targets reach 44 px:** "Try again" (`min-h-0` today) and the Show and Hide password button, about 40 px (`Field.jsx:55`). **(S, review, audit)**
9. - [ ] **Day marks not by colour alone.** A counted and a missed day differ mostly by fill, and the legend is hidden from screen readers (`index.css:905-913`, `Progress.jsx:204-219`). Put a tick and a dash inside the marks, as DESIGN.md §18 rule 6 asks. **(S, audit)**
10. - [ ] **Reports reads properly aloud.** The line about a deleted account is one run-on sentence, and every report repeats the heading "The task it was sent from" (`Reports.jsx:23`); make it a level-3 heading under each report's own. **(S, review, audit)**
11. - [ ] **`lang="en-IN"` and a `<noscript>` line** in `client/index.html`. **(S, audit)**
12. - [ ] **The WCAG 2.2 AA pass,** with `design:accessibility-review`, over every route:
    - clear whatever Phase 1's axe run listed as known
    - reflow at 320 px, and at 200% zoom
    - forced colours (Windows high contrast) and reduced motion
    - every new control from Phases 5 and 6 by keyboard alone
    - then hand the user an exact checklist for NVDA on this machine, and for TalkBack or VoiceOver over `npm run dev:lan`. Those are theirs to do. **(M, todo #17 to #19)**

**The whole product, looked at once**
13. - [ ] **A design pass over every screen.** `impeccable` critique first, at 360 px and 1280 px, as a parent, a child and a moderator, giving a ranked list of findings. Fix the high and medium ones with `frontend-design`, inside DESIGN.md. Then `design:design-critique` on the three screens people see most: Today, Overview and the parent's task page. A new token or component goes into DESIGN.md first. **(M to L, new)**
14. - [ ] **A copy pass,** with `design:ux-copy`: every empty state, error, button and confirmation, in the child's shell and the parent's. Short sentences on child screens, no guilt, the next step always named. **(S to M, new)**
15. - [ ] **A `web-design-guidelines` audit** of the whole client, fixed until no high finding is open. **(S to M)**

**Code health**
16. - [ ] **Split the two longest pages:** ParentRewards into its requests, rewards and quest parts; Progress into weeks, rest days, calendar and stickers, reusing `Streak.jsx`'s day marks. **(S, audit)**
17. - [ ] **Small shared helpers:** one `LOCALE` with shared date and number formatters (16 places repeat them); `plural()` on `Intl.PluralRules`; store actions instead of `useSession.setState` in pages (`Settings.jsx:30`, `Landing.jsx:303`); one `useMedia` hook (`Stickers.jsx:57`, `ChildTask.jsx:58`); Landing's sticker count from one constant (`Landing.jsx:21-29,45,200`); the remaining forms onto `useForm` and `ConfirmDialog`. **(S to M, audit)**

Acceptance: the loop test runs axe with no known-issue list left; the whole loop works by keyboard; no high finding is open from the critique or either audit; DESIGN.md matches the code.

### Phase 8. Trust and data

**Ask first:** the source for the real screening word list. With none, skip item 8 and say so.

1. - [ ] **A second step for the moderator.** The moderator reads every family's report text behind a password only. TOTP per RFC 6238 on `node:crypto`: SHA-1, 30-second steps, 6 digits, one step either side allowed, and the last used step stored so a code cannot be replayed. The secret is 20 random bytes in base32, in `User.totpSecret`. `MODERATOR_TOTP=new npm run moderator` prints the `otpauth://` link once, to the operator's terminal only. A moderator signing in without a code gets `NEEDS_CODE`, and Sign in then shows a code field. **(M, audit, medium)**
2. - [ ] **Let a family be paused: the button.** `POST /api/reports/:id/pause` and `/unpause`, moderator only, using Phase 3's logic and answering `NOT_FOUND` when the sender is gone. Reports shows "Pause this family" with a confirm step, and a "paused" tag. Still no names. **(M, audit, high)**
3. - [ ] **A record of what the moderator did, and a list that cannot hide a report.** `ModeratorAction` holds `id`, `moderatorId`, `action` (`answer`, `pause` or `unpause`), `reportId` and `at`, and has no update or delete path in code. The list stops at the oldest 200 today (`server/src/routes/reports.js:45`), so a flood from one family could hide another child's report: show the total waiting, and page through 200 at a time. **(M, todo #42, #46, audit)**
4. - [ ] **Delete proof files after a while.** `User.keepProofDays Int @default(90)` on the parent, chosen from 30, 90 or 365 in Settings. `Proof.removedAt DateTime?`. `removeOldProofFiles()` runs in `server/src/index.js` at start-up and every 24 hours (`setInterval`, `unref`): it deletes each file once its task's approval is older than the family's setting, sets `removedAt`, and logs the count. The pages say "Photo removed after N days", and My proofs shows the ones kept. Privacy changes. **(M, audit, medium)**
5. - [ ] **Parent password reset, by recovery code.** Today a parent who forgets their password is locked out.
   - At sign-up, and from Settings behind the password, make a code: 16 base32 characters from `crypto.randomBytes`, shown once as four groups. Its bcrypt hash goes in `User.recoveryHash`.
   - A new `/forgot` route and page take the email, the code and a new password. The answer is the same for a wrong email and a wrong code, and the route uses the sign-in limits.
   - On success: set the password, raise `tokenVersion`, clear the code, and tell the parent to make a new one. A paused family is refused.
   - Settings nudges a parent who has no code.
   - Sitemap §3 and §14 change first. The email stays unverified, and Privacy says so. **(M, todo #29)**
6. - [ ] **Let parents download all their family's data.** `POST /api/me/export` takes the password and uses `passwordLimit`. It streams a `.zip` of stored, uncompressed entries, written by hand with `zlib.crc32` and no new dependency: `family.json` in the API's shapes, and `proofs/<id>.<ext>` for each kept file, one file read at a time. The quota keeps it under the zip64 limit. The client downloads through a function in `client/src/api/`. **(M, todo #31)**
7. - [ ] **The GPS route in video tracks.** Some action cameras record their route in a separate track, which today is stored. In MP4 and MOV, find each `trak` whose `hdlr` handler is `meta`, `text` or `gpmd`; zero its sample bytes in `mdat` from `stsz`, `stsc` and `stco` or `co64`; then blank the `trak` and rename it `free`. Use a fixture with a timed-metadata track. Privacy changes. **(M, low)**
8. - [ ] **The real screening word list,** only from the source the user gave. **(S to M, todo #20)**

Acceptance:
- a moderator cannot sign in without a valid code, and a replayed code fails
- an old file is deleted and shown as removed
- recovery works once and the code then dies
- the export opens in Windows Explorer and holds `family.json`
- the GPS fixture comes out without its track data

### Phase 9. Attack it, measure it

Build nothing new here. Find what the earlier phases missed, and put numbers on what they changed.

1. - [ ] **Every route, tried from the wrong family.** In `server/test/security.test.js`, build the route list from the routers themselves, so a new route cannot be forgotten. Over that list, check that a second family's ids answer `NOT_FOUND` on every route, that a moderator is refused on every family route, and that a signed-out caller is refused everywhere but the public ones. **(S, review, audit)**
2. - [ ] **The attack pass.** Go down the table in section 2 and try each attack against the test server on `127.0.0.1`. Each one that works is fixed and gets a test; each one that fails gets a test too, so it stays failed. Cover at least:
   - **Tokens:** an unsigned token, the wrong algorithm, an expired one, an old `tokenVersion`, another user's id.
   - **Requests:** a write with no `X-GrowKid` header, with a form content type, with `__proto__` and `constructor` in the JSON, with a NUL and a lone surrogate in every text field, with a body over the size limit.
   - **Role and field:** a child calling each parent route; `role`, `status`, `tokenVersion`, `pausedAt` and `parentId` sent in a body.
   - **Races:** two approvals at once, two reward requests at once at the edge of the balance, uploads at once at the edge of the quota, a proof sent while the family is being deleted.
   - **Files:** a file that claims one type and is another, a PNG of thousands of tiny chunks, an MP4 whose boxes run past their parent or have a zero size, a JPEG with a second picture after the first, a path in the proof id.
   - **Guessing and naming:** what sign-in, sign-up, add-a-child and `/forgot` reveal about which accounts exist, and how long each takes.
   - **Slow callers:** a request that never finishes its headers or its body. Set `server.headersTimeout` and `requestTimeout` if Node's defaults leave a slot held for minutes.
   - Write what stays accepted, and why, into this file under the threat table: for example, that sign-up says an email is taken, because without email nothing else can. **(M, new)**
3. - [ ] **`/deep-review` over the whole repository.** Fix the high findings now; list the rest under the item they belong to. **(S to M, audit)**
4. - [ ] **`ponytail:ponytail-audit` over the whole repository,** and `ponytail:ponytail-debt` for the shortcut ledger. Delete what the audit shows is not needed. **(S)**
5. - [ ] **Measure.** Lighthouse on the built app for Landing, Sign in, Today and Overview; the bundle sizes; the test counts; the approval time at 2,000 tasks; the upload size of a 12 MB photo. Put each beside its Phase 1 value in section 1. Phase 10 reports the pairs. **(S)**

Acceptance: `npm run verify` passes; no high finding is open from the attack pass, `/security-review` or `/deep-review`; section 1 holds a before and an after for every measure in section 2.

### Phase 10. The university documents

Bring the three documents up to what the repository is on the day this phase runs. It may be run more than once.

- `Documentation/GrowKid-Project-Report.docx`
- `Documentation/Presentation/GrowKid-Final-Presentation.pptx` (19 slides; leave the October deck beside it alone)
- `Documentation/GrowKid-Project-Tracker.xlsx`

**Ask first:** the submission date; any feedback from the guide; the meetings held since 14 November, with dates and what was agreed; who did which task. Never invent a meeting, a date or an owner. If the user gives none, the tracker's new rows show the work and its dates from `git log`, and the meeting log is left as it is.

1. - [ ] **A facts sheet, from commands.** In the scratchpad, work out every number the documents state, from the repository and not from memory: tests and their count by file, routes, models and enums, pages and routes, stickers, bundle sizes, the before-and-after measures in section 1, audit totals, and the commit dates. Every number in all three documents comes from this sheet. **(S)**
2. - [ ] **Bring the repo's own documents up to date first:** `README.md`, DESIGN.md §18, the sitemap's page and route counts, and the date on the Safety and privacy page. **(S)**
3. - [ ] **Figures.** Take new screenshots, with the Playwright MCP from the demo family at 360 px and 1280 px, of every screen that changed, into `Documentation/figures/` under the next numbers. Redraw the architecture diagram without the Caddy box and the data-model diagram with the new models, with `archify`. **(M)**
4. - [ ] **A test strategy for chapter 7,** written with `qa-test-strategy`: what is tested at which level, and the test-case table, from the tests that exist. It goes into the report, not into a new file. **(S)**
5. - [ ] **The report,** edited in place with `anthropic-skills:docx`. Keep the university's format (`Documentation/Formats/Annexure 6_Project report format - guidelines_SKP.docx`), the built-in styles, the eight chapters and their numbering, the team's names and roll numbers. Update at least: 1.5 scope; 4.2 timeline, 4.3 status and 4.4 risks; 5.4 to 5.7 requirements, architecture and data model; chapter 6, with new parts for security hardening, speed with its before-and-after table, and what was added for children and parents; 6.9 deviations (no hosting, PDF dropped, recovery code in place of email); chapter 7 with the new counts, the loop test, the axe run and the attack pass; 8.2 limitations and 8.3 future work, from section 7 of this file. **(M)**
6. - [ ] **The presentation,** with `anthropic-skills:pptx`, in the university's format (`Documentation/Formats/Final_Project_Presentation_format.pptx`). Update at least: the results slide's numbers, the architecture slide (it still mentions the Caddy box), the data-model slide, the three implementation slides, and the conclusion. Keep speaker notes on every slide, and put a five-minute demo path into them: the demo family, one task from set to reward. **(M)**
7. - [ ] **The tracker,** with `anthropic-skills:xlsx`. Add each phase as its tasks with real start and end dates, status and owner, through the last day of work, so the sheet runs to the end. Keep the formulas, the validations, the print setup and the layout. Never copy from the sample workbook: it holds another team's personal data. Recalculate, and check the progress figure and the meeting count. **(M)**
8. - [ ] **Humanize.** Run the `humanizer` skill over every passage that is new or changed in the report, the slides, the speaker notes and the tracker's text, then `taste` on the report's abstract and conclusion. It changes how a sentence reads and never what it says: check every number against the facts sheet again afterwards. **(S to M)**
9. - [ ] **Check the files.**
   - No "Claude", "Anthropic" or any AI tool's name in any XML part or document property of the three files; the author is "Group SY2615".
   - Open each through Word, PowerPoint and Excel to confirm it opens with no repair prompt; export the report and the deck to PDF and look at every page for overflow, a broken figure or a stale number.
   - The report states nothing that is not true of the repository.
   - A first-week walkthrough: seven days as a child in the demo family with the development clock, noting what is new to do or see each day. It is the check on the engagement goal in section 2, and the demo path comes from it. **(S to M)**

Acceptance: every number in the three documents matches the facts sheet; each file opens cleanly; nothing in them names an AI tool; the tracker's last row is the last day of work.

## 7. Parked, and why

Not planned. Each waits for a reason that this project does not have. The list feeds the report's future-work chapter.

| Item | Waits for |
|---|---|
| Hosting, backups, firewall, a domain, HTTPS (old Phase B5) | A decision to host. Dropped on 14 November 2026. |
| Web push; offline support; the web app manifest and icons; `robots.txt`; share tags | A hosted, installable site |
| Email, with password reset by link and email verification | An email provider (D2) |
| A second parent or guardian; the family goal; a parent PIN on a shared device | Your decision; declined on 8 November |
| Prisma 7 | Your decision. It would clear the server's 3 advisories in the command-line tool. |
| Legal review under India's DPDP Act and its 2025 Rules, verifiable parental consent, whether streaks and leaderboards count as behavioural monitoring under section 9(3), a retention policy, a breach plan, abuse-image detection | Real families, and people beyond the code |
| A pilot with 3 to 5 families; usage numbers; Hindi and a regional language; load testing and a cost plan | Real families |
| Rate limits in PostgreSQL in place of memory | A second server process |
| Score reads that do not load a child's whole history (`server/src/db.js:16`) | Histories in the thousands; Phase 2's test says when |
| A rest day can raise the best streak without awarding its sticker until the next approval | Left as a known limit |
| A zone that changes its clock exactly at midnight can show a day mark an hour out (`server/src/scoring.js:93`) | Left as a known limit |

## 8. Built before this plan

Kept short; the detail is in git and in the four older plans in the repo root, which are history only.

- **Engagement layer (G1 to G4):** reward shop, weekly quest with a sealed surprise, parent cheers, growth path, rest days, child picks next, streak reminder, family leaderboard, 14 stickers. Sitemap rules 17 to 24.
- **Backend (B0 to B4):** Prisma schema and migrations; accounts and sessions (JWT in an httpOnly cookie, bcrypt, token-version revocation); tasks, proof and review with row locks; proof files on disk, typed from their bytes, location stripped, served only to the child and their parent; scoring in each family's time zone; rewards, quests, rest days, leaderboard and reports; demo seed and moderator script; rate limits on sign-in, sign-up, passwords and reports; 127 tests.
- **Integration (B4):** the client calls the real server; country at sign-up and in Settings; an honest Safety and privacy page; sign-out that reports a failure and works without the database.
- **Confirmed by the audit of 8 November, and to be kept as they are:**
  - Every route reaches a child, task, proof, reward, request, quest or rest day only through the signed-in user's own family; another family's ids answer `NOT_FOUND`.
  - Every write names its fields: role, status and `tokenVersion` never come from a request body.
  - Writes that can race take the child's row lock and are conditional on the state they checked.
  - Uploads are refused before they are parsed when the task is not the child's or not open; a JPEG ends at its first end-of-image marker; HEIC is refused; files are written once under a random id.
  - Sign-in takes the same time for an unknown account; a password over 72 bytes never matches.
  - Cross-site requests are stopped three ways: the `X-GrowKid` header, a `SameSite=Strict` cookie limited to `/api`, and no CORS.
  - The server refuses to start with a bad environment, listens on `127.0.0.1` only, and never logs a request body, file name, note or cookie.
  - Production builds keep nothing in browser storage, and no page renders HTML from data.
- **Dropped or replaced:** `vercel.json` (no hosting); client-side EXIF stripping (done on the server); the health route and clean shutdown (they served the deployment); the M6 document.
