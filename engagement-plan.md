# GrowKid engagement plan: build guide for G1 to G4

This is the build guide for the engagement layer described in `psychology-interactivity-plan.md`. It covers `complete-todo-list.md` items 22, 23 and 24 (phases G2, G3, G4), plus item 11 (phase G1), because G1 has to come first. Anyone, or any model, building it should be able to finish it from this document without asking anything. Where something is not written here, **stop and ask. Do not guess.**

---

## 0. How to use this document

1. Read sections 1 to 5 in full before touching a file. They hold the rules and the contract that every phase depends on.
2. Build one phase at a time, in order: G1, G2, G3, G4. Each phase ends at its **Stop** line. Do not start the next phase until the user says so (repo rule, `CLAUDE.md`, "Phases").
3. A phase is done only when every check in its "Done when" list passes. Report in the format of section 11.
4. Wherever this document gives text in quotes, use it word for word, including the curly quotes (’ “ ”). It has already been checked against DESIGN.md's voice rules.
5. If the code differs from what this document describes (a function renamed, a line moved), find the closest match. If the intent is still unclear, stop and report it.

---

## 1. Goal and non-goals

**Goal.** Children keep coming back because each visit has something to pull them forward, and the pull always leads to **doing a real task and sending proof**. Nine features, all set out in `psychology-interactivity-plan.md`:

1. reward shop
2. weekly quest
3. parent cheers
4. growth path
5. rest days
6. child picks the next task
7. streak reminder
8. sibling leaderboard
9. three more stickers

**Non-goals. Do not build:**
- Sounds, vibration, push notifications or email.
- Anything random or chance-based: no spins, no mystery boxes. A sealed surprise is written by the parent and opens on a known condition.
- Rewards for opening the app.
- Ranking anyone outside the family.
- New design tokens: no colour, radius, shadow, font, size or breakpoint.
- Server code, the Prisma schema, or deployment.
- Changes to `Documentation/GrowKid-Synopsis.pdf` or the poster. Both are final.
- The university Word documents.
- `pages/DesignSheet.jsx`.

---

## 2. Read before starting

| File | Why |
|---|---|
| `CLAUDE.md` (repo root) | Repo rules: phases, checks, trust boundaries, what never to read |
| `Documentation/DESIGN.md` | The design authority. Sections 5 to 13, 15, 17 and 18 matter most |
| `Documentation/FRONTEND-SITEMAP.md` | Sections 2, 3, 7, 10 and 12 (the rules the backend must implement) |
| `psychology-interactivity-plan.md` | Why each feature exists |
| `client/src/api/index.js` | The API contract. JSDoc types at the top; every function documented |
| `client/src/api/fake.js` | The stand-in server: all stored data and rules |
| `client/src/api/scoring.js` | The award rules as pure functions |
| `client/src/api/scoring.check.js`, `fake.check.js`, `utils/tasks.check.js` | The runnable checks (`npm run check`) |
| `client/src/pages/Today.jsx` | The child's home and the reward moment |
| `client/src/components/GrowthRuler.jsx`, `Streak.jsx`, `Review.jsx`, `Task.jsx`, `Sticker.jsx`, `Shells.jsx`, `states.jsx`, `Field.jsx` | The components reused everywhere |
| `client/src/index.css`, lines 370–460 and 760–930 | `.ruler`, `.sticker`, `.choice`, `.stamp`, `.nav-count`, `.day-*`, `.land` |

Never open `node_modules/`, `client/dist/` or either `package-lock.json`.

---

## 3. Ground rules (every phase)

**Data boundary**
- Pages and components reach data only through `client/src/api/index.js`.
- Nothing outside `client/src/api/` imports `fake.js` or `scoring.js`, or touches `localStorage`, `sessionStorage` or IndexedDB.

**Design**
- Tokens only. Tailwind's default colour, text, radius, shadow and breakpoint scales are switched off in `index.css`, so classes like `text-sm`, `rounded-xl` and `md:` do nothing.
- Use the type roles (`type-small`, `type-game` and the rest), the token colours (`navy-*`, `sprout-*`, `sun-*`, `coral-*`, `ember-*`), `rounded-tag`, `rounded-control`, `rounded-card`, and the `sm:` and `lg:` breakpoints.
- Lucide icons only, outline, size 16, 20 or 24 px (`size-4`, `size-5`, `size-6`). Only the star (points) and the flame (streak) are ever filled, with `icon-earned`.
- Gold (`sun-*`) only on earned objects. Never on a background, text or a button.
- One main button per screen. Every other button is `btn-secondary` or `btn-text`.
- Sentence case. No exclamation marks; the level-up is the only exception, and nothing new is a level-up.
- Every status shows an icon, a word and a colour together.
- Motion uses transform and opacity only, plays once, and respects `prefers-reduced-motion`. The only animation class allowed is the existing `.land`.

**Accessibility**
- Every control has a visible label or an accessible name.
- Targets are at least 44 px (`min-h-11`). The child's main action is 56 px (`btn-lg`).
- An error appears beside its field, through `Field`'s `error` prop.
- Loading, empty and error states use `PageLoading`, `EmptyState` and `ErrorState`.

**Code style**
- Match the file you are in. Each file opens with a short comment saying what it is for. Exported functions get JSDoc in the same plain-English voice. Comments explain why, not what.
- A deliberate shortcut with a known limit gets a `// ponytail:` comment that names the limit.
- No new npm dependencies.
- Reuse before adding: `useLoad` (with `live` and `set`), `noticeExpiry`, `errorText`, `Field`, `Message`, `Points`, `Sticker`, `TaskRow`, `CategoryTile`, `whenText`, `refuse()` in `fake.js`, and the `.choice`, `.ruler` and `.tag-*` classes.

**Trust boundary.** Children's names and data. Nothing new leaves the browser. The leaderboard shows a sibling's **first name as the parent typed it**, and nothing else about them.

---

## 4. Settled decisions (do not reopen)

| # | Topic | Decision |
|---|---|---|
| D1 | Points vs XP | `points` stays "every point ever earned", and XP is unchanged. A new number, `balance`, is what can be spent. Spending never lowers `points`, XP or level. This resolves the "Points and XP" assumption in DESIGN.md §18 |
| D2 | Balance | `balance = points + quest bonuses − cost of every request that is waiting or given`. The child's balance uses the **shown** score (sitemap rule 13): an approval or quest the child hasn't seen on Today doesn't count yet. The parent's pages use the real one |
| D3 | Requests | A request holds its points at once. Declining gives them back. A request needs `shown balance ≥ cost`, otherwise `NOT_ENOUGH`. It is answered once; a second answer gets `REVIEWED` |
| D4 | Declined wording | Shown as "Not this time", with a neutral tag and `CircleMinus`. Never coral: declining isn't something the child has to fix |
| D5 | Quest week | A task counts toward the week its approved proof was **sent** in (the same rule as Progress, rule 14). The quest that applies is the one in place at the moment of approval. A quest completes once per week. Its bonus goes to `balance`, not XP. The award is a copy, so later edits to the quest don't change it |
| D6 | Sealed surprise | The parent writes it; the child sees only that it exists until the quest is complete. This is the one thing a child can't see, and it is about a reward, not about the child. DESIGN.md §13 records this as the only exception |
| D7 | Cheer | Optional on approval: one of six fixed kinds, or none, plus an optional line of up to 120 characters. It is shown with the approval stamp everywhere the stamp appears, except Landing |
| D8 | Rest days | Only a parent sets them, for one child at a time, from 7 days ago up to 90 days ahead. The controls live on the parent's Progress page, in the Streak section. A rest day is never missed; it shows the day state `rest`, and proof approved on it still counts |
| D9 | Pin | Only the child pins a task, and only one at a time. `nextTask` returns the pinned task while it is open. The pin clears when proof is sent for that task or the task is deleted. The parent can see which task is pinned (`pinned` is on every task); nothing about the child is hidden from the parent |
| D10 | Leaderboard | A parent setting, off by default. It appears only on the child's Growth page, and only when the family has 2 or more children. Each entry is a first name and the number of tasks approved this week (Monday to Sunday, by the week the proof was sent), counting only approvals **that sibling has seen**. Sorted by tasks (most first), then by name |
| D11 | Streak reminder | Shown on Today's band only when all four hold: a task is due today, that task is still open, the child has sent no proof today, and today isn't a rest day. Worded as fact, never as guilt |
| D12 | Stickers | 14 in total, in the order given in §5.3. Their rules become data `{ measure, need }`. Earned stickers are never lost or re-dated (unchanged) |
| D13 | Navigation | Child: Today, Growth, Stickers, Rewards. Parent: Overview, Tasks, Rewards, Progress, Family. The parent's Rewards item shows a count of requests waiting |
| D14 | Reward moment | Cheers show inside each gain row; there is no separate cheer step. A quest completion lands after the stickers, with the same `.land` class and a staggered delay |
| D15 | Storage | The `fake.js` key goes from `growkid.fake.v5` to `growkid.fake.v6`. Local demo data resets once; say so in the G2 report |
| D16 | Dates | A day is the local calendar day, written `YYYY-MM-DD`. A week runs Monday to Sunday. Time zones per family are not in scope (to-do item 27) |

---

## 5. The contract: data, rules and API

### 5.1 Stored data (`fake.js`)

Add these fields to the stored `db`. Existing fields are unchanged.

