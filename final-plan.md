# GrowKid: final plan

One list of everything done and everything left, checked against the code on 6 November 2026. It merges the four plans in the repo root and adds what we decided to work on next. It lists work only; the builder prompts come later, one phase at a time.

Tags show where each item came from: **todo #n** is `complete-todo-list.md`, **B5** is `final-backend-plan.md`, **review** is the B4 reviews of 6 November, **new** is the engagement discussion of 6 November. Sizes are rough: **S** is under half a day, **M** is up to two days, **L** is more.

## 1. Where things stand

- The React client and the Express server are built and run together. The in-browser stand-in (`fake.js`) is gone.
- Server: 127 tests pass. Client: lint, check and build pass. The data-boundary checks are clean.
- University documents M1 to M5 exist. M6 waits for deployment.
- B0 to B3 are committed (`7ace37e`, labelled "Phase B3-B4 Done" but holding B2 and B3). **B4 and everything since is uncommitted.**
- Deployment (B5) is the only planned phase left.

## 2. The four plans, reviewed

| Plan | What it is | Status | Keep? |
|---|---|---|---|
| `psychology-interactivity-plan.md` | Why the engagement layer exists, and its 9 features | All 9 features built (G1 to G4) | History only |
| `engagement-plan.md` | Build guide for G1 to G4 | Done. Its contract (§5) describes `fake.js`, which no longer exists | History only |
| `final-backend-plan.md` | Server, integration and deployment, B0 to B5 | B0 to B4 done; B5 open. Git-ignored | Keep until B5 is done |
| `complete-todo-list.md` | 52 items to a world-ready product, as of 28 October | 15 done, 2 obsolete, 35 open (section 4) | Replaced by this file |

## 3. Done

**Engagement layer (psychology and engagement plans):** the 9 features below, with sitemap rules 17 to 24 accepted.
- reward shop
- weekly quest with a sealed surprise
- parent cheers
- growth path
- rest days
- child picks next
- streak reminder
- family leaderboard
- 14 stickers

**Backend (B0 to B4):**
- Prisma schema and migrations.
- Accounts and sessions: JWT in an httpOnly cookie, bcrypt, token-version revocation.
- Tasks, proof and review, with row locks.
- Proof files on disk: type from the bytes, location stripped, served only to the child and their parent.
- Scoring in each family's time zone, from the country chosen at sign-up.
- Rewards, quests, rest days, leaderboard and reports.
- Demo seed and moderator script.
- Rate limits: sign-in, sign-up, password, reports.
- 127 tests.

**Integration (B4):**
- The client calls the real server.
- Country at sign-up and in Settings.
- An honest Safety and privacy page.
- Sign-out that reports a failure, and works without the database.
- Limits shown as field messages.
- Phase 2G's six fixes.

**Plan items closed:**
- **From `complete-todo-list.md`:**
  - todo #1: `server/.env.example`; the client needs none.
  - todo #7: Childline 1098, confirmed 10 Oct.
  - todo #8: README.
  - todo #11, #22, #23, #24: engagement G1 to G4.
  - todo #16: open rules settled, A7 and A10.
  - todo #27: time zone per family, done as country.
  - todo #28: client on the server.
  - todo #33: server tests, with `node:test`.
  - todo #38: backend core.
  - todo #39: authentication.
  - todo #40: the proof upload pipeline. Its bucket and signed links became an authenticated file route; thumbnails and compression were left out on purpose (A5).
  - todo #41: proof storage decided, on the VM's disk.
  - todo #20, part: reward titles are screened too.
  - todo #21, part: M1 to M5 documents.
- **From `final-backend-plan.md` §10:** the ponytail-debt ledger, and the memory files and work state brought up to date.

**Obsolete:**
- todo #2: `vercel.json`. Hosting moved to Oracle, so Caddy's `try_files` does this.
- todo #14: client-side EXIF stripping through a canvas. Replaced by server-side stripping (A6).

## 4. Still to do

### A. Deployment (B5, closes M6)

