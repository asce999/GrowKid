# GrowKid design reference

This is the design reference for GrowKid. Frontend work follows it. If the code and this document disagree, this document is right until it is changed here first.

It covers direction and foundations only (design phase D1). It does not specify screens. Product facts come from the project synopsis; the poster is the starting point for the brand.

---

## 1. Design philosophy

**Real-world growth is the game.** GrowKid takes what works on children in games (visible progress, rewards, levels) and attaches it to things done away from the screen. So the design keeps real things looking real and puts the game only on what has been earned.

The picture behind every decision is a **family growth chart**: the pencil marks on a door frame that show how much a child has grown, and the sticker chart on the fridge. Families already do both. In GrowKid, level progress is a ruler, badges are stickers, and a parent's approval is a stamp.

Three commitments follow from this:

1. **Structure is calm; earned things are loud.** Screens are flat, rectangular and mostly white and navy. Colour, unusual shapes and motion are saved for progress and achievements, so they still mean something when they appear.
2. **A colour means one thing everywhere.** Green is growth, gold is something earned, coral is something to fix. Nothing is coloured for decoration.
3. **Nothing is secret.** Harmful challenges work through secrecy. Every status in GrowKid says who did what and when, and a child can see everything a parent sees about them. The one exception is a sealed surprise, which is about a reward, not about the child (section 13).

## 2. Product personality

GrowKid speaks to two audiences in one voice at two volumes.

| | To the child | To the parent |
|---|---|---|
| Character | Encouraging, direct, a little proud of them | Clear, organised, reassuring |
| Says | "Next up: water the balcony plants." | "3 proofs are waiting for review." |
| After a setback | "Mum wants a clearer photo. Try again." | "Sent back with your note." |
| Never | Baby talk, hype, guilt | Jargon, alarm, sales language |

Shared by both: plain words, sentence case, short sentences, and no exclamation marks except at a level-up.

## 3. Target users

- **Child.** Assumed to be 8 to 14 (see section 18). Uses a parent's phone or a family tablet after school. Wants to know what to do next and what they have earned. Reads short sentences comfortably.
- **Parent or guardian.** Reviews proof on a phone in spare minutes and plans tasks on a laptop. Wants oversight without having to nag.
- **Evaluator.** Faculty watching a projected demo for a few minutes. The whole loop (assign, do, prove, approve, grow) has to be readable from the back of a room, which means large type, strong contrast and one obvious action per screen.

## 4. Visual direction

Five directions were weighed against child appeal, parent trust, accessibility, uniqueness, build cost, and fit for dashboards, mobile and an academic demo.

| Direction | Verdict | What we kept |
|---|---|---|
| Soft and friendly (pastels, everything rounded) | Rejected. Reads as babyish, weak contrast, and is the look every "friendly app" already has. | Generous spacing |
| Bold educational (flat solid colour, strong hierarchy) | **Chosen as the base.** Credible to parents and evaluators, accessible, cheap to build. | Everything structural |
| Modern game UI (dark, neon, glows) | Rejected. It looks like the games parents are worried about, and it is heavy to build and animate. | Level, XP and streak always visible to the child |
| Editorial and gamified (quiet, typographic) | Rejected as a whole; too adult for the child. | Restraint on parent screens: lists and tables before cards |
| Playful graphic (cut shapes, stickers) | **Chosen for earned things only.** Memorable, and built from simple shapes rather than illustrations. | Stickers, the growth ruler |

**The chosen direction, "growth chart":** a bold, flat, structured interface where the only playful objects are the things a child has earned.

- Flat surfaces, one-pixel borders, no gradients and no resting shadows.
- Rectangles for structure. Only people (round avatars) and achievements (sticker shapes) break the rectangle.
- Colour is restrained on parent screens (white and navy, colour only in status). Child screens commit to colour: a navy **growth band** fills the top of the screen and holds the level, the ruler and the streak.
- Light theme only. Parents review on a phone in the evening and children use a tablet in a lit room after school; neither is a dark-room setting.

**From the poster.** Kept: the navy and gold, the parent and child relationship, the level, points and streak trio, shield and hexagon badges. Left behind: the table-heavy layout, the purple, and the mixed icon styles. The app should look like where the poster's idea went next, not like the poster on a screen.

**Logo.** A sprout that is also a child with both arms raised, on a navy tile. The long leaf leans like a tick, and the head is gold. The drawing is in `client/public/favicon.svg`. The wordmark is "GrowKid" in Baloo 2 extra bold.

## 5. Color system

Five families. Values are in section 17.

| Family | Job |
|---|---|
| Navy | Structure, text, main actions, and information. Its light steps are the greys. |
| Sprout (green) | Growth: XP, progress, approved. |
| Sun (gold) | Something earned: stickers, points, level-ups. |
| Coral | Something to fix: sent back, overdue, errors, deleting. |
| Ember (orange) | Time pressure: due soon. Used sparingly. |

| Role | Token | Notes |
|---|---|---|
| Primary | `navy-800` | Main buttons, navigation, links. Hover and pressed: `navy-950`. |
| Secondary (growth) | `sprout-500` | Progress fill and the Approve button, with `navy-950` text. |
| Accent (achievement) | `sun-500` | Stickers, point stars, level-up. Outline `sun-800`, highlight `sun-300`. |
| Background | `navy-50` | The page. |
| Surface | `white` | Cards, lists, forms. |
| Sunken surface | `navy-100` | Progress tracks, photo placeholders, wells. |
| Elevated surface | `white` + overlay shadow | Menus, dialogs, toasts only. |
| Growth band | `navy-800`, white text | Top of child screens. Muted text on it is `navy-200`. |
| Text | `navy-950` | |
| Muted text | `navy-600` | Helper text, timestamps. |
| Success | `sprout-800` on `sprout-100` | Approved. |
| Warning | `ember-800` on `ember-100` | Due soon. |
| Danger | `coral-700` on `coral-100`; solid `coral-500` with white text | Sent back, overdue, errors, delete. |
| Info | `navy-800` on `navy-100` | In review, tips, neutral notices. |
| XP / progression | `sprout-500` | Always on the ruler. |
| Achievement / badge | `sun-500` | Default sticker colour. `navy-800` and `sprout-500` are alternates so a sticker chart is not all gold. |

