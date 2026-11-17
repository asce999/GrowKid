/**
 * The GrowKid API as the frontend sees it. Pages and stores call only these functions.
 *
 * Each one is an HTTP call to the GrowKid server under /api (the paths are in server/src/routes/).
 * Every function is async and rejects with an ApiError (see ./errors.js).
 *
 * In development only, ?dev=slow|fail|offline|ok (per tab) simulates a slow, failing or absent
 * server, and ?clock=<days> moves the clock (see ./clock.js).
 *
 * @typedef {'parent' | 'child' | 'moderator'} Role
 * @typedef {{ colour: 'navy' | 'sprout' | 'sun' | 'ember', stickerId: string, shape: string, kind?: string }} Avatar  a child's badge (K10)
 * @typedef {{ id: string, role: Role, name: string, email?: string, username?: string, zone?: string, avatar?: Avatar, sound?: boolean }} User (zone: the family's time zone, P13; none for a moderator. avatar and sound: a child's, K10 and K11)
 *   A parent or moderator has an email; a child has a username. Never a password.
 * @typedef {{ id: string, name: string, username: string, agreedAt?: string, avatar?: Avatar }} Child  agreedAt: when the child agreed to the family agreement (K7), absent until then
 *
 * @typedef {object} Review  A parent's answer to one proof.
 * @property {'approved' | 'sentBack'} result
 * @property {string} note        what to fix; always present when sent back, '' when approved
 * @property {string} by          the parent's name, as the child sees it
 * @property {string} at          ISO time
 * @property {Cheer} [cheer]      the parent's words with an approval; present only when they chose a kind or wrote a line
 *
 * @typedef {object} Proof  One attempt at proving a task: a file, a note, or both.
 * @property {string} id
 * @property {string} note        '' when there is none
 * @property {string} [fileUrl]   an address the browser can show; only on getTask and sendProof
 * @property {string} [fileName]
 * @property {string} [fileType]  the MIME type: image/... or video/...; application/pdf only for a PDF sent before PDFs were dropped (sitemap rule 5, C2), which downloads
 * @property {number} [fileSize]  in bytes
 * @property {{ at: string, afterDays?: number }} [removed]  the file was deleted for age (T4); fileUrl is then absent
 * @property {string} sentAt      ISO time
 * @property {boolean} late       sent after the task's due time
 * @property {Review} [review]    absent while the proof waits for a parent
 *
 * @typedef {object} Task
 * @property {string} id
 * @property {string} childId
 * @property {string} childName
 * @property {'chores' | 'study' | 'reading' | 'creative' | 'outdoors' | 'health'} category
 * @property {string} title
 * @property {string} instructions
 * @property {string} dueAt       ISO time
 * @property {number} points      what the task is worth: 5 to 100, in fives
 * @property {'todo' | 'review' | 'sentBack' | 'approved'} status  "Overdue" is not stored: it is
 *   'todo' with dueAt in the past. A task takes proof while it is 'todo' or 'sentBack'.
 * @property {string} createdAt   ISO time
 * @property {Proof[]} proofs     every attempt, oldest first; only the newest can be waiting
 * @property {boolean} resultSeen false from a review until the child has seen its result on Today
 * @property {boolean} pinned     the child chose this as the task to do next, and it is still open
 * @property {string} doneLooksLike  what finished looks like (H5), or empty
 * @property {string} [seriesId]      the repeating series that made it (H2), while that series runs
 *
 * @typedef {object} TaskDetails  What a parent types.
 * @property {string} childId
 * @property {string} category      one of the six categories
 * @property {string} title         3 to 80 characters
 * @property {string} instructions  1 to 500 characters
 * @property {string} dueAt         ISO time; in the future when the task is new or the time changes
 * @property {number} points        5 to 100, in fives
 *
 * @typedef {object} Streak
 * @property {number} days   days that count since the last missed day
 * @property {number} best   the longest it has been
 * @property {{ day: string, state: 'done' | 'missed' | 'none' | 'rest' }[]} week  the last seven days, today last
 *   A day is 'done' when proof the child sent that day was approved, whenever that happened;
 *   'missed' when a task was due on it and no proof for that task had been sent by the end of
 *   the day, unless the child sent any proof that day, whatever became of it (so a parent sending
 *   it back never makes a missed day); otherwise 'none', which changes nothing. A day a parent set
 *   as a rest day is 'rest' instead of 'missed': it neither adds to the streak nor breaks it, and
 *   if proof was approved on it, it is 'done'.
 *
 * @typedef {object} Score
 * @property {number} level
 * @property {number} xp          XP earned inside the current level
 * @property {number} xpForNext   what the level needs: 100
 * @property {number} points      every point ever earned; an approved task's points are its XP
 * @property {number} waitingXp   the points of tasks whose proof is waiting for approval
 * @property {Streak} streak
 * @property {number} balance     points that can be spent: points, plus the bonus of every quest
 *   completed, minus the cost of every request that is waiting or given. Spending never lowers
 *   points, XP or level
 * @property {Quest | null} quest this week's quest, or null when none is set
 *
 * @typedef {Score & { shown: Score, questAwards: QuestAward[], goal?: Reward | null, weeks?: Progress['weeks'], bestWeek?: number }} Growth
 *   shown is the score as the child has been shown it on Today: an approval whose result they
 *   have not seen yet (resultSeen false) still counts as waiting there, and so does a quest
 *   completed with it. The reward moment plays from shown to the score itself. What a child can
 *   spend is shown.balance. questAwards are the quests completed, newest first. For a child only: goal, the reward they are
 *   saving for (K3), or null; weeks, their last six weeks as Progress has them, and bestWeek, the most tasks approved in any one
 *   week, both from the score as they have been shown it (K4).
 *
 * @typedef {object} Sticker
 * @property {string} id
 * @property {string} name
 * @property {string} how         one sentence saying what earns it
 * @property {'seal' | 'shield' | 'hexagon' | 'star'} shape  task counts, streaks, levels, a skill
 * @property {'sun' | 'sprout' | 'navy'} tone
 * @property {'approved' | 'streak' | 'level' | 'kinds' | 'firstTry' | 'quests'} measure  what it is
 *   counted by: tasks approved, best streak, level, kinds of task done, tasks right first time,
 *   or weekly quests completed
 * @property {number} need        how much of that earns it
 * @property {number} [have]      how much of it the child has, at most need; only on a sticker not
 *   yet earned or not yet seen, and only from listStickers
 * @property {string[]} [missing]  the All six kinds sticker only, while not earned or not seen: the kinds still to do (K1)
 * @property {string} [earnedAt]  ISO time of the approval that earned it; absent until earned
 * @property {string} [taskId]    the task that approval was for
 * @property {string} [taskTitle]
 * @property {boolean} [seen]     whether the child has seen that approval on Today
 *
 * @typedef {object} Progress  One child's progress, as their parent sees it. Score is the real one.
 * @property {Child} child
 * @property {{ start: string, tasks: number, xp: number }[]} weeks  the last six weeks, Monday to
 *   Sunday, this week last: the tasks approved and the XP they earned. A task belongs to the week
 *   its approved proof was sent in.
 * @property {{ day: string, state: 'done' | 'missed' | 'none' | 'rest' }[]} calendar  the streak's
 *   day marks, from the Monday three weeks before this week's up to today; 'rest' is as in Streak
 * @property {{ approved: number, waiting: number, open: number, overdue: number }} counts  tasks
 *   approved, waiting for review, still to do (sent back included), and how many of those are overdue
 * @property {Sticker[]} stickers  every sticker, with earnedAt on the ones earned; no `seen`
 *
 * @typedef {object} ReportItem  A copy of the task a report was sent from, made at that moment.
 *   Words only: no proof file, no note a child wrote and nobody's name.
 * @property {string} title
 * @property {string} instructions
 * @property {string} dueAt
 * @property {number} points
 * @property {string[]} notes   the notes a parent sent proof back with, oldest first
 * @property {number} proofs    how many times proof had been sent
 *
 * @typedef {object} Report
 * @property {string} id
 * @property {'parent' | 'child'} from  the role of whoever sent it. Never who.
 * @property {string} details           their own words, up to 1,000 characters
 * @property {string} sentAt            ISO time
 * @property {ReportItem} [item]        present when it was sent from a task's page
 * @property {{ note: string, at: string }} [resolution]  the moderator's answer, once resolved
 * @property {boolean} [senderGone]  true on a kept report whose sender has since been deleted; the
 *   moderator's copy only. Answering it deletes it, because nobody is left to read the answer
 * @property {boolean} [paused]  the moderator's copy only: the sender's family is paused (T2)
 *
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
 * @typedef {{ name: string, tasks: number, you: boolean, avatar?: Avatar }} LeaderboardEntry
 * @typedef {{ id: string, fileUrl: string, fileType: string, taskId: string, taskTitle: string, at: string, cheer?: Cheer }} MyProof
 *   an approved photo or video of the signed-in child's (K5); at is when it was approved
 * @typedef {{ id: string, childId: string, childName: string, ideaId: string, createdAt: string }} Suggestion  a child's suggestion
 *   of one of utils/ideas.js's ideas, still waiting (K6); ideaId may name an idea the app no longer has
 * @typedef {{ series: { id: string, title: string, weekdays: number, dueTime: string, points: number }[], rewards: Reward[] } | { agreedAt: string }} Agreement
 *   what Today asks a child to agree to (K7), or, once they have, only when they agreed
 */
