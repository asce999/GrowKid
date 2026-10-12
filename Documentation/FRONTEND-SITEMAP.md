# GrowKid frontend sitemap

**Status: final.** This is the frontend architecture to build from: which pages exist, their routes, how they connect and what is deliberately not a page. It replaces the earlier proposal of 27 pages on 29 routes (two of those pages optional) with **19 pages on 21 routes**. Product facts come from the project synopsis; look and behaviour come from `DESIGN.md`.

**Where the frontend stands today.** All eleven steps of the implementation order (section 13) are built, so the frontend is complete: all 21 routes with their access rules and redirects, the four shells, the shared states, Sign in, Sign up, Family and the Child form, tasks on both sides with sending proof, review with Approve and Send back, Overview, the rewards (the reward moment on Today, the streak, Growth and Stickers), Progress with its printed report, Settings with deleting the family's data, Report a problem, the moderator's Reports, and the two public pages, Landing and Safety and privacy. All nineteen pages exist. A task can be To do, Overdue, In review, Sent back or Approved; "Due soon" waits for a rule saying how soon. The message after deleting a family's data is shown once, on Landing. Decisions D1 to D3 and the working assumptions marked accepted in section 12 are built on. The server still has no code and the Prisma schema has no models, so the client calls the functions in `client/src/api/`, which a stand-in (`api/fake.js`) answers in the browser: records in localStorage, proof files in IndexedDB. The award and progress rules are plain functions in `api/scoring.js`; `npm run check` runs them, and checks what deleting a family removes and keeps, and what a moderator is handed. React Router 7 and Zustand are in use; Axios is installed and waits for a real server.

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
| Authentication | Sign in; Sign up | 2 |
| Parent | Overview; Tasks; Task form (create and edit); Task detail (with proof review); Progress; Family; Child form (add and edit); Settings | 8 |
| Child | Today; Task detail (with sending proof); Growth; Stickers | 4 |
| Shared | Report a problem | 1 |
| System | Not found | 1 |
| Moderator (D3) | Reports | 1 |
| | **Total** | **19** |

Build cost of each page:

| Cost | Pages |
|---|---|
| High | Parent Task detail; Progress; Today; Child Task detail |
| Medium | Landing; Overview; Tasks; Task form; Growth; Reports |
| Low | Safety and privacy; Sign in; Sign up; Family; Child form; Settings; Stickers; Report a problem; Not found |

## 3. Route map

| Route | Page | Role | Purpose |
|---|---|---|---|
| `/` | Landing | Public | What GrowKid is, who it is for, how it works; leads to sign in and sign up |
| `/privacy` | Safety and privacy | Public | How children are kept safe, who can see what, what is stored and how to delete it |
| `/login` | Sign in | Public | One sign-in page for parent, child and moderator |
| `/signup` | Sign up | Public | A parent creates the family's account |
| `/parent` | Overview | Parent | Proofs waiting for review first, then the week's tasks and each child's progress in a line |
| `/parent/tasks` | Tasks | Parent | Every task, filtered by child and status |
| `/parent/tasks/new` | Task form | Parent | Create a task and assign it to a child |
| `/parent/tasks/:taskId` | Task detail | Parent | One task: details, status, every proof and note. Approve or send back happens here. |
| `/parent/tasks/:taskId/edit` | Task form | Parent | Edit a task (the same form as create) |
| `/parent/progress/:childId` | Progress | Parent | A child's level, streak, weekly completion and stickers; download the PDF report |
| `/parent/family` | Family | Parent | The children in the family |
| `/parent/family/new` | Child form | Parent | Add a child and set their sign-in details |
| `/parent/family/:childId` | Child form | Parent | Rename a child, reset their password, remove them |
| `/parent/settings` | Settings | Parent | Name, password, delete the family's data |
| `/child` | Today | Child | The next task, the growth band, other tasks, results of reviews |
| `/child/tasks/:taskId` | Task detail | Child | What to do, when, what it is worth. Sending proof happens here. |
| `/child/growth` | Growth | Child | Level, XP, points, streak and the history of what was earned |
| `/child/stickers` | Stickers | Child | The sticker chart: earned stickers and empty slots |
| `/report` | Report a problem | Any signed-in user | Report a task, a note or anything that feels wrong |
| `/admin/reports` | Reports | Moderator | Reports waiting; open one to see the item and mark it resolved |
| `*` | Not found | Anyone | Any address that does not exist or is not the user's to see |

