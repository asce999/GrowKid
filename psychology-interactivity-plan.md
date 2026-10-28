# GrowKid engagement layer: psychology and interactivity plan

## Why

Children drop off part-way through. The loop works (task, proof, approval, then XP, streak and stickers), but after the ruler has moved a few times there is little to pull a child on:

- Points have no use. They are the same number as XP.
- There is no goal past the next level.
- A parent's approval is a plain stamp, with nothing personal in it.
- A missed day wipes the streak, and there is no way back.

The aim is Duolingo-level stickiness without copying Duolingo. The rule that holds it together: **the unit of engagement is the real-world task, not time in the app.** Every new pull leads to the child sending proof of something they did. This keeps the synopsis's argument intact: harmful online challenges exploit children's love of progress and reward, and GrowKid points that same psychology at good things.

The calm rules in DESIGN.md §12–13 are relaxed on purpose ("go full Duolingo"), with one exception:

- **Mystery rewards are sealed rewards, never chance.** A loot box for 8 to 14 year olds is a gambling mechanic. Instead, a parent can seal a surprise into a weekly quest. The child knows the surprise exists and what unlocks it, but not what it is until it opens. The curiosity stays and the chance goes.

Everything else asked for is included: streak reminders, a sibling leaderboard (opt-in, siblings only, resets weekly; the synopsis lists opt-in leaderboards as future scope) and "almost there" progress toward the next sticker.

**Out of scope:** push notifications (there is no server yet, and sitemap §14 excludes them), sound effects, the backend (these rules join sitemap §12 for it), the Prisma schema and the university documents.

## The features

| # | Feature | Psychology | What the child sees | What the parent does |
|---|---|---|---|---|
| 1 | **Reward shop** | A goal they can hold in their hands; points finally mean something apart from XP | A new **Rewards** page: their balance, the rewards they can afford, and their requests with the answers | A new **Rewards** page: list rewards with a title and a cost in points; give or decline requests |
| 2 | **Weekly quest** | Goal gradient: effort speeds up as the goal gets close | A quest bar on Today's band ("3 of 5 tasks this week, +50 points"), a sealed surprise if one is set, and a landing in the reward moment when the quest is completed | For each child: a target (tasks this week), bonus points and an optional sealed surprise |
| 3 | **Parent cheers** | Relatedness: being noticed by a parent | The cheer and its line, in the reward moment and on the approval stamp | Optionally pick one of six cheers, and add a short line, when approving |
| 4 | **Growth path** | Seeing the road ahead; the pull to complete a collection | Growth opens on a path of the next five levels, with stickers waiting at their levels and "Next sticker: 7 of 10 tasks" | Nothing |
| 5 | **Rest days** (streak freeze) | Less streak anxiety, and a way back after a drop-off | The day mark shows a rest day and the streak survives it | Mark days off for a child: today, the future, or up to 7 days back (this repairs a streak) |
| 6 | **Child picks next** | Autonomy | "Do this next" on each "Also to do" row; the pinned task becomes Next up | Nothing |
| 7 | **Streak reminder** | Loss aversion, stated as fact and never as guilt | On the band, when nothing has been sent today: "Send proof today to keep your 5-day streak." or "Send proof today to start a streak." | Nothing |
| 8 | **Sibling leaderboard** | Social comparison | On Growth: siblings ranked by tasks approved this week, reset every Monday | A switch in Settings, off by default; hidden when there is only one child |
| 9 | **More stickers** | There is always a next one close by | Three new stickers: 50 tasks (seal), First quest and 4 quests (stars) | Nothing |

## Rules

These become sitemap §12 rules 17 to 24. The scoring parts go in `client/src/api/scoring.js`.