Rules:

- **Gold is always solid and only on earned objects.** No gold backgrounds, no gold text, no gold buttons. A warm tinted background therefore always means a warning.
- **No gradients.** Fills are flat. There is no gradient token.
- Gold on a light surface gets a `sun-800` outline, because gold on white is only 1.8:1.
- The green progress fill is 2.4:1 on white, so progress is never shown by fill alone: the ruler has an ink marker at the current value and the number beside it.

Measured contrast (WCAG ratio): text `navy-950` on white 17.9, on the page 16.6. Muted `navy-600` on white 7.6. White on `navy-800` 13.1. `navy-950` on `sprout-500` 7.3. White on `coral-500` 4.5. `sprout-800` on `sprout-100` 5.7. `coral-700` on `coral-100` 6.0. `ember-800` on `ember-100` 6.3. `navy-800` on `navy-100` 10.9. `navy-950` on `sun-500` 10.0.

## 6. Typography

Two families. Lexend does the work; Baloo 2 talks about the game.

| Role | Face | Weight | Size / line height (px) | Used for |
|---|---|---|---|---|
| Display | Baloo 2 | 800 | 40 / 44 (32 / 36 on mobile) | Child page titles, level-up and celebration lines |
| Headline | Lexend | 600 | 40 / 44 (32 / 36 on mobile) | Public page headlines: Landing and Safety and privacy only |
| Game numeral | Baloo 2 | 700 | 28 / 32, up to 48 / 48 | Level, XP, points and streak counts, for both audiences |
| Heading | Lexend | 600 | 24 / 32 | Parent page titles, section headings |
| Subheading | Lexend | 600 | 18 / 28 | Card, list-group and dialog titles |
| Body | Lexend | 400 | 16 / 24 (18 / 28 on child screens) | Everything you read |
| Small / meta | Lexend | 400 to 500 | 14 / 20 | Helper text, timestamps, table headers, tags |
| Data numeral | Lexend | 600, tabular figures | 24 / 32 | Parent statistics and tables |
| Button / label | Lexend | 600 / 500 | 16 / 24 | Buttons / form labels |

Rules:

- Baloo 2 is only for the game and for child page titles. Never for body text, forms, tables or buttons.
- Sentence case everywhere. No all-caps labels.
- Nothing smaller than 14 px. Lines no longer than about 70 characters. Text is left-aligned; the one exception is a sticker's name, centred under the sticker.
- A number always carries its unit and its limit: "650 of 1,000 XP", not "650".

## 7. Shape language

Geometry tells you what kind of thing you are looking at.

| Thing | Shape |
|---|---|
| Tags, checkboxes, small icon tiles | Rectangle, 6 px radius |
| Buttons, inputs, menu items | Rectangle, 10 px radius. 44 px tall; the child's main button is 56 px. |
| Cards, dialogs, sheets, photo frames | Rectangle, 16 px radius, 1 px `navy-200` border, no shadow |
| Progress (the growth ruler) | Rectangle, 6 px radius, with tick marks |
| People | Circle. Avatars are the only circles. |
| Achievements | Sticker shapes: seal, shield, star, hexagon. Never a plain rectangle. |
| Not yet (locked sticker, empty slot, upload area) | The same shape as a 2 px dashed `navy-400` outline |

Fully rounded "pill" shapes are not used for buttons, inputs or tags.

## 8. Iconography

One family: **Lucide** (already installed as `lucide-react`).

- Outline, 2 px stroke, in the current text colour.
- Sizes: 16 px beside small text, 20 px in buttons and navigation, 24 px in headers and icon tiles.
- Filled icons mean "earned": the gold star (points) and gold flame (streak), each with a `sun-800` outline. Nothing else is filled.
- No emoji as icons.
- An icon-only button has an accessible name and a 44 px target.

Status always shows icon, word and colour together:

| State | Icon | Colour role | Word shown |
|---|---|---|---|
| Not started | `Circle` | Neutral outline | To do |
| Proof sent, waiting | `Hourglass` | Info | In review |
| Approved | `CircleCheck` | Success | Approved |
| Proof rejected by the parent | `Undo2` | Danger | Sent back |
| Deadline close | `Clock` | Warning | Due soon |
| Deadline passed | `CircleAlert` | Danger | Overdue |
| Locked sticker | `Lock` | Muted | Not earned yet |

Other fixed meanings: `Star` points, `Flame` streak, `Sprout` level and growth, `ShieldCheck` safety and privacy, `BadgeCheck` the approval stamp, `Gift` rewards and a sealed surprise, `Flag` the weekly quest, `Pin` the task a child chose to do next.

A parent can add a cheer to an approval. There are six, each with one icon and its words:

| Kind | Icon | Words |
|---|---|---|
| proud | `Heart` | Proud of you |
| tidy | `Sparkles` | Super tidy |
| brave | `Mountain` | That was brave |
| clever | `Lightbulb` | Clever thinking |
| kind | `HandHeart` | So kind |
| effort | `BicepsFlexed` | Great effort |

A cheer's icon is an outline in the text colour. It is never filled and never gold.

A task has one of six categories, in words a parent would use, each with one icon:

| Category | Icon | Covers |
|---|---|---|
| Chores | `Brush` | Tidying, cleaning, helping at home |
| Study | `Pencil` | Homework and revision |
| Reading | `BookOpen` | Books and reading practice |
| Music and art | `Palette` | Practising an instrument, drawing, making things |
| Outdoors | `Bike` | Sport, play and time outside |
| Health | `Apple` | Food, sleep, hygiene and exercise habits |

A category has an icon and a name. It never has a colour of its own.

## 9. Illustration direction

GrowKid has no characters, no mascot and no scene illustrations. Its graphics are four things, all built from simple shapes in code:

1. **The sprout mark.**
2. **Stickers.** One of four shapes, a flat colour, a white die-cut edge, a short shadow and one icon. Shown slightly tilted, straightening when touched.
3. **The ruler's tick marks,** which can also be used as a quiet divider.
4. **The dashed outline** for anything not yet earned or not yet added.

The real imagery is the family's own: **proof photos.** They are shown large and uncropped wherever possible. An empty state is a dashed outline, one sentence and one action, not a drawing.

## 10. Gamification visual language

The game sits on what was earned, not on the work. A task is called a task and described in plain words.

| Element | How it looks | Rule |
|---|---|---|
| XP | Green fill on the growth ruler, with the number in Baloo 2 | Only ever shown on the ruler. A gain says why: "+30 XP for Water the balcony plants". XP from proof that a parent has not approved yet is drawn after the marker as a dashed stretch, with its number and what it is waiting for: "30 XP waiting for a parent to approve". |
| Points | Gold star and an ink number | No gold background. Shown on a task before it is done, as what the task is worth. |
| Level | A numbered mark on the ruler; "Level 7" in Baloo 2 | The ruler always shows the current level, the next one and the distance: "350 XP to level 8". The next level is the dashed tile at the far end of the ruler: dashed because it is not reached yet. |
| Progress | The growth ruler: a ticked bar with an ink marker at the current value | Never fill alone. Never a ring or a percentage with no meaning. |
| Badges and achievements | Stickers. The shape says what kind: seal for task counts, shield for streaks, hexagon for levels, stars for a skill or a weekly quest. The colour follows the kind too: gold seals and stars, navy shields with a gold flame, green hexagons, green being the colour of growth. Icons: `Check` on a seal, `Flame` on a shield, `Sprout` on a hexagon, `Star` on a star. | Each sticker has a name and one sentence saying what earns it. The set is the fourteen listed in the sitemap, section 12. |
| Sticker chart | A grid of earned stickers and dashed empty slots | Empty slots show what is possible. Stickers not yet earned show how far along the child is, in numbers. |
| Streak | Gold flame, a number in Baloo 2, and a row of seven day marks, each a small square with the day's letter: solid gold for a day that counted, a dashed outline for a day that changed nothing, flat grey for a missed day. The flame is an outline until the streak is at least one. | A missed day ends a streak quietly and the best streak is kept. No countdowns and no "you will lose it" messages. |
| Rest day | A day mark with a solid `navy-800` border on white (on the band: `navy-200` on `navy-950`), with the day's letter | Set by a parent. Never missed; the streak survives it. Read out as "a rest day". |
| Streak reminder | One line on Today's band, under the streak, with an outline `Flame` | Only when a task is due today, is still open, no proof was sent today, and today is not a rest day. Factual: "A task is due today. Send proof for it to keep your 5-day streak." Never guilt, never a countdown. |
| Weekly quest | On Today's band, under the gains: `Flag`, "This week’s quest", the bonus as points, a short ruler (`ruler quest-ruler`) with its marker, and "3 of 5 tasks approved this week. 2 to go." | Set by a parent. Counts tasks by the week their proof was sent. Completes once a week. The bonus is points to spend, not XP. |
| Sealed surprise | `Gift` and "A surprise is sealed inside. It opens when the quest is complete." | The parent writes it. The child sees what unlocks it, never what it is, until it opens. Not chance: the parent chose it and the condition is shown. |
| Reward shop | The child's Rewards page: points to spend, then rewards as rows with their cost and "Ask for this", then the child's requests with their answers | Asking holds the points; "Not this time" returns them. Spending never lowers XP, level or points earned. |
| Cheer | An outline icon and the cheer's words, then the parent's line in quotes, under the approval stamp | Optional, chosen by the parent when approving. |
| Growth path | On Growth: the current level and the next five, as a vertical line of level tiles (solid for the current one, dashed ahead), with the XP each one starts at and any level sticker waiting there | Shows the road ahead. Tiles are not buttons. |
| Next stickers | Up to three stickers not yet earned, closest first, each as a dashed outline with "7 of 10 tasks approved" | Progress toward a sticker is shown in numbers with units. |
| Family leaderboard | On Growth, only when a parent turns it on and there are two or more children: siblings in order of tasks approved this week, with "you" marked | Siblings only. Task counts only, never XP or level. Starts again every Monday. |
| Milestone | A level mark on the ruler, or a streak length (7, 30 days), that awards a sticker | |
| Task ("quest") | A card: category tile, title, what to do, due time, points, status | Not renamed or themed. The category tile is the only flavour: a square tile holding the category's icon, 48 px on a card and 40 px in a row. The icon says what kind of task it is; the tile's colour says where the task stands, in the same roles as the status tag, so no colour leaves its job. Solid navy while the task is to do, pale navy in review, pale coral when it is overdue or sent back, solid green once it is approved. |
| Completion | Sending proof moves the task to "In review" | Nothing is awarded until a parent approves. The screen says so. |
| Verification | An approval stamp on the task: the seal outline with a tick, plus who and when ("Approved by Mum, today 6:40 pm") | Sending back needs a note. The child sees the note and a "Try again" button. |
| Reward moment | The one animation in the product, on Today's band, in a fixed order: the ruler grows from where the child last saw it to where it is now, and the XP number counts up with it; if a level was passed, the ruler fills, the level number lands and the ruler grows again from the start; then each new sticker lands, and then any weekly quest the approval completed. The ruler takes the slower `grow` duration on the `ease-grow` curve, so it reads as growing; a landing takes the `reward` duration on `ease-land`, with no overshoot; a short `pause` separates one step from the next. Everything moves by transform and opacity only, except the XP number, which changes while the ruler grows and at no other time. Everything approved since the last visit is gathered into this one sequence, with each reason written beside it. | Only on approval, a new sticker or a level-up. Once: never on reload, never looping. With reduced motion the new state simply appears. |