```js
{
  // existing: users, tasks, session, awards, reports
  rewards: [{ id, parentId, title, cost, createdAt }],
  requests: [{
    id, childId, parentId, rewardId,
    title, cost,                       // copied from the reward when requested; deleting or editing the reward changes neither
    status: 'requested' | 'given' | 'declined',
    note: '',                          // the parent's note when declining, '' otherwise
    requestedAt,                       // ISO
    answer: undefined | { by, at },    // the parent's name and ISO time once answered
  }],
  quests: { [childId]: { target, bonus, surprise /* string or null */, setAt } },
  questAwards: { [childId]: { [weekKey]: { week: weekKey, target, bonus, surprise, earnedAt, taskId, taskTitle } } },
  restDays: { [childId]: ['YYYY-MM-DD', ...] },   // sorted ascending, no duplicates
  settings: { [parentId]: { leaderboard: false } },
}
```

Two existing records gain a field:
- A **child** user gains `pinnedTaskId?: string`.
- `proof.review` gains `cheer?: { kind: string | null, line: string }`. It is present only when the parent chose a kind or wrote a line.

### 5.2 Validation (`fake.js`, through the existing `refuse()` and `ApiError`)

| Input | Rule | Error |
|---|---|---|
| Reward title | trimmed, 3 to 60 characters | `INVALID` `{ title: 'length' }` |
| Reward title | screened with `BLOCKED_WORDS`, using the same regular expression as `checkTask` | `SCREENED` `{ word }` |
| Reward cost | an integer, 10 to 1000, a multiple of 10 | `INVALID` `{ cost: 'range' }` |
| Quest target | an integer, 2 to 20 | `INVALID` `{ target: 'range' }` |
| Quest bonus | an integer, 10 to 200, a multiple of 5 | `INVALID` `{ bonus: 'range' }` |
| Quest surprise | trimmed, at most 80 characters; `''` is stored as `null` | `INVALID` `{ surprise: 'length' }` |
| Quest surprise | screened | `SCREENED` `{ word }` |
| Decline note | at most 200 characters | `INVALID` `{ note: 'length' }` |
| Cheer kind | `null`, or one of `CHEER_KINDS` | `INVALID` `{ cheer: 'kind' }` |
| Cheer line | trimmed, at most 120 characters | `INVALID` `{ line: 'length' }` |
| Rest day | matches `/^\d{4}-\d{2}-\d{2}$/` and falls between `dayKey(today − 7 days)` and `dayKey(today + 90 days)`, inclusive | `INVALID` `{ day: 'range' }` |
| Request | the reward must belong to the child's parent | `NOT_FOUND` |
| Request | shown balance must be at least the cost | `NOT_ENOUGH` (new code) |
| Answer | the request must still be `requested` | `REVIEWED` |
| Pin | the task must be the child's own | `NOT_FOUND` |
| Pin | the task must be open (`todo` or `sentBack`) | `LOCKED` |

`CHEER_KINDS = ['proud', 'tidy', 'brave', 'clever', 'kind', 'effort']` is a constant in `fake.js`, because the server owns the list. The words and icons for each kind live in `client/src/utils/cheers.js` (§8.1).

### 5.3 Award rules (`scoring.js`)

Every function stays pure: no browser, no `Date.now()`. Times are passed in. New and changed exports:

```js
/** A local calendar day as 'YYYY-MM-DD'. */
export const dayKey = (time) => { const d = new Date(time); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
/** The start of a 'YYYY-MM-DD' day, as milliseconds: the same value dayOf gives. */
const dayOfKey = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).getTime() }
/** The week a time falls in, named by its Monday. */
export const weekKey = (time) => dayKey(mondayOf(time))
```
(`mondayOf` already exists. Move it above its first use if needed.)

**`streakOf(approved, tasks, time, span = 7, rest = new Set())`**, where `rest` is a Set of day values as returned by `dayOf`:
- In the missed loop, a day is missed only if `!rest.has(due)`, on top of the existing conditions.
- A week entry's state is `'done'` if the day is in `done`; otherwise `'rest'` if it is in `rest`; otherwise `'missed'` if it is in `missed`; otherwise `'none'`.
- The counting loop is unchanged. Rest days are never in `missed`, so they neither add to nor break the streak.

**Rest days through the other functions.** `score(tasks, time, rest = [])` and `progress(tasks, time, rest = [])` take `rest` as an array of `'YYYY-MM-DD'` keys and pass `new Set(rest.map(dayOfKey))` down to `streakOf`.

**`STICKERS`** become plain data. Delete the `earned` functions and the `CHART` export, and use `STICKERS` wherever `CHART` was used (`fake.js` imports it). The chart order, exactly:

| id | name | how | shape | tone | measure | need |
|---|---|---|---|---|---|---|
| `first-task` | First task | Awarded when your first task is approved. | seal | sun | approved | 1 |
| `tasks-10` | 10 tasks | Awarded when 10 of your tasks have been approved. | seal | sun | approved | 10 |
| `tasks-25` | 25 tasks | Awarded when 25 of your tasks have been approved. | seal | sun | approved | 25 |
| `tasks-50` | 50 tasks | Awarded when 50 of your tasks have been approved. | seal | sun | approved | 50 |
| `streak-3` | 3-day streak | Awarded when your streak reaches 3 days. | shield | navy | streak | 3 |
| `streak-7` | 7-day streak | Awarded when your streak reaches 7 days. | shield | navy | streak | 7 |
| `streak-30` | 30-day streak | Awarded when your streak reaches 30 days. | shield | navy | streak | 30 |
| `level-2` | Level 2 | Awarded when you reach level 2. | hexagon | sprout | level | 2 |
| `level-5` | Level 5 | Awarded when you reach level 5. | hexagon | sprout | level | 5 |
| `level-10` | Level 10 | Awarded when you reach level 10. | hexagon | sprout | level | 10 |
| `all-kinds` | All six kinds | Awarded when a task of each of the six kinds has been approved. | star | sun | kinds | 6 |
| `first-try-5` | Right first time | Awarded when 5 tasks have been approved on the first try. | star | sun | firstTry | 5 |
| `quest-1` | First quest | Awarded when you complete your first weekly quest. | star | sun | quests | 1 |
| `quest-4` | 4 quests | Awarded when you have completed 4 weekly quests. | star | sun | quests | 4 |

**New: `recordOf(tasks, time, { rest = [], quests = 0 } = {})`** returns `{ approved, level, streak, kinds, firstTry, quests }` for the tasks as they stand, where `streak` is the **best** streak. It uses the same expressions as the existing record inside `stickers()`. Refactor `stickers()` to share them rather than copying.

**`stickers(tasks, { rest = [], questAwards = [] } = {})`**, where `questAwards` is an array of awards each with `earnedAt`:
- For each approval in order, `record.quests` = the number of quest awards with `earnedAt <= approvedAt(task)`.
- `record.streak` = `streakOf(soFar, tasks, approvedAt(task), 7, restSet).best`.
- A sticker is earned when `record[sticker.measure] >= sticker.need`.
- It returns `STICKERS.map(...)`, as today.

**New: `approvedInWeek(tasks, week)`** returns the number of approved tasks where `weekKey(task.proofs.at(-1).sentAt) === week`.

**New: `questOf(tasks, def, awardsByWeek, time)`** returns `null` when `def` is null. Otherwise, with `week = weekKey(time)`, it returns:
```js
{ week, target: def.target, bonus: def.bonus,
  done: Math.min(def.target, approvedInWeek(tasks, week)),
  completed: Boolean(awardsByWeek?.[week]),
  surprise: def.surprise }   // fake.js strips it for a child (§5.4)
```

**New: `questCompletedBy(tasks, def, awardsByWeek, task)`**. Here `tasks` already includes `task` as approved. It returns the `weekKey` of `task.proofs.at(-1).sentAt` when `def` exists, that week has no award yet, and `approvedInWeek(tasks, thatWeek) >= def.target`. Otherwise it returns `null`.

**New: `balanceOf(points, questAwards, requests)`** returns `points + sum(questAwards.bonus) − sum(cost of requests whose status is 'requested' or 'given')`.

### 5.4 Server behaviour (`fake.js`)

**Helpers**
- `restOf(db, childId)` returns `db.restDays[childId] ?? []`.
- `questAwardsOf(db, childId)` returns `Object.values(db.questAwards[childId] ?? {})`, sorted by `earnedAt`, newest first.
- `awardSeen(db, award)` returns `db.tasks.find((t) => t.id === award.taskId)?.resultSeen ?? true`. It is the same rule as `seen` in `listStickers`; extract it there and reuse it.

**`growthOf(db, childId)`** replaces the current one:
1. Set `theirs`, `rest`, `def = db.quests[childId] ?? null`, `byWeek = db.questAwards[childId] ?? {}`, `awards = questAwardsOf(...)` and `held = db.requests.filter((r) => r.childId === childId)`.
2. `current = score(theirs, now(), rest)`. Add `current.balance = balanceOf(current.points, awards, held)` and `current.quest = questOf(theirs, def, byWeek, now())`.
3. `shownTasks = theirs.map(notShown)`, as today. `seenAwards = awards.filter((a) => awardSeen(db, a))`. `shownByWeek` is `byWeek` restricted to seen awards.
4. `shown = score(shownTasks, now(), rest)`, with `waitingXp: current.waitingXp` (as today), `balance: balanceOf(shown.points, seenAwards, held)` and `quest: questOf(shownTasks, def, shownByWeek, now())`.
5. Return `{ ...current, questAwards: awards.map((a) => ({ ...a, seen: awardSeen(db, a) })), shown }`.

