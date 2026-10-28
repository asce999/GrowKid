# GrowKid: complete to-do list for a world-ready product

Ranked from easiest to hardest. It includes everything in [psychology-interactivity-plan.md](psychology-interactivity-plan.md). The effort estimates are rough and assume one developer. Items 51 and 52 were added later: they sit in their tier but keep the next free numbers, so references to the other items stay valid.

## Where things stand (checked on 28 October 2026)

- **Client:** finished, and every page works. It runs on `client/src/api/fake.js`, a stand-in that keeps all data in the browser.
- **Server:** `server/src/` has empty folders and no files. `server/prisma/schema.prisma` has no models. `npm test` in `server/` is a placeholder that fails.
- **Dependencies:** `npm audit` in `server/` reports 7 advisories (5 high, 2 moderate) in `multer`, `body-parser`, `prisma`, `@prisma/config`, `deepmerge-ts`, `qs` and `ip-address`.
- **Unused so far:** `axios` is installed in the client but not imported anywhere. `server/.env` has Cloudinary keys, but no Cloudinary package is installed.
- **Missing infrastructure:** no CI (`.github/` doesn't exist), no `vercel.json`, no `.env.example`, no web app manifest, no `robots.txt`.
- **Empty folders:** `Architecture/`, `specs/`, `reviews/` and `.workflow-context/` are empty and exist only locally, not in git.
- **Already in place:** the camera opens with `capture="environment"` (`ChildTask.jsx`). Childline 1098 is shown on Privacy and on Report a problem. Privacy says the fonts come from Google Fonts. Progress has a printable report.
- **Not in place:** no metadata (EXIF or GPS) is stripped from photos, there's no Duplicate task action, and routes aren't code-split.

## Tier 1

| # | Task | Why it matters |
|---|---|---|
| 1 | Add `.env.example` files for client and server, with variable names only | New teammates and hosting setups can't guess the variables |
| 2 | Add a `vercel.json` rewrite to `index.html` | Without it, refreshing a deep link such as `/child/growth` on Vercel gives a 404 |
| 3 | Delete the empty local folders, or fill them | They suggest work that doesn't exist |
| 4 | Add `robots.txt` that blocks `/parent`, `/child`, `/admin` and `/report` | Keeps private pages out of search engines |
| 5 | Add Open Graph and Twitter meta tags and a share image to `client/index.html` | Links shared on WhatsApp currently show nothing |
| 6 | Add a web app manifest and PNG icons (192 px, 512 px, apple-touch) | Families can add GrowKid to a phone or tablet home screen |
| 7 | Confirm that Childline 1098 is still the right number to publish | The sitemap asks for this before release |
| 8 | Rewrite the README: setup, scripts, environment variables, demo accounts, architecture | Anyone new to the repo starts here |
| 9 | Self-host the fonts with `@fontsource`, then remove the Google Fonts sentence from `Privacy.jsx` | No third-party request for children's devices, and the app works offline |
| 10 | Triage the 7 `npm audit` advisories in `server/`, including `multer` (uploads) and `body-parser` (every request) | A known hole that ships if nobody looks |

## Tier 2: half a day to two days each

| # | Task | Why it matters |
|---|---|---|
| 11 | **Engagement plan G1:** update DESIGN.md and FRONTEND-SITEMAP.md | The repo rule is to change the documents before the code |
| 12 | Add a Duplicate task action | The cheap fix for repeated chores (sitemap rule 9) |
| 13 | Split code by route with `React.lazy` in `router.jsx`, and set a bundle-size budget | All 19 pages currently load up front, which is slow on cheap phones |
| 14 | Strip EXIF and GPS data from proof photos on the client, by re-encoding through a canvas before upload | **Phone photos carry the child's home location.** This is the most serious privacy gap |
| 15 | Set up GitHub Actions to run `npm run lint`, `npm run check` and `npm run build` on every push | Nothing stops a broken commit today |
| 16 | Settle the open rules: a missed day when an overdue task is deleted or moved (rule 3), and what moderators can do (rule 15) | The backend can't be built against open rules |
| 17 | Test the camera and uploads on a real iPhone (Safari) and a real Android phone (Chrome) | `capture` is in the code, but emulators misreport it and file types |
| 18 | Run Lighthouse and fix the findings | Measured performance and accessibility |
| 19 | Do a full WCAG 2.2 AA audit with NVDA, VoiceOver and TalkBack | So far the checks have been Playwright and keyboard only |
| 20 | Write the real content-screening word list; it also has to cover reward titles | The current list is a three-word sample |
| 21 | Write the university milestone Word document(s) | Required for every major milestone |

## Tier 3

| # | Task | Why it matters |
|---|---|---|
| 22 | **Engagement plan G2:** data and rules (balance, quests, rest days, pins, 14 stickers) | Everything in the plan sits on it |
| 23 | **Engagement plan G3:** child screens (quest bar, streak reminder, growth path, Rewards page, cheers) | What children actually see |
| 24 | **Engagement plan G4:** parent screens (Rewards page, cheer picker, leaderboard switch, rest days) | Parents run the shop and the quests |
| 25 | Build a library of task ideas by age and category | Parents also drop off when they run out of ideas |
| 26 | Add repeating tasks (daily or weekly) | The biggest pull for routines, and it changes sitemap rule 9 |
| 27 | Store a time zone per family | The streak rule counts days in the family's local time, and the server needs it |
| 28 | Connect the client to the server: swap `fake.js` for `axios` calls in `api/index.js`, map errors to `ApiError`, report upload progress, handle sessions that expire and slow first loads | The step that makes it a real product |
| 29 | Parent password reset and email verification, through an email provider | Excluded so far (sitemap D2), but a real service needs both |
| 30 | Emails to parents (proof waiting, reward requested, weekly digest), with an off switch | Parents who aren't nudged stop reviewing, and then children stop |
| 31 | Let parents download all of their family's data, not only the printed progress report | A legal right in most places |
| 32 | Privacy-respecting usage numbers, counted on the server: weekly active children, tasks per week, where children drop off | **The only way to know whether the engagement plan works.** No third-party trackers |
| 33 | Server tests (unit plus `supertest`), replacing the failing `npm test`, and the same rule checks run against the real API | Proves the server matches the rules the client was built on. `scoring.js` can be shared with the server as it is |
| 34 | A Playwright test of the whole loop (assign, prove, approve, reward), run in CI | Catches regressions across the whole loop |
| 35 | Deploy: Vercel for the client, Render or Railway for the server, managed Postgres and storage, a staging environment, a domain and HTTPS | Nothing runs anywhere today |
| 36 | Uptime checks, structured logs (`morgan` is already installed) and alerts; error tracking with personal data stripped out | You find out about failures before families do |
| 37 | Database backups and a test restore, with deletions honoured in the backups too (rule 16) | Data loss, or data you promised to delete still sitting in a backup |
| 51 | **Data retention policy.** Decide how long each kind of data is kept: proof files, tasks, the accounts of families who stop using GrowKid, reports, server logs and backups. Then build it: a scheduled job that deletes on time, a warning to the parent before an inactive account is removed, and the periods written on the Privacy page. Needs the backend (38) and backups (37); the legal wording goes through item 50 | Keeping children's photos forever is risk with no benefit. The DPDP Act requires deleting data once its purpose is served. Its 2025 Rules may also require keeping some logs for a set time, and the policy has to square that with rule 16's promise that "no copy is kept" |
| 52 | **Data breach plan.** Who is in charge, how a leak is noticed (the alerts from item 36), how access is cut off and keys are rotated, ready-written notices for the Data Protection Board and for families, a record of what happened, and one practice run. The legal wording goes through item 50 | After a breach the DPDP Act requires telling the Board and the affected families, with a detailed report to the Board soon after (72 hours under the 2025 Rules). On the day of a leak there is no time to work this out |

## Tier 4

| # | Task | Why it matters |
|---|---|---|
| 38 | **Backend core:** Prisma models and migrations for users, families, tasks, proofs, reviews, awards and reports, plus rewards, requests, quests, rest days and settings; Express 5 routes for every function in `api/index.js`; validation; checks that each family sees only its own children | The product doesn't exist without it |
| 39 | **Authentication:** JWT in httpOnly cookies with refresh-token rotation (`JWT_REFRESH_SECRET` is already in `.env`), bcrypt, role guards, rate-limited sign-in, child sign-in by username | Children's accounts are the trust boundary |
| 40 | **Proof upload pipeline:** Multer, file-type checks on the actual bytes (not just the declared type), size limits, a private bucket with short-lived signed links, image compression and thumbnails, limits on video, files deleted along with their records, EXIF stripped again on the server | Children's photos are the most sensitive data in the app |
| 41 | **Decide where proofs are stored.** Cloudinary keys are already in `.env`. Whichever provider you pick needs a data processing agreement, an Indian or nearby region, and private delivery | It isn't decided yet, and it's where children's photos end up |
| 42 | **Security hardening:** a Helmet content security policy, a CORS allowlist, CSRF protection for cookie sessions, an audit log of moderator actions, a threat model, `/security-review` on every backend phase | The standard you need before strangers sign up |
| 43 | More than one guardian per family, with invites (changes sitemap D1) | Most families have two parents |
| 44 | Hindi plus at least one regional language: an i18n setup and translated copy | The audience is Indian families |
| 45 | Offline support (PWA) and web push notifications for parents | App-like behaviour without building native apps |
| 46 | Moderator tooling and process: what moderators see, how they escalate, who staffs it | A report that nobody reads is worse than no report button |

## Tier 5: hardest, needs people beyond the code

| # | Task | Why it matters |
|---|---|---|
| 47 | Load testing and a cost plan (video on free storage tiers gets expensive) | So it survives real traffic and doesn't run up a bill |
| 48 | Usability testing with real families (with consent, through the university's ethics process), then improve based on what you learn | The engagement plan is a guess until children use it |
| 49 | **Detecting and reporting abuse images among proof photos:** hash matching through an approved provider, plus a process for reporting to the authorities | Any service that stores photos of children has to plan for this |
| 50 | **Legal compliance:** India's DPDP Act 2023 and its 2025 Rules (verifiable parental consent for everyone under 18, and a ban on tracking children's behaviour or targeting ads at them), plus COPPA, GDPR or the UK Age Appropriate Design Code for any country you open in. You also need a privacy policy and terms reviewed by a lawyer, and data agreements with every vendor | **Read the engagement features against these laws.** Streak reminders and leaderboards for children are exactly what regulators examine |

## Left out on purpose

These aren't missing; each was rejected for a reason.

- **Dark mode:** DESIGN.md chose light only.
- **Native apps:** a PWA covers it (item 45).
- **Chance-based rewards:** a gambling mechanic for children. The engagement plan uses sealed rewards instead.
- **Chat, public profiles, contact with strangers:** they break the safety design that the synopsis is built on.

## Suggested order

The ranking is by difficulty, not by order of work.

1. Tier 1 and item 14 (stripping photo location data) now.
2. The engagement plan: items 11, 22, 23 and 24. They only touch the client.
3. The backend block: items 38 to 42, then 28 and 33.
4. Deployment: items 35 to 37.
5. The legal review (item 50), the retention policy (51) and the breach plan (52) before any real family signs up.

Tiers 4 and 5 take most of the time. Item 50 depends on a lawyer and item 48 on real families, so code alone won't finish them.