import axios from 'axios'
import { daysAhead } from './clock.js'
import { ApiError, toApiError } from './errors.js'

export { ApiError } from './errors.js'
/** The time. Development can move it (see ./clock.js); ask here, not `new Date()`, for "now". */
export { now } from './clock.js'

// ------------------------------------------------------------------ the wire

// P15: a call gives up after 20 seconds, so a page never waits forever; sendProof sets none, as an upload takes as long as it takes
const http = axios.create({ baseURL: '/api', headers: { 'X-GrowKid': '1' }, timeout: 20_000 })
/** P15: an id as one path segment, whatever it holds: a "/" or "?" in it can never reach another route. */
const at = (id) => encodeURIComponent(id)

// Rule 5, proof files: one photo or video of up to 25 MB (C2: no PDF). Checked here only to spare an upload; the server decides.
const MAX_FILE_BYTES = 25 * 1024 * 1024
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']

/*
 * Development only: open any page with ?dev=<mode> to reach a state on purpose. It lasts for the
 * browser tab; ?dev=ok goes back.
 *   slow, fail, offline   every call (checking who is signed in and signing out still work)
 * Sending a proof file slowly, or failing half way, is the browser's own network throttling now.
 */
const DEV_KEY = 'growkid.dev'
if (import.meta.env.DEV) {
  const asked = new URLSearchParams(window.location.search).get('dev')
  if (asked) sessionStorage.setItem(DEV_KEY, asked)
}
const devMode = () => (import.meta.env.DEV ? sessionStorage.getItem(DEV_KEY) : null)