`getGrowth` (child) also strips secrets. In `current.quest` and `shown.quest`, set `surprise` to `null` and `sealed` to `Boolean(def?.surprise)` while that week isn't completed **and seen**. When it is completed and seen, keep `surprise` and set `sealed: false`. `listGrowth` (parent) returns the quest unstripped, with `sealed: Boolean(def?.surprise) && !completed`.

**Tasks.** `asTask` adds `pinned: task.id === db.users.find((u) => u.id === task.childId)?.pinnedTaskId`.

**`sendProof`.** Inside `record`, after the push: if the child's `pinnedTaskId === taskId`, delete `pinnedTaskId`. **`deleteTask`** clears the pin the same way.

**`review(taskId, proofId, result, note = '', cheer)`**
- Validate the cheer only when `result === 'approved'` and `cheer` is given. If `cheer.kind` is null and `cheer.line.trim()` is empty, store nothing.
- On approval, in this order:
  1. Check `questCompletedBy(tasksOf(db, childId), db.quests[childId], db.questAwards[childId], task)`. If it returns a week, record `{ week, target, bonus, surprise, earnedAt: proof.review.at, taskId, taskTitle }` from the quest **as it is now**.
  2. Call `recordAwards(db, childId, approval)`.
- Export `approveProof = (taskId, proofId, cheer) => review(taskId, proofId, 'approved', '', cheer)`.

**`recordAwards`** passes `{ rest: restOf(db, childId), questAwards: questAwardsOf(db, childId) }` to `stickers()`.

**`listStickers`** keeps its current output, plus `have: Math.min(s.need, record[s.measure])` on stickers that aren't earned or not yet seen. `record` is `recordOf(shownTasks, now(), { rest, quests: seenAwards.length })`.

**`getProgress`** passes `rest` to `score` and `progress`.

**`erase(db, userIds)`** also removes:
- `rewards` whose `parentId` is gone
- `requests` whose `childId` or `parentId` is gone
- `quests[id]`, `questAwards[id]`, `restDays[id]` and `settings[id]` for each gone id

**Pure, testable functions.** As with `answerReport`, these work on a `db` passed in, use `db.session`, and are exported for `fake.check.js`:
- **`requestIn(db, rewardId)`:** child only. Finds the reward among the child's parent's rewards (`NOT_FOUND` otherwise). Checks `growthOf(db, me.id).shown.balance >= reward.cost` (`NOT_ENOUGH` otherwise). Pushes the request and returns it as `asRequest`.
- **`answerIn(db, id, result, note = '')`:** parent only. The request must be in their family (`NOT_FOUND`) and still `requested` (`REVIEWED`). `result` must be `'given'` or `'declined'` (`INVALID` `{ result: 'required' }`). Validates the note, sets `status`, `note` (only when declining) and `answer: { by: me.name, at: now }`.

`asRequest(db, r)` returns `{ ...r, childName }`, without `parentId`.

**`read()` defaults.** `{ reports: [], rewards: [], requests: [], quests: {}, questAwards: {}, restDays: {}, settings: {}, ...JSON.parse(saved) }`.

**Demo data**, added in `read()` after `recordAwards` runs:

| Data | Value |
|---|---|
| `rewards` (parent `demo-parent`) | "15 minutes of extra screen time" (50); "Choose the film on Friday" (100); "A trip to the park café" (300). Each `createdAt` is 6 days ago |
| `requests` | Aarav requested "15 minutes of extra screen time" (50) 2 days ago at 5 pm; `status: 'given'`, `answer: { by: 'Meera Joshi', at: <2 days ago, 7 pm> }` |
| `quests['demo-aarav']` | `target = Math.max(2, approvedInWeek(aaravTasks, weekKey(now())) + 2)`, `bonus: 50`, `surprise: 'Ice cream after school on Saturday'`, `setAt` 6 days ago. This always leaves "2 to go", whatever weekday the demo is created on |
| Cycling approval (`demo-done-5`) | `review.cheer = { kind: 'effort', line: 'Twenty minutes there and back is quick. Well done.' }` |
| Settings and rest days | None. The leaderboard stays off |

The result: Aarav's real balance is 120 − 50 = 70. His shown balance is 40 until he watches the cycling approval on Today, then 70. That's enough for the 50-point reward, and 30 short of the 100-point one: the "almost there" pull.

### 5.5 API (`index.js`): JSDoc types and exports

Add to the typedef block, in the existing style:

```js
/**
 * @typedef {'proud' | 'tidy' | 'brave' | 'clever' | 'kind' | 'effort'} CheerKind
 * @typedef {{ kind: CheerKind | null, line: string }} Cheer  a parent's words with an approval
 * @typedef {{ id: string, title: string, cost: number }} Reward  something a child can spend points on
 * @typedef {object} RewardRequest
 * @property {string} id
 * @property {string} childId
 * @property {string} childName
 * @property {string} rewardId    may name a reward since deleted; title and cost are copies
 * @property {string} title
 * @property {number} cost
 * @property {'requested' | 'given' | 'declined'} status
 * @property {string} note        the parent's note when declined, '' otherwise
 * @property {string} requestedAt ISO time
 * @property {{ by: string, at: string }} [answer]
 * @typedef {{ target: number, bonus: number, surprise: string | null }} QuestDef  what a parent sets
 * @typedef {object} Quest  this week's quest. A child is given surprise only once it is complete and seen.
 * @property {string} week       'YYYY-MM-DD' of its Monday
 * @property {number} target
 * @property {number} bonus
 * @property {number} done       tasks approved this week, at most target
 * @property {boolean} completed
 * @property {boolean} sealed    a surprise is waiting and not yet shown
 * @property {string | null} surprise
 * @typedef {{ week: string, target: number, bonus: number, surprise: string | null, earnedAt: string,
 *   taskId: string, taskTitle: string, seen?: boolean }} QuestAward
 * @typedef {{ name: string, tasks: number, you: boolean }} LeaderboardEntry
 */
```

Change the existing types:
- `Review` gains `@property {Cheer} [cheer]`.
- `Task` gains `@property {boolean} pinned`.
- `Streak.week[].state` becomes `'done' | 'missed' | 'none' | 'rest'`, with a sentence on rest days. Do the same in `Progress.calendar`.
- `Score` gains `@property {number} balance` (points that can be spent; see D2) and `@property {Quest | null} quest`.
- `Growth` becomes `Score & { shown: Score, questAwards: QuestAward[] }`.
- `Sticker` gains `measure`, `need`, and `[have]`.

Exports, in a new section `// ---- rewards, quests and the rest` placed before `// ---- reports`. Each gets JSDoc stating its role and every rejection, as the existing functions do.

| Export | Who | Signature | Rejects |
|---|---|---|---|
| `listRewards` | parent, child | `() => Promise<Reward[]>`, the family's rewards, cheapest first | NOT_ALLOWED |
| `saveReward` | parent | `({ id?, title, cost }) => Promise<Reward>`, creates one or changes it | INVALID, SCREENED, NOT_FOUND |
| `deleteReward` | parent | `(id) => Promise<void>`; past requests keep their copies | NOT_FOUND |
| `requestReward` | child | `(rewardId) => Promise<RewardRequest>` | NOT_ENOUGH, NOT_FOUND |
| `listRequests` | parent, child | `() => Promise<RewardRequest[]>`, newest first: the parent's whole family, or a child's own | |
| `answerRequest` | parent | `(id, result, note?) => Promise<RewardRequest>` | REVIEWED, INVALID, NOT_FOUND |
| `countRequestsWaiting` | parent | `() => Promise<number>` | |
| `setQuest` | parent | `(childId, def \| null) => Promise<QuestDef \| null>`; null removes it | INVALID, SCREENED, NOT_FOUND |
| `listRestDays` | parent | `(childId) => Promise<string[]>`, from 7 days ago onward | NOT_FOUND |
| `setRestDay` | parent | `(childId, day, rest: boolean) => Promise<string[]>`; returns the new list | INVALID, NOT_FOUND |
| `pinTask` | child | `(taskId \| null) => Promise<Task[]>`; returns the child's tasks, as `listTasks` does | LOCKED, NOT_FOUND |
| `getLeaderboard` | child | `() => Promise<LeaderboardEntry[] \| null>`; null when off or with fewer than 2 children | |
| `getSettings` | parent | `() => Promise<{ leaderboard: boolean }>` | |
| `setLeaderboard` | parent | `(on: boolean) => Promise<{ leaderboard: boolean }>` | |

Change `approveProof` to `(taskId, proofId, cheer?) => Promise<Task>`, documenting `INVALID` with `fields.cheer` or `fields.line`.

There is deliberately no `getQuest`. The parent reads each child's quest from `listGrowth()[childId].quest`, which includes the surprise.

**`errors.js`:** add the line `NOT_ENOUGH      a reward costs more points than the child has to spend` and add `'NOT_ENOUGH'` to the typedef.
**`utils/messages.js`:** add `NOT_ENOUGH: 'You do not have enough points for that yet.'`

---

## 6. Phase G1: documents

**Goal.** The design and sitemap documents describe the engagement layer before any code changes (DESIGN.md §18 rule 2). Edit only these two files and `prompt.md`.

### 6.1 `Documentation/DESIGN.md`