- [ ] **B5** as written in `final-backend-plan.md`. It starts by asking for the domain, confirming the VM and SSH, and asking who runs the commands. Its scope:
  - the `deploy/` files
  - the VM setup
  - the 7-day backup line on Privacy (A13)
  - the live checks, including a test restore of a backup (todo #37)
  - `/security-review` **(L)**
- [ ] Caddy must send a content security policy, HSTS and the other security headers for the **pages**: Helmet only covers `/api`. The plan doesn't say this yet. **(S, review)**
- [ ] The Caddyfile needs `handle` blocks, or every `/api` call returns the page. The plan already says so. **(in B5, review)**
- [ ] Self-host the fonts (`@fontsource`), then remove the Google Fonts sentence from Privacy. Children's devices stop contacting Google. **(S, todo #9)**
- [ ] Uptime check and alerts. Request logging is left out on purpose; Caddy logs access. **(S to M, todo #36)**
- [ ] Your decisions at B5:
  - upgrade to Pay As You Go to avoid Oracle reclaiming an idle VM
  - an off-VM copy of the backups
- [ ] After B5:
  - the M6 document
  - memory files `growkid-hosting-oracle` and `growkid-friend-backend-rejected` (plan §10)
  - PPT slide 9, when you ask

### B. Making families take it seriously (new)

Parents first, because children copy them:
- [ ] **Repeating tasks** (daily or chosen weekdays). Parents stop retyping chores. **(M, todo #26)**
- [ ] Duplicate task, if repeating tasks don't cover it. **(S, todo #12)**
- [ ] **A nudge to the parent when proof is waiting**, by web push or email. The message must carry no child's name or photo, because children's data never goes to an outside service. **(M to L, todo #30, #45; email reopens decision D2)**
- [ ] A weekly summary for parents, for example "Diya did 9 of 11 tasks, 4-day streak". **(M)**
- [ ] A reminder to the parent when a reward request has waited too long. **(S)**
- [ ] More than one parent or guardian per family, with invites. **(L, todo #43; changes decision D1)**
- [ ] Landing: who built it, and a contact address. **(S)**
- [ ] A library of task ideas by age and category. **(M, todo #25)**

Children:
- [ ] The child pins one reward as a savings goal on Today. Rewards already shows "N more points to go". **(S to M)**
- [ ] A family agreement when a child is added: parent and child choose the regular jobs and rewards, and the child taps "I agree". **(M)**
- [ ] "What done looks like" on each task. **(S)**
- [ ] A look that grows with the child's level or age, so older children don't find it babyish. **(M)**
- [ ] Something the child owns and grows: an avatar, pet or plant. **(M to L)**
- [ ] Optional sound and vibration on the reward moment, off when reduced motion is set. **(S)**

Outside the app:
- [ ] A prompt for a weekly family check-in on Progress. **(S)**
- [ ] Web app manifest and PNG icons, so GrowKid can sit on the home screen. **(S, todo #6)**

### C. Quality and testing

- [ ] CI (GitHub Actions): client lint, check and build; server lint and test against a PostgreSQL service. **(S to M, todo #15)**
- [ ] A Playwright test of the whole loop (assign, prove, approve, reward), run in CI. **(M, todo #34)**
- [ ] Split the bundle by route (`React.lazy`) and set a size budget. Today it is one 517 kB file. **(S, todo #13)**
- [ ] Some client day calculations use the device's time zone, but the server uses the family's (the streak reminder, the rest-day limits). Send the family's zone to the client. **(M, review)**
- [ ] Focus management:
  - focus stays on Save after Settings saves (older forms too)
  - "Try again" in ErrorState, Report and Proof moves focus somewhere useful
  - resolving a report focuses the confirmation, not `<main>` **(S, review)**
- [ ] "Try again" buttons reach the 44 px target (`min-h-0` today). **(S, review)**
- [ ] The rate-limit message says how long to wait, not "a while". **(S, review)**
- [ ] The Reports line about a deleted account reads as one run-on sentence to screen readers. **(S, review)**
- [ ] Deleting the family on a broken connection says "Nothing was deleted", although it may have been. **(S, review)**
- [ ] Encode route ids in API paths; add a request timeout that leaves uploads alone. **(S, review)**
- [ ] Move the streak-reminder rule (rule 24) into `utils/` with a check. **(S, review)**
- [ ] Build the moderator route list in `security.test.js` from the routers; check Landing's copied sticker names. **(S, review)**
- [ ] Known limit: a rest day can raise the best streak without awarding its sticker until the next approval. **(S)**
- [ ] Lighthouse, a real iPhone and Android test, and a screen-reader audit (NVDA, VoiceOver, TalkBack). **(M, todo #17 to #19)**
- [ ] Housekeeping:
  - delete the empty local folders `specs/`, `reviews/` and `.workflow-context/` (todo #3)
  - remove the unused `VITE_API_URL` from `client/.env`
  - add `robots.txt` blocking the private routes (todo #4)
  - add share tags and a share image (todo #5) **(S)**
- [ ] Note: the test database is never reset by an agent, so leftover rows grow. Reset it yourself now and then.

### D. Security and privacy

- [ ] `npm audit` (todo #10). The 7 advisories are now 4 high:
  - **Client:** `follow-redirects`, used by axios only under Node; `npm audit fix` clears it.
  - **Server:** 3 in the Prisma command-line tool's config loader, not in anything that handles requests; fixing needs Prisma 7, a major upgrade (decision S7). **(S, plus a decision)**
- [ ] The GPS route that some action cameras record in a separate video track isn't stripped; WebM is stored as sent. Privacy now says so. **(M)**
- [ ] Parent password reset and email verification. Today a parent who forgets their password is locked out. **(M to L, todo #29; needs an email provider)**
- [ ] Let parents download all their family's data. **(M, todo #31)**
- [ ] The real screening word list. Today it is the three-word sample (A8). **(S to M, todo #20)**
- [ ] Moderator tools and process, and an audit log of moderator actions. **(M, todo #42, #46)**
- [ ] Shortcuts to revisit when usage grows (ponytail ledger):
  - in-memory rate limits (one VM)
  - each score read loads the child's whole history
  - one shared dev clock
  - a midnight time-zone edge case (`scoring.js:93`)
- [ ] **Before real families sign up:**
  - legal review under India's DPDP Act and its 2025 Rules, including verifiable parental consent (todo #50)
  - whether streaks and leaderboards count as behavioural monitoring of children
  - a data-retention policy (todo #51)
  - a breach plan (todo #52)
  - abuse-image detection (todo #49) **(L, needs people beyond the code)**

### E. Reach and evidence

- [ ] A pilot with 3 to 5 families for two weeks, with consent through the university's ethics process. Measure:
  - the share of proofs reviewed within 24 hours
  - the share of earned rewards given
  - children returning in week two **(L, todo #48, new)**
- [ ] Privacy-respecting usage numbers, counted on the server. **(M, todo #32)**
- [ ] Hindi and at least one regional language. **(L, todo #44)**
- [ ] Offline support. **(M, todo #45)**
- [ ] Load testing and a cost plan. **(M, todo #47)**

## 5. Decisions that stand

- No chance-based rewards for children; a sealed surprise instead.
- Children's data (names, accounts, proof photos) never goes to an outside service. This decides how a nudge or email may be built.
- One origin on an Oracle VM: Caddy serves the client and proxies `/api`; no CORS.
- The PDF report is the browser's print of Progress.
- Recommended, not yet confirmed by you: no point deductions. Missed days already cost the streak.

## 6. Suggested order

1. **You:** commit B4 and the documents.
2. **Quick wins:**
   - repeating tasks
   - web app manifest
   - `npm audit fix` in the client
   - housekeeping, `robots.txt`, share tags
3. **B5:** deploy, with the page security headers in Caddy and self-hosted fonts. Then the M6 document.
4. **Seriousness set:**
   - proof-waiting nudge
   - savings goal
   - family agreement
   - weekly summary
   - "what done looks like"
5. **Quality:**
   - CI
   - Playwright loop test
   - send the family's time zone to the client
   - focus and accessibility fixes
6. **Before real families:** legal review, retention policy, breach plan, then the pilot.