Access:

- **Public:** `/`, `/privacy`, `/login`, `/signup`.
- **Any signed-in user:** `/report`. A moderator who opens it is sent to Reports: reports come to them.
- **Parent only:** everything under `/parent`. **Child only:** everything under `/child`. **Moderator only:** `/admin/reports`.

Redirects: a signed-in user who opens `/`, `/login` or `/signup` goes to their own home. `/parent/progress` goes to the first child's progress. Signing out goes to `/login`, not the landing page, because on a shared device the next thing that happens is usually the other person signing in.

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
├─ Progress ──► Download report
├─ Family ──► Child form (add or edit)
└─ account menu ──► Settings, Report a problem, Sign out

Today (/child)
├─ Task detail (send proof here)
├─ Growth
├─ Stickers
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
| Is uneasy about a task | Task detail, then `/report` | The report arrives already linked to that task. |
| Sign out | Account menu, in the shell | Lands on Sign in. |

## 6. Parent information architecture

The parent side is the quiet volume: lists and tables, colour only in status, and reviewing proof as the most frequent job.

Navigation, in this order: **Overview, Tasks, Progress, Family.** A sidebar on desktop and a bottom bar on phones. Overview carries the count of proofs waiting. The account menu holds Settings, Report a problem and Sign out.

| Page | Leads with | Also holds |
|---|---|---|
| Overview | Proofs waiting for review, oldest first | The week's tasks by child; one line of progress per child |
| Tasks | The task list | Filters for child and status; Create task |
| Task form | The fields in order: child, title, what to do, due, points | A preview of the child's task card on desktop |
| Task detail | The task and its status. When proof is waiting: the proof, shown large, with Approve and Send back. | Every earlier proof and note; the approval stamp and what was awarded; Edit and Delete |
| Progress | The child's level and growth ruler | Weekly completion chart, streak calendar, stickers, Download report |
| Family | The children | Add a child |
| Child form | Name and sign-in details | Reset password; Remove child |
| Settings | Name | Change password; delete the family's data |

With more than one child, Progress has a child switcher, and Overview and Tasks group or filter by child.

## 7. Child information architecture

The child side is the louder volume: one job per screen, the navy growth band, and the next task first.

Navigation: **Today, Growth, Stickers.** A bottom bar on phones and a top bar on desktop. The account menu holds What parents can see, Report a problem and Sign out. The child has no settings: the parent manages the account.

| Page | Leads with | Also holds |
|---|---|---|
| Today | The one next task, with its main button | The growth band (level, ruler, streak); other tasks to do; tasks in review; results since the last visit |
| Task detail | What to do, and the Send proof button | Due time, points, status; the parent's note if it was sent back; the proof already sent; the approval stamp |
| Growth | The growth ruler | Points, streak with the week's day marks, best streak, the list of what was earned and why |
| Stickers | The sticker chart | Opening a sticker shows its name, how it was earned and when |

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

No cookie policy is needed: the app sets no advertising or analytics cookies, and one sentence on Safety and privacy covers the session token. Fonts currently load from Google's servers, which is a third-party request; either say so on that page or host the fonts with the app. This is a product judgement, not legal advice.

## 9. Flows

**Authentication**

