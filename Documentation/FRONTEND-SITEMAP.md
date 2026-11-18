# GrowKid frontend sitemap

**Status: final.** This is the frontend architecture to build from: which pages exist, their routes, how they connect and what is deliberately not a page. It replaces the earlier proposal of 27 pages on 29 routes (two of those pages optional) with **21 pages on 23 routes**. Product facts come from the project synopsis; look and behaviour come from `DESIGN.md`.

**Where the frontend stands today.** All eleven steps of the implementation order (section 13) are built, so the frontend is complete: all 21 routes with their access rules and redirects, the four shells, the shared states, Sign in, Sign up, Family and the Child form, tasks on both sides with sending proof, review with Approve and Send back, Overview, the rewards (the reward moment on Today, the streak, Growth and Stickers), Progress with its printed report, Settings with deleting the family's data, Report a problem, the moderator's Reports, and the two public pages, Landing and Safety and privacy. All nineteen pages exist. A task can be To do, Due soon (due within 24 hours, since final plan Phase 7), Overdue, In review, Sent back or Approved. The message after deleting a family's data is shown once, on Landing. Decisions D1 to D3 and the working assumptions marked accepted in section 12 are built on. The server is built (`server/`, backend phases B0 to B4): the client calls the functions in `client/src/api/`, which make one HTTP call each to it, and the records live in PostgreSQL and the proof files on the server's disk. The award and progress rules are `server/src/scoring.js`; the server's tests (`npm test` in `server/`) run them, and check what deleting a family removes and keeps, and what a moderator is handed. Sign up asks for the family's country and Settings changes it (rule 25). Phase 2G fixes now done: sending proof marks the earlier result as seen (rule 4) and the moderator is told when a kept report's sender is gone (rule 15), both in the server; and, in the pages, Landing and Safety and privacy have a Lexend headline, the public header's side padding is equal on both sides, and Safety and privacy has the section "What a task may not ask for". React Router 7, Zustand and Axios are in use.

---

## 1. Decisions this architecture rests on

Three questions were open in the proposal. They are settled here by recommendation. Each one changes pages, so a different answer means revisiting this document before building.

| # | Decision | Why | What was rejected |
|---|---|---|---|
| D1 | **The parent creates each child's account** and sets a username and password. The child signs in on the same sign-in page. | No child can start an account alone. No child email is needed. Two ordinary sign-ins are the simplest thing to build and the clearest way to demonstrate role-based access. | Invitations and join codes: three more pages, and a child could begin without a parent. A single family account with a "switch to child" picker: it suits a shared phone, but needs a token exchange and a parent re-check to leave child mode. |
| D2 | **No email service in this version.** | The synopsis stack has none. | Email verification, and emailed password reset. The cost: a parent who forgets their password cannot recover the account. A child's password is reset by the parent. If email is added later, two pages return: Forgot password and Reset password. |
| D3 | **Reports go to one moderator page, built last.** | The synopsis names an Admin / Safety module with reporting and moderation. A Report button with nobody behind it would be a safety feature that does nothing. | A full admin area: user management, dashboards, statistics. Also rejected: no receiver at all. |

## 2. Final page inventory

| Area | Pages | Count |
|---|---|---|
| Public | Landing; Safety and privacy | 2 |
| Authentication | Sign in; Sign up; Set a new password | 3 |
| Parent | Overview; Tasks; Task form (create and edit); Task detail (with proof review); Rewards (parent); Progress; Family; Child form (add and edit); Settings | 9 |
| Child | Today; Task detail (with sending proof); Growth; Stickers; Rewards (child) | 5 |
| Shared | Report a problem | 1 |
| System | Not found | 1 |
| Moderator (D3) | Reports | 1 |
| | **Total** | **22** |

Build cost of each page:

| Cost | Pages |
|---|---|
| High | Parent Task detail; Progress; Today; Child Task detail; Rewards (parent) |
| Medium | Landing; Overview; Tasks; Task form; Growth; Reports; Rewards (child) |
| Low | Safety and privacy; Sign in; Sign up; Set a new password; Family; Child form; Settings; Stickers; Report a problem; Not found |

## 3. Route map

| Route | Page | Role | Purpose |
|---|---|---|---|
| `/` | Landing | Public | What GrowKid is, who it is for, how it works; leads to sign in and sign up |
| `/privacy` | Safety and privacy | Public | How children are kept safe, who can see what, what is stored and how to delete it |
| `/login` | Sign in | Public | One sign-in page for parent, child and moderator |
| `/signup` | Sign up | Public | A parent creates the family's account |
| `/forgot` | Set a new password | Public | A parent sets a new password with their email and their recovery code |
| `/parent` | Overview | Parent | Proofs waiting for review first, then the week's tasks and each child's progress in a line |
| `/parent/tasks` | Tasks | Parent | Every task, filtered by child and status |
| `/parent/tasks/new` | Task form | Parent | Create a task and assign it to a child |
| `/parent/tasks/:taskId` | Task detail | Parent | One task: details, status, every proof and note. Approve or send back happens here. |
| `/parent/tasks/:taskId/edit` | Task form | Parent | Edit a task (the same form as create) |
| `/parent/rewards` | Rewards | Parent | Requests waiting first, then the rewards, then each child's weekly quest |
| `/parent/progress/:childId` | Progress | Parent | A child's level, streak, weekly completion and stickers; download the PDF report |
| `/parent/family` | Family | Parent | The children in the family |
| `/parent/family/new` | Child form | Parent | Add a child and set their sign-in details |
| `/parent/family/:childId` | Child form | Parent | Rename a child, reset their password, remove them |
| `/parent/settings` | Settings | Parent | Name, country, password, delete the family's data |
| `/child` | Today | Child | The next task, the growth band, other tasks, results of reviews |
| `/child/tasks/:taskId` | Task detail | Child | What to do, when, what it is worth. Sending proof happens here. |
| `/child/growth` | Growth | Child | Level, XP, points, streak and the history of what was earned |
| `/child/stickers` | Stickers | Child | The sticker chart: earned stickers and empty slots |
| `/child/rewards` | Rewards | Child | Points to spend, the rewards, and the child's requests with their answers |
| `/report` | Report a problem | Any signed-in user | Report a task, a note or anything that feels wrong |
| `/admin/reports` | Reports | Moderator | Reports waiting; open one to see the item and mark it resolved |
| `*` | Not found | Anyone | Any address that does not exist or is not the user's to see |

Access:

- **Public:** `/`, `/privacy`, `/login`, `/signup`, `/forgot`.
- **Any signed-in user:** `/report`. A moderator who opens it is sent to Reports: reports come to them.
- **Parent only:** everything under `/parent`. **Child only:** everything under `/child`. **Moderator only:** `/admin/reports`.

Redirects: a signed-in user who opens `/`, `/login`, `/signup` or `/forgot` goes to their own home. `/parent/progress` goes to the first child's progress. Signing out goes to `/login`, not the landing page, because on a shared device the next thing that happens is usually the other person signing in.

```
Landing ──► Safety and privacy
├─ Sign up ─────────────────┐
└─ Sign in ──┬─ parent ─────┴──► Overview
             ├─ child ─────────► Today
             └─ moderator ─────► Reports

Overview (/parent)
├─ a proof waiting ──► Task detail (review) ──► back to Overview
├─ Tasks ──┬──► Task form (create) ──► Tasks
│          └──► Task detail ──► Task form (edit)
├─ Rewards ──► answer requests, set rewards and weekly quests
├─ Progress ──► Download report, rest days
├─ Family ──► Child form (add or edit)
└─ account menu ──► Settings, Report a problem, Sign out

Today (/child)
├─ Task detail (send proof here)
├─ Growth
├─ Stickers
├─ Rewards ──► ask for a reward
└─ account menu ──► What parents can see, Report a problem, Sign out
```

## 4. Route audit

Every route in the proposal, reviewed against three questions: is it necessary, does it need to be a route, and can one developer build and maintain it in a semester.