if (import.meta.env.DEV) {
  http.interceptors.request.use(async (config) => {
    config.headers['X-Clock-Days'] = daysAhead()
    const own = config.url === '/session' && ['get', 'delete'].includes(config.method)
    const mode = own ? null : devMode()
    if (mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 6000))
    if (mode === 'offline') throw new ApiError('NETWORK')
    if (mode === 'fail') throw new ApiError('SERVER')
    return config
  })
}

/** One request. Resolves to the answer's body; rejects with an ApiError: the server's code, or NETWORK when there was no answer. */
async function call(method, url, data, config) {
  try {
    return (await http.request({ method, url, data, ...config })).data
  } catch (error) {
    throw toApiError(error)
  }
}

// ------------------------------------------------------------------ accounts and family

/**
 * Who is signed in on this device.
 * @type {() => Promise<User | null>}
 */
export const getSession = () => call('get', '/session')

/**
 * Signs in a parent or moderator by email, or a child by username.
 * Rejects WRONG_DETAILS whether the account or the password is the wrong part, TOO_MANY after
 * too many wrong tries, and PAUSED, after the right password, for a family paused while a report is looked at (C6).
 * T1: a moderator also sends `code`, the 6 digits from their authenticator app. After the right password it rejects NEEDS_CODE
 * when the code is missing, and NEEDS_CODE with fields.code 'wrong' when it does not match or was used already.
 * @type {(details: { identifier: string, password: string, code?: string }) => Promise<User>}
 */
export const signIn = (details) => call('post', '/session', details)

/**
 * Creates a parent account and its family, and signs the parent in. country is a code from
 * listCountries; the family's days follow that country's time zone (rule 25).
 * Rejects EMAIL_TAKEN, TOO_MANY, or INVALID with fields name, email (format), password (8 or more;
 * 'common' or 'personal' when it is easy to guess), country ('required': not one of the countries) or
 * consent ('required' unless it is true: the parent's tick, C8).
 * T5: it resolves with the parent's recovery code too, 16 letters and digits. This is the only time the code is sent; the server
 * keeps only its hash.
 * @type {(details: { name: string, email: string, password: string, country: string, consent: boolean }) => Promise<User & { recoveryCode: string }>}
 */
export const signUp = (details) => call('post', '/parents', details)

/**
 * Sets a new password for a parent who forgot theirs, with their email and recovery code (T5). It signs every device out and uses
 * the code up; the parent then signs in. Rejects WRONG_DETAILS whether the email, the code or the account is the wrong part,
 * PAUSED for a family paused while a report is looked at, TOO_MANY after too many tries, and INVALID with fields.password
 * (8 or more; 'common' or 'personal' when it is easy to guess).
 * @type {(details: { email: string, code: string, password: string }) => Promise<void>}
 */
export const resetPassword = async (details) => {
  await call('post', '/recovery', details)
}

/**
 * Every country a family can be in, with the time zone its days are counted in, sorted by name.
 * Needs no sign-in: the sign-up form uses it.
 * @type {() => Promise<{ code: string, name: string, zone: string }[]>}
 */
export const listCountries = () => call('get', '/countries')

/** @type {() => Promise<void>} */
export const signOut = async () => {
  await call('delete', '/session')
}

/**
 * The signed-in parent's children, and only theirs. Rejects NOT_ALLOWED for other roles.
 * @type {() => Promise<Child[]>}
 */
export const listChildren = () => call('get', '/children')

/**
 * One child of the signed-in parent. Rejects NOT_FOUND for another family's child.
 * @type {(id: string) => Promise<Child>}
 */
export const getChild = (id) => call('get', `/children/${at(id)}`)

/**
 * Adds a child with the sign-in details the parent chose. The password is not returned.
 * Rejects USERNAME_TAKEN, QUOTA (children), TOO_MANY, or INVALID with fields name, username (3 to 20
 * of a-z and 0-9), password (8 or more; 'common' or 'personal' when it is easy to guess) or consent
 * ('required' unless it is true: the parent's tick for this child, C8).
 * @type {(child: { name: string, username: string, password: string, consent: boolean }) => Promise<Child>}
 */