```
Landing
├─ Sign up (parent only: name, email, password, confirms they are the parent or guardian)
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
| Progress | No approved tasks yet | Load failed; report being prepared; report failed |
| Family | No children yet | Load failed |
| Today | Nothing to do right now; everything done for today | Load failed; no network |
| Task detail (child) | | One layout per status. Proof: choosing, preview, uploading with progress, too large or wrong type, upload failed, sent |
| Growth | Level 1 with an empty ruler is the empty state | Load failed |
| Stickers | The chart of empty slots is the empty state | Load failed |
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
| Navigation | Bottom bar: four items for the parent, three for the child | Parent sidebar; child top bar |
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

1. **Late proof.** Accepted on 9 October 2026: a child can still send proof after the deadline; the task shows as Overdue. Once the proof is sent the task shows as In review, and the proof is marked as sent late, to the child and to the parent.
2. **Editing and deleting.** Accepted on 9 October 2026: a task can be edited until its first proof is sent and deleted until it is approved. Approved tasks stay as history. The due time must be in the future when a task is created or when its due time is changed, so an overdue task can still have its other fields edited; and deleting a task deletes its proofs. Accepted on 9 October 2026: a task that was sent back has had a proof sent, so it stays closed to editing and can still be deleted. If the task itself was wrong, the parent says so in the note, or deletes it and sets another.
3. **Scoring rules.** The synopsis names a rule-based engine and gives no numbers. Accepted on 9 October 2026: a task is worth 5 to 100 points in steps of 5, chosen by the parent (20 unless changed). Approving its proof awards those points, and one XP for each point. Every level takes 100 XP, so the level is 1 plus the XP earned divided by 100, rounded down. Today also shows the XP of proofs still waiting for approval, which is the points of the tasks in review. The synopsis also gives no rule for streaks or badges; the two below were accepted on 10 October 2026.
   - **Streak.** A day counts when proof the child sent that day is approved, whenever the parent gets to it: the day is the day it was sent, so a parent who approves late breaks nothing. A day is missed when a task was due on it and the child had sent no proof for that task by the end of the day, unless the child sent any proof at all that day, whatever later happens to it: waiting, approved or sent back. A parent's answer therefore never turns a day into a missed one. Every other day, one with nothing due included, changes nothing. The streak is the number of days that count since the last missed day, and the best is kept. Only the child's own actions move it. A day is a calendar day in the family's local time. One point stays open for the backend phase: what happens to a missed day when a parent deletes an overdue task or moves its due time.
   - **Stickers.** Eleven, each earned once and never lost. Task counts (seal): First task, 10 tasks, 25 tasks approved. Streaks (shield): a streak of 3, 7 and 30 days. Levels (hexagon): level 2, 5 and 10. Skills (star): All six kinds, for an approved task in each category; Right first time, for 5 tasks approved on the first try. An award is recorded when the approval that earns it is given, and belongs to that approval.
4. **Seen results.** The server records which review results the child has seen, so Today can show what is new. Accepted on 9 October 2026: each task carries whether its newest result has been seen. Today shows an approval as new once, on its band, and then tells the server which tasks it showed, so a result that arrives meanwhile is still new. An approved task then leaves Today (Growth will list it). A sent-back task stays on Today until new proof is sent, seen or not.
5. **Proof files.** Allowed types and the size limit, especially for video, which is costly on free storage. Accepted on 9 October 2026: one proof is one file, a note, or both. The file is a photo (JPEG, PNG or WebP), a video (MP4, WebM or QuickTime) or a PDF, of at most 25 MB. A note is at most 500 characters.
6. **PDF report.** Assumed: the server builds it, so the frontend needs only a Download report button. Until there is a server, Download report asks for the child's progress again and opens the browser's print window on Progress, which is styled for paper; "Save as PDF" there keeps a copy. That printed page is what the server later turns into a PDF.
7. **"Real-time" progress.** Accepted on 9 October 2026: Overview, Today and the child's Task page reload when the page regains focus and once a minute, and so does the count of proofs waiting. No live connection.
8. **Content screening.** What is checked when a task or file is saved. Accepted on 9 October 2026: a task's title and instructions are checked when it is saved, for length and against a short list of words that harmful challenges rely on. The stand-in's sample list is "secret", "dare" and "don't tell"; the server owns the real one. The refusal names the word. A proof file is checked for its type and size only: nothing looks inside a photo, a video or a note.
9. **Repeating tasks.** Not in the synopsis and not planned. If daily habits matter, a Duplicate action on a task is the cheap substitute.
10. **Review.** Accepted on 9 October 2026: only the newest proof of a task in review can be answered, and only once. A second answer, from another tab, a second press or a slow connection, is refused as already reviewed and awards nothing. Sending back needs a note of at most 300 characters. The reviewer's name and the time stay with the proof and are shown to the child. An approval cannot be taken back.
11. **Categories.** Accepted on 9 October 2026: every task has exactly one of the six categories in DESIGN.md section 8, chosen by the parent. The field is required.
12. **Overview's week.** Accepted on 9 October 2026: the week runs from Monday to Sunday. "This week" lists tasks due in it and older ones still open, and leaves out the ones waiting for review, which are listed above it.
13. **What the child has been shown.** Accepted on 10 October 2026: a reward is given on Today first. The server therefore answers with two scores, the real one and the one the child has last seen, and the reward moment plays from the second to the first. A result counts as seen only when Today reports it, which it does after the moment has run to its end. Until then Growth and Stickers show the seen score, and the parent's pages show the real one.

14. **Progress.** Accepted on 10 October 2026: progress is worked out from the child's tasks when asked and never stored. The weekly chart counts the tasks approved in each of the last six weeks, Monday to Sunday, with the XP they earned; a task belongs to the week its approved proof was sent in, as a day does in the streak, so a parent who approves on Monday what was sent on Sunday moves nothing. The calendar shows the streak's day marks for this week and the three before it. The counts are tasks approved, proofs waiting, and tasks still to do with how many are overdue. The parent sees the real score, which the child sees once Today has shown it (rule 13). Everything on the page is the child's own record, which the child can see on Growth, Stickers and Today, with one difference of range: Growth shows the last seven day marks, Progress four weeks of them.
15. **Reports and the moderator.** Accepted on 10 October 2026.
    - **What a report holds.** The sender's own words (up to 1,000 characters), whether they are a parent or a child, and the time. If it was sent from a task's page, also a copy of that task made at that moment: its title, instructions, due time and points, the notes a parent sent proof back with, and how many times proof had been sent. The copy is kept so that editing or deleting the task afterwards cannot change what was reported.
    - **What a moderator sees:** exactly that, and nothing else. Never a name, an email or a username; never a proof photo, video or file; never a note the child wrote with their proof; never any other task, score or person in the family. A moderator cannot open any family page.
    - **Who else sees a report:** only the person who sent it, on Report a problem, with the moderator's answer. A child's report goes straight to the moderator: no parent is asked, told or shown, and a parent's page never lists or counts it.
    - **Resolved** means the moderator has written an answer (required, up to 500 characters). The report leaves the moderator's list and the answer appears to the sender. It changes nothing else: no task, proof, score or account is touched, nobody else is told, and it cannot be reopened or answered twice. A moderator has no other power in this version.
    - **How soon.** No time is promised. The page says only that a moderator reads every report, because a time is a promise a person would have to keep. Add one only when someone is there to keep it.
    - **Not settled:** a report about something that needs more than an answer (a harmful task, a worrying photo) can only be answered, and the page gives a helpline number. Whether a moderator should be able to see a proof file, remove a task or reach a family is a decision for the backend phase.
16. **The parent's account, and deleting.** Accepted on 10 October 2026: a parent can change their name and, by typing the current one, their password (8 characters or more). The email cannot be changed. An earlier approval or note keeps the name it was given under. Deleting the family's data asks for the password and removes the parent's account, every child's sign-in, every task and proof with its file, every score and sticker, and every report the moderator has answered; the parent is signed out and no copy is kept, which the server must honour in its backups too. Removing one child removes the same things for that child.
    - **A report nobody has answered survives.** A report the moderator has not answered is kept when its sender or the sender's family is deleted, so that a parent cannot make a child's report disappear by removing the child or the family. It stays in the moderator's list as before, and holds nothing that points back to the family: no user id, no family id, no task id. It keeps the sender's words, whether a parent or a child sent it, the time, and the copy of the task (rule 15). The task copy is the parent's own words, so a name written into a task stays in it; the pages therefore say "no account and no link to the family", never "no name". When the moderator answers it, it is deleted, because nobody is left to read the answer.
    - **Safety and privacy says so.** Both dialogs that list what deleting removes say that a report not yet answered is kept without the family's name, and Safety and privacy says it in the same words.

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
| Email verification, Forgot password, Reset password | D2 |
| Registration success, onboarding flows | First-run empty states |
| Notifications | Future scope in the synopsis; the count on Overview covers the need |
| Review queue, Review a proof, Send proof, child account page, Report detail | Merged; see section 4 |
| Safety settings, notification preferences | Nothing in the backend behind them |
| 401, 403, 500, 503 pages | Redirects and in-page states |
| Admin dashboard, user management | D3 |
| Leaderboards, second parent account | Not in the synopsis for this version |