| Route | Current purpose | Final classification | Decision | Reason | Dependencies |
|---|---|---|---|---|---|
| `/` | Landing page | REQUIRED | Keep | The only entry for someone not signed in. Carries how it works, safety in brief and a few questions. | None |
| `/safety` | How children are kept safe | MERGE | Into `/privacy`, as one page called Safety and privacy | Two static pages covered the same ground (who sees what). One page answers both parent questions and gives sign-up one link. | None |
| `/privacy` | Privacy policy | REQUIRED | Keep, widened to Safety and privacy | The app stores children's names and photos; sign-up links here. | Storage provider named; font hosting decided |
| `/terms` | Rules of use | REMOVE | Drop | Not needed for the product to work or be shown. An "optional" page invites a placeholder. Rules on what a task may ask for go on Safety and privacy. | None |
| `/accessibility` | Accessibility statement | REMOVE | Drop | A statement is only honest after the keyboard and screen-reader checks are done, and they are not. The requirements stay in `DESIGN.md`. | None |
| `/login` | Sign in | REQUIRED | Keep | | Sign-in endpoint; D1 (username for a child) |
| `/signup` | Parent sign-up | REQUIRED | Keep | | Sign-up endpoint; D2 (no verification step) |
| `/parent` | Overview | REQUIRED | Keep; it is now also the review queue | It already led with proofs waiting. | Tasks waiting, week's tasks and a per-child summary |
| `/parent/tasks` | All tasks | REQUIRED | Keep | The full record once there is more than a week of tasks. Filtering by "In review" gives the same list as the old queue. | Task list with filters |
| `/parent/tasks/new` | Create task | REQUIRED | Keep | | Create task; at least one child exists; content screening rule |
| `/parent/tasks/:taskId` | Task detail | REQUIRED | Keep; proof review moves here | The proof, the notes and the decision belong with the task's history. | Task with its proofs and notes; approve and send back; scoring on approval |
| `/parent/tasks/:taskId/edit` | Edit task | REQUIRED | Keep the route; it is the same page as create | Fixing a title or moving a deadline is basic. It costs no extra page. | Update task; the editing rule (section 12) |
| `/parent/review` | Review queue | MERGE | Into `/parent` | It repeated the first section of Overview, so the same list existed twice. | |
| `/parent/review/:taskId` | Review a proof | MERGE | Into `/parent/tasks/:taskId` | One task had three parent screens. Merging also removes the split-screen review layout, the most expensive parent screen. | |
| `/parent/progress/:childId` | Child's progress | REQUIRED | Keep | The synopsis asks for progress visualisations and a report export. Reading progress and managing an account are different jobs, so it is not merged with the child form. | Progress summary; scoring rules; PDF export |
| `/parent/family` | Children | REQUIRED | Keep | | Children list |
| `/parent/family/new` | Add child | REQUIRED | Keep | The family cannot work without a child account (D1). | Create child |
| `/parent/family/:childId` | Edit child | REQUIRED | Keep; the same form as add | The only way to reset a child's password (D2). | Update child; reset password; delete child and their data |
| `/parent/settings` | Parent's account | REQUIRED | Keep, cut down to name, password and deleting the family's data | No notification or preference settings: the backend has nothing behind them. | Update name; change password; delete family |
| `/child` | Today | REQUIRED | Keep | | Child's tasks; results not yet seen; progress summary |
| `/child/tasks/:taskId` | Task detail | REQUIRED | Keep; sending proof moves here | | Task; proof upload; file limits |
| `/child/tasks/:taskId/proof` | Send proof | COMPONENT / STATE | A section of the child's Task detail | On a phone the camera or file chooser is already its own screen. The preview, note and Send button fit on the task page. A route added a back-button problem mid-upload and no screen the child needs. | |
| `/child/growth` | Growth | REQUIRED | Keep | | Progress and history; scoring rules |
| `/child/stickers` | Stickers | REQUIRED | Keep | Low cost, and it is the sticker chart the whole design is named after. Merged into Growth it would make one very long phone screen. | Sticker list; badge rules |
| `/child/account` | Me | COMPONENT / STATE | The account menu in the child's shell | It held three links and nothing the child could change. Both shells need an account menu anyway. | |
| `/report` | Report a problem | REQUIRED | Keep | The synopsis promises reporting. A form plus a confirmation that deserves a full screen is a page, not a sheet. | Create report; D3 |
| `*` | Not found | REQUIRED | Keep | | None |
| `/admin/reports` | Reports queue | DEPENDS | Keep, as the only moderator page (D3) | | Moderator role; list and resolve reports |
| `/admin/reports/:reportId` | Report detail | MERGE | Into `/admin/reports`; a report opens in place | The volume will be tiny. A second page added routing and states for nothing. | |

## 5. Journey audit

Each step of both journeys, walked against the final routes.

**Parent**

| Step | Where it happens | Finding |
|---|---|---|
| Landing | `/` | |
| Sign up, account creation | `/signup` | On success the parent is signed in. No success page. |
| Initial setup | Overview, first run | Not a flow. Overview says "Add a child". |
| Family creation | Nothing to do | The family is created with the account. There is no family name to fill in. |
| Add child | `/parent/family/new` | **Gap closed:** after saving, Family shows the child's sign-in details once and offers "Create the first task", so the next step is on screen. |
| Parent dashboard | `/parent` | |
| Create task, assign task | `/parent/tasks/new` | Assigning is a field on the form. With one child it is already chosen. **Gap closed:** with no children, Create task leads to "Add a child first". |
| View task | `/parent/tasks/:taskId` | |
| Wait for completion | Overview, Tasks | **Known limit:** there is no signal while the parent is away. Notifications are future scope in the synopsis. |
| Receive proof | Overview | The first section, with a count on the Overview item in the navigation. |
| Review proof, approve or send back | `/parent/tasks/:taskId` | Sending back needs a note. Afterwards the parent returns to Overview, where the next proof waiting is at the top. |
| Reward and progress update | The confirmation, then Task detail | **Gap closed:** the confirmation names what was awarded, and Task detail keeps it beside the approval stamp. |
| Review child progress | `/parent/progress/:childId` | |
| Answer requests, set rewards and quests | `/parent/rewards` | Requests waiting come first, with a count on the Rewards item in the navigation. |
| Manage family | `/parent/family`, Child form | |
| Manage account | `/parent/settings` | |
| Log out | Account menu, in the shell | One tap, from every parent page. Lands on Sign in. |

**Child**

| Step | Where it happens | Finding |
|---|---|---|
| Gets sign-in details | Outside the app, from the parent | |
| Sign in | `/login` | **Gap closed:** the page tells a child who forgot their password to ask their parent. |
| First visit | Today, first run | Says there is nothing to do yet. |
| Sees and opens a task | `/child`, then `/child/tasks/:taskId` | |
| Does the task | Away from the screen | There is no "start" button and no in-progress status. Nothing needs one. |
| Sends proof | `/child/tasks/:taskId` | Choose, preview, add a note, send. |
| Waits | Today, Task detail | The task shows "In review" and says nothing is awarded yet. |
| Gets the result | Today, on the next visit | Approved: the reward moment and what was earned. Sent back: the parent's note and "Try again". **Dependency:** the server must record which results the child has already seen. |
| Several results at once | Today | One reward moment that sums them up, not one per task. |
| Sees progress | `/child/growth`, `/child/stickers` | |
| Spends points | `/child/rewards` | Asking holds the points until a parent answers. |
| Is uneasy about a task | Task detail, then `/report` | The report arrives already linked to that task. |
| Sign out | Account menu, in the shell | Lands on Sign in. |

## 6. Parent information architecture

The parent side is the quiet volume: lists and tables, colour only in status, and reviewing proof as the most frequent job.

Navigation, in this order: **Overview, Tasks, Rewards, Progress, Family.** A sidebar on desktop and a bottom bar on phones. Overview carries the count of proofs waiting and Rewards the count of requests waiting. The account menu holds Settings, Report a problem and Sign out.

| Page | Leads with | Also holds |
|---|---|---|
| Overview | Proofs waiting for review, oldest first | The week's tasks by child; one line of progress per child |
| Tasks | The task list | Filters for child and status; Create task |
| Task form | The fields in order: child, title, what to do, due, points | A preview of the child's task card on desktop |
| Task detail | The task and its status. When proof is waiting: the proof, shown large, with Approve and Send back. | Every earlier proof and note; the approval stamp and what was awarded; Edit and Delete |
| Rewards | Requests waiting | The rewards; each child's weekly quest |
| Progress | The child's level and growth ruler | Weekly completion chart, streak calendar with the rest days (set in the Streak section), stickers, Download report |
| Family | The children | Add a child |
| Child form | Name and sign-in details | Reset password; Remove child |
| Settings | Name | Change password; delete the family's data |

With more than one child, Progress has a child switcher, and Overview and Tasks group or filter by child.

## 7. Child information architecture