1. **§2 Product personality.** Leave as is.
2. **§8 Iconography.**
   - Append to "Other fixed meanings": `` `Gift` rewards and a sealed surprise, `Flag` the weekly quest, `Pin` the task a child chose to do next ``.
   - Add a sub-table "Cheers", with kind, icon and words: proud `Heart` "Proud of you"; tidy `Sparkles` "Super tidy"; brave `Mountain` "That was brave"; clever `Lightbulb` "Clever thinking"; kind `HandHeart` "So kind"; effort `BicepsFlexed` "Great effort". Then one line: "A cheer's icon is an outline in the text colour. It is never filled and never gold."
3. **§10 Gamification visual language.** Add these rows to the table, after "Streak":

| Element | How it looks | Rule |
|---|---|---|
| Rest day | A day mark with a solid `navy-800` border on white (on the band: `navy-200` on `navy-950`), with the day's letter | Set by a parent. Never missed; the streak survives it. Read out as "a rest day". |
| Streak reminder | One line on Today's band, under the streak, with an outline `Flame` | Only when a task is due today, is still open, no proof was sent today, and today is not a rest day. Factual: "A task is due today. Send proof for it to keep your 5-day streak." Never guilt, never a countdown. |
| Weekly quest | On Today's band, under the gains: `Flag`, "This week’s quest", the bonus as points, a short ruler (`ruler quest-ruler`) with its marker, and "3 of 5 tasks approved this week. 2 to go." | Set by a parent. Counts tasks by the week their proof was sent. Completes once a week. The bonus is points to spend, not XP. |
| Sealed surprise | `Gift` and "A surprise is sealed inside. It opens when the quest is complete." | The parent writes it. The child sees what unlocks it, never what it is, until it opens. Not chance: the parent chose it and the condition is shown. |
| Reward shop | The child's Rewards page: points to spend, then rewards as rows with their cost and "Ask for this", then the child's requests with their answers | Asking holds the points; "Not this time" returns them. Spending never lowers XP, level or points earned. |
| Cheer | An outline icon and the cheer's words, then the parent's line in quotes, under the approval stamp | Optional, chosen by the parent when approving. |
| Growth path | On Growth: the current level and the next five, as a vertical line of level tiles (solid for the current one, dashed ahead), with the XP each one starts at and any level sticker waiting there | Shows the road ahead. Tiles are not buttons. |
| Next stickers | Up to three stickers not yet earned, closest first, each as a dashed outline with "7 of 10 tasks approved" | Progress toward a sticker is shown in numbers with units. |
| Family leaderboard | On Growth, only when a parent turns it on and there are two or more children: siblings in order of tasks approved this week, with "you" marked | Siblings only. Task counts only, never XP or level. Starts again every Monday. |

   - Also edit the existing "Sticker chart" row. Replace "No 'almost there' teasing." with "Stickers not yet earned show how far along the child is, in numbers."
   - In the "Badges and achievements" row, change "the eleven listed in the sitemap" to "the fourteen listed in the sitemap", and add "stars for a skill or a weekly quest".
4. **§11 Parent vs child experience.** Navigation row:
   - Parent: "Sidebar on desktop, bottom bar on mobile: Overview, Tasks, Rewards, Progress, Family. Overview carries the count of proofs waiting and Rewards the count of requests waiting."
   - Child: "Bottom bar with four places: Today, Growth, Stickers, Rewards".