export const addChild = (child) => call('post', '/children', child)

/** @type {(id: string, name: string) => Promise<Child>} */
export const renameChild = (id, name) => call('patch', `/children/${at(id)}`, { name })

/**
 * Sets a new password. The old one stops working at once. Rejects TOO_MANY, or INVALID with
 * fields.password as addChild does.
 * @type {(id: string, password: string) => Promise<void>}
 */
export const resetChildPassword = async (id, password) => {
  await call('put', `/children/${at(id)}/password`, { password })
}

/**
 * Removes a child and everything that belongs to them: tasks, proofs, progress and the reports
 * they sent that the moderator has answered. A report not yet answered is kept for the moderator
 * with nothing that leads back to the child or the family (see resolveReport).
 * @type {(id: string) => Promise<void>}
 */
export const removeChild = async (id) => {
  await call('delete', `/children/${at(id)}`)
}

/**
 * Signs a child out on every device (rule 26). The password stays.
 * @type {(id: string) => Promise<void>}
 */
export const endChildSessions = async (id) => {
  await call('post', `/children/${at(id)}/sessions/end`)
}

/**
 * Changes the signed-in parent's name. Rejects INVALID with fields.name. Earlier approvals and
 * notes keep the name they were given under.
 * @type {(name: string) => Promise<User>}
 */
export const updateName = (name) => call('patch', '/me', { name })

/**
 * Changes the signed-in parent's password. Rejects WRONG_PASSWORD when current is not their
 * password, INVALID with fields.next (8 or more; 'common' or 'personal'), and TOO_MANY after too many tries.
 * @type {(passwords: { current: string, next: string }) => Promise<void>}
 */
export const changePassword = async (passwords) => {
  await call('put', '/me/password', passwords)
}

/**
 * Makes the signed-in parent a new recovery code, behind their password (T5). The one before stops working. Shown once: the
 * server keeps only its hash. Rejects WRONG_PASSWORD, and TOO_MANY after too many tries.
 * @type {(password: string) => Promise<{ recoveryCode: string }>}
 */
export const makeRecoveryCode = (password) => call('post', '/me/recovery', { password })

/**
 * Signs the parent out on every other device; this one stays signed in (rule 26).
 * @type {() => Promise<void>}
 */
export const endOtherSessions = async () => {
  await call('post', '/me/sessions/end')
}

/**
 * Deletes the signed-in parent's family for good: their account, every child's sign-in, every
 * task and proof with its file, every score and sticker, and the reports any of them sent that
 * the moderator has answered. A report not yet answered is kept for the moderator, so that
 * deleting cannot make it vanish, and holds no user id, family id or task id. Ends the session.
 * Rejects WRONG_PASSWORD, and TOO_MANY after too many tries.
 * @type {(password: string) => Promise<void>}
 */
export const deleteFamily = async (password) => {
  await call('post', '/me/delete', { password })
}

/**
 * Downloads a copy of the family's data as growkid-family.zip (T6): family.json and the proof files still kept. Rejects
 * WRONG_PASSWORD, and TOO_MANY after too many tries. No timeout: it takes as long as the files take. The download happens here,
 * because only this folder may hold the file.
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

// ------------------------------------------------------------------ tasks and proof

/**
 * A parent gets the tasks in their family's window; a child gets their own (P2): every task not yet approved, every one approved
 * in the last 30 days, and any whose newest result the child has not seen. Ordered by due time, soonest first. Proofs come
 * without fileUrl.
 * @type {() => Promise<Task[]>}
 */
export const listTasks = () => call('get', '/tasks')

/**
 * A repeating task (sitemap rule 9, H1 to H3). weekdays is 7 bits, Monday = 1 ... Sunday = 64; dueTime is 'HH:MM' on the
 * family's clock. Each day it runs, its task for that day is made the first time anyone in the family opens a task list.
 * @typedef {{ id: string, childId: string, category: string, title: string, instructions: string, doneLooksLike: string,
 *   points: number, weekdays: number, dueTime: string, active: boolean }} Series
 */

/** The signed-in parent's series, oldest first. @type {() => Promise<Series[]>} */
export const listSeries = () => call('get', '/series')

/**
 * A new series for one of the parent's children. Rejects INVALID (the task's fields, plus weekdays 'range' and dueTime 'format'),
 * SCREENED, QUOTA (fields.quota 'series': 20 per child) or NOT_FOUND for another family's child.
 * @type {(details: Omit<Series, 'id' | 'active'>) => Promise<Series>}
 */
export const createSeries = (details) => call('post', '/series', details)

/** Changes a series from now on; tasks it made already stay as they are. Rejects as createSeries does. @type {(id: string, details: Omit<Series, 'id'>) => Promise<Series>} */
export const updateSeries = (id, details) => call('put', `/series/${at(id)}`, details)

/** Stops a series. Every task it made stays. @type {(id: string) => Promise<void>} */
export const stopSeries = async (id) => {
  await call('delete', `/series/${at(id)}`)
}