- **Balance:** points from approved tasks, plus quest bonuses, minus points held by requests that are waiting or given. A request takes its points at once, and a decline gives them back. A request needs a balance at least as large as the cost. Spending never lowers XP or level.
- **Reward:** a title of 3 to 60 characters and a cost of 10 to 1,000 points in steps of 10, shared by the whole family. Deleting a reward keeps its past requests. Reward titles are screened like task text (rule 8).
- **Request:** goes from `requested` to either `given` or `declined`. A decline note is optional, up to 200 characters. A request is answered once, like a review (rule 10). The child sees every answer.
- **Quest:** set per child, and it repeats every week until changed or removed. The target is 2 to 20 tasks; the bonus is 10 to 200 points in fives; a surprise is up to 80 characters and hidden from the child until the quest is completed. Progress counts tasks whose approved proof was sent this week, by the same week rule as Progress. A quest completes once a week, on the approval that reaches the target. The award is recorded like a sticker (`earnedAt`, `taskId`) and plays in that approval's reward moment.
- **Cheer:** optional on approval. It is one of six fixed kinds (`proud`, `tidy`, `brave`, `clever`, `kind`, `effort`), each with a Lucide icon and a set phrase, plus an optional line of up to 120 characters.
- **Rest day:** a day the parent marks is never a missed day and shows as `rest`. Proof approved on a rest day still counts. Rest days can be set from 7 days back onward.
- **Pin:** a child can pin one open task. `nextTask` returns the pinned task while it is still open, and otherwise follows the current rule. The pin clears when that task closes.
- **Leaderboard:** a family setting, off by default. It shows only to children, only when there are two or more, and lists each sibling's name and tasks approved this week. It never shows XP, level or anything else.
- **Stickers:** the set goes from 11 to 14. Each sticker's rule changes from a function to `{ measure, need }`, so unearned stickers can report how far along they are (`have` of `need`) for the path.

## Phases

Each phase stops when it is done. The next one starts only when you say so.

### G1: documents

Change the authority documents first (DESIGN.md §18 rule 2).

- **`Documentation/DESIGN.md`**
  - §10: rows for the shop, quest, cheer, path, rest day, leaderboard and reminder.
  - §11: child navigation becomes four places (Today, Growth, Stickers, Rewards); parent navigation becomes five (Rewards added).
  - §12: rewrite principle 7. Engagement comes through the task, and factual streak reminders are allowed.
  - §13: drop "loss-framed streak messages", the "almost there" teasing rule and "ranking children". Replace the last with "ranking beyond siblings, or without the parent's opt-in". Keep the ban on random rewards, with its reason.
  - §8: the cheer icons and the `rest` day mark.
  - §18: update "What the code has today" at the end of G4.
- **`Documentation/FRONTEND-SITEMAP.md`**
  - §2 page inventory and §3 routes: `/child/rewards` and `/parent/rewards`.
  - §6 and §7: both information architectures.
  - §10: states for both new pages.
  - §12: rules 17 to 24 above. Rule 3's sticker set becomes 14. Rule 13's reward moment gains cheers and quest completion. Mark each new rule as an assumption to confirm.
- Write the G2 builder brief into `prompt.md`.

### G2: data and rules

- **`client/src/api/scoring.js`**
  - Sticker rules become `{ measure, need }`, and the three new stickers are added.
  - `streakOf` takes the rest days and gives them the state `rest`.
  - `score()` adds `balance`.
  - A new `quest(tasks, questDef, awards, time)`.
  - The sticker record includes `quests`.
- **`client/src/api/fake.js`**
  - The stored data gains `rewards`, `requests`, `quests` (by child), `questAwards`, `restDays` (by child), `settings.leaderboard`, and `pinnedTaskId` on each child.
  - Bump `KEY` to `growkid.fake.v6`.
  - Demo data: three rewards, a quest for Aarav at 3 of 5, one given request, and a cheer on the cycling approval he has not seen yet.
  - Quest awards are recorded inside `review()`, next to `recordAwards`.
  - `erase()` removes every one of a child's new records.
- **`client/src/api/index.js`**
  - JSDoc types and exports: `listRewards`, `saveReward`, `deleteReward`, `requestReward`, `listRequests`, `answerRequest`, `getQuest`, `setQuest`, `listRestDays`, `setRestDays`, `pinTask`, `getLeaderboard`, `getSettings`, `setLeaderboard`.
  - `approveProof(taskId, proofId, cheer?)`.
  - Shape changes: Growth gains `balance` and `quest`, Sticker gains `have` and `need`, Task gains `pinned`, Review gains `cheer`.
