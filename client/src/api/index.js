/**
 * The GrowKid API as the frontend sees it. Pages and stores call only these functions.
 *
 * Today ./fake.js answers them, because server/ has no code yet. The backend phase replaces the
 * right-hand side of each export with an HTTP call and keeps the names, the shapes and the
 * failures. Every function is async and rejects with an ApiError (see ./errors.js).
 *
 * @typedef {'parent' | 'child' | 'moderator'} Role
 * @typedef {{ id: string, role: Role, name: string, email?: string, username?: string }} User
 *   A parent or moderator has an email; a child has a username. Never a password.
 * @typedef {{ id: string, name: string, username: string }} Child
 *
 * @typedef {object} Review  A parent's answer to one proof.
 * @property {'approved' | 'sentBack'} result
 * @property {string} note        what to fix; always present when sent back, '' when approved
 * @property {string} by          the parent's name, as the child sees it
 * @property {string} at          ISO time
 *
 * @typedef {object} Proof  One attempt at proving a task: a file, a note, or both.
 * @property {string} id
 * @property {string} note        '' when there is none
 * @property {string} [fileUrl]   an address the browser can show; only on getTask and sendProof
 * @property {string} [fileName]
 * @property {string} [fileType]  the MIME type: image/..., video/... or application/pdf
 * @property {number} [fileSize]  in bytes
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
 * @property {{ day: string, state: 'done' | 'missed' | 'none' }[]} week  the last seven days, today last
 *   A day is 'done' when proof the child sent that day was approved, whenever that happened;
 *   'missed' when a task was due on it and no proof for that task had been sent by the end of
 *   the day, unless the child sent any proof that day, whatever became of it (so a parent sending
 *   it back never makes a missed day); otherwise 'none', which changes nothing.
 *
 * @typedef {object} Score
 * @property {number} level
 * @property {number} xp          XP earned inside the current level
 * @property {number} xpForNext   what the level needs: 100
 * @property {number} points      every point ever earned; an approved task's points are its XP
 * @property {number} waitingXp   the points of tasks whose proof is waiting for approval
 * @property {Streak} streak
 *
 * @typedef {Score & { shown: Score }} Growth
 *   shown is the score as the child has been shown it on Today: an approval whose result they
 *   have not seen yet (resultSeen false) still counts as waiting there. The reward moment plays
 *   from shown to the score itself.
 *
 * @typedef {object} Sticker
 * @property {string} id
 * @property {string} name
 * @property {string} how         one sentence saying what earns it
 * @property {'seal' | 'shield' | 'hexagon' | 'star'} shape  task counts, streaks, levels, a skill
 * @property {'sun' | 'sprout' | 'navy'} tone
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
 * @property {{ day: string, state: 'done' | 'missed' | 'none' }[]} calendar  the streak's day
 *   marks, from the Monday three weeks before this week's up to today
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
 */
import * as server from './fake.js'

export { ApiError } from './errors.js'
/** The time. Development can move it (see ./clock.js); ask here, not `new Date()`, for "now". */
export { now } from './clock.js'

// ------------------------------------------------------------------ accounts and family

/**
 * Who is signed in on this device.
 * @type {() => Promise<User | null>}
 */
export const getSession = server.getSession

/**
 * Signs in a parent or moderator by email, or a child by username.
 * Rejects WRONG_DETAILS whether the account or the password is the wrong part.
 * @type {(details: { identifier: string, password: string }) => Promise<User>}
 */
export const signIn = server.signIn

/**
 * Creates a parent account and its family, and signs the parent in.
 * Rejects EMAIL_TAKEN, or INVALID with fields name, email (format) or password (8 or more).
 * @type {(details: { name: string, email: string, password: string }) => Promise<User>}
 */
export const signUp = server.signUp

/** @type {() => Promise<void>} */
export const signOut = server.signOut

/**
 * The signed-in parent's children, and only theirs. Rejects NOT_ALLOWED for other roles.
 * @type {() => Promise<Child[]>}
 */
export const listChildren = server.listChildren