/**
 * Approved tasks the signed-in parent or child may see, newest due first, at most 50 from offset (P2, P8).
 * @type {(offset?: number) => Promise<Task[]>}
 */
export const listHistory = (offset = 0) => call('get', `/tasks/history?offset=${offset}`)

/** How many a history page holds, so a shorter page means there is no more. */
export const HISTORY_PAGE = 50

/**
 * Today's data in one call (P1), read from one moment: the child's task window, their growth and their stickers, as listTasks,
 * getGrowth and listStickers give them; the answers to their requests not yet shown (K2), oldest first; and the agreement to ask
 * for (K7), or null when they have agreed or there is nothing to agree to. Rejects NOT_ALLOWED for other roles.
 * @type {() => Promise<{ tasks: Task[], growth: Growth, stickers: Sticker[], answers: RewardRequest[], agreement: Agreement | null }>}
 */
export const getToday = () => call('get', '/today')

/**
 * The navigation's numbers in one call (P3): for a parent, proofs waiting for review and reward requests waiting for an answer;
 * for a child, review results and request answers not yet seen on Today (K2). Rejects NOT_ALLOWED for a moderator.
 * @type {() => Promise<{ proofs: number, requests: number } | { results: number, answers: number }>}
 */
export const getCounts = () => call('get', '/counts')

/**
 * One task, with fileUrl on its proofs. Rejects NOT_FOUND for a task of another family or,
 * for a child, of another child.
 * @type {(id: string) => Promise<Task>}
 */
export const getTask = (id) => call('get', `/tasks/${at(id)}`)

/**
 * A parent creates a task for one of their children.
 * Rejects INVALID with fields category, title, instructions, dueAt or points; SCREENED with fields.word
 * when the text uses a word tasks may not use; NOT_FOUND for a child who is not theirs; QUOTA
 * (fields.quota 'tasks') when that child already has the most tasks that are not approved yet.
 * @type {(details: TaskDetails) => Promise<Task>}
 */
export const createTask = (details) => call('post', '/tasks', details)

/**
 * Changes a task. Rejects LOCKED once its first proof has been sent, which includes a task
 * that was sent back, and otherwise as createTask.
 * @type {(id: string, details: TaskDetails) => Promise<Task>}
 */
export const updateTask = (id, details) => call('put', `/tasks/${at(id)}`, details)

/**
 * Deletes a task and its proofs. Rejects LOCKED once the task is approved.
 * @type {(id: string) => Promise<void>}
 */
export const deleteTask = async (id) => {
  await call('delete', `/tasks/${at(id)}`)
}

/**
 * A child sends proof for one of their tasks, new or sent back: a file, a note, or both. The
 * task becomes 'review'. Proof sent after the due time is accepted and marked late. onProgress is called
 * with 0 to 1 while a file uploads.
 * Rejects INVALID (fields.proof when there is neither file nor note, fields.note over 500
 * characters), FILE_TYPE (decided from the file's bytes, not its name), FILE_TOO_LARGE (over
 * 25 MB), LOCKED when the task is not waiting for proof, QUOTA (fields.quota 'storage' or 'disk')
 * when there is no room for the file, TOO_MANY (with no minutes when another upload is still
 * arriving), and NETWORK if the upload breaks off or `signal` cancels it (P11; the caller can tell by signal.aborted). No timeout (P15).
 * @type {(taskId: string, proof: { file?: File, note?: string },
 *   options?: { onProgress?: (fraction: number) => void, signal?: AbortSignal }) => Promise<Task>}
 */
export const sendProof = async (taskId, { file, note = '' }, { onProgress, signal } = {}) => {
  if (file?.type && !FILE_TYPES.includes(file.type)) throw new ApiError('FILE_TYPE') // no type at all: the server decides from the bytes
  if (file && file.size > MAX_FILE_BYTES) throw new ApiError('FILE_TOO_LARGE')
  const form = new FormData()
  form.set('note', note)
  if (file) form.set('file', file)
  return call('post', `/tasks/${at(taskId)}/proofs`, form, { onUploadProgress: (event) => onProgress?.(event.progress ?? 0), signal, timeout: 0 })
}

/**
 * A parent approves the newest proof of a task in review. The task becomes 'approved' and its
 * points are awarded, once: a second attempt from anywhere rejects REVIEWED, as does a proofId
 * that is no longer the newest proof. cheer is optional; a kind of null with an empty line stores
 * nothing. Rejects INVALID with fields.cheer ('kind', when it is not one of the six) or
 * fields.line ('length', over 120 characters once trimmed), and SCREENED when the line uses a blocked word (C7). An approval that reaches the child's
 * quest target for the week its proof was sent in also completes that quest.
 * @type {(taskId: string, proofId: string, cheer?: Cheer) => Promise<Task>}
 */
export const approveProof = (taskId, proofId, cheer) => call('post', `/tasks/${at(taskId)}/review`, { proofId, result: 'approved', cheer })