The child side is the louder volume: one job per screen, the navy growth band, and the next task first.

Navigation: **Today, Growth, Stickers, Rewards.** A bottom bar on phones and a top bar on desktop. The account menu holds What parents can see, Report a problem and Sign out. The child has no settings: the parent manages the account.

| Page | Leads with | Also holds |
|---|---|---|
| Today | The one next task, with its main button | The growth band (level, ruler, streak); other tasks to do; tasks in review; results since the last visit; this week's quest; the streak reminder; choosing the next task |
| Task detail | What to do, and the Send proof button | Due time, points, status; the parent's note if it was sent back; the proof already sent; the approval stamp |
| Growth | The growth ruler | Points, streak with the week's day marks, best streak, the list of what was earned and why, the growth path, the next stickers, and the family leaderboard when a parent turns it on |
| Stickers | The sticker chart | Opening a sticker shows its name, how it was earned and when |
| Rewards | Points to spend | The rewards, and the child's requests with their answers |

The reward moment plays on Today when a result has arrived. It is a state of that page.

## 8. Public information architecture

Two public pages. The landing page carries what would otherwise be separate How it works, About and FAQ pages.

| A first-time visitor asks | Answered on |
|---|---|
| What is GrowKid? Who is it for? | Landing, first screen |
| How does it work? | Landing: the loop of assign, do, prove, approve, grow |
| Why should a parent trust it? | Landing in brief, then Safety and privacy |
| What happens to my child's data? | Safety and privacy, linked from Landing and Sign up |
| How does safety work? | Safety and privacy |

- **Landing**, in order: what it is and who it is for; how it works; what the parent sees and what the child sees; safety in brief; a few questions; who built it. Its two actions are Sign up and Sign in.
- **Safety and privacy**, in order: children cannot sign up alone; no public profiles, no chat, no contact with strangers; what parents can see, written so a child can read it; what a task may not ask for; how to report and a child helpline number; what is stored, where, who can see it and how to delete it.
- The footer links to Safety and privacy, Sign in and Create a parent account. As built, the footer has no contact email address, because none exists yet, and Landing has the five parts of the Phase 2F brief (the opening, how it works, parents and children, safety, the close) without the "few questions" and "who built it". There is no contact form.

No cookie policy is needed: the app sets no advertising or analytics cookies, and one sentence on Safety and privacy covers the session token. The fonts are hosted with the app (rule 28), so no page asks another company's server for anything. This is a product judgement, not legal advice.

## 9. Flows

**Authentication**

```
Landing
├─ Sign up (parent only: name, email, password, country, confirms they are the parent or guardian)
│     └─► signed in ──► Overview, first run
└─ Sign in (email or username, and password)
      ├─ parent ──► Overview        ├─ child ──► Today        ├─ moderator ──► Reports
      └─ wrong details ──► message on the same page

Session expires ──► Sign in, with a message ──► back to the page the user was on
A page for another role ──► the user's own home
```

**Family**

```
Sign up ──► Overview (first run) ──► Child form (add): name, username, password
                └─► Family: the child's sign-in details, shown once, and "Create the first task"
                        └─► the child signs in ──► Today
```

Removing a child deletes their tasks, proofs and progress, so it asks for confirmation in a dialog. There is one parent account per family.

**Task lifecycle**

```
Parent: Task form ──► To do
Child:  Today ──► Task detail ──► sends proof ──► In review
Parent: Task detail ──┬─► Approved ──► points and XP awarded; stickers and level checked
                      └─► Sent back, with a note
Child:  Today shows the note ──► Task detail ──► sends proof again ──► In review
```

| Status | Set by | Parent sees it on | Child sees it on |
|---|---|---|---|
| To do | Creating the task | Tasks, Task detail | Today, Task detail |
| Due soon | Time (shown, not stored) | Overview, Tasks | Today, Task detail |
| Overdue | Time (shown, not stored) | Overview, Tasks | Today, Task detail |
| In review | The child sending proof | Overview, Tasks | Today, Task detail |
| Sent back | The parent, with a note | Tasks, Task detail | Today, Task detail |
| Approved | The parent | Tasks, Task detail, Progress | Growth, Task detail |

**Proof and verification**

```
Child: Task detail                              Parent: Overview (count goes up)
  choose photo, file, video or note                  │
  preview, add a note                                ▼
  upload, with progress ───────────────────►    Task detail
  the task now shows "In review";                    ├─ Approve ────────────► Overview
  nothing is awarded yet                             └─ Send back, with note ► Overview
        ▲                                            │
        └─────────── result on Today ◄───────────────┘
```

Every attempt is kept: Task detail shows each proof and note in order, to both parent and child. A failed upload keeps the chosen file and offers Try again.

**Rewards**

```
Child:  Rewards ──► asks for a reward ──► points held ──► Waiting for a parent
Parent: Rewards (count goes up) ──┬─► Give ──► Given
                                  └─► Decline, note optional ──► Not this time; the points come back
```

**Safety and reporting**

```
Account menu or Task detail ──► Report a problem: what is wrong, details
        └─► sent ──► confirmation on the same page: what happens next, and a helpline number
                └─► Moderator: Reports ──► open the report ──► mark resolved, with a note
```

- A report is visible to the person who made it and to the moderator. A parent is not shown a report their child made.
- The moderator sees only the item that was reported, never the rest of the family's content.
- Content screening happens when a task is saved or a file is uploaded, and reaches the user as an ordinary validation error.
- The helpline should be a real child helpline for India, such as Childline 1098. Confirm the current official number before it is published.

## 10. States

Only Not found is a route. Everything else is a state of a page or of the shell.

| Situation | What the user sees |
|---|---|
| Address does not exist | Not found |
| Another family's task or child | Not found, so nothing is revealed |
| Page for another role | Redirect to their own home |
| Not signed in, or session expired | Sign in, with a message, then back |
| Server error | A full-page error inside the shell, with Try again |
| Server slow to wake (free hosting) | The loading state, saying the first load can take up to a minute |
| No network | A banner on the page, and Try again on the failed action |
| Validation failed | An error beside the field, saying what to do |

| Page | Empty | Error and special cases |
|---|---|---|
| Overview | No children: "Add a child". No tasks: "Create the first task". Nothing waiting: says so. | Load failed |
| Tasks | No tasks; nothing matches the filter | Load failed |
| Task form | No children: "Add a child first" | Field errors; screening refused it; save failed and the input is kept |
| Task detail (parent) | | One layout per status. Proof would not load; already reviewed in another tab; deleted or not theirs: Not found |
| Rewards (parent) | "No rewards yet" and "No requests waiting" | Load failed; answered in another tab |
| Progress | No approved tasks yet | Load failed; report being prepared; report failed |
| Family | No children yet | Load failed |
| Today | Nothing to do right now; everything done for today | Load failed; no network |
| Task detail (child) | | One layout per status. Proof: choosing, preview, uploading with progress, too large or wrong type, upload failed, sent |
| Growth | Level 1 with an empty ruler is the empty state | Load failed |
| Stickers | The chart of empty slots is the empty state | Load failed |
| Rewards (child) | "No rewards yet" | Load failed; asking failed and nothing was held |
| Report a problem | | Sending; send failed and the text is kept; sent |
| Reports | No reports waiting | Load failed |

Every page also has a loading state: a skeleton of its own layout.

**Successes.** None gets its own route. Say it where the user already is, and move them to the next useful place.

| Event | What happens |
|---|---|
| Sign up | Signed in, on Overview's first-run state |
| Child added | Family, with the child's sign-in details shown once and "Create the first task" |
| Task created or edited | Back to Tasks or Task detail with a short confirmation |
| Task deleted | A confirmation dialog first, then back to Tasks |
| Proof sent | The task page now shows "In review" and says nothing is awarded until a parent approves |
| Proof approved (parent) | Back to Overview, with a quiet confirmation naming what the child earned |
| Proof approved (child) | The reward moment on Today |
| Proof sent back | A quiet confirmation for the parent; the note appears on the child's Today |
| Report sent | The Report page becomes a confirmation. It earns a full screen because the reader may be a worried child. |
| Settings saved | A confirmation beside the form |
| Family data deleted | Signed out, on Landing with a one-time message. |

## 11. Mobile considerations

Where the structure changes, not just the layout.