/**
 * One child of the signed-in parent. Rejects NOT_FOUND for another family's child.
 * @type {(id: string) => Promise<Child>}
 */
export const getChild = server.getChild

/**
 * Adds a child with the sign-in details the parent chose. The password is not returned.
 * Rejects USERNAME_TAKEN, or INVALID with fields name, username (3 to 20 of a-z and 0-9)
 * or password (6 or more).
 * @type {(child: { name: string, username: string, password: string }) => Promise<Child>}
 */
export const addChild = server.addChild

/** @type {(id: string, name: string) => Promise<Child>} */
export const renameChild = server.renameChild

/**
 * Sets a new password. The old one stops working at once.
 * @type {(id: string, password: string) => Promise<void>}
 */
export const resetChildPassword = server.resetChildPassword

/**
 * Removes a child and everything that belongs to them: tasks, proofs, progress and the reports
 * they sent that the moderator has answered. A report not yet answered is kept for the moderator
 * with nothing that leads back to the child or the family (see resolveReport).
 * @type {(id: string) => Promise<void>}
 */
export const removeChild = server.removeChild

/**
 * Changes the signed-in parent's name. Rejects INVALID with fields.name. Earlier approvals and
 * notes keep the name they were given under.
 * @type {(name: string) => Promise<User>}
 */
export const updateName = server.updateName

/**
 * Changes the signed-in parent's password. Rejects WRONG_PASSWORD when current is not their
 * password, and INVALID with fields.next (8 or more).
 * @type {(passwords: { current: string, next: string }) => Promise<void>}
 */
export const changePassword = server.changePassword

/**
 * Deletes the signed-in parent's family for good: their account, every child's sign-in, every
 * task and proof with its file, every score and sticker, and the reports any of them sent that
 * the moderator has answered. A report not yet answered is kept for the moderator, so that
 * deleting cannot make it vanish, and holds no user id, family id or task id. Ends the session.
 * Rejects WRONG_PASSWORD.
 * @type {(password: string) => Promise<void>}
 */
export const deleteFamily = server.deleteFamily

// ------------------------------------------------------------------ tasks and proof

/**
 * A parent gets every task in their family; a child gets their own. Ordered by due time,
 * soonest first. Proofs come without fileUrl.
 * @type {() => Promise<Task[]>}
 */
export const listTasks = server.listTasks

/**
 * One task, with fileUrl on its proofs. Rejects NOT_FOUND for a task of another family or,
 * for a child, of another child.
 * @type {(id: string) => Promise<Task>}
 */
export const getTask = server.getTask

/**
 * A parent creates a task for one of their children.
 * Rejects INVALID with fields category, title, instructions, dueAt or points; SCREENED with fields.word
 * when the text uses a word tasks may not use; NOT_FOUND for a child who is not theirs.
 * @type {(details: TaskDetails) => Promise<Task>}
 */
export const createTask = server.createTask

/**
 * Changes a task. Rejects LOCKED once its first proof has been sent, which includes a task
 * that was sent back, and otherwise as createTask.
 * @type {(id: string, details: TaskDetails) => Promise<Task>}
 */
export const updateTask = server.updateTask

/**
 * Deletes a task and its proofs. Rejects LOCKED once the task is approved.
 * @type {(id: string) => Promise<void>}
 */
export const deleteTask = server.deleteTask

/**
 * A child sends proof for one of their tasks, new or sent back: a file, a note, or both. The
 * task becomes 'review'. Proof sent after the due time is accepted and marked late. onProgress is called
 * with 0 to 1 while a file uploads.
 * Rejects INVALID (fields.proof when there is neither file nor note, fields.note over 500
 * characters), FILE_TYPE, FILE_TOO_LARGE (over 25 MB), LOCKED when the task is not waiting
 * for proof, and NETWORK if the upload breaks off.
 * @type {(taskId: string, proof: { file?: File, note?: string },
 *   options?: { onProgress?: (fraction: number) => void }) => Promise<Task>}
 */
export const sendProof = server.sendProof