/**
 * A parent sends the newest proof back with a note saying what to fix. The task becomes
 * 'sentBack' and takes new proof. Rejects INVALID with fields.note when the note is empty
 * ('required') or over 300 characters ('length'), SCREENED when it uses a blocked word (C7), and REVIEWED as approveProof does.
 * @type {(taskId: string, proofId: string, note: string) => Promise<Task>}
 */
export const sendBackProof = (taskId, proofId, note) => call('post', `/tasks/${at(taskId)}/review`, { proofId, result: 'sentBack', note })

/**
 * The signed-in child has seen the review results of these tasks: sets resultSeen on them, and
 * on no others, so a result that arrives meanwhile is still new. The server takes at most 200 ids
 * at once; any beyond that are marked on the next visit.
 * @type {(taskIds: string[]) => Promise<void>}
 */
export const markResultsSeen = async (taskIds) => {
  await call('post', '/tasks/seen', { taskIds: taskIds.slice(0, 200) })
}

/**
 * The signed-in child's level, XP, points, streak, balance and this week's quest, all worked out
 * from their tasks, rest days and completed quests by the award rules. The quest's surprise is
 * null, and sealed true, until the quest is complete and the child has seen it. Rejects
 * NOT_ALLOWED for other roles.
 * @type {() => Promise<Growth>}
 */
export const getGrowth = () => call('get', '/growth')

/**
 * The same for each of the signed-in parent's children, by child id. A parent reads every quest
 * with its surprise; sealed is true while the quest is not yet complete.
 * @type {() => Promise<Record<string, Growth>>}
 */
export const listGrowth = () => call('get', '/growth/children')

/**
 * Every sticker there is, in the order of the chart, with earnedAt on the ones the signed-in
 * child has earned. An award is recorded when the approval that earns it is given, and is never
 * taken back or re-dated, whatever happens to the tasks afterwards.
 * @type {() => Promise<Sticker[]>}
 */
export const listStickers = () => call('get', '/stickers')

/**
 * One child's progress for the signed-in parent. Worked out from the child's tasks when asked.
 * Rejects NOT_FOUND for another family's child.
 * @type {(childId: string) => Promise<Progress>}
 */
export const getProgress = (childId) => call('get', `/children/${at(childId)}/progress`)

// ------------------------------------------------------------------ rewards, quests and the rest

/**
 * The family's rewards, cheapest first: a parent's own, or those of the signed-in child's parent.
 * Rejects NOT_ALLOWED for a moderator.
 * @type {() => Promise<Reward[]>}
 */
export const listRewards = () => call('get', '/rewards')

/**
 * A parent creates a reward, or with an id changes one of their own. The title is 3 to 60
 * characters and screened like a task; the cost is 10 to 1,000 points, in tens.
 * Rejects INVALID with fields.title ('length') or fields.cost ('range'), SCREENED with
 * fields.word, NOT_FOUND for an id that is not theirs, and QUOTA (fields.quota 'rewards') for one
 * more than a family may have.
 * @type {(reward: { id?: string, title: string, cost: number }) => Promise<Reward>}
 */
export const saveReward = (reward) => call('post', '/rewards', reward)

/**
 * A parent deletes one of their rewards. Requests already made for it stay and can still be
 * answered, because each keeps its own copy of the title and cost. Rejects NOT_FOUND.
 * @type {(id: string) => Promise<void>}
 */
export const deleteReward = async (id) => {
  await call('delete', `/rewards/${at(id)}`)
}

/**
 * A child asks for one of their parent's rewards. The points are held at once, and the cost is
 * checked against the child's shown balance (rule 13). Rejects NOT_ENOUGH when it costs more than
 * that, and NOT_FOUND for a reward that is not their parent's.
 * @type {(rewardId: string) => Promise<RewardRequest>}
 */
export const requestReward = (rewardId) => call('post', '/requests', { rewardId })

/**
 * The requests, newest first: a parent's whole family, or a child's own. Rejects NOT_ALLOWED for
 * a moderator.
 * @type {() => Promise<RewardRequest[]>}
 */
export const listRequests = () => call('get', '/requests')

/**
 * A parent gives or declines a request in their family; a note of up to 200 characters goes with
 * a decline. Declining gives the points back. It is answered once: a second answer rejects
 * REVIEWED. Rejects INVALID with fields.result ('required', when it is not 'given' or 'declined')
 * or fields.note ('length'), SCREENED when a decline's note uses a blocked word (C7), and NOT_FOUND for a request of another family.
 * @type {(id: string, result: 'given' | 'declined', note?: string) => Promise<RewardRequest>}
 */
export const answerRequest = (id, result, note) => call('post', `/requests/${at(id)}/answer`, { result, note })

/**
 * A parent sets one quest for a child: tasks to have approved in a week (2 to 20), a bonus in
 * points (10 to 200, in fives) and an optional surprise of up to 80 characters, which is screened;
 * an empty one means none. null removes the quest. Changing it does not change a quest already
 * completed. A surprise opens once: completing the quest empties it from the quest. Rejects
 * INVALID with fields.target ('range', or 'done' when that many are already approved this week and
 * the week's quest is not complete), fields.bonus ('range') or
 * fields.surprise ('length'), SCREENED with fields.word, and NOT_FOUND for a child who is not theirs.
 * @type {(childId: string, def: QuestDef | null) => Promise<QuestDef | null>}
 */