- **`client/src/utils/tasks.js`:** `nextTask` follows `pinned`.
- **`client/src/utils/format.js`:** add `DAY_SAID.rest`.
- **Checks**
  - `scoring.check.js`: a rest day keeps the streak; the balance is right after a request and after a decline; a quest completes once a week; stickers report `have` and `need`.
  - `tasks.check.js`: the pin rule.
  - `fake.check.js`: `erase()` removes the new records; a second answer to a request is refused; a request bigger than the balance is refused.

### G3: child screens

- **`Today.jsx`:** the quest bar; the reminder line; a cheer step and a quest step in the reward moment, after the stickers; the "Do this next" button on each row.
- **`Growth.jsx`:** the path first, then the leaderboard, then the history.
- **New `pages/Rewards.jsx`:** the child's reward shop.
- **`components/Streak.jsx`:** the `rest` day mark.
- **`components/Review.jsx`:** the cheer on the stamp and in `Gain`.
- **`components/Shells.jsx`:** the fourth child tab.
- **`router.jsx`:** the new route.
- **`index.css`:** `day-rest`, a quest bar that reuses the `ruler` classes, and path styles from existing tokens only. No new tokens.

### G4: parent screens

Runs after G3.

- **New `pages/ParentRewards.jsx`:** the rewards list, requests waiting, each child's quest, and rest days.
- **`TaskDetail.jsx`:** a cheer picker beside Approve. There is still one main button.
- **`Overview.jsx` and the navigation count in Shells:** requests waiting are counted alongside proofs waiting.
- **`Settings.jsx`:** the leaderboard switch.
- **`Shells.jsx`:** the fifth parent item.
- **`router.jsx`:** the new route.
- **`Privacy.jsx` and `Landing.jsx`:** what siblings can see, and what the shop is.
- **DESIGN.md §18:** update the file table.

### Reuse instead of rebuilding

| Existing piece | Reused for |
|---|---|
| `GrowthRuler` and the `ruler` classes | The quest bar |
| `Sticker` | Path milestones; the sealed surprise, dashed `not-yet` until it opens |
| `useLoad` with `live` | Data loading on the new pages |
| `Field` and `refuse()` | Validation |
| `review()`'s answer-once pattern | Answering requests |
| `mondayOf` | The quest's week |
| `EmptyState`, `ErrorState`, `PageLoading` | Every new state |

## Risks

- **The reward moment gets longer.** It must still play once and respect reduced motion. Today's `visit` ref already handles repeated plays.
- **Bumping `KEY` wipes local demo data.** This is intended, and each phase report will say so.
- **Five parent items in the bottom bar at 360 px.** Check that they fit with 44 px targets before G4 closes. If they don't, move Rewards under Family.
- **The leaderboard can upset a younger sibling.** It is off by default, resets every week and shows only a task count.

## How each phase is checked

- In `client/`: `npm run lint`, `npm run check` and `npm run build`.
- Data boundary: no page imports `fake.js`, and nothing outside `client/src/api/` touches `localStorage`, `sessionStorage` or IndexedDB.
- Browser: Playwright at 360 px and 1280 px, plus a keyboard-only pass. Remove `.playwright-mcp/` afterwards.
  - **G3**, as `aarav` / `plants42`:
    - The quest bar shows 3 of 5, and the cheer plays in the reward moment.
    - Pin a task; open Rewards and request a reward.
    - `?clock=1` shows the streak reminder.
    - The Growth path renders, and the leaderboard appears once the parent turns it on.
  - **G4**, as `meera@example.com`:
    - Add a reward and answer a request.
    - Set a quest with a surprise, and approve a proof with a cheer.
    - Mark a rest day two days back and confirm the child's streak is repaired.
- Review: `/code-review` and `/ponytail-review` on each finished phase's diff.