## 11. Parent vs child experience

The same tokens, type, shapes and icons. What changes is what leads, how dense it is and how much colour it carries.

| | Parent | Child |
|---|---|---|
| Order of priority | Clarity, oversight, action, insight | Clarity, action, progress, reward |
| Home leads with | Proofs waiting for review, then this week's tasks | The one next task, then the growth ruler, then new stickers |
| Navigation | Sidebar on desktop, bottom bar on mobile: Overview, Tasks, Rewards, Progress, Family. Overview carries the count of proofs waiting and Rewards the count of requests waiting. | Bottom bar with four places: Today, Growth, Stickers, Rewards |
| Layout | Lists and tables; several things per screen | One job per screen in a single column, at most 720 px wide even on desktop |
| Colour | Restrained: white and navy, colour only in status and charts | Committed: the navy growth band, full-colour stickers |
| Type | Lexend headings; Baloo 2 only on game numbers | Baloo 2 page titles and numbers; 18 px body |
| Controls | 44 px | Main button 56 px, full width on mobile |
| Progress shown as | Bar charts by week, a streak calendar, completion counts | The ruler and the sticker chart; no charts |
| On approval | A quiet confirmation | The reward moment |
| Proof photo | Large, with Approve and Send back beside or below it | A thumbnail of what was sent, with its status |

## 12. UX principles