| Page | Phone | Desktop |
|---|---|---|
| Navigation | Bottom bar: five items for the parent, four for the child | Parent sidebar; child top bar |
| Overview | Proofs waiting, then tasks; progress is a link | Progress summary alongside |
| Tasks | Stacked rows; one filter control | A table with columns and filters |
| Task form | One column | The form beside a preview of the child's task card |
| Parent Task detail, when proof is waiting | The proof full width; Approve and Send back fixed at the bottom | The proof on one side; task details and actions on the other |
| Child Task detail | Send proof opens the camera first | A file chooser with drag and drop |
| Progress | One measure at a time | Chart, calendar and stickers together |
| Stickers | Three per row; details in a sheet from the bottom | Six per row; details beside the chart |
| Today | A compact growth band; the next task within thumb reach | The same single column, no wider than 720 px |

A parent and a child will often share one phone or tablet. Sign out is therefore one tap from both shells, it lands on Sign in, and Sign in does not remember the previous user's details.

## 12. Rules the backend must define

The screens depend on these. Each has a working assumption so that building can start.

1. **Late proof.** Since final plan Phase 7 (the settled value in final-plan.md section 3), a task still to do whose due time is within the next 24 hours shows as "Due soon", with the `Clock` icon and the warning colour; it is worked out on screen and never stored. Accepted on 9 October 2026: a child can still send proof after the deadline; the task shows as Overdue. Once the proof is sent the task shows as In review, and the proof is marked as sent late, to the child and to the parent.
2. **Editing and deleting.** Accepted on 9 October 2026: a task can be edited until its first proof is sent and deleted until it is approved. Approved tasks stay as history. The due time must be in the future when a task is created or when its due time is changed, so an overdue task can still have its other fields edited; and deleting a task deletes its proofs. Accepted on 9 October 2026: a task that was sent back has had a proof sent, so it stays closed to editing and can still be deleted. If the task itself was wrong, the parent says so in the note, or deletes it and sets another. Assumed (final plan Phase 7), to confirm, **Q1**: leaving a page with typed work in a form (a task, a reward, a quest, a proof's note or chosen file, a report) asks first, "Leave without saving?", with Keep editing and Leave without saving; closing the tab or reloading gets the browser's own question. Cancel inside a form still clears it at once, because it is a deliberate choice.
3. **Scoring rules.** The synopsis names a rule-based engine and gives no numbers. Accepted on 9 October 2026: a task is worth 5 to 100 points in steps of 5, chosen by the parent (20 unless changed). Approving its proof awards those points, and one XP for each point. Every level takes 100 XP, so the level is 1 plus the XP earned divided by 100, rounded down. Today also shows the XP of proofs still waiting for approval, which is the points of the tasks in review. The synopsis also gives no rule for streaks or badges; the two below were accepted on 10 October 2026.
   - **Streak.** A day counts when proof the child sent that day is approved, whenever the parent gets to it: the day is the day it was sent, so a parent who approves late breaks nothing. A day is missed when a task was due on it and the child had sent no proof for that task by the end of the day, unless the child sent any proof at all that day, whatever later happens to it: waiting, approved or sent back. A parent's answer therefore never turns a day into a missed one. Every other day, one with nothing due included, changes nothing. The streak is the number of days that count since the last missed day, and the best is kept. Only the child's own actions move it. A day is a calendar day in the family's local time. One point stays open for the backend phase: what happens to a missed day when a parent deletes an overdue task or moves its due time. Rest days are one answer for a family that knows a day will be missed. Accepted on 6 November 2026 (backend phase B2): the streak is worked out from the tasks as they stand, so deleting an overdue task, or moving its due time, removes the missed day it made.
   - **Stickers.** Twenty since final plan Phase 6, approved by the user on 16 November 2026 (fourteen before), each earned once and never lost. Kinds (star, in the kind's own icon): one for each of the six categories, earned when 10 tasks of that kind have been approved; a child who already had 10 when the six arrived earns it with their next approval (**K8**). Task counts (seal): First task, 10 tasks, 25 tasks, 50 tasks approved. Streaks (shield): a streak of 3, 7 and 30 days. Levels (hexagon): level 2, 5 and 10. Skills (star): All six kinds, for an approved task in each category; Right first time, for 5 tasks approved on the first try. Weekly quests (star): First quest, for the first weekly quest completed; 4 quests, for four completed. An award is recorded when the approval that earns it is given, and belongs to that approval. Assumed (final plan Phase 6), to confirm, **K1**: the chart shows how far along each sticker not yet earned is, as "7 of 10" under it, and All six kinds also names the kinds still missing.
4. **Seen results.** The server records which review results the child has seen, so Today can show what is new. Accepted on 9 October 2026: each task carries whether its newest result has been seen. Today shows an approval as new once, on its band, and then tells the server which tasks it showed, so a result that arrives meanwhile is still new. An approved task then leaves Today (Growth will list it). A sent-back task stays on Today until new proof is sent, seen or not. Accepted on 6 November 2026 (backend phase B2): sending new proof for a sent-back task counts its earlier result as seen.
5. **Proof files.** Allowed types and the size limit, especially for video, which is costly on free storage. Accepted on 9 October 2026: one proof is one file, a note, or both. The file is a photo (JPEG, PNG or WebP) or a video (MP4, WebM or QuickTime), of at most 25 MB. A note is at most 500 characters. Decided on 8 November 2026 and built in final plan Phase 3, **C2**: a PDF is no longer accepted, because it is stored as sent, with its author details and any photos inside it, and a reader may run scripts it carries; a PDF sent before then can still be opened, as a download. Accepted on 6 November 2026 (backend phase B2):
   - **Type:** the server decides a file's type from its contents, never from its name or from what the browser says. A video must contain a picture, so an audio file is refused.
   - **Who sees it:** a proof file is shown only to the child the task belongs to and to that child's parent, never to a moderator.
   - **Location:** before a photo or video is stored, the server removes its location and camera details. A photo keeps only which way up it goes, and anything stored after the picture itself, such as a second picture or a moving-photo clip, is dropped. A WebM video is stored as sent, because phone cameras put no location in it. Since final plan Phase 8 the GPS route some action cameras record in a separate video track is blanked too (rule 30, T7). Assumed (final plan, Phase 3), to confirm, **C3**: a PNG also loses the time it was made (its `tIME` chunk); an MP4 or QuickTime video also loses the details inside each track (its `udta` and `meta` boxes) and the times it was made and changed (in `mvhd`, `tkhd` and `mdhd`, set to zero); and the stored file name comes from the file's type (`photo.jpg`, `photo.png`, `photo.webp`, `video.mp4`, `video.mov`, `video.webm`), never from the device, because a camera's own name carries the date.
   - **Unreadable files:** a file whose structure cannot be read is refused. Assumed (final plan, Phase 3), **C1**: so is a photo or video made of more than 10,000 parts (20,000 for a PNG), refused as FILE_TYPE, because reading millions of tiny parts would stall the server.
   - **How a file is sent back** (final plan, Phase 3), **C4**: every proof file is served with `Content-Security-Policy: default-src 'none'; img-src 'self'; media-src 'self'; sandbox` and `Cross-Origin-Resource-Policy: same-origin`, so a file opened as its own page can run nothing and no other site can embed it. A stored PDF is sent with `Content-Disposition: attachment; filename="proof.pdf"`, so it downloads instead of opening.
   - **Files left behind** (final plan, Phase 3), **C5**: when the server starts it removes every file in the upload folder that no proof names, which is what is left when the server stopped between writing a file and saving its proof, or when a delete could not remove a file. Only files named like a proof and more than an hour old are touched, so a file still being saved is never removed. When more than 10 would go at once, none go: that many means the server is looking at the wrong database, and removing them would lose real proof for good. The log says only how many it removed, or how many it left and why.
6. **PDF report.** The frontend needs only a Download report button. Assumed (backend phase B4), following the user's decision of 5 November 2026 that the server builds no PDF: the report is the browser's print of Progress. Download report asks for the child's progress again and opens the browser's print window on Progress, which is styled for paper; "Save as PDF" there keeps a copy.
7. **"Real-time" progress.** Accepted on 9 October 2026: Overview, Today and the child's Task page reload when the page regains focus and once a minute, and so does the count of proofs waiting. No live connection. Assumed (final plan, Phase 4), to confirm:
   - **P1, one call for Today.** Today asks the server once per refresh, for its tasks, the growth and the stickers together, all read from the same moment.
   - **P3, one call for the counts.** The navigation's numbers come from one call: for a parent, proofs waiting and reward requests waiting; for a child, new results.
   - **P6, a refresh never blanks the page.** A page shows what it last loaded for the same question at once, and refreshes it quietly; Try again keeps the page on screen. What was loaded is forgotten whenever the signed-in person changes (signing in, signing out, a session that ends, deleting the family), so nobody sees the last person's pages on a shared device. Today is the one page that always loads afresh: its reward moment is worked out with its data, and a kept copy could play it again. A page that regains focus refreshes at most once every 15 seconds. The parent's Tasks page refreshes like Overview.
   - **H12, a nudge that uses no outside service.** The browser tab's title begins with the count of things waiting, such as "(2) Overview – GrowKid". In Settings a parent can turn on "Tell me on this computer when something is waiting", which asks for the browser's permission to notify at that tap and no other time. While it is on and the tab is hidden, a refresh that finds the count has gone up shows a notification that says only "Something is waiting in GrowKid": no name, no task and no number. No service worker, no push service and no other company is involved, and the setting is kept in this browser only.
   - **P7, a refresh that fails says so.** After two quiet refreshes in a row fail, the page keeps what it shows and says "Could not refresh. Showing what was here at 10:42."
8. **Content screening.** What is checked when a task or file is saved. Accepted on 9 October 2026: a task's title and instructions are checked when it is saved, for length and against a short list of words that harmful challenges rely on. The stand-in's sample list is "secret", "dare" and "don't tell"; the server owns the real one. The refusal names the word. A proof file is checked for its type and size only: nothing looks inside a photo, a video or a note. Accepted on 6 November 2026 (backend phase B2): the server's list stays the stand-in's three words until the user supplies more, and a curly apostrophe counts as a plain one, so "don’t tell" is caught too. Assumed (final plan, Phase 3), to confirm, **C7**: a word is found only as a whole word, in any script: the letters, marks and digits on either side must not be part of a word, so a Hindi word is found at the edge of a sentence and not inside a longer word, and the text is compared after Unicode NFKC normalisation, without invisible format characters (a soft hyphen or a zero-width space would show the word and hide it), and in lower case. Every text a parent writes for a child is checked against the list: a task, a reward, a quest's surprise, a cheer's line, the note a proof is sent back with, and the note a reward request is declined with.
9. **Repeating tasks.** Approved by the user on 8 November 2026 and built in final plan Phase 5, replacing "not planned". Assumed, to confirm:
   - **H1, a series.** A parent can make a task repeat every day or on chosen weekdays, at a time of day. The series keeps the task's category, title, instructions, "what done looks like" and points, all checked and screened as a task's are (rules 2 and 8). A child can have at most 20 series.
   - **H2, the day's task.** On a day the series runs, its task for that day is made the first time anyone in the family opens a task list that day, due at the series' time in the family's zone (rule 25). Exactly one task is made per series per day, however many people load at once. A missed day is never made afterwards, so a day nobody opened costs no streak.
   - **H3, changing and stopping.** Changing a series changes only the tasks it makes from then on; the tasks it already made stay as they are. Stopping a series keeps every task it made.
   - **H4, duplicating.** A task can be duplicated into the task form, with everything but its due time, which the parent sets.
10. **Review.** Assumed (final plan Phase 5), to confirm: **H5**, each task can carry "what done looks like", up to 200 characters, screened like the rest of the task and shown above the child's proof form and beside the proof on the parent's review; **H6**, after a parent approves or sends back a proof, the next proof waiting (the oldest, as Overview orders them) opens, with the result said at the top, and Overview opens when none is left; **H7**, sending back offers three ready notes ("The photo is blurry", "Part of it is missing", "Nearly there, try once more") that fill the note, which stays editable. Accepted on 9 October 2026: only the newest proof of a task in review can be answered, and only once. A second answer, from another tab, a second press or a slow connection, is refused as already reviewed and awards nothing. Sending back needs a note of at most 300 characters. The reviewer's name and the time stay with the proof and are shown to the child. An approval cannot be taken back.
11. **Categories.** Accepted on 9 October 2026: every task has exactly one of the six categories in DESIGN.md section 8, chosen by the parent. The field is required.
12. **Overview's week.** Accepted on 9 October 2026: the week runs from Monday to Sunday. "This week" lists tasks due in it and older ones still open, and leaves out the ones waiting for review, which are listed above it. Assumed (final plan Phase 5), to confirm:
   - **H8, how long proof has waited.** Each proof waiting says "Waiting since" and when it was sent.
   - **H9, the first steps.** Until a parent has added a child, set a task and added a reward, Overview opens with those three steps, each ticked from what the parent has already done. It goes once all three are done, and nothing about it is stored.
   - **H10, last week, Monday to Wednesday.** From Monday to Wednesday Overview shows, for each child, last week's tasks approved out of the tasks that were due, and the streak. It is the same record the child sees (rule 14), so nothing is watched in secret.
   - **H11, a request that has waited.** A reward request older than two days moves to the top of Overview, with how long it has waited.
   - **H13, the task form.** The due time starts empty, with three quick choices, "Today 6 pm", "Tomorrow 6 pm" and "Saturday 10 am", in the family's zone; a choice already past cannot be picked. The category and points start as the parent's most recently created task had them. A library of 60 task ideas, 10 per category, each for ages 8 to 10 or 11 to 14, can fill the form; every idea's words pass screening, and nothing about which idea was picked is stored. The weekly quest form says how many tasks the child has due this week beside its target.
13. **What the child has been shown.** Accepted on 10 October 2026: a reward is given on Today first. The server therefore answers with two scores, the real one and the one the child has last seen, and the reward moment plays from the second to the first. A result counts as seen only when Today reports it, which it does after the moment has run to its end. Until then Growth and Stickers show the seen score, and the parent's pages show the real one. Cheers are shown with each approval in the moment. A weekly quest completed by an approval lands after that approval's stickers.

14. **Progress.** Accepted on 10 October 2026: progress is worked out from the child's tasks when asked and never stored. The weekly chart counts the tasks approved in each of the last six weeks, Monday to Sunday, with the XP they earned; a task belongs to the week its approved proof was sent in, as a day does in the streak, so a parent who approves on Monday what was sent on Sunday moves nothing. The calendar shows the streak's day marks for this week and the three before it. The counts are tasks approved, proofs waiting, and tasks still to do with how many are overdue. The parent sees the real score, which the child sees once Today has shown it (rule 13). Everything on the page is the child's own record, which the child can see on Growth, Stickers and Today, with one difference of range: Growth shows the last seven day marks, Progress four weeks of them. The calendar shows rest days. Assumed (final plan Phase 6), to confirm:
   - **K4, the child's own weekly chart.** Growth shows the child the same six weeks as Progress, worked out from the score as they have been shown it (rule 13), and their best week: the most tasks approved in any one week, by the week the proof was sent in. It compares the child with nobody else.
   - **K5, my proofs.** Growth shows the child the photos and videos of their approved tasks, newest first, 24 at a time, once Today has shown the approval (rule 13). A proof whose file has been deleted, or a PDF, is left out. Each opens its task.
15. **Reports and the moderator.** Accepted on 10 October 2026.
    - **What a report holds.** The sender's own words (up to 1,000 characters), whether they are a parent or a child, and the time. If it was sent from a task's page, also a copy of that task made at that moment: its title, instructions, due time and points, the notes a parent sent proof back with, and how many times proof had been sent. The copy is kept so that editing or deleting the task afterwards cannot change what was reported.
    - **What a moderator sees:** exactly that, and nothing else. Never a name, an email or a username; never a proof photo, video or file; never a note the child wrote with their proof; never any other task, score or person in the family. A moderator cannot open any family page.
    - **Who else sees a report:** only the person who sent it, on Report a problem, with the moderator's answer. A child's report goes straight to the moderator: no parent is asked, told or shown, and a parent's page never lists or counts it.
    - **Resolved** means the moderator has written an answer (required, up to 500 characters). The report leaves the moderator's list and the answer appears to the sender. It changes nothing else: no task, proof, score or account is touched, nobody else is told, and it cannot be reopened or answered twice. A moderator has no other power in this version. Since final plan Phase 8 a moderator can also pause the sender's family (rule 30, T2), and a moderator signs in with a second step (T1).
    - **How soon.** No time is promised. The page says only that a moderator reads every report, because a time is a promise a person would have to keep. Add one only when someone is there to keep it.
    - **Not settled:** a report about something that needs more than an answer (a harmful task, a worrying photo) can only be answered, and the page gives a helpline number. Whether a moderator should be able to see a proof file, remove a task or reach a family is a decision for the backend phase. Accepted on 6 November 2026 (backend phase B3): a moderator has no power beyond reading reports and answering them, and the helpline line on the page covers anything more serious.
    - **Pausing a family.** Assumed (final plan, Phase 3), to confirm, **C6**: the person who runs the GrowKid server can pause the family of a report's sender with a script on the server (`npm run pause-family`, given the report's id), and unpause it the same way; since final plan Phase 8 a moderator can do the same from Reports (rule 30, T2). A paused family's parent and children are signed out everywhere and cannot sign in; sign-in is refused with a new code, PAUSED (403): "This family's account is paused while a report is looked at." Nothing of the family is deleted or changed while it is paused: its tasks, proofs and files stay as they were, as evidence, until a person decides. A report whose sender has been deleted cannot pause anyone.
    - **Moderator accounts.** Accepted on 6 November 2026 (backend phase B3): a moderator account is made only by a script run on the server, never through sign-up, and an address that already belongs to a parent or a child is refused. Changing a moderator's password signs them out everywhere. Assumed (final plan, Phase 1), F5: a moderator's password is at least 20 characters, because a moderator's answer reaches the child who sent the report.
    - **A report whose sender is gone.** Accepted on 6 November 2026 (backend phase B3): when the sender of a kept report has been deleted (rule 16), the moderator's list says so. Answering it deletes it, and the moderator is told the answer was not kept because nobody is left to read it.
16. **The parent's account, and deleting.** Accepted on 10 October 2026: a parent can change their name and, by typing the current one, their password (8 characters or more). The email cannot be changed. An earlier approval or note keeps the name it was given under. Deleting the family's data asks for the password and removes the parent's account, every child's sign-in, every task and proof with its file, every score and sticker, and every report the moderator has answered; the parent is signed out and no copy is kept, which the server must honour in its backups too. Removing one child removes the same things for that child. Deleting also removes the family's rewards and requests, and each child's quests, quest awards and rest days. Since final plan Phase 6 it also removes each child's task suggestions, savings goal and agreement (rule 29). Assumed (final plan Phase 7), to confirm, **Q2**: when deleting fails, the page says "Nothing was deleted" only for a refusal that came before anything was touched (a wrong password, too many tries, a session that ended); after a broken connection or a server failure it says it cannot tell, and how to find out. **Q3**: a new child's password, and a reset one, is shown once with a Copy button, and is handed from the form to the Family page in memory, never in the browser's history, so a reload does not bring it back. Since final plan Phase 8 a parent can download a copy of the family's data first (rule 30, T6); deleting keeps the record of what a moderator did (T3), which holds nothing of the family's.
    - **A report nobody has answered survives.** A report the moderator has not answered is kept when its sender or the sender's family is deleted, so that a parent cannot make a child's report disappear by removing the child or the family. It stays in the moderator's list as before, and holds nothing that points back to the family: no user id, no family id, no task id. It keeps the sender's words, whether a parent or a child sent it, the time, and the copy of the task (rule 15). The task copy is the parent's own words, so a name written into a task stays in it; the pages therefore say "no account and no link to the family", never "no name". When the moderator answers it, it is deleted, because nobody is left to read the answer.
    - **Safety and privacy says so.** Both dialogs that list what deleting removes say that a report not yet answered is kept without the family's name, and Safety and privacy says it in the same words.
    - **Consent.** Assumed (final plan, Phase 3), to confirm, **C8**: signing up needs the parent's tick that they are the parent or guardian of the children they will add and have read Safety and privacy, and adding a child needs the parent's tick that they are that child's parent or guardian and agree to GrowKid storing the child's details as Safety and privacy describes. The server refuses either without it (INVALID, `consent: 'required'`) and records, on the parent and on each child, the time of the tick and the version of Safety and privacy it was given under, which is the date that page last changed. GrowKid records this consent; it does not check that the person is really the parent.
17. **Balance.** Accepted on 30 October 2026: points stay every point a child has ever earned, and XP is unchanged. A new number, the balance, is what can be spent, and spending never lowers points, XP or level. The balance is the points, plus the bonus of every weekly quest completed, minus the cost of every request that is waiting or given. The child's balance is worked out from the score the child has been shown (rule 13), so an approval or a quest the child has not yet seen on Today does not count yet; the parent's pages use the real one. A request needs a shown balance of at least its cost, and is refused as not enough points otherwise.
18. **Rewards and requests.** Accepted on 30 October 2026: a parent sets rewards for the family. A reward's title is 3 to 60 characters once trimmed and is checked against the same word list as a task (rule 8); the refusal names the word. Its cost is a whole number of points from 10 to 1,000, in steps of 10. A child can ask only for a reward their own parent set; any other is not found. A request holds its points at once, and declining gives them back. A request is answered once, as given or as declined; a second answer is refused as already reviewed. A parent can add a note of at most 200 characters when declining. A declined request is shown to the child as "Not this time", in a neutral tag and never in coral, because declining is not something the child has to fix. Assumed (final plan Phase 6), to confirm:
   - **K2, hearing back.** A request's answer is new to the child until Today has shown it. Today's reward moment shows each answer after the approvals, stickers and quests (rule 13), and then tells the server, which marks only the child's own requests as seen. Until then the Today item in the child's navigation counts it with the new results.
   - **K3, a savings goal.** A child can choose one of the family's rewards as their goal, or none. Today shows it as a short ruler, the shown balance against its cost, with the points still to go, or that there are enough to ask for it. Deleting the reward clears the goal, and so does asking for it.
19. **Weekly quest.** Accepted on 30 October 2026: a parent can set one quest for each child: a number of tasks to have approved in a week, a bonus, and optionally a sealed surprise. The week runs Monday to Sunday, and a task counts toward the week its approved proof was sent in, the same rule as Progress (rule 14). The quest that applies is the one in place when the task is approved. A quest is completed once a week, and its bonus is points to spend (rule 17), not XP. The award is a copy, so later changes to the quest do not change it. The target is a whole number from 2 to 20, and the bonus a whole number from 10 to 200 in steps of 5. The surprise is the parent's own words, at most 80 characters once trimmed and checked against the same word list as a task (rule 8); an empty one means no surprise. The child sees only that a surprise is sealed, and what unlocks it, until the quest is complete and has been shown to the child (rule 13). It is the one thing a child cannot see, and it is about a reward, not about the child. Accepted on 31 October 2026: a quest changed after that week's was completed opens nothing early, because the child reads the completed week from its award; and the award reaches the child's device with its surprise before Today plays it, as the real score does (rule 13). Also accepted on 31 October 2026: a surprise opens once, so completing the quest empties it from the quest, and next week's quest has none unless the parent writes a new one; and a target at or below the tasks already approved this week is refused, unless that week's quest is already complete, because a quest completes only on an approval and would otherwise show as full and never pay.
20. **Cheers.** Accepted on 30 October 2026: when approving a proof, a parent can add a cheer: one of six fixed kinds (proud, tidy, brave, clever, kind or effort), or none, and an optional line of at most 120 characters once trimmed. A cheer is shown with the approval stamp everywhere the stamp appears, except on Landing.
21. **Rest days.** Accepted on 30 October 2026: only a parent sets a rest day, for one child at a time. A day is a local calendar day, written YYYY-MM-DD, and a rest day can be set from 7 days ago up to 90 days ahead, both included; any other day is refused. The controls are on the parent's Progress page, in the Streak section. A rest day is never missed. It is shown as a rest day, and proof approved on it still counts. Accepted on 31 October 2026: the day must be a real calendar date; the parent's list shows days from 7 days ago onward, and older rest days stay stored and still protect the streak.
22. **The chosen next task.** Accepted on 30 October 2026: only the child chooses which task to do next, and only one at a time. The task must be the child's own and still open, meaning to do or sent back; a task that is not theirs is not found, and a task that is not open is refused. Today leads with the chosen task for as long as it is open. The choice clears when proof is sent for that task or the task is deleted. A parent can see which task is chosen: nothing about the child is hidden from the parent.
23. **Family leaderboard.** Accepted on 30 October 2026: a parent can turn it on, and it is off until then. It appears only on the child's Growth page, and only when the family has two or more children. Each entry is only a child's first name and the number of tasks approved this week (Monday to Sunday, by the week the proof was sent in, as in rule 14), counting only approvals that child has been shown (rule 13). The list is sorted by tasks, most first, then by name. Accepted on 31 October 2026: the name is shown exactly as the parent typed it, with nothing cut from it, so a parent who types a full name shows a full name.
24. **Streak reminder.** Accepted on 30 October 2026: Today's band shows a reminder only when all four hold: a task is due today, that task is still open, the child has sent no proof today, and today is not a rest day. It is worded as fact, never as guilt.
25. **Days and time zone.** Accepted on 5 November 2026: the parent picks the family's country at sign-up and can change it in Settings. A family's day is a calendar day in that country's time zone. For a country with more than one time zone it is the capital's, so New York for the United States and Sydney for Australia. The server works out streaks, rest days, quests, the leaderboard and the Monday-to-Sunday week in that zone, whatever the device's time zone. Changing the country counts every past day again in the new zone, so a streak that sat right at midnight can move by a day. Since final plan Phase 4 (P13), the screens show days and times in the family's time zone too, whatever the device's.
26. **Sessions.** Accepted on 5 November 2026: signing in lasts seven days on that device. Signing out ends it on that device only. A parent who changes their password stays signed in on that device and is signed out everywhere else. Resetting a child's password signs that child out everywhere. Removing a child or deleting the family ends their sessions at once. Assumed (final plan, Phase 2), to confirm, **L5**: from Settings a parent can sign out every other device and stays signed in on the one in hand; from a child's page a parent can sign that child out on every device. Each asks once before it happens and says when it is done. Neither changes a password.
27. **Account limits.** Accepted on 5 November 2026: a name is 1 to 60 characters. A parent's password is at least 8 characters and a child's at least 6, and neither may be longer than 72 bytes (72 plain letters, fewer with accents or emoji). Sign-in pauses after 10 wrong tries at one account from one network within 15 minutes, or 50 tries at any accounts from one network. Sign-up pauses after 20 new accounts in an hour from one network. Changing the password or deleting the family pauses after 10 tries in 15 minutes. A pause is refused with a new code, TOO_MANY: "Too many tries. Wait a while, then try again." Accepted on 6 November 2026 (backend phase B4): sending a report pauses after 10 reports sent in an hour from one account, refused the same way; reports that were refused do not count. Since final plan Phase 8 a parent who forgets their password resets it with a recovery code (rule 30, T5). Assumed (final plan, Phase 2), each to confirm:
    - **L1, a limit per account.** Sign-in to one account also pauses after 30 wrong tries within an hour, whatever network they come from. Someone who knows a child's username can therefore lock that account for up to an hour; that is the accepted cost of stopping guesses sent from many addresses.
    - **L2, how long to wait.** A TOO_MANY refusal from a counted limit carries `fields.minutes`, the whole minutes until that limit starts again, and the screen says "Too many tries. Try again in N minutes."
    - **L3, child accounts.** Adding a child and resetting a child's password pause, counted together, after 20 in an hour from one parent.
    - **L4, passwords.** A child's password is at least 8 characters (it was 6). A new password is refused when it is one of the 1,000 most common passwords, in any mix of capitals (INVALID, `common`), or when it contains the child's username, a word of three or more letters from the person's name or, for a parent, the part of their email before the `@` when that is three or more characters (INVALID, `personal`). A password set before this rule keeps working. The child form offers "Make one for me": three everyday words joined by `-`, picked at random on the parent's device from a list of 150. A made password never holds a word of the child's name or the username. A name is compared as whole words in any script, with accents and vowel signs kept inside the word.
    - **L6, caps for one family.** At most 10 children, 300 tasks not yet approved for one child, 50 rewards, and 2 GiB of proof files. A request past a cap is refused with a new code, QUOTA (409), whose `fields.quota` is `children`, `tasks`, `rewards` or `storage`. A task moved to another child counts against that child's cap. Two requests at the same instant can pass a cap by one.
    - **L7, a write limit.** Any one account can make 120 changes a minute; a signed-out caller is counted by address. Signing out is never counted. A child can send 30 proofs an hour. Both are refused as TOO_MANY.
    - **L8, uploads at once.** The server receives at most 4 proof files at the same time, and 1 per child. One more is refused as TOO_MANY, with no minutes, and can be sent again straight away.
    - **L9, free space.** A proof file is refused, as QUOTA with `disk`, when storing it would leave the upload folder's drive with less than 2 GiB free, so the database on the same drive never runs out of room.
28. **Running on one machine.** Assumed (final plan, Phase 1), each to confirm. GrowKid is not hosted: the client and the server run on one computer, and the browser reaches the server only through Vite's proxy.
    - **F1, the caller's address.** "One network" in rule 27 is the address Vite's proxy saw the request come from. The server reads only that address, the last one in `X-Forwarded-For`, and ignores any address the caller wrote into the header. A program on the same computer that calls the server's own port directly, without the proxy, can still name any address.
    - **F2, the development clock.** The server moves its clock for an `X-Clock-Days` header only when it was started with `DEV_CLOCK=1` and is not in production mode. Without that switch the header changes nothing.
    - **F3, no stored answers.** Every answer under `/api` carries `Cache-Control: no-store`, so the browser keeps no copy of one person's pages for the next person on a shared device.
    - **F4, fonts.** Lexend and Baloo 2 are served by the app itself. No page of GrowKid asks another company's server for anything.
    - **F6, the built app.** The demo runs the built client (`npm run preview`) against the server (`npm start`). In that mode every page carries a Content-Security-Policy that allows only the app's own scripts, styles, fonts, images and media, plus `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
    - **F7, the server's log.** A failure is logged as the method, the path, the error's name and code, and where in the code it happened. The error's message is never logged, because it can quote a task title or a note.
    - **F8, where proof files live.** The server refuses to start when `UPLOAD_DIR` is inside the repository or inside a folder that OneDrive syncs (the folders named by the `OneDrive`, `OneDriveConsumer` and `OneDriveCommercial` environment variables), because a synced folder is copied to another company's servers.
    - **P2, the task list's window.** The task list holds every task not yet approved, every approved task whose approval was in the last 30 days, and any whose newest result the child has not yet seen. Older approved tasks are in the history, newest due first, 50 at a time. Scores, streaks and stickers still count every task ever approved.
    - **P5, loading a page.** Each page's code loads when the page is first opened. When that fails because the app was updated meanwhile, the app reloads once by itself; a second failure shows the crash screen. No built file is over 200 kB, except React DOM, one library file that cannot be split, which may not pass 230 kB (the user's decision of 15 November 2026).
    - **P8, long lists.** Tasks, Growth's history and the moderator's Reports show 50 at a time, with "Show more".
    - **P10, smaller photos.** Before a photo is sent, the child's device makes it at most 1,600 pixels on its longest side, as a JPEG at quality 0.85, when it is larger than that. A video is sent as it is. The server's stripping (rule 5) still applies to what arrives.
    - **P11, cancelling an upload.** A child can cancel a proof while it uploads, and leaving the page cancels it. Nothing is stored for a cancelled upload.
    - **P12, an answer stays in place.** Giving, declining, asking for, adding or changing a reward puts the server's answer into the list on screen instead of reloading the page.
    - **P13, the family's day on the device.** Every day the screens work out (the streak reminder, rest days, "today" and "tomorrow", this week, the due-time field, the day marks) is a day in the family's time zone (rule 25), the same as the server's, whatever the device's zone. A day mark is shown under the day it names, in every time zone.
    - **P15, requests that cannot hang.** A call to the server gives up after 20 seconds, except sending proof, which may take as long as the upload does.
    - **C9, the security log.** Assumed (final plan, Phase 3), to confirm. The server writes one line to its log when a limit first refuses a caller (once per pause, however many tries follow), when someone tries to sign in to a paused account, and when a moderator signs in: `security` with the event and the route, and nothing else. No name, email, username, address or id is ever in the line. Since final plan Phase 8 the same line is written when a moderator's code is refused, when a family is paused or unpaused from Reports, when a password is reset with a recovery code, and when a reset is tried for a paused family.
    - **N1, callers that stall.** Assumed (final plan Phase 9), to confirm. A caller that has not finished sending a request's headers within 15 seconds, or the whole request within 120 seconds, is cut off, so a stalled caller cannot hold one of the four upload places (L8) for minutes. A 25 MB video therefore needs a connection of about 2 megabits a second or better, which any home Wi-Fi gives.