export const setQuest = (childId, def) => call('put', `/children/${at(childId)}/quest`, def ?? undefined) // no body at all removes the quest; the server refuses a JSON null

/**
 * The rest days a parent has set for a child, as 'YYYY-MM-DD', oldest first, from 7 days ago
 * onward. Rejects NOT_FOUND for a child who is not theirs.
 * @type {(childId: string) => Promise<string[]>}
 */
export const listRestDays = (childId) => call('get', `/children/${at(childId)}/rest-days`)

/**
 * A parent sets or clears one rest day for a child, from 7 days ago up to 90 days ahead, both
 * included, and gets the new list back as listRestDays gives it. Rejects INVALID with
 * fields.day ('range'), and NOT_FOUND for a child who is not theirs.
 * @type {(childId: string, day: string, rest: boolean) => Promise<string[]>}
 */
export const setRestDay = (childId, day, rest) => call('post', `/children/${at(childId)}/rest-days`, { day, rest })

/**
 * A child chooses the task to do next, or null to clear the choice, and gets their tasks back as
 * listTasks gives them. Only one at a time: this replaces any earlier choice. The choice clears
 * by itself when proof is sent for that task or it is deleted. Rejects LOCKED when the task is not
 * open (to do or sent back), and NOT_FOUND for a task that is not theirs.
 * @type {(taskId: string | null) => Promise<Task[]>}
 */
export const pinTask = (taskId) => call('put', '/pin', { taskId })

/**
 * The signed-in child picks a badge (K10): one of four colours and a sticker they have earned and seen, or both null for none.
 * Answers with their User. Rejects INVALID with fields.colour or fields.stickerId.
 * @type {(colour: Avatar['colour'] | null, stickerId: string | null) => Promise<User>}
 */
export const setAvatar = (colour, stickerId) => call('put', '/me/avatar', { colour, stickerId })

/**
 * The signed-in child turns the reward moment's sound and vibration on or off (K11). Answers with their User.
 * @type {(sound: boolean) => Promise<User>}
 */
export const setSound = (sound) => call('put', '/me/sound', { sound })

/**
 * The signed-in child has seen the answers to these requests of theirs on Today (K2); others are left as they are. At most 200.
 * @type {(ids: string[]) => Promise<void>}
 */
export const markAnswersSeen = async (ids) => {
  await call('post', '/requests/seen', { ids: ids.slice(0, 200) })
}

/**
 * The signed-in child chooses one of the family's rewards to save for, or null for none (K3). Asking for it, or the reward being
 * deleted, clears it. Rejects NOT_FOUND for a reward that is not their family's.
 * @type {(rewardId: string | null) => Promise<{ goal: Reward | null }>}
 */
export const setGoal = (rewardId) => call('put', '/goal', { rewardId })

/** How many listMyProofs gives at once, so a shorter page means there is no more. */
export const MY_PROOFS_PAGE = 24

/**
 * The signed-in child's approved photos and videos (K5), newest first, MY_PROOFS_PAGE from offset, once Today has shown each
 * approval. Rejects NOT_ALLOWED for other roles.
 * @type {(offset?: number) => Promise<MyProof[]>}
 */
export const listMyProofs = (offset = 0) => call('get', `/proofs/mine?offset=${offset}`)

/**
 * The signed-in child suggests a task by an idea's id (K6). The same idea already waiting answers with that suggestion. Rejects
 * INVALID (fields.ideaId), and QUOTA (fields.quota 'suggestions') with 3 already waiting.
 * @type {(ideaId: string) => Promise<Suggestion>}
 */
export const suggestTask = (ideaId) => call('post', '/suggestions', { ideaId })

/**
 * Suggestions still waiting, oldest first: a child's own, or the signed-in parent's family's. Rejects NOT_ALLOWED for a moderator.
 * @type {() => Promise<Suggestion[]>}
 */
export const listSuggestions = () => call('get', '/suggestions')

/**
 * A parent answers a suggestion once: 'accepted' after making the task, 'declined' for Not now. Rejects REVIEWED when it was
 * answered already, NOT_FOUND for another family's.
 * @type {(id: string, result: 'accepted' | 'declined') => Promise<void>}
 */
export const answerSuggestion = async (id, result) => {
  await call('post', `/suggestions/${at(id)}/answer`, { result })
}

/**
 * The signed-in child agrees to the family agreement (K7).
 * @type {() => Promise<void>}
 */
export const agree = async () => {
  await call('post', '/agree')
}

/**
 * A parent clears a child's agreement, so Today asks them again (K7). Rejects NOT_FOUND for a child who is not theirs.
 * @type {(childId: string) => Promise<void>}
 */
export const askAgreementAgain = async (childId) => {
  await call('delete', `/children/${at(childId)}/agreement`)
}