5. **§12 UX principles.** Replace principle 7 with:
   > **Engagement comes through the task.** Every pull back to GrowKid (a quest, a reward, a streak reminder, a sibling's week) leads to doing a real task and sending proof. No countdowns, no guilt, no reward for opening the app, nothing left to chance. Factual reminders are allowed on Today and nowhere else.
6. **§13 Anti-patterns.** Under Behaviour:
   - Replace "Countdown timers, loss-framed streak messages, or rewards for simply opening the app." with "Countdown timers, guilt wording, or rewards for simply opening the app."
   - Keep the random-rewards line and add to it: "A sealed surprise is not random: the parent writes it and the child sees what opens it."
   - Replace "Ranking children against each other. (…)" with "Ranking children outside their own family, or ranking siblings without the parent turning it on. The family leaderboard counts tasks only."
   - Replace "Anything the parent can see about the child that the child cannot." with "Anything the parent can see about the child that the child cannot. The one thing a child does not see is a sealed surprise, which is about a reward, not about them, and only until it opens."
7. **§16 Component taxonomy.**
   - Rewards row: add "quest bar, sealed surprise, cheer, reward list, request row, growth path, next stickers, family leaderboard".
   - Progress row: add "rest day mark".
8. **§18.**
   - Under "Assumptions to confirm", replace the "Points and XP" bullet with: "**Points and XP.** Separate since the engagement layer: XP and points earned only grow; `balance` is what can be spent in the reward shop."
   - Add a bullet: "**Engagement layer.** Its rules are the sitemap's rules 17 to 24, assumed on 28 October 2026 and waiting for confirmation."
   - Leave "What the code has today" for G4.

### 6.2 `Documentation/FRONTEND-SITEMAP.md`

1. **§2 Page inventory.** Add "Rewards (child)" and "Rewards (parent)". The page count goes from 19 to 21.
2. **§3 Route map.** Add `/child/rewards` (child, Rewards) and `/parent/rewards` (parent, Rewards). The route count goes from 21 to 23.
3. **§6.** Add Rewards to the parent's navigation list: it leads with requests waiting, then rewards, then each child's weekly quest. The Progress page's Streak section holds rest days.
4. **§7.** Navigation becomes "Today, Growth, Stickers, Rewards". In the table:
   - Add a Rewards row: leads with "points to spend"; also holds "the rewards, and the child's requests with their answers".
   - Today's "Also holds" gains "this week's quest; the streak reminder; choosing the next task".
   - Growth's "Also holds" gains "the growth path, the next stickers, and the family leaderboard when a parent turns it on".
5. **§10 States.**
   - Rewards (child): empty "No rewards yet"; error "Load failed; asking failed and nothing was held".
   - Rewards (parent): empty "No rewards yet" and "No requests waiting"; error "Load failed; answered in another tab".
6. **§12.**
   - Rule 3, "Stickers": replace "Eleven" with "Fourteen" and add "50 tasks (seal); First quest and 4 quests (star)".
   - Rule 13: append "Cheers are shown with each approval in the moment. A weekly quest completed by an approval lands after that approval's stickers."
   - Rule 14: append "The calendar shows rest days."
   - Rule 16: append "Deleting also removes the family's rewards and requests, and each child's quests, quest awards and rest days."
   - Add rules 17 to 24, each beginning "Assumed on 28 October 2026, to confirm:". They are the text of §4's D2/D3 (rule 17, Balance), D3/D4 (18, Rewards and requests), D5/D6 (19, Weekly quest), D7 (20, Cheers), D8 (21, Rest days), D9 (22, The chosen next task), D10 (23, Family leaderboard) and D11 (24, Streak reminder), rewritten in the sitemap's own plain style, together with §5.2's limits for that rule.
   - Also edit rule 3's "One point stays open" sentence: add "Rest days are one answer for a family that knows a day will be missed."

### 6.3 `prompt.md`

Write the G2 brief. It is section 7 of this document, preceded by:
> Load `ponytail:ponytail` first. Read sections 0 to 5 of `engagement-plan.md`. Build section 7 only. Stop at its Stop line and report in the format of section 11.

**Done when**
- Both documents read correctly.
- No other file changed (`git status` shows only the two documents, plus the ignored `prompt.md`).
- Every new sitemap rule says "Assumed on 28 October 2026, to confirm".

**Stop.** Report the list of assumptions for the user to confirm.

---

## 7. Phase G2: data and rules

**Goal.** Everything in §5 exists in `scoring.js`, `fake.js`, `index.js`, `errors.js`, `messages.js`, `utils/tasks.js` and `utils/format.js`, with checks. No page changes yet, except the small compatibility edits in step 9.

**Order of work**

1. **`scoring.js`.** Everything in §5.3. Update the file's header comment to say that rest days and quests are now inputs.
2. **`scoring.check.js`.** Change `STICKERS.length` to `14`. Add the assertions in the checks list below.
3. **`fake.js`.** Everything in §5.1, §5.2 and §5.4, in this order:
   1. constants (`KEY`, `CHEER_KINDS`) and `read()` defaults
   2. helpers
   3. `growthOf`
   4. `asTask`
   5. `sendProof` and `deleteTask` pin clearing
   6. `review` and `approveProof`
   7. `recordAwards`, `listStickers` and `getProgress`
   8. the new functions: rewards, requests (through `requestIn` and `answerIn`), quests, rest days, pin, leaderboard, settings
   9. `erase`
   10. demo data
   - Every new export follows the existing pattern: `export const x = (...) => answer((db) => { ... })`.
4. **`fake.check.js`.** Extend `family()` with the new collections (one reward and one request for `c1`, a quest, a quest award, rest days, and settings for `p1`), then add the assertions in the checks list.
5. **`index.js`.** §5.5: types, then exports. Update the header comment's description of Growth.
6. **`errors.js` and `utils/messages.js`.** `NOT_ENOUGH`.
7. **`utils/tasks.js`.** `nextTask = (tasks) => tasks.find((t) => t.pinned && isOpen(t)) ?? tasks.find((t) => t.status === 'sentBack') ?? tasks.find((t) => t.status === 'todo')`. Update its comment: the child's own choice comes first, then the existing rule.
8. **`utils/tasks.check.js`.** Add the pin assertions in the checks list.
9. **`utils/format.js`.** `DAY_SAID.rest = 'a rest day'`. Also check that `Landing.jsx` (`EXAMPLE_STICKERS`) and every page still build. Nothing imports `CHART` outside `fake.js`; confirm this with a grep for `CHART` in `client/src`.

**Checks to add** (each is one `assert` line, with a comment in the existing style)

`scoring.check.js`
- `streak([done(2), task({ due: 1 }), done(0)])` with rest = `[dayKey(at(1))]` gives `days === 2`, and `week[5].state === 'rest'`. A rest day saves the streak.
- The same tasks without rest give `days === 1` (the control).
- A rest day on which proof was approved shows `'done'`, not `'rest'`.
- `score(..., rest).streak` and `progress(..., rest).calendar` show the same `'rest'` marks.
- `STICKERS.every((s) => typeof s.measure === 'string' && s.need > 0)`.
- `stickers(run(1), { questAwards: [{ earnedAt: run(1)[0].proofs[0].review.at }] })` includes `quest-1`. Without quest awards, it doesn't.
- `recordOf(Array.from({ length: 7 }, () => done(40)), NOW).approved === 7`.
- `balanceOf(120, [{ bonus: 50 }], [{ cost: 50, status: 'given' }, { cost: 100, status: 'declined' }, { cost: 10, status: 'requested' }]) === 110`.
- `approvedInWeek` counts by the week the proof was sent: reuse `acrossTheBoundary`. It is in last week, not this one.
- `questOf(tasks, null, {}, NOW) === null`.
- `questOf` with `target: 2` over two tasks done this week gives `done === 2`, and `completed === false` until awarded.
- `questCompletedBy` returns this week's key on the approval that reaches the target, and `null` once that week has an award.
- `dayKey(new Date(2026, 9, 5)) === '2026-10-05'`.

`fake.check.js`
- `erase(db, ['p1', 'c1', 'c2'])` leaves no reward, request, quest, quest award, rest day or setting of theirs. Extend the existing JSON regular expression with their ids.
- `requestIn` over the balance throws `NOT_ENOUGH`, and nothing is pushed.
- `requestIn` within the balance pushes one request with status `requested`, and the shown balance drops by its cost.
- `answerIn(db, id, 'declined')` returns the points (the balance goes back up), and a second `answerIn` throws `REVIEWED`.
- `answerIn` by a parent of another family throws `NOT_FOUND`.

`utils/tasks.check.js`
- A pinned open task beats a sent-back one.
- A pinned approved task is ignored.

**Done when**
- In `client/`: `npm run lint` is clean, `npm run check` prints all three "… hold" lines, and `npm run build` succeeds.
- Searching `client/src/pages` and `client/src/components` for `fake.js`, `scoring.js`, `localStorage`, `sessionStorage` and `indexedDB` finds nothing.
- With the dev server running (`npm run dev`), signing in as `aarav` / `plants42` works and Today still plays the cycling approval once. Verify in a browser; existing screens must not regress.

**Stop.** Report, and mention that local demo data reset (D15).

---

## 8. Phase G3: child screens

**Goal.** The child sees the quest, the reminder, cheers, the growth path, next stickers, the leaderboard and the reward shop, and can choose the next task.

### 8.1 New `client/src/utils/cheers.js`

```js
import { BicepsFlexed, HandHeart, Heart, Lightbulb, Mountain, Sparkles } from 'lucide-react'

/** The six cheers a parent can add to an approval (DESIGN.md section 8). The server owns the kinds. */
export const CHEERS = {
  proud: { words: 'Proud of you', Icon: Heart },
  tidy: { words: 'Super tidy', Icon: Sparkles },
  brave: { words: 'That was brave', Icon: Mountain },
  clever: { words: 'Clever thinking', Icon: Lightbulb },
  kind: { words: 'So kind', Icon: HandHeart },
  effort: { words: 'Great effort', Icon: BicepsFlexed },
}
```

Before using them, confirm every icon exists by running this in `client/`:

`node -e "import('lucide-react').then(m => console.log(['Heart','Sparkles','Mountain','Lightbulb','HandHeart','BicepsFlexed','Gift','Flag','Pin','CircleMinus','Hourglass','CircleCheck'].filter(n => !m[n])))"`

It must print `[]`. If any name is missing, stop and report it.

### 8.2 `client/src/utils/stickers.js`

Add:

```js
/** What each measure counts, for "7 of 10 tasks approved". */
export const MEASURE_WORDS = {
  approved: 'tasks approved', streak: 'days in your best streak', level: 'levels',
  kinds: 'kinds of task', firstTry: 'tasks right first time', quests: 'weekly quests completed',
}
```

### 8.3 New `client/src/components/Cheer.jsx`

```jsx
/** A parent's cheer with an approval: the icon, the words, and their own line if they wrote one. */
export function Cheer({ cheer, className = '' }) { ... }
```

Render nothing when `cheer` is missing.

```html
<p class="flex items-start gap-2 {className}">
  <Icon class="mt-0.5 size-5 shrink-0" aria-hidden="true">
  <span class="min-w-0 break-words">
    <span class="font-semibold">{words}</span>   (only if kind)
    {line && (kind ? ' ' : '') + `“${line}”`}
  </span>
</p>
```

With no kind, use `MessageCircle` as the icon. Add it to the icon check in §8.1. The picker is added in G4, in the same file.

### 8.4 `client/src/components/Review.jsx`

- `Gain`: after the `<Stamp>`, add `{review.cheer && <Cheer cheer={review.cheer} className="type-small mt-1" />}`, where `review = task.proofs.at(-1).review`.
- `Stamp`: unchanged. It's also used on Landing.

### 8.5 `client/src/pages/ChildTask.jsx`

In `Outcome`, after `<Stamp review={proof.review} />` (around line 223), add `<Cheer cheer={proof.review.cheer} className="mt-2" />`.

### 8.6 `client/src/components/Task.jsx`

`TaskRow` gains an optional `action` prop:

```html
<li class="flex items-center border-b last:border-b-0">
  <Link class="task-row min-w-0 flex-1"> …unchanged… </Link>
  {action && <div class="shrink-0 pr-2 sm:pr-4">{action}</div>}
</li>
```

With no `action`, the output must look the same as before: check Overview and Tasks.

### 8.7 New `client/src/components/Quest.jsx`

`QuestBar({ quest })` renders nothing for `null`. Otherwise:

```html
<section aria-label="This week’s quest" class="mt-6">
  <p class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
    <span class="flex items-center gap-2 font-semibold"><Flag class="size-5 shrink-0" aria-hidden> This week’s quest</span>
    <span class="flex items-center gap-1">+<Points value={quest.bonus} /></span>
  </p>
  <div class="ruler quest-ruler mt-2" style={{ '--at': `${(quest.done / quest.target) * 100}%` }}>
    <progress value={quest.done} max={quest.target} aria-label="Tasks approved for this week’s quest" />
  </div>
  <p class="type-small mt-2">{status line}</p>
  {quest.sealed && <p class="type-small mt-1 flex items-center gap-1.5"><Gift class="size-4 shrink-0" aria-hidden> A surprise is sealed inside. It opens when the quest is complete.</p>}
  {quest.completed && quest.surprise && <p class="type-small mt-1 flex items-center gap-1.5 font-medium"><Gift …> Your surprise: {quest.surprise}</p>}
</section>
```

The status line:

| Case | Text |
|---|---|
| Completed | "Quest complete. A new one starts on Monday." |
| One left | "{done} of {target} tasks approved this week. 1 to go." |
| Otherwise | "{done} of {target} tasks approved this week. {target − done} to go." |

### 8.8 `client/src/index.css`

Add these to the rewards layer (`@layer components`, after `.day-missed`), using tokens only:

```css
.quest-ruler { height: 1rem; }
.day-rest { @apply border-2 border-navy-800 bg-white text-navy-800; }
.on-navy .day-rest { @apply border-navy-200 bg-navy-950 text-navy-200; }
/* The growth path: the levels ahead as a line of tiles, dashed until reached. */
.path-step { @apply relative flex items-start gap-4 pb-6; }
.path-step:last-child { padding-bottom: 0; }
.path-step::before { content: ""; position: absolute; left: calc(1.25rem - 1px); top: 2.5rem; bottom: 0; border-left: 2px dashed var(--color-navy-400); }
.path-step:last-child::before { content: none; }
.path-level { @apply type-game grid size-10 shrink-0 place-items-center rounded-tag border-2 border-dashed border-navy-400 text-navy-800; }
.path-here .path-level { @apply border-solid border-navy-800 bg-navy-800 text-white; }
```

Also update the `/* The streak's day marks … */` comment to mention rest days.

### 8.9 `client/src/pages/Today.jsx`

1. **The visit record.** `visit` gains `quests: []`. In the loader, after `theirs`:
   ```js
   const done = growth.questAwards.filter((a) => fresh.some((t) => t.id === a.taskId)).map((a) => ({ ...a, play }))
   ```
   Then `visit.current = { …, quests: [...seen.quests, ...done] }`.
2. **`Band`**, in order:
   1. `GrowthRuler`, then the gains list, then the stickers list (all unchanged)
   2. **Quest awards list:** the same markup and `land` logic as the stickers list. The delay is `calc(var(--duration-pause) + ${(moment.stickers.length + i) * 120}ms)`. Each `li` has a `Gift` icon tile in place of the sticker (`grid size-20 place-items-center rounded-card bg-white text-navy-800`, holding `<Gift class="size-10" aria-hidden>`). The text is "Quest complete" (`type-small muted`), then "+{bonus} points to spend" (`font-semibold`), then, when there is a surprise, "Your surprise: {surprise}" (`type-small`).
   3. `<QuestBar quest={growth.shown.quest} />`
   4. `<Streak>` (unchanged)
   5. `<Reminder>` (below)
3. **`Reminder({ tasks, streak })`**, defined in `Today.jsx`. It shows only when D11 holds:
   - `today = dayKey(api.now())`. Import `dayKey` from a client copy in `utils/format.js` (`export const dayKeyOf = …`, the same body as §5.3). Pages may not import `scoring.js`.
   - Due today: `tasks.some((t) => isOpen(t) && dayKeyOf(t.dueAt) === today)`.
   - Nothing sent today: `!tasks.some((t) => t.proofs.some((p) => dayKeyOf(p.sentAt) === today))`.
   - Not a rest day: `streak.week.at(-1).state !== 'rest'`.
   - Markup: `<p className="type-small mt-3 flex items-center gap-2 font-medium"><Flame className="size-4 shrink-0" aria-hidden="true" />{text}</p>`.
   - Text: if `streak.days > 0`, "A task is due today. Send proof for it to keep your {days}-day streak." (use "1-day" for 1); otherwise "A task is due today. Send proof for it to start a streak."
   - Use `growth.shown.streak`.
4. **The pin.**
   - The "Also to do" `Rows` gets a `pin` callback. Each `TaskRow` there gets:
     ```jsx
     action={<button type="button" className="btn btn-text type-small" onClick={() => pin(task.id)}><Pin className="size-4 shrink-0" aria-hidden="true" /><span aria-hidden="true">Do next</span><span className="sr-only">Do “{task.title}” next</span></button>}
     ```
   - `pin` is `async (id) => { try { loaded.set({ ...loaded.data, tasks: await api.pinTask(id) }) } catch (e) { setProblem(errorText(noticeExpiry(e))) } }`.
   - **Use `loaded.set`, never `reload`.** A reload remounts `Band` and replays the reward moment.
   - On failure, show `<Message tone="danger" alert className="mt-4">` above "Next up".
   - When `next.pinned`, show `<p className="type-small muted mt-3 flex items-center gap-2"><Pin className="size-4 shrink-0" aria-hidden="true" />You chose this one. <button type="button" className="btn btn-text type-small" onClick={() => pin(null)}>Let GrowKid choose</button></p>` inside the `TaskCard`, before the main button.
5. **Header comment.** Mention the quest, the reminder and the pin.

### 8.10 New `client/src/components/GrowthPath.jsx`

`GrowthPath({ level, xpForNext, stickers })` draws an `<ol className="path mt-4">` of 6 steps, for levels `level` to `level + 5`. Each step is `<li className={`path-step ${n === level ? 'path-here' : ''}`}>` holding:
- `<span className="path-level" aria-hidden="true">{n}</span>`
- the text:
  - First line, `font-semibold`: "Level {n}", or "Level {n}: you are here" for the current level.
  - Second line, `type-small muted`: "Starts at {((n − 1) * xpForNext).toLocaleString('en-IN')} XP".
  - If a sticker has `measure === 'level' && need === n`, show `<Sticker … slot={!earnedAndSeen} className="size-10" />` and its name.
- The current step is read out with `aria-current="step"`.

**`NextStickers({ stickers })`** lists up to 3 stickers that aren't earned and seen, have a `have`, and have `measure !== 'level'` (the path covers levels). They are sorted by `(need − have) / need`, smallest first. Each row has a `Sticker` slot (`size-12`), the name in `font-medium`, and "{have} of {need} {MEASURE_WORDS[measure]}" (`type-small muted`). Render nothing if the list is empty.

Put both in this one file and export both.

### 8.11 `client/src/pages/Growth.jsx`

- Load `Promise.all([api.getGrowth(), api.listTasks(), api.listStickers(), api.getLeaderboard()])`.
- After the existing `Message`:
  1. `<h2 className="type-display mt-6 text-navy-800 sm:mt-8">The road ahead</h2>` with `<GrowthPath level={shown.level} xpForNext={shown.xpForNext} stickers={stickers} />`
  2. If `NextStickers` has entries: `<h2 className="type-subheading mt-10">Next stickers</h2>`, then the list in a `rounded-card border bg-white` list, matching the history list.
  3. **Leaderboard**, when the array isn't null:
     - `<h2 className="type-subheading mt-10">This week in your family</h2>`
     - `<p className="type-small muted mt-1">Tasks approved since Monday. It starts again every Monday.</p>`
     - An `<ol>` in the same card-list style. Each row shows the position `{i + 1}` in `type-game`, the name, and "{tasks} task" or "{tasks} tasks". The row with `you` adds `font-semibold`, and "(you)" after the name.
  4. The existing "What you earned" heading and history.
- History gains quest awards that have been seen: `{ at: award.earnedAt, award }`. They render like a sticker row, with a `Gift` tile (`size-10`), "Weekly quest complete: +{bonus} points", and `type-small muted` "For the week starting {date}. {surprise ? `Surprise: ${surprise}.` : ''}". Format the date with `Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long' })`.
- The `Points` line becomes: `<Points value={shown.points} /> earned so far, from {n} tasks. <Points value={shown.balance} /> to spend.` with a link "Rewards" to `/child/rewards`.
- Update the header comment.

### 8.12 `client/src/pages/Stickers.jsx`

- `Details`: for an unearned sticker with `have`, add `<p className="type-small">{have} of {need} {MEASURE_WORDS[measure]}</p>` above "Not earned yet".
- Header comment: replace "Slots show what is possible and nothing more: no bar creeping towards one." with "Slots show what is possible, and the details say how far along each one is."

### 8.13 New `client/src/pages/Rewards.jsx` (child)

**Load.** `useLoad(() => Promise.all([api.getGrowth(), api.listRewards(), api.listRequests()]), [], { live: true })`. `balance = growth.shown.balance`.

**Layout, in order**
1. `<title>Rewards – GrowKid</title>` and `<h1>Rewards</h1>`.
2. `<p className="mt-2 flex flex-wrap items-center gap-x-2"><Points value={balance} /> to spend.</p>` and `<p className="type-small muted mt-1">Spending points never lowers your level.</p>`.
3. **Rewards list** (the `rounded-card border bg-white` list style).
   - Empty: `EmptyState` with title "No rewards yet" and "When a parent adds rewards, they show up here."
   - Each row: the title (`font-medium`, `break-words`), then `<Points value={cost} />`, then the action:
     - If `cost <= balance`: `<button className="btn btn-secondary">Ask for this</button>`.
     - Otherwise: `<p className="type-small muted">{cost − balance} more points to go</p>` and no button.
   - Tapping "Ask for this" turns that row into a confirm (no dialog): "Ask for {title}? It holds {cost} points until a parent answers." with `btn btn-primary` "Yes, ask" and `btn btn-text` "Cancel". Only one row confirms at a time.
   - On yes: `await api.requestReward(id)`, then `loaded.reload()` (there is no reward moment on this page, so reload is safe). Then `Message tone="success"`: "Asked. A parent will answer soon."
   - On `NOT_ENOUGH` or any failure: `Message tone="danger" alert` with `errorText`.
4. **"Your requests"** (`type-subheading mt-10`), only when there is at least one. Each row shows the title, `<Points value={cost} short />`, and a tag (`tag` + tone + icon + word):

   | Status | Tag | Icon | Word |
   |---|---|---|---|
   | `requested` | `tag-info` | `Hourglass` | "Waiting for a parent" |
   | `given` | `tag-success` | `CircleCheck` | "Given" |
   | `declined` | `tag-neutral` | `CircleMinus` | "Not this time" |

   Below that, `type-small muted`:
   - "Asked {whenText(requestedAt)}"
   - when answered: ". Answered by {answer.by}, {whenText(answer.at)}"
   - when declined: ". Your points came back."
   - if there is a note: a new line with the note in quotes.

5. **Loading and errors.** `PageLoading rows={3}` and `ErrorState`, as in `Stickers.jsx`.

### 8.14 `client/src/components/Shells.jsx` and `client/src/router.jsx`

- `CHILD_NAV`: append `{ to: '/child/rewards', label: 'Rewards', Icon: Gift }`. Change the child `nav-bar` from `grid-cols-3` to `grid-cols-4`.
- Router: add `{ path: 'rewards', element: <Rewards /> }` under `/child`. Update the "All 21 routes" comment to 22 (it reaches 23 in G4).

### 8.15 `client/src/components/Streak.jsx` and `client/src/pages/Progress.jsx`

- `Streak.jsx`: only the comment changes: "a rest day a parent set changes nothing and is never missed".
- `Progress.jsx` legend: add a fourth item, `<span className="day-mark day-rest size-5" aria-hidden="true" /> Rest day: set by you, never missed`.

**Done when**
- In `client/`: `npm run lint`, `npm run check` and `npm run build` all pass.
- The data boundary search from G2 is clean.
- The browser script G3 in §10 passes at 360 px and 1280 px, plus a keyboard-only pass (Tab through Today, Growth and Rewards; every control is reachable and its focus ring visible).
- `.playwright-mcp/` is deleted from the repo root.

**Stop.**

---

## 9. Phase G4: parent screens and public pages

**Goal.** Parents run rewards, quests, cheers, rest days and the leaderboard switch. The public pages tell the truth about the new features.

### 9.1 `client/src/components/Cheer.jsx`: add `CheerPicker`

`CheerPicker({ value, onChange, child })`, where `value` is `{ kind: string | null, line: string }`:

```html
<fieldset class="grid gap-3">
  <legend class="font-medium">Add a cheer <span class="muted font-normal">(optional)</span></legend>
  <div class="grid grid-cols-4 gap-2 sm:grid-cols-7">
    <label class="choice"><input type="radio" name="cheer" class="sr-only" checked={!value.kind} onChange={() => onChange({ ...value, kind: null })}>None</label>
    {Object.entries(CHEERS).map(([kind, { words, Icon }]) =>
      <label class="choice"><input type="radio" name="cheer" class="sr-only" checked={value.kind === kind} onChange={…}><Icon class="size-5" aria-hidden>{words}</label>)}
  </div>
  <Field label="A line from you (optional)" hint={`${child} sees it with the approval.`} maxLength={120} value={value.line} onChange={…} name="cheer-line" />
</fieldset>
```

Check how `TaskForm.jsx` hides the radio inside `.choice`, and use the same class (`sr-only` or whatever it uses).

### 9.2 `client/src/pages/TaskDetail.jsx`

- `TaskDetail` holds `const [cheer, setCheer] = useState({ kind: null, line: '' })`.
- When `task.status === 'review'`, render `<div className="lg:col-start-2"><CheerPicker value={cheer} onChange={setCheer} child={task.childName} /></div>` immediately **before** `<ReviewBar>`, as its own grid item. **Do not wrap `ReviewBar`**: it is `sticky` on phones, and a wrapper would break that.
- Change the grid class: when `proof && task.status === 'review'`, use `lg:grid-rows-[auto_auto_1fr]`, and give the proof section `lg:row-span-3`. Otherwise keep it as is.
- `ReviewBar` gets a `cheer` prop. `approve` calls `api.approveProof(task.id, proof.id, cheer.kind || cheer.line.trim() ? { kind: cheer.kind, line: cheer.line.trim() } : undefined)`.
- On `INVALID` with `fields.line`, show `Message tone="danger"`: "Keep the line to 120 characters."
- Where the approved stamp shows (around line 251), add `<Cheer cheer={review.cheer} className="mt-2" />`.
- Update the header comment.

### 9.3 New `client/src/pages/ParentRewards.jsx` (route `/parent/rewards`)

**Load.** `useLoad(() => Promise.all([api.listChildren(), api.listRewards(), api.listRequests(), api.listGrowth()]), [], { live: true })`. With no children, show `<AddChildFirst />` from `Task.jsx` under the heading.

**Layout, in order**
1. `<title>Rewards – GrowKid</title>` and `<h1>Rewards</h1>`. Then `<p className="muted mt-2">Your children spend points on these. Spending never lowers their level or the points they have earned.</p>`.
2. **Requests waiting** (`type-subheading mt-8`), with `status === 'requested'`, oldest first.
   - None waiting: `<p className="muted mt-1">No requests are waiting.</p>`.
   - Each row: "{childName} asked for {title}" (`font-medium`), `<Points value={cost} />`, and `type-small muted` "Asked {whenText(requestedAt)}. {childName} has {growth[childId].balance} points left after this."
   - Actions: `btn btn-approve` "Give", and `btn btn-secondary` "Decline". Decline opens, in place, `Field as="textarea" rows={2} maxLength={200}` labelled "A note for {childName} (optional)", with `btn btn-primary` "Decline" and `btn btn-text` "Cancel".
   - After an answer, `Message tone="success"` above the list:
     - Given: "Given. Tell {childName} when it is ready."
     - Declined: "Declined. {childName} got the {cost} points back."
     - Then `loaded.reload()`.
   - On `REVIEWED`: `Message`: "That request had already been answered. This is how it stands now." Then reload.
3. **Answered** (`type-subheading mt-10`): the 10 most recent answered requests. Each row has the tag from §8.13, "{childName}: {title}", and the answer line.
4. **Rewards** (`type-subheading mt-10`): rows of title, `Points`, and `btn btn-text` "Edit" and "Delete".
   - "Edit" turns the row into the reward form, filled in.
   - "Delete" turns it into an inline confirm: "Delete “{title}”? Requests already made keep it." with `btn btn-danger` "Delete" and `btn btn-text` "Keep it".
   - Empty: `EmptyState` with title "No rewards yet" and "Add a few things your children can choose, like picking the film on Friday."
   - **The reward form**, below the list, titled "Add a reward" or "Change the reward":
     - `Field` "What it is", hint "In words your child would use.", `maxLength={60}`
     - `Field type="number"` "Cost in points", `min=10 max=1000 step=10`, hint "10 to 1,000, in tens. A task is usually worth 20."
     - `btn btn-primary` "Add reward" / "Save reward"
   - Errors through `Field error`:
     - title: "Give the reward a name of 3 to 60 characters."
     - cost: "Choose 10 to 1,000 points, in tens."
     - `SCREENED`: "Rewards cannot use the word “{word}”."
5. **Weekly quests** (`type-subheading mt-10`): one `card` per child, titled with the child's name.
   - Shows the real quest from `growth[id].quest`: "{done} of {target} tasks this week, +{bonus} points", or "Complete this week." If there's a surprise: "Sealed surprise: {surprise}".
   - Or "No quest for {name} this week."
   - `btn btn-secondary` "Set a quest" or "Change the quest" opens an inline form:
     - `Field as="select"` "Tasks to approve this week", options 2 to 20, default 5
     - `Field type="number"` "Bonus points", `min=10 max=200 step=5`, default 50, hint "Points to spend. They do not add XP."
     - `Field` "Sealed surprise (optional)", `maxLength={80}`, hint "{name} sees that a surprise is waiting, but not what it is, until the quest is complete."
     - `btn btn-primary` "Save quest"; `btn btn-text` "Cancel"; when one exists, `btn btn-text text-coral-700` "Remove quest" (calls `setQuest(id, null)`)
   - Field errors: "Choose 2 to 20 tasks.", "Choose 10 to 200 points, in fives.", "Keep the surprise to 80 characters."; `SCREENED` as above.
   - After saving: `Message tone="success"` "Quest saved. {name} sees it on Today." Then reload.
6. **Saving buttons** use the busy pattern from `Settings.jsx`: `disabled` while busy, with the label changed to "Saving…".

### 9.4 `client/src/pages/Progress.jsx`: rest days

Add `RestDays({ child, onChange })`, inside the Streak section, after the legend, with class `print:hidden mt-6 border-t pt-4`.
- Loads `useLoad(() => api.listRestDays(child.id), [child.id])`.
- Heading `type-small font-semibold` "Rest days".
- `<p className="type-small muted">On a rest day nothing is missed, so {child.name}’s streak is safe. You can mark a day up to 7 days back.</p>`
- The list of days, each formatted with `Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })` from the key, with `btn btn-text type-small` "Remove".
- A form: `Field type="date"` "Mark a rest day", `min`/`max` from today − 7 and today + 90 (computed with `dayKeyOf`), and `btn btn-secondary` "Add rest day".
- Error: "Choose a day from a week ago up to three months ahead."
- After any change: the list updates from the returned array, and `onChange()` reloads the page's progress so the calendar shows the mark.

### 9.5 `client/src/pages/Overview.jsx`

- Add `api.countRequestsWaiting()` to the `Promise.all`.
- Under the proofs-waiting paragraph, when `requests > 0`, add `<p className="mt-2"><Link to="/parent/rewards" className="font-medium text-navy-800 underline underline-offset-4">{requests === 1 ? '1 reward request is waiting.' : `${requests} reward requests are waiting.`}</Link></p>`.

### 9.6 `client/src/pages/Settings.jsx`

Add a section after Password and before Delete, titled "Family leaderboard":
- Load `api.getSettings()` with the family (`Promise.all`).
- A checkbox using the `SignUp.jsx` markup (`label.flex.items-start.gap-3`, `input.mt-0.5.size-5.shrink-0`), labelled "Show a weekly leaderboard to my children".
- `type-small muted` text: "Each child sees their brothers’ and sisters’ first names and how many of their tasks were approved this week. Nothing else. It starts again every Monday, and it only appears with two or more children."
- It saves on change through `api.setLeaderboard(checked)`. While saving, the input is `disabled`. Then `Message tone="success" role="status"`: "Saved." On failure, put the box back and show `Message tone="danger" alert` with `errorText`.

### 9.7 `client/src/components/Shells.jsx` and `client/src/router.jsx`

- `PARENT_NAV`: insert `{ to: '/parent/rewards', label: 'Rewards', Icon: Gift }` after Tasks. Change the parent `nav-bar` from `grid-cols-4` to `grid-cols-5`.
- `NavItems({ items, counts })`: `const count = counts?.find((c) => c.to === to)`. Update the JSDoc.
- `ParentShell`:
  ```js
  counts = [
    { to: '/parent', ...useCount(api.countProofsWaiting), what: 'waiting for review' },
    { to: '/parent/rewards', ...useCount(api.countRequestsWaiting), what: 'reward requests waiting' },
  ]
  ```
  `ChildShell` passes `counts={[count]}`.
- Router: `{ path: 'rewards', element: <ParentRewards /> }` under `/parent`. The comment becomes "All 23 routes".
- **360 px check:** five items must fit with no label wrapping onto three lines, and every target must be at least 44 px. If they don't fit, stop and report. Don't shrink the type.

### 9.8 `client/src/pages/Privacy.jsx`

1. In `child-title`, append to the first paragraph: "The one thing a child does not see straight away is a sealed surprise a parent puts in a weekly quest. It is about a reward, not about the child, and it opens when the quest is complete."
2. Add a new `Part id="rewards-title" title="Rewards, quests and the family leaderboard"` after `child-title`:
   > A parent can add rewards, like choosing the film on Friday, and set a weekly quest. A child spends points on rewards; the parent sees every request and answers it. A parent can also mark rest days, which keep a streak safe.
   >
   > If a parent turns on the family leaderboard, each child sees their brothers’ and sisters’ first names and how many tasks were approved for each of them this week. Nothing else: not their tasks, proof, points or level. Nobody outside the family is ever on it, and it is off unless a parent turns it on.

### 9.9 `client/src/pages/Landing.jsx`

1. Line 22 comment: "3 of 11" becomes "3 of 14", "Eleven to collect" becomes "Fourteen to collect", and "asserts there are 11" becomes "asserts there are 14".
2. Line 45: `aria-label="Stickers: 3 of 14 earned"`.
3. `FOR_CHILDREN`:
   - The streak item becomes `['A streak', 'Send proof on the days a task is due, and your streak grows. Today reminds you once, and never anywhere else.']`.
   - The stickers item becomes `['Stickers', 'Fourteen to collect. You earn each one once, and you keep it for good.']`.
   - Append `['Rewards and quests', 'Spend points on rewards your parent sets, and finish a weekly quest for bonus points.']`.
4. `FOR_PARENTS`: append `['Rewards and quests', 'Add rewards your children can spend points on, set a weekly quest, and cheer them on when you approve.']`.

### 9.10 `Documentation/DESIGN.md` §18 "What the code has today"

- In the first paragraph, add one sentence on the engagement layer.
- In the file table, add rows for `components/Cheer.jsx`, `components/Quest.jsx`, `components/GrowthPath.jsx`, `utils/cheers.js`, `pages/Rewards.jsx` and `pages/ParentRewards.jsx`.
- Add the new CSS classes to the `index.css` row: `quest-ruler`, `day-rest`, `path-step`, `path-here`, `path-level`.
- The page count goes from 19 to 21.

**Done when**
- Lint, check and build all pass.
- The data boundary search is clean.
- The browser script G4 in §10 passes at 360 px and 1280 px, plus a keyboard-only pass through Rewards, Task detail with a cheer, Progress rest days and Settings.
- `.playwright-mcp/` is removed.
- Then run `/code-review` and `/ponytail-review` on the whole G2 to G4 diff, and fix the findings or report each one with its reason.

**Stop.**

---

## 10. Browser scripts

Run in a real browser (Playwright MCP) against `npm run dev`. Start from fresh demo data: clear site data, or use a new profile. Use `?clock=<days>` to move the clock.

**G3**, as `aarav` / `plants42`:
1. **Today.** The reward moment plays once. The cycling gain row shows "Great effort" and “Twenty minutes there and back is quick. Well done.” Reloading doesn't replay it.
2. **The quest bar.** It shows "This week’s quest", "+50 points", a ruler, "… 2 to go." and the sealed-surprise line.
3. **The reminder.** "Read 20 pages" is due tomorrow, so there is no reminder today. With `?clock=1` the reminder shows the streak sentence. Return to `?clock=0`.
4. **The pin.** "Do next" on an "Also to do" row makes that task Next up, with "You chose this one." The band doesn't replay. "Let GrowKid choose" undoes it.
5. **Growth.** The path shows the current level and five ahead. The level sticker tiles are where they should be. "Next stickers" shows "… of 10 tasks approved". There is no leaderboard yet.
6. **Rewards.**
   - "70 points to spend".
   - The 50-point reward has "Ask for this".
   - The 100-point reward shows "30 more points to go".
   - The 300-point reward shows "230 more points to go".
   - Ask for the 50-point one, then confirm. The balance becomes 20, and "Waiting for a parent" appears.
   - The earlier given request shows "Given".
7. **The bottom bar** shows four items at 360 px. Rewards is marked as the current page.
8. **Keyboard.** Every new control is reachable with Tab, with a visible focus ring.

**G4**, as `meera@example.com` / `growkid-demo`:
0. **Setup.** Sign in as Aarav, watch the reward moment, and ask for the 50-point reward (as in G3 step 6). Sign out.
1. **The navigation** shows five items, and Rewards shows the count `1`.
2. **Requests.** Decline Aarav's request with the note "Let’s do this on Sunday instead." The message names the 50 points returned. Sign in as Aarav: "Not this time", the note, and "Your points came back." The balance is back. Sign back in as the parent.
3. **Rewards.** Add "Extra bedtime story" for 40. It appears in the list. Edit it to 30. Delete it with the inline confirm.
4. **Quests.** Change Diya's quest: none exists, so set target 3, bonus 30, surprise "Pancakes on Sunday". As Diya, Today shows the bar and the sealed line, but not the pancake text.
5. **Cheers.** On Diya's "Tidy the study desk", sign in as Diya and send a note as proof, then return as the parent. Approve with "Super tidy" and the line "Every pencil in its place." As Diya, the reward moment shows the cheer; Task detail shows it under the stamp.
6. **Rest days.**
   - Open Progress for Aarav with `?clock=2`. "Read 20 pages" was due yesterday and no proof was sent that day, so yesterday shows as missed and the streak is 0.
   - Mark yesterday as a rest day. The calendar shows the rest mark, and the streak number recovers.
   - Removing it breaks the streak again. Return to `?clock=0`.
7. **The leaderboard.** In Settings, turn it on ("Saved."). As Aarav, Growth shows "This week in your family", with Aarav and Diya and "(you)" marked. Turn it off; the section is gone.
8. **Public pages.** Privacy shows the new section. Landing shows "Fourteen to collect" and the new items.
9. **The 360 px parent bar.** Five items, readable, with no horizontal scroll.

---

## 11. Report format (end of every phase)

```
Phase G<n> report
Changed:  file:line-range – one line on what
Checks:   npm run lint → <result>; npm run check → <the three lines>; npm run build → <result>
Boundary: <grep command> → <result>
Browser:  <each script step> → pass / fail, with what was seen
Assumptions made: <each one, also written into sitemap §12 if it is a rule>
Open questions: <anything this document did not settle>
Not done: <anything skipped, and why>
```

A claim without the output that shows it isn't a pass.

---

## 12. Edge cases a builder must handle

| Case | Expected |
|---|---|
| A child asks for two rewards quickly, from two tabs | The second gets `NOT_ENOUGH` if the first used up the balance; `requestIn` re-reads the balance inside one `answer()` |
| A parent deletes a reward that has a waiting request | The request stays and can still be answered; its title and cost are copies |
| A parent edits a quest mid-week after it was completed | The award stays as it was; `completed` stays true for that week |
| A proof sent Sunday is approved on Monday and reaches last week's target | Last week's quest completes (dated now) and plays in this approval's moment; this week's bar is unaffected |
| A child's pinned task is deleted, or proof is sent for it | The pin clears; `nextTask` falls back to the existing rule |
| A rest day is set on a day the child got a task approved | It shows `done`; rest only matters when a day would otherwise be missed |
| Only one child, with the leaderboard on | `getLeaderboard` returns null; no section is shown |
| Reduced motion is on | Quest awards appear without `land` (the existing `.land` keyframes are already empty under reduced motion; confirm it, and if not, gate the class as `GrowthRuler`'s `ms()` does) |
| A family is deleted | `erase` removes every new collection (asserted in `fake.check.js`) |
| A parent approves with an empty line and no kind | No `cheer` is stored |

---

## 13. File change index

| File | G1 | G2 | G3 | G4 |
|---|---|---|---|---|
| `Documentation/DESIGN.md` | ✔ | | | §18 |
| `Documentation/FRONTEND-SITEMAP.md` | ✔ | | | |
| `prompt.md` (git-ignored) | ✔ | | ✔ | ✔ |
| `client/src/api/scoring.js`, `scoring.check.js` | | ✔ | | |
| `client/src/api/fake.js`, `fake.check.js` | | ✔ | | |
| `client/src/api/index.js`, `errors.js` | | ✔ | | |
| `client/src/utils/tasks.js`, `tasks.check.js`, `format.js`, `messages.js` | | ✔ | `format.js` `dayKeyOf` | |
| `client/src/utils/cheers.js`, `stickers.js` | | | ✔ | |
| `client/src/components/Cheer.jsx` (new) | | | display | picker |
| `client/src/components/Quest.jsx`, `GrowthPath.jsx` (new) | | | ✔ | |
| `client/src/components/Review.jsx`, `Task.jsx`, `Streak.jsx` | | | ✔ | |
| `client/src/components/Shells.jsx`, `client/src/router.jsx` | | | child | parent |
| `client/src/index.css` | | | ✔ | |
| `client/src/pages/Today.jsx`, `Growth.jsx`, `Stickers.jsx`, `ChildTask.jsx`, `Rewards.jsx` (new) | | | ✔ | |
| `client/src/pages/Progress.jsx` | | | legend | rest days |
| `client/src/pages/TaskDetail.jsx`, `Overview.jsx`, `Settings.jsx`, `ParentRewards.jsx` (new) | | | | ✔ |
| `client/src/pages/Privacy.jsx`, `Landing.jsx` | | | | ✔ |