29. **What a child can ask for, agree to, pick, and see grow.** Assumed (final plan Phase 6), each to confirm. A child never gets a box to type in: each thing a child sends here is a choice from a fixed list.
    - **K6, asking for a task.** A child can suggest a task by picking one of the 60 task ideas (H13), from Today when nothing is left to do and from Rewards. Suggesting an idea that is already waiting counts once. A child can have at most 3 suggestions waiting; one more is refused as QUOTA with `fields.quota` `suggestions`. The child sees their own waiting suggestions. Overview shows the parent "Diya suggested Water the plants" with "Make it a task", which opens the task form filled from the idea and answers the suggestion once the task is saved, and "Not now", which answers it at once. An answered suggestion leaves both lists. An idea the app no longer knows reads as "an idea from the list".
    - **K9, the plant.** Approved by the user on 16 November 2026. A child's level is drawn as a plant with ten named stages, one per level: Seed, Sprout, Seedling, Young plant, Leafy plant, Bush, Sapling, Young tree, Tall tree and Big tree. Past level 10 it stays a Big tree and counts a ring for each level beyond 10. It is worked out from the level, so nothing is stored, and it is not a character: no face, no name of its own, no voice. Growth shows it large; the reward moment shows it grow when a level is passed.
    - **K10, the badge.** Approved by the user on 16 November 2026. A child can pick a badge: one of four colours (navy, green, gold, orange) and one sticker they have earned and seen on Today, or none. Any other colour or sticker is refused as INVALID. The badge shows in the child's own bar, on the parent's Overview and Family, and on the family leaderboard; without one, the first letter of the name shows as before.
    - **K11, sound.** Approved by the user on 16 November 2026. The reward moment can play three short tones made in the browser (the ruler rising, a level, a sticker landing) and a short vibration where the device has one. Never outside the reward moment, never with reduced motion on, and never before the browser allows sound. It is on until the child turns it off with "Sound" in their menu; the setting is stored with the child's account.
    - **K12, the family check-in and the fridge chart.** Progress shows the parent, from Friday to Sunday, three questions to talk over as a family, taken from a fixed list by the week; nothing is stored. "Print a fridge chart" prints this week's tasks for the child, each with a box to tick, and the stickers they have earned, instead of the report.
    - **K7, the family agreement.** Today shows a child who has not agreed "Our agreement": their repeating tasks and the family's rewards, with "I agree". It shows only when there is at least one of either. Agreeing records the time, and Today then shows the child when they agreed. The child's page shows the parent "Agreed on 16 November" or "Not agreed yet", with "Ask again", which clears it so Today asks again.