/**
 * The family's children and the tasks each has had approved this week, by name, most first,
 * counting only approvals each child has been shown. null when the parent has not turned it on or
 * the family has fewer than 2 children. Rejects NOT_ALLOWED for other roles.
 * @type {() => Promise<LeaderboardEntry[] | null>}
 */
export const getLeaderboard = () => call('get', '/leaderboard')

/**
 * The signed-in parent's settings. The leaderboard is off until they turn it on.
 * @typedef {{ leaderboard: boolean, country: string, keepProofDays: 30 | 90 | 365, recovery: boolean }} Settings  country is a code
 *   from listCountries; keepProofDays is how long a proof's file is kept after its task is approved (T4); recovery is whether the
 *   parent has a recovery code (T5)
 * @type {() => Promise<Settings>}
 */
export const getSettings = () => call('get', '/settings')

/**
 * A parent turns the family leaderboard on or off.
 * @type {(on: boolean) => Promise<Settings>}
 */
export const setLeaderboard = (on) => call('put', '/settings', { leaderboard: on })

/**
 * A parent changes the family's country. From then on days are counted in its time zone, so past
 * days are counted again: a streak or a quest week can change. Rejects INVALID with fields.country.
 * @type {(country: string) => Promise<Settings>}
 */
export const setCountry = (country) => call('put', '/settings/country', { country })

/**
 * A parent chooses how long a proof's photo or video is kept after its task is approved: 30, 90 or 365 days (T4). A shorter time
 * deletes older files within a day. Rejects INVALID with fields.days.
 * @type {(days: 30 | 90 | 365) => Promise<Settings>}
 */
export const setKeepProofDays = (days) => call('put', '/settings/keep-proof', { days })

// ------------------------------------------------------------------ reports

/**
 * A parent or a child reports a problem. It goes to the moderator and to nobody else: a parent
 * is never shown, told of or asked about a report their child sent. taskId links the task it was
 * sent from, of which a copy is kept (see ReportItem); a task the sender cannot see is left out.
 * Rejects INVALID with fields.details ('required', or 'length' over 1,000 characters), and
 * TOO_MANY after 10 reports sent in an hour.
 * @type {(report: { details: string, taskId?: string }) => Promise<Report>}
 */
export const sendReport = (report) => call('post', '/reports', report)

/**
 * The reports the signed-in user sent, newest first, each with the moderator's answer once it
 * has one.
 * @type {() => Promise<Report[]>}
 */
export const listMyReports = () => call('get', '/reports/mine')

/** T3: how many waiting reports the moderator's list holds at a time. */
export const REPORTS_PAGE = 200

/**
 * The reports still waiting, oldest first, REPORTS_PAGE of them from `offset`, and how many wait in all (T3). Moderator only:
 * rejects NOT_ALLOWED for anyone else.
 * @type {(offset?: number) => Promise<{ waiting: number, reports: Report[] }>}
 */
export const listReports = (offset = 0) => call('get', `/reports?offset=${offset}`)

/**
 * The moderator answers a report and closes it. The answer is shown to whoever sent the report.
 * Nothing else changes: no task, proof, score or account is touched, and nobody is told. If the
 * sender and their family have since been deleted, the report is deleted too, because nobody is
 * left to read the answer; the call still returns it, answered.
 * Rejects INVALID with fields.note ('required', or 'length' over 500 characters), LOCKED when
 * the report is already resolved, LOCKED also while the sender's family is paused, and NOT_FOUND.
 * @type {(id: string, note: string) => Promise<Report>}
 */
export const resolveReport = (id, note) => call('post', `/reports/${at(id)}/resolve`, { note })

/**
 * The moderator pauses the family of a report's sender (T2): the parent and every child are signed out everywhere and cannot sign
 * in until it is unpaused. Nothing of theirs is deleted or changed. Rejects NOT_FOUND when the report or its sender is gone.
 * @type {(id: string) => Promise<Report>}
 */
export const pauseFamily = (id) => call('post', `/reports/${at(id)}/pause`)

/**
 * The moderator unpauses the family of a report's sender (T2): they can sign in again with the same passwords. Rejects NOT_FOUND
 * when the report or its sender is gone.
 * @type {(id: string) => Promise<Report>}
 */
export const unpauseFamily = (id) => call('post', `/reports/${at(id)}/unpause`)

// ------------------------------------------------------------------ not part of the real API

/**
 * The demo family's sign-ins (made by `npm run seed` in server/), in development builds only.
 * @type {() => Promise<{ who: string, identifier: string, password: string }[]>}
 */
export const listDemoSignIns = async () =>
  import.meta.env.DEV
    ? [
        { who: 'Meera Joshi (parent)', identifier: 'meera@example.com', password: 'growkid-demo' },
        { who: 'Aarav (child)', identifier: 'aarav', password: 'plants42' },
        { who: 'Diya (child)', identifier: 'diya', password: 'books77' },
      ]
    : []

/**
 * True when the development switch is simulating no network.
 * @type {() => boolean}
 */
export const pretendingOffline = () => devMode() === 'offline'