1. **The next step is always on screen.** The child's home opens on the next task; the parent's on the proofs waiting.
2. **Nothing earned in secret, nothing watched in secret.** Every status shows who and when. The child can see what the parent sees about them; only a sealed surprise waits until it opens (section 13).
3. **Every reward says why.** Points, XP and stickers always name the task or rule that earned them.
4. **Reviews teach.** A proof cannot be sent back without a note, and the child always gets a way to try again. The word shown is "Sent back", not "Rejected".
5. **Real things look real.** Tasks use plain words and proof photos are shown large. Only earned things are dressed as a game.
6. **Progress is always readable.** Where you are, what is next and how far, in numbers with units.
7. **Engagement comes through the task.** Every pull back to GrowKid (a quest, a reward, a streak reminder, a sibling's week) leads to doing a real task and sending proof. No countdowns, no guilt, no reward for opening the app, nothing left to chance. Factual reminders are allowed on Today and nowhere else.
8. **One screen, one main action.** Especially for the child.
9. **Safety is plain.** Reporting, privacy and account controls look like ordinary serious interface, are never themed as a game, and are reachable from every screen.
10. **Empty and broken states give the next step.** They say what happened and what to do, with one action.

## 13. Anti-patterns

GrowKid does not use these. Check this list before merging interface work.

Visual:

- Gradients, as backgrounds or decoration.
- Glass, blur, glows, floating blobs or decorative shapes.
- Shadows on anything that is not floating above the page.
- Pill-shaped buttons, inputs or tags.
- A grid of cards as the default layout, or cards inside cards.
- Emoji as icons, mascots, cartoon characters, stock illustration.
- A colour used outside its job: gold on a button, green as decoration.
- Baloo 2 on functional text. All-caps labels.
- A dark, neon "gamer" look.
- Any colour, radius, shadow or font that is not a token.

Behaviour:

- Numbers the system does not really compute, such as a "productivity score".
- Countdown timers, guilt wording, or rewards for simply opening the app.
- Random rewards: spins, loot boxes, mystery prizes. A sealed surprise is not random: the parent writes it and the child sees what opens it.
- Ranking children outside their own family, or ranking siblings without the parent turning it on. The family leaderboard counts tasks only.
- Guilt wording on the button that declines something.
- Anything the parent can see about the child that the child cannot. The one thing a child does not see is a sealed surprise, which is about a reward, not about them, and only until it opens.
- Celebration animation for routine actions.
- More than one main button on a screen.
- Dialogs for routine steps.

## 14. Responsive philosophy

Design the phone first. Three ranges: phone below 640 px, tablet 640 to 1023 px, desktop from 1024 px.

Most things reflow. These change shape:

| Component | Phone | Desktop |
|---|---|---|
| Navigation | Bottom bar | Parent: 240 px sidebar. Child: top bar. |
| Parent review (on the task's page) | Photo full width, Approve and Send back fixed at the bottom within thumb reach | Proof on one side, task details and actions on the other |
| Tables | Stacked rows: title, then status and due time | Real tables |
| Sending proof | Camera first, using the native file input | File picker with drag and drop |
| Dialogs | Sheets rising from the bottom | Centred dialogs |
| Sticker chart | Three per row | Six per row |
| Charts | One measure at a time | Side by side |
| Creating a task | One column, fields in order | Form with a live preview of the task card |

The child's screens stay a single narrow column at every size. A wide screen gets more space around it, not more columns.

## 15. Accessibility principles

The target is WCAG 2.2 level AA.

- **Contrast.** Text at least 4.5:1; large text and interface outlines at least 3:1. Section 5 lists the measured pairs. Input borders use `navy-600`.
- **Not colour alone.** Every status is icon, word and colour (section 8). Progress always has a number.
- **Focus.** A 3 px `navy-800` outline, offset 3 px, on every focusable element; white on navy surfaces. Never removed.
- **Keyboard.** Everything works without a pointer, in reading order. A skip link leads each page. Dialogs trap focus and close on Escape.
- **Touch.** Targets at least 44 px; the child's main action 56 px.
- **Motion.** Movement is transform and opacity only. One exception: during the reward moment the XP number counts up while the ruler grows. No other number in the product changes on its own. With reduced motion on, the reward moment becomes an immediate state change with no movement.
- **Reading.** 14 px minimum, lines of about 70 characters at most, short sentences on child screens.
- **Errors.** Shown beside the field, tied to it for screen readers, and saying what to do: "Add a day and time so Aarav knows when it is due."
- **Images.** A proof photo is labelled with who sent it and for which task. Charts have a one-line text summary.
- **Time.** Nothing times out while someone is reading or typing.

## 16. Component taxonomy

Categories only. Components are specified when they are built.

| Category | Components | Audience |
|---|---|---|
| Navigation | App shell, sidebar, bottom bar, top bar, skip link | Both, different shells |
| Actions | Button (main, approve, secondary, danger, text), icon button, link | Both |
| Inputs | Text, long text, select, date and time (native), file and camera (native), checkbox, radio, switch | Both |
| Tasks | Task card, task row, task detail header, status tag, due indicator, category tile | Both |
| Proof | Proof uploader, proof viewer, review bar, feedback note, approval stamp | Uploader: child. Review: parent. |
| Progress | Growth ruler, step tracker (to do, in review, approved), streak week, rest day mark | Mostly child |
| Rewards | Points display, XP gain, sticker, sticker chart, reward moment, quest bar, sealed surprise, cheer, reward list, request row, growth path, next stickers, family leaderboard | Mostly child. Reward list, request row, quest setup and cheer: parent too. |
| Feedback | Toast, inline message, banner, dialog or sheet, confirmation | Both |
| Data | Table, list, statistic, bar chart, streak calendar | Parent |
| People | Avatar, child switcher | Parent |
| States | Empty, loading (skeleton), error | Both |

## 17. Design tokens

Names are how the tokens should appear in the Tailwind theme.

**Colour**

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `white` | `#FFFFFF` | | `sprout-100` | `#DFF6E8` |
| `navy-50` | `#F5F6FC` | | `sprout-300` | `#8FE0B1` |
| `navy-100` | `#E8EAF6` | | `sprout-500` | `#2EBD6B` |
| `navy-200` | `#D3D7EC` | | `sprout-800` | `#146C3A` |
| `navy-400` | `#8D94BA` | | `sun-300` | `#FCD77F` |
| `navy-600` | `#4A5180` | | `sun-500` | `#F7B733` |
| `navy-800` | `#1F2A6B` | | `sun-800` | `#8A5A00` |
| `navy-950` | `#0E1436` | | `coral-100` | `#FDE7E7` |
| `ember-100` | `#FFE8D4` | | `coral-500` | `#D93A40` |
| `ember-500` | `#D9620B` | | `coral-700` | `#A8262B` |
| `ember-800` | `#8F3D05` | | | |

`navy-400` is for disabled content and dashed "not yet" outlines only. It is 3.0:1 on white and must never be the only carrier of information. Placeholder text uses `navy-600`.

**Type**

| Token | Value |
|---|---|
| `font-sans` | Lexend, then the system sans-serif |
| `font-display` | Baloo 2, then Lexend |
| Sizes (px) | 14, 16, 18, 24, 28, 32, 40, 48 |
| Weights | Lexend 400, 500, 600. Baloo 2 700, 800. |

**Spacing** (4 px base): 4, 8, 12, 16, 24, 32, 48, 64. Inside a component use 8 to 16; between components 24; between sections 48. Page gutter 16 on phones, 32 on desktop.

**Radius**

| Token | Value | For |
|---|---|---|
| `radius-tag` | 6 px | Tags, checkboxes, icon tiles, the ruler |
| `radius-control` | 10 px | Buttons, inputs, menu items |
| `radius-card` | 16 px | Cards, dialogs, sheets, photos |
| `radius-full` | 9999 px | Avatars only |

**Borders**

| Use | Value |
|---|---|
| Dividers and card edges | 1 px `navy-200` |
| Inputs and secondary buttons | 1 px `navy-600`; 2 px `navy-800` when focused or selected |
| Not yet | 2 px dashed `navy-400` |
| Ruler marker | 2 px `navy-950` |

**Shadows**

| Token | Value | For |
|---|---|---|
| none | | Everything at rest |
| `shadow-overlay` | `0 12px 32px -12px rgb(14 20 54 / 0.30)` | Menus, dialogs, toasts |
| `shadow-sticker` | `0 2px 0 rgb(14 20 54 / 0.12), 0 6px 8px rgb(14 20 54 / 0.16)` | Stickers |

**Motion**

| Token | Value | For |
|---|---|---|
| `press` | 100 ms | Button press |
| `state` | 200 ms | Hover, selection, tags changing |
| `overlay` | 300 ms | Dialogs and sheets |
| `reward` | 600 ms | A landing in the reward moment: a sticker, a new level number |
| `grow` | 1,000 ms | The ruler growing in the reward moment |
| `pause` | 150 ms | The gap between two steps of the reward moment |
| `ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | Default |
| `ease-land` | `cubic-bezier(0.22, 1, 0.36, 1)` | A sticker landing: fast in, soft stop, no bounce |
| `ease-grow` | `cubic-bezier(0.45, 0, 0.25, 1)` | The ruler growing: a slow start and a slow stop, so it reads as growth and not as a landing |

No looping animation and no entrance animation on page content.

**Breakpoints and widths:** 640 px and 1024 px. Parent content up to 1120 px, sidebar 240 px, child column up to 720 px.

## 18. Future design implementation rules

1. **Tokens only.** No hex values, pixel radii, shadows or font names inside components.
2. **Change it here first.** A new colour, radius, shadow, font or component category is added to this document, with its reason, before it is added to code.
3. **Reuse before adding.** Check section 16 for an existing component.
4. **A screen is not done without its states.** Empty, loading and error are designed with it.
5. **One main action per screen.**
6. **Every status is icon, word and colour.**
7. **Read section 13 before merging.**
8. **Test at 360 px wide and with the keyboard alone** before calling a screen finished.

### Assumptions to confirm

- **Age.** The synopsis gives no age range; this document assumes 8 to 14.
- **Points and XP.** Separate since the engagement layer: XP and points earned only grow; `balance` is what can be spent in the reward shop.
- **Badges.** Which stickers exist and what earns each comes from the scoring rules. The shape-to-kind mapping in section 10 is a proposal.
- **Task categories.** Accepted on 9 October 2026: tasks have a category field, and the six categories in section 8 are the set. Changing the set means changing section 8 first.
- **Fonts** are hosted with the app, through `@fontsource/lexend` (400, 500, 600) and `@fontsource/baloo-2` (700, 800), imported once in `client/src/main.jsx`. No page asks Google or anyone else for a typeface.
- **Engagement layer.** Its rules are the sitemap's rules 17 to 24, accepted on 30 October 2026.

### What the code has today

`client/src` implements the foundations of this document and all eleven steps of the sitemap's build order, so every one of the 21 pages exists: the shells, sign in, sign up, Family and the child form, tasks on both sides, review and Overview, the rewards, Progress with its report, Settings, reporting with the moderator's page, and the two public pages, Landing and Safety and privacy. The whole loop runs: a parent creates a task, the child sends proof, the parent sends it back with a note or approves it, and on approval the child sees the reward moment on Today, keeps a streak, earns stickers and can look back at all of it on Growth and Stickers. The engagement layer sits on that loop and every piece of it is built: a reward shop on both sides (the child asks, the parent answers), a weekly quest with an optional sealed surprise, parent cheers with an approval, the growth path and the next stickers, the streak reminder, rest days, the child choosing the next task, and a family leaderboard that is off until a parent turns it on in Settings. The server is built (`server/`), and every call in `api/index.js` goes to it. The typefaces are served by the app itself, and `client/e2e/loop.spec.js` runs the whole loop in the built app, with an axe check on every page it visits that found nothing serious on 15 November 2026. Since final plan Phase 3, proof is a photo or a video only (an older PDF downloads), Sign up and the add-a-child form each end with a consent tick, a screened word in a send-back note, a cheer's line or a decline note is named beside that field or in the review bar, Sign in says when a family is paused, and Safety and privacy carries an "Updated" date. Since Phase 4, each page's code loads when it is first opened; a page opened again shows what it last loaded at once and refreshes quietly, and the banner at the top says "Could not refresh. Showing what was here at …" after two failed refreshes; long lists show 50 at a time with a quiet "Show more" button (secondary); an earlier attempt's proof opens from a "Show what was sent" disclosure; a child can cancel an upload; and every day and time on screen is in the family's time zone.

| File | What it holds |
|---|---|
| `index.css` | Every token in section 17. The type roles as utilities: `type-display`, `type-headline`, `type-game`, `type-game-lg`, `type-heading`, `type-subheading`, `type-body`, `type-body-child`, `type-small`, `type-data`. The base classes: `btn`, `file-button`, `field`, `card`, `tag`, `avatar`, `not-yet`, `icon-earned`, `on-navy`, `muted`, `ruler` (with `ruler-waiting` and `ruler-goal`), `sticker`, `logo`. For the shells and shared states: `nav-item`, `nav-rail`, `nav-bar`, `growth-band`, `band-open`, `door-band`, `volume-child`, `menu`, `dialog`, `skeleton`, `message`, and the utility `min-h-page`. For tasks, proof and review: `task-card`, `press-all`, `task-row`, `drop-over`, `settle`, `category-tile` (coloured by status), `choice`, `stamp`, `nav-count`, `review-bar`. For rewards: `ruler-growth` with `ruler-fill` (the ruler that moves by transform), `xp-count` with `xp-now` and `xp-left` (the two XP numbers, which count while the ruler grows), `land`, `day-mark` and `day-rest` (a rest day a parent set), `sticker-slot`, `quest-ruler` (the weekly quest's slimmer ruler), and the growth path's `path-step`, `path-here` and `path-level`. For Progress: `bars` with `bar-well` and `bar` (the weekly chart), `btn-switch` (the child switcher), and the print rules that turn Progress into the report. For the public pages: `ruler-rule`, the ruler's tick marks as a quiet divider between sections. |
| `components/Logo.jsx` | The mark and the lockup |
| `components/StatusTag.jsx` | The six states in section 8 |
| `components/GrowthRuler.jsx` | Level progress with its marker, the next level at the far end, and the dashed stretch of XP waiting for approval. Given the score the child last saw, it grows from there with the XP numbers counting beside it: the first part of the reward moment. |
| `components/Streak.jsx` | The flame, the number and the seven day marks |
| `components/Task.jsx` | The category tile, points, the due time, the child's task card and the task row |
| `components/Review.jsx` | The approval stamp, the note on a proof that was sent back, and the earlier attempts |
| `components/Cheer.jsx` | A parent's cheer with an approval (an icon, words and the parent's own line), and the picker a parent adds one with |
| `components/Quest.jsx` | The weekly quest as a slim ruler with a status line and, when there is one, its sealed surprise |
| `components/GrowthPath.jsx` | The levels ahead as a line of tiles with the sticker each level earns, and the stickers the child is closest to |
| `components/Request.jsx` | A reward request's tag and its asked-and-answered line, the same for the child and the parent |
| `utils/cheers.js` | The six cheers: their words and icons |
| `components/Proof.jsx` | One proof: the photo or video, and the note. A PDF sent before PDFs were dropped (sitemap rule 5, C2) is a button that downloads it |
| `components/Sticker.jsx` | Four shapes, three colours, the locked state and the empty slot of the chart |
| `components/Shells.jsx` | The parent, child, moderator, public and sign-in shells, with navigation, the account menu and Sign out |
| `components/Guards.jsx` | Who may open what, and the redirects |
| `components/states.jsx` | The shared states: loading, empty, error, inline message, no-network banner |
| `components/ConfirmDialog.jsx` | The confirm step (final plan Phase 5): a native modal dialog whose heading asks the act as a question, whose first button backs out in words and whose second does the act, red only when something is lost. `hooks/useForm.js` holds what every form repeats: values, tried, busy, the problem and the first invalid field |
| `components/Field.jsx` | A labelled input, long text or select with hint and error; the password field; a requirement that ticks itself off |
| `pages/` | Landing, Safety and privacy, Sign in, Sign up, Overview, Family, Child form, Tasks, Task form, Task detail (parent, with Approve and Send back), Progress (with the printed report), Settings, Today (with the reward moment), Task (child, with sending proof and trying again), Growth, Stickers, Report a problem, Reports (moderator), Not found |
| `api/` | The API contract (`index.js`, `errors.js`): one function per call to the server, over one Axios instance. In development, `?dev=slow\|fail\|offline\|ok` simulates a slow, failing or absent server. `clock.js` is the clock, which development can move with `?clock=<days>`; the server's clock moves with it. The award and progress rules, and what deleting a family removes and keeps, are the server's, checked by its tests (`server/test/`). |
| `hooks/`, `utils/` | Loading data and one-time notes; form rules, how times and sizes are written, the six categories, and the rule for which task is next. `utils/words.js` holds the 150 words behind "Make one for me" on the child form. `npm run check` in `client/` runs the runnable checks: `utils/tasks.check.js`, `api/errors.check.js` and `utils/words.check.js`. |
| `pages/Rewards.jsx` | The child's reward shop: points to spend, what each reward costs or how far away it is, an in-place confirm to ask for one, and the requests so far with their answers |
| `pages/ParentRewards.jsx` | The parent's side: requests to give or decline (with a note), the rewards with the one form that adds or changes them, and a weekly quest for each child |
| `pages/DesignSheet.jsx` | A reference page showing the tokens and game pieces. It is at `/design` in development builds only. |

Tailwind's default colour, type-size, radius, shadow and breakpoint scales are switched off in `index.css`, so a class such as `text-sm`, `rounded-xl` or `md:` does nothing. Use the tokens and type roles instead.

How the shells apply this document:

- **The current page is a pencil mark.** The parent's sidebar ends in a ruler edge (the tick marks of section 9), and the current page is the ink line crossing it. On phones the same edge runs along the top of the bottom bar. In the child's shell the current page is a white tile on navy instead: the same idea, louder.
- **Page titles take their role from the shell.** An `h1` is the Heading role everywhere, and the Display role inside the child's shell.
- **Sign in and Sign up** sit beside a navy band with the ruler along its edge: across the top on a phone, down the left on a desktop.
- **Consent is one plain tick** (sitemap rule 16, C8). Sign up and the add-a-child form each end with one native checkbox, its sentence beside it and a link to Safety and privacy under it. It starts unticked, and sending without it marks the box with its reason in words, like any other field.
- **Sign out is its own button** beside the account menu, not an item inside it, so that it is one tap away on a shared device.
- **Today opens the band.** The navy bar grows downward to hold the level and the ruler, full width, while its content keeps to the child's column. The streak joins it when the scoring rules define a day.
- **The no-network banner stays in view** at the top, and each shell's sticky bar sits below it.

How tasks and proof apply it:

- **A card answers a press.** The child's task card moves as one piece under the finger, and its button's hit area covers the whole card.
- **Sending proof stays on the task's page:** choose, look at it, send. A phone or tablet opens the camera first; a desktop gets a file chooser and a place to drop. The upload is drawn as a ruler filling. Afterwards the page says "In review" and that nothing is awarded yet, and nothing celebrates.
- **A control that is closed says why.** Once proof is sent, Edit is shown disabled with the reason beside it.
- **The parent's task form previews the child's card** beside the form on a desktop, as the parent types.
- **Repeating is a choice in the form, not a separate place** (sitemap rule 9, H1). A new task offers Repeat: Never, Every day or Chosen days, as the same `choice` tiles the categories use; chosen days are seven small tiles, Monday first; a repeating task asks for a time each day instead of a due date. Tasks and the task page say "Repeats Mon, Wed" in quiet small text, and the task page offers Stop repeating, a primary confirm because nothing is lost. A task can be duplicated into the form, with its due time left empty.
- **What done looks like** (H5) is an optional line under What to do, shown to the child just above the proof form and beside the proof on the parent's review.

How review applies it:

- **Review has one main button.** Approve is green and alone. Send back is quieter and opens its note in place, never in a dialog. On a phone the two stay at the bottom of the screen, above the navigation, while the proof is looked at.
- **What a review leaves is the same for both.** The stamp (who and when), the note and every earlier attempt are shown to the parent and to the child alike.
- **An approval pays out on Today's band,** beside the ruler it moved: the gain, the task it was for and the stamp. It is shown once and nothing moves; the reward moment comes with Growth and Stickers.
- **A sent-back task leads Today,** with the parent's note where the instructions were and Try again as the button.
- **Overview is not a dashboard.** It opens on the proofs waiting, oldest first, and its navigation item carries their count.

How the rewards apply it:

- **The reward moment is one sequence on Today's band.** The ruler grows from where the child last saw it (1,000 ms on `ease-grow`) and the XP number counts up with it; if a level was passed it fills, the new level number lands on an empty ruler (600 ms on `ease-land`) and the ruler grows again from the start; then each new sticker lands (600 ms, 120 ms apart). A 150 ms pause separates each step from the next, so a new level is not swallowed by the ruler. Nothing overshoots. Everything moves by transform and opacity; the number counts through a registered CSS property on the same clock as the ruler. Each gain and each sticker has its reason written beside it from the start.
- **It plays once, and only when it can be watched.** Everything approved since the last visit is gathered into the one sequence. A result counts as seen only after its sequence has run to the end, so leaving early or loading in a hidden tab does not use it up. A second approval during the same visit plays only what is new.
- **A reward is given on Today first.** Until then Growth and Stickers show the score as the child has seen it, the task's own page says only that it was approved, and Today's navigation item carries a gold count.
- **With reduced motion** the new level, ruler and stickers are simply there.
- **The sticker chart is an album, not a locked shop.** An empty slot is the sticker's dashed outline and its name, with no padlock and no bar. A sticker's details say how far along it is and show the padlock, beside "Not earned yet"; Growth lists the three a child is closest to.
- **The streak is calm.** A flame, a number and seven day marks. A missed day turns grey and the number goes back to nought, with no message.

How Progress and the report apply it:

- **Progress is the parent's one page of charts, and it is not a dashboard.** It opens on the child's level and ruler, then says the counts in two sentences. There are no statistic tiles.
- **The weekly chart stands on the ruler's edge.** Six bars, one a week, growth-green with the ruler's ink mark across the top of each, so a bar's height never rests on a pale fill alone (the green is 2.4:1 on white). Every bar carries its number, its week and the XP earned, and the chart has a sentence that says the same. One series, so no legend, and no hover layer: nothing is hidden behind one.
- **The streak calendar is the child's day marks, four weeks of them,** a week to a row, with a legend in words.
- **One measure at a time on a phone:** a three-way choice between the weeks, the streak and the stickers. From the desktop width they sit together.
- **Nothing watched in secret.** The page says that the child sees all of it too, and it shows no number the child cannot find on Growth, Stickers or Today.
- **The report is the page, printed.** Download report asks for the figures again, says so while it waits, and opens the browser's print window. On paper the shell, the buttons and the switches are gone, a heading names the child, the parent and the time, and colours are kept because the bars and marks mean nothing without them.

How the serious pages apply it:

- **Settings is seven plain sections** divided by a rule: name, password, signed-in devices, country, family leaderboard, notifications on this computer (H12), deleting. The child form has the same shape: name, password, signed-in devices, removing. A step that signs someone out asks once in a dialog and answers with a success message; its confirm button is the primary one, because nothing is lost. No sidebar and no red box. The one red button in it is inside the dialog, on the act itself.
- **Deleting the family's data is a dialog that lists exactly what goes** and asks for the password. The button that backs out says "Keep everything". The one thing deleting keeps is a report no moderator has answered yet, with no account and no link back; the dialog says so.
- **Report a problem is one box.** No category to choose. It says who reads a report and that the family is not told, and what the moderator is and is not shown. Sending it turns the page into a confirmation that says what happens next, with no time promised, and a helpline number. Both screens look the same in the child's shell and the parent's, apart from size.
- **The moderator's page is a work list.** Reports waiting, oldest first; one opens in place, shows the task it came from as a quoted block, and takes an answer. An answered report leaves the list.

How the public pages apply it:

- **Landing is the app's own pieces, finished and still.** Five parts in a fixed order: the opening (the headline, one sentence, the one main button, a quieter Sign in link, and a child's growth band built from the real `GrowthRuler`, `Streak` and `Sticker` with made-up numbers under a caption that says so), how it works, what a parent gets and what a child gets, safety in three statements, and the close. Nothing animates: the band is in its finished state and the reward moment stays inside the app.
- **How it works is one task you can follow.** A native radio group (`choice`) swaps the real task card and the ruler through To do, In review and Approved. The ruler is drawn again for each step instead of being moved, so it never grows on this page.
- **The ruler's tick marks divide the page,** with `ruler-rule` between the sections. The only card is the task card.
- **The headline uses the Headline role (section 6):** Lexend 600 at 40/44, 32/36 on a phone. Baloo 2 stays for the game and child page titles.
- **Safety and privacy is one narrow column** of plain headings and short paragraphs that a child can read, with no accordion. It says what is true today: everything is stored on the GrowKid server, passwords are hashed, photos and most phone videos are stored without their location, one sign-in cookie lasts up to 7 days, no moderator is assigned yet, and nothing, the typefaces included, is asked of another company. An "Updated" line under the title gives the date the page last changed, which is the version a parent's consent is recorded against.
- **The footer links only to pages that exist:** Safety and privacy, Sign in and Create a parent account. Under the links, in small quiet text, it says who built GrowKid (four BTech students: Aryan D’Cruz, Vedant Bane, Niddhi Machhi and Rajat Madan) and the contact address, MIT-ADT, Loni Kalbhor, Maharashtra 412201, as the team gave them on 16 November 2026.

Not built yet: every task state exists except "Due soon", which waits for a rule saying how soon. The frontend is otherwise complete and runs on the GrowKid server. GrowKid is not hosted: both run on one computer.