/**
 * A parent approves the newest proof of a task in review. The task becomes 'approved' and its
 * points are awarded, once: a second attempt from anywhere rejects REVIEWED, as does a proofId
 * that is no longer the newest proof.
 * @type {(taskId: string, proofId: string) => Promise<Task>}
 */
export const approveProof = server.approveProof

/**
 * A parent sends the newest proof back with a note saying what to fix. The task becomes
 * 'sentBack' and takes new proof. Rejects INVALID with fields.note when the note is empty
 * ('required') or over 300 characters ('length'), and REVIEWED as approveProof does.
 * @type {(taskId: string, proofId: string, note: string) => Promise<Task>}
 */
export const sendBackProof = server.sendBackProof

/**
 * The signed-in child has seen the review results of these tasks: sets resultSeen on them, and
 * on no others, so a result that arrives meanwhile is still new.
 * @type {(taskIds: string[]) => Promise<void>}
 */
export const markResultsSeen = server.markResultsSeen

/**
 * How many proofs in the signed-in parent's family are waiting for review.
 * @type {() => Promise<number>}
 */
export const countProofsWaiting = server.countProofsWaiting

/**
 * The signed-in child's level, XP, points and streak, all worked out from their tasks by the
 * award rules. Rejects NOT_ALLOWED for other roles.
 * @type {() => Promise<Growth>}
 */
export const getGrowth = server.getGrowth

/**
 * The same for each of the signed-in parent's children, by child id.
 * @type {() => Promise<Record<string, Growth>>}
 */
export const listGrowth = server.listGrowth

/**
 * Every sticker there is, in the order of the chart, with earnedAt on the ones the signed-in
 * child has earned. An award is recorded when the approval that earns it is given, and is never
 * taken back or re-dated, whatever happens to the tasks afterwards.
 * @type {() => Promise<Sticker[]>}
 */
export const listStickers = server.listStickers

/**
 * How many review results the signed-in child has not yet seen on Today.
 * @type {() => Promise<number>}
 */
export const countNewResults = server.countNewResults

/**
 * One child's progress for the signed-in parent. Worked out from the child's tasks when asked.
 * Rejects NOT_FOUND for another family's child.
 * @type {(childId: string) => Promise<Progress>}
 */
export const getProgress = server.getProgress

// ------------------------------------------------------------------ reports

/**
 * A parent or a child reports a problem. It goes to the moderator and to nobody else: a parent
 * is never shown, told of or asked about a report their child sent. taskId links the task it was
 * sent from, of which a copy is kept (see ReportItem); a task the sender cannot see is left out.
 * Rejects INVALID with fields.details ('required', or 'length' over 1,000 characters).
 * @type {(report: { details: string, taskId?: string }) => Promise<Report>}
 */
export const sendReport = server.sendReport

/**
 * The reports the signed-in user sent, newest first, each with the moderator's answer once it
 * has one.
 * @type {() => Promise<Report[]>}
 */
export const listMyReports = server.listMyReports

/**
 * Every report, oldest first. Moderator only: rejects NOT_ALLOWED for anyone else.
 * @type {() => Promise<Report[]>}
 */
export const listReports = server.listReports

/**
 * The moderator answers a report and closes it. The answer is shown to whoever sent the report.
 * Nothing else changes: no task, proof, score or account is touched, and nobody is told. If the
 * sender and their family have since been deleted, the report is deleted too, because nobody is
 * left to read the answer; the call still returns it, answered.
 * Rejects INVALID with fields.note ('required', or 'length' over 500 characters), LOCKED when
 * the report is already resolved, and NOT_FOUND.
 * @type {(id: string, note: string) => Promise<Report>}
 */
export const resolveReport = server.resolveReport

// ------------------------------------------------------------------ not part of the real API

/**
 * The demo family's sign-ins, in development builds only.
 * @type {() => Promise<{ who: string, identifier: string, password: string }[]>}
 */
export const listDemoSignIns = server.listDemoSignIns

/**
 * True when the development switch is simulating no network.
 * @type {() => boolean}
 */
export const pretendingOffline = () => server.devMode() === 'offline'