30. **Trust and data.** Assumed (final plan Phase 8), each to confirm.
    - **T1, the moderator's second step.** A moderator signs in with the password and then a 6-digit code from an authenticator app (TOTP, RFC 6238: SHA-1, 30-second steps). The right password with no code is refused with a new code, NEEDS_CODE (401), and Sign in then shows a code field; a wrong or used code is refused the same way, with `fields.code` set to `wrong`. A code works once. The step before and the step after the current one are accepted, so a clock half a minute out still works. The secret is made by `npm run moderator` and printed once, as an `otpauth://` link, to the terminal of whoever runs the server; a moderator with no secret cannot sign in. Tries count against the sign-in limits (rule 27). The same script removes a moderator. The upgrade signs every moderator out once, so no session begun before the code survives it.
    - **T2, pausing from the moderator's page.** A moderator can pause and unpause the family of a waiting report's sender from Reports, each behind a confirm step, with the same effect as the server script (C6); an answered report pauses nobody (NOT_FOUND), and unpausing a family that is not paused signs nobody out. The report then carries a "Family paused" tag. The moderator still sees no name. A report cannot be answered while its family is paused, because nobody in the family could read the answer: it is refused as LOCKED. A report whose sender is gone can pause nobody (NOT_FOUND).
    - **T3, the moderator's record, and a list with no hidden end.** Every answer, pause and unpause is recorded: which moderator, which report, what and when; no words and no names. Nothing in the app changes or deletes a record, and deleting a family keeps it, because it holds no id of the family's. Whoever runs the server reads it from the database. The moderator's list says how many reports wait in all and shows them 200 at a time, oldest first, with Next and Previous.
    - **T4, how long proof files are kept.** A proof's photo or video is deleted once its task's approval is older than the family's setting: 30 days, 90 days (the start value) or 365 days, chosen by the parent in Settings. The task, the note, the review and the points stay, and every earlier attempt's file of that task goes with it. The server does this when it starts and once a day, by the real clock, never the development clock. A removed file no longer counts toward the family's 2 GiB, leaves My proofs (K5), and its proof says "Photo removed after 92 days", the days from the approval to the removal, to the parent and to the child alike. Choosing a shorter time deletes older files within a day, and Settings asks first.
    - **T5, a forgotten parent password.** Signing up makes a recovery code: 16 letters and digits, shown once on Overview as four groups of four; only its hash is stored. Settings makes a new one behind the password, which stops the old one, and says when a parent has none. `/forgot` takes the email, the code and a new password. A wrong code, an unknown email, a child's username and an account with no code all get the same refusal (WRONG_DETAILS), and tries count against the sign-in limits, by the email. A right code sets the password (checked as L4 checks it), signs every device out and is used up; the page tells the parent to sign in and make a new one. A paused family is refused (PAUSED). The email is still not verified, so the code is the only proof of who is asking. A child's password is still reset by their parent.
    - **T6, a copy of the family's data.** From Settings, behind the password, a parent downloads a .zip. It holds `family.json` (the parent's account and settings, each child with their tasks, the details of their proofs, the reviews, stickers, quests and rest days, and the family's rewards, requests, repeating tasks and task suggestions, and the parent's own reports) and a `proofs` folder with every proof file still kept. It holds what the parent can already see: not a child's report (rule 15), not a child's savings goal (K3), and never a password. Tries share the limit of changing the password (rule 27).
    - **T7, a route recorded beside a video.** In an MP4 or QuickTime video, a track of data recorded alongside the picture (handler `meta`, `text`, `gpmd`, `sbtl` or `subt`: an action camera's GPS route, timed text, and the subtitle tracks where drones and dash cameras often write their route) is blanked. Its samples are overwritten with zeros where they lie, and the track becomes an empty box, so the file keeps its size. A video whose data track cannot be read that way, a fragmented one included, is refused as FILE_TYPE.
    - **T8, the word list.** Not built: the user chose on 16 November 2026 to supply no list, so rule 8's three words stay.

## 13. Implementation order

Each step leaves something that can be shown working. Step 6 closes the loop.

1. **Foundation.** Routing, the role guard, both shells with their navigation and account menu, the shared loading, empty and error states, Not found.
2. **Accounts.** Sign in, Sign up.
3. **Family.** Family and the Child form.
4. **Tasks, parent side.** Task form, Tasks, Task detail without review.
5. **Tasks, child side.** Today, Task detail with sending proof.
6. **Review.** Approve and send back on the parent's Task detail; then Overview.
7. **Rewards.** Growth, Stickers and the reward moment.
8. **Progress** and the PDF report.
9. **Settings.**
10. **Safety.** Report a problem, then the moderator's Reports page.
11. **Public pages.** Landing, Safety and privacy. Last, so they describe what was actually built.

**If time runs short, cut in this order:** the moderator page (Report a problem then says plainly where a report goes); the streak calendar on Progress; the sticker detail view; task filters beyond status; Landing sections after "how it works". The loop in steps 1 to 6 is never cut.

## 14. Excluded on purpose

Do not add these without changing this document first.

| Not a page | Why |
|---|---|
| Contact form, About, FAQ, How it works | Sections of Landing, or a footer email link |
| Terms, Accessibility statement, Cookie policy | Not needed yet; see section 4 |
| Role selection, child sign-up, invitations, join codes | D1 |
| Email verification, password reset by an emailed link | D2. A parent resets a forgotten password with a recovery code instead (rule 30, T5) |
| Registration success, onboarding flows | First-run empty states |
| Push notifications | Would need a push service run by another company, which GrowKid does not use; the tab's title and a notification the open page raises itself cover it (rule 7, H12) |
| Review queue, Review a proof, Send proof, child account page, Report detail | Merged; see section 4 |
| Safety settings, notification preferences | Nothing in the backend behind them |
| 401, 403, 500, 503 pages | Redirects and in-page states |
| Admin dashboard, user management | D3 |
| Second parent account | Not in the synopsis for this version |
| Leaderboards beyond the family | Rule 23 keeps ranking inside the family |
