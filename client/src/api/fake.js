/**
 * STAND-IN FOR THE SERVER. Delete this file and ./fakeFiles.js when server/ can answer these calls.
 *
 * It keeps everything in this browser: records as one JSON blob in localStorage, proof files in
 * IndexedDB. Passwords are plain text and the session is a bare user id. That is deliberate:
 * hashing, tokens and every other security measure belong to the server (bcrypt, JWT, PostgreSQL
 * through Prisma, cloud storage) and would only be theatre here. Nothing outside client/src/api/
 * may import this file.
 *
 * The rules it follows are the working assumptions in FRONTEND-SITEMAP.md section 12. The award
 * rules are in ./scoring.js, and ./clock.js is the clock, which development can move.
 *
 * ponytail: one JSON blob, rewritten after every call. Fine for a demo family.
 */
import { now } from './clock.js'
import { ApiError } from './errors.js'
import { deleteFile, getFile, putFile } from './fakeFiles.js'
import {
  STICKERS, approvedInWeek, balanceOf, dayKey, progress, questCompletedBy, questOf, recordOf, score, stickers, weekKey,
} from './scoring.js'

const KEY = 'growkid.fake.v6'
const DEV_KEY = 'growkid.dev'

// Rule 5, proof files: one photo, video or PDF of up to 25 MB, or a note with no file.
const MAX_FILE_BYTES = 25 * 1024 * 1024
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf']
const CATEGORIES = ['chores', 'study', 'reading', 'creative', 'outdoors', 'health']
// Rule 8, content screening: a task may not use these words. A sample list; the server owns the real one.
const BLOCKED_WORDS = ['secret', 'dare', "don't tell"]
// Rule 20, cheers: the six kinds a parent can approve with. The server owns the list; the words
// and icons for each live in the client (utils/cheers.js).
const CHEER_KINDS = ['proud', 'tidy', 'brave', 'clever', 'kind', 'effort']

const DEMO_USERS = [
  { id: 'demo-parent', role: 'parent', name: 'Meera Joshi', email: 'meera@example.com', password: 'growkid-demo' },
  { id: 'demo-aarav', role: 'child', name: 'Aarav', username: 'aarav', password: 'plants42', parentId: 'demo-parent' },
  { id: 'demo-diya', role: 'child', name: 'Diya', username: 'diya', password: 'books77', parentId: 'demo-parent' },
  { id: 'demo-moderator', role: 'moderator', name: 'Moderator', email: 'moderator@example.com', password: 'growkid-demo' },
]

/** A time in the demo data: this many days from now (negative for the past), at this hour of that day. */
function demoAt(days, hour) {
  const day = now()
  day.setDate(day.getDate() + days)
  day.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0)
  return day.toISOString()
}

/**
 * The demo family's tasks, dated from the moment the data is first created. Aarav has a few days
 * of history and one approval he has not seen yet; Diya is new. No level, streak or sticker is
 * stored anywhere: they all come from these tasks by the award rules in ./scoring.js.
 */
function demoTasks() {
  const at = demoAt
  const task = (id, childId, category, title, instructions, dueAt, points) => ({
    id, childId, category, title, instructions, dueAt, points,
    status: 'todo', createdAt: at(-6, 9), proofs: [], resultSeen: true,
  })
  const answer = (result, when, note = '') => ({ result, note, by: 'Meera Joshi', at: when })
  /** A task Aarav did some days ago: due at 6 pm, a note sent at 5 pm, approved at 8 pm. */
  const done = (n, days, category, title, instructions, points, said) => ({
    ...task(`demo-done-${n}`, 'demo-aarav', category, title, instructions, at(-days, 18), points),
    status: 'approved',
    proofs: [{ id: `demo-proof-${n}`, note: said, sentAt: at(-days, 17), late: false, review: answer('approved', at(-days, 20)) }],
  })
  const drawing = done(4, 2, 'creative', 'Draw the view from your window', 'Use the whole page. Send a photo of the drawing.', 20, 'Here is all of it.')
  drawing.proofs.unshift({
    id: 'demo-proof-4a', note: 'My drawing.', sentAt: at(-2, 16), late: false,
    review: answer('sentBack', at(-2, 16.5), 'The drawing is cut off in the photo. Send one that shows the whole page.'),
  })
  const cycling = done(5, 1, 'outdoors', 'Cycle to the park and back', 'Wear your helmet. Write how long it took.', 30, 'Twenty minutes there and back.')
  cycling.proofs[0].review.at = new Date(now() - 3_600_000).toISOString() // approved an hour ago, and not seen yet
  cycling.resultSeen = false
  return [
    done(1, 5, 'chores', 'Make your bed', 'Pull the sheet flat and put the pillow on top. Write when you did it.', 20, 'Done before school.'),
    done(2, 4, 'study', 'Practise the 7 times table', 'Say it aloud twice, then write it out once.', 30, 'Wrote it out. 7 x 8 is the hard one.'),
    done(3, 3, 'reading', 'Read one chapter aloud', 'Read chapter 3 to someone at home. Write who listened.', 20, 'Read it to Dadi.'),
    drawing,
    cycling,
    task('demo-task-1', 'demo-aarav', 'chores', 'Water the balcony plants', 'Give each pot one full mug. Send a photo when you are done.', at(-1, 18), 30),
    task('demo-task-2', 'demo-aarav', 'reading', 'Read 20 pages of your library book', 'Read from where you stopped. Write one line about what happened.', at(1, 19), 20),
    task('demo-task-3', 'demo-diya', 'chores', 'Tidy the study desk', 'Books on the shelf, pencils in the stand. Send a photo of the desk.', at(2, 17), 20),
  ]
}

/*
 * Development only: open any page with ?dev=<mode> to reach a state on purpose. It lasts for
 * the browser tab; ?dev=ok goes back.
 *   slow, fail, offline         every call (checking who is signed in and signing out still work)
 *   upload-slow, upload-fail    only the sending of a proof file
 */
if (import.meta.env?.DEV) {
  const asked = new URLSearchParams(window.location.search).get('dev')
  if (asked) sessionStorage.setItem(DEV_KEY, asked)
}
export const devMode = () => (import.meta.env.DEV ? sessionStorage.getItem(DEV_KEY) : null)

/**
 * The demo family's engagement data, added after its stickers are recorded: three rewards, one
 * request already given, a weekly quest for Aarav and the cheer on his newest approval. The
 * quest's target is two more than he has done this week, so it reads "2 to go" whatever weekday
 * the demo is created on. No rest days, and the leaderboard stays off.
 */
function addDemoEngagement(db) {
  const reward = (n, title, cost) => ({ id: `demo-reward-${n}`, parentId: 'demo-parent', title, cost, createdAt: demoAt(-6, 9) })
  db.rewards = [reward(1, '15 minutes of extra screen time', 50), reward(2, 'Choose the film on Friday', 100), reward(3, 'A trip to the park café', 300)]
  db.requests = [{
    id: 'demo-request-1', childId: 'demo-aarav', parentId: 'demo-parent', rewardId: 'demo-reward-1',
    title: db.rewards[0].title, cost: db.rewards[0].cost, status: 'given', note: '', requestedAt: demoAt(-2, 17),
    answer: { by: 'Meera Joshi', at: demoAt(-2, 19) },
  }]
  db.quests['demo-aarav'] = {
    target: Math.max(2, approvedInWeek(tasksOf(db, 'demo-aarav'), weekKey(now())) + 2), bonus: 50,
    surprise: 'Ice cream after school on Saturday', setAt: demoAt(-6, 9),
  }
  db.tasks.find((t) => t.id === 'demo-done-5').proofs[0].review.cheer = { kind: 'effort', line: 'Twenty minutes there and back is quick. Well done.' }
}

/** The collections a saved copy may lack: data saved before they existed gets them empty. */
const blank = () => ({ reports: [], rewards: [], requests: [], quests: {}, questAwards: {}, restDays: {}, settings: {} })

function read() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return { ...blank(), ...JSON.parse(saved) }
  } catch {
    // unreadable or blocked: start again from the demo data
  }
  // the demo family's stickers come from running the award rules over its tasks, like everything else
  const db = { ...blank(), users: structuredClone(DEMO_USERS), tasks: demoTasks(), session: null, awards: {} }
  for (const user of db.users) if (user.role === 'child') recordAwards(db, user.id)
  addDemoEngagement(db)
  return db
}

const write = (db) => localStorage.setItem(KEY, JSON.stringify(db))

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Runs one request against the stored data, after a delay, the way a server would answer. */
async function answer(work, { always = false } = {}) {
  const mode = always ? null : devMode()
  await wait(mode === 'slow' ? 6000 : 200)
  if (mode === 'offline') throw new ApiError('NETWORK')
  if (mode === 'fail') throw new ApiError('SERVER')
  const db = read()
  const result = work(db)
  write(db)
  return result
}

// ------------------------------------------------------------------ who is asking

const asUser = ({ id, role, name, email, username }) => ({ id, role, name, email, username })
const asChild = ({ id, name, username }) => ({ id, name, username })

function signedIn(db) {
  const user = db.users.find((u) => u.id === db.session)
  if (!user) throw new ApiError('NOT_SIGNED_IN')
  return user
}

function only(role, db) {
  const user = signedIn(db)
  if (user.role !== role) throw new ApiError('NOT_ALLOWED')
  return user
}

/** A child of the signed-in parent. Someone else's child does not exist as far as they can tell. */
function ownChild(db, id) {
  const me = only('parent', db)
  const child = db.users.find((u) => u.id === id && u.role === 'child' && u.parentId === me.id)
  if (!child) throw new ApiError('NOT_FOUND')
  return child
}

function refuse(fields) {
  const wrong = Object.fromEntries(Object.entries(fields).filter(([, problem]) => problem))
  if (Object.keys(wrong).length) throw new ApiError('INVALID', wrong)
}

// ------------------------------------------------------------------ accounts and family

export const getSession = () =>
  answer((db) => {
    const user = db.users.find((u) => u.id === db.session)
    return user ? asUser(user) : null
  }, { always: true })

export const signIn = ({ identifier, password }) =>
  answer((db) => {
    const typed = identifier.trim().toLowerCase()
    const user = db.users.find((u) => (u.email ?? u.username) === typed)
    if (!user || user.password !== password) throw new ApiError('WRONG_DETAILS')
    db.session = user.id
    return asUser(user)
  })

export const signUp = ({ name, email, password }) =>
  answer((db) => {
    const address = email.trim().toLowerCase()
    refuse({
      name: !name.trim() && 'required',
      email: !/^\S+@\S+\.\S+$/.test(address) && 'format',
      password: password.length < 8 && 'short',
    })
    if (db.users.some((u) => u.email === address)) throw new ApiError('EMAIL_TAKEN')
    const user = { id: crypto.randomUUID(), role: 'parent', name: name.trim(), email: address, password }
    db.users.push(user)
    db.session = user.id
    return asUser(user)
  })

export const signOut = () =>
  answer((db) => {
    db.session = null
  }, { always: true })

export const listChildren = () =>
  answer((db) => {
    const me = only('parent', db)
    return db.users.filter((u) => u.role === 'child' && u.parentId === me.id).map(asChild)
  })

export const getChild = (id) => answer((db) => asChild(ownChild(db, id)))

export const addChild = ({ name, username, password }) =>
  answer((db) => {
    const me = only('parent', db)
    refuse({
      name: !name.trim() && 'required',
      username: !/^[a-z0-9]{3,20}$/.test(username) && 'format',
      password: password.length < 6 && 'short',
    })
    if (db.users.some((u) => u.username === username)) throw new ApiError('USERNAME_TAKEN')
    const child = { id: crypto.randomUUID(), role: 'child', name: name.trim(), username, password, parentId: me.id }
    db.users.push(child)
    return asChild(child)
  })

export const renameChild = (id, name) =>
  answer((db) => {
    const child = ownChild(db, id)
    refuse({ name: !name.trim() && 'required' })
    child.name = name.trim()
    return asChild(child)
  })

export const resetChildPassword = (id, password) =>
  answer((db) => {
    const child = ownChild(db, id)
    refuse({ password: password.length < 6 && 'short' })
    child.password = password
  })

/**
 * Removes these users and everything held for them: their tasks with every proof, their awards,
 * the family's rewards and requests, each child's quests, quest awards and rest days, a parent's
 * settings, and the reports they sent that the moderator has answered. A report not yet answered stays for
 * the moderator (rule 16), with its sender's id taken off: it then holds no user, family or task
 * id, only the words, the sender's role, the time and the task copy. Returns the ids of the proof
 * files, which have to go as well.
 */
export function erase(db, userIds) {
  const gone = new Set(userIds)
  const files = db.tasks.filter((t) => gone.has(t.childId)).flatMap((t) => t.proofs).filter((p) => p.fileType).map((p) => p.id)
  db.users = db.users.filter((u) => !gone.has(u.id))
  db.tasks = db.tasks.filter((t) => !gone.has(t.childId))
  db.reports = db.reports.filter((r) => !gone.has(r.byId) || !r.resolution)
  for (const report of db.reports) if (gone.has(report.byId)) delete report.byId
  db.rewards = db.rewards.filter((r) => !gone.has(r.parentId))
  db.requests = db.requests.filter((r) => !gone.has(r.childId) && !gone.has(r.parentId))
  for (const id of gone) {
    for (const held of [db.awards, db.quests, db.questAwards, db.restDays, db.settings]) delete held[id]
  }
  if (gone.has(db.session)) db.session = null
  return files
}

// ponytail: records first, then files, and a file that will not go is left behind with no record
// pointing to it: by then the deletion has happened and must be reported as done. The server does
// both as one job.
async function eraseFiles(ids) {
  await Promise.allSettled(ids.map((id) => deleteFile(id)))
  for (const id of ids) {
    URL.revokeObjectURL(fileUrls.get(id)) // a picture already on screen in this tab goes too
    fileUrls.delete(id)
  }
}

export const removeChild = async (id) => eraseFiles(await answer((db) => erase(db, [ownChild(db, id).id])))

export const updateName = (name) =>
  answer((db) => {
    const me = only('parent', db)
    refuse({ name: !name.trim() && 'required' })
    me.name = name.trim()
    return asUser(me)
  })

export const changePassword = ({ current, next }) =>
  answer((db) => {
    const me = only('parent', db)
    if (me.password !== current) throw new ApiError('WRONG_PASSWORD')
    refuse({ next: next.length < 8 && 'short' })
    me.password = next
  })

export const deleteFamily = async (password) =>
  eraseFiles(
    await answer((db) => {
      const me = only('parent', db)
      if (me.password !== password) throw new ApiError('WRONG_PASSWORD')
      return erase(db, [me.id, ...db.users.filter((u) => u.parentId === me.id).map((u) => u.id)])
    }),
  )

// ------------------------------------------------------------------ tasks and proof

/** The tasks this user may see: a parent's whole family, or a child's own. */
function visibleTasks(db) {
  const me = signedIn(db)
  if (me.role === 'child') return db.tasks.filter((t) => t.childId === me.id)
  if (me.role !== 'parent') throw new ApiError('NOT_ALLOWED')
  const mine = new Set(db.users.filter((u) => u.parentId === me.id).map((u) => u.id))
  return db.tasks.filter((t) => mine.has(t.childId))
}

function visibleTask(db, id) {
  const task = visibleTasks(db).find((t) => t.id === id)
  if (!task) throw new ApiError('NOT_FOUND')
  return task
}

const asTask = (db, task) => {
  const child = db.users.find((u) => u.id === task.childId)
  return { ...structuredClone(task), childName: child?.name ?? '', pinned: task.id === child?.pinnedTaskId }
}

/** The child's choice of next task ends when proof is sent for it or it is deleted (rule 22). */
function unpin(db, task) {
  const child = db.users.find((u) => u.id === task.childId)
  if (child?.pinnedTaskId === task.id) delete child.pinnedTaskId
}

const fileUrls = new Map() // proof id to its address, so a reload shows the same picture and makes no new one

/** Gives each proof file an address the browser can show. A server would return a storage URL. */
async function withFiles(task) {
  for (const proof of task.proofs) {
    if (!proof.fileType) continue
    if (!fileUrls.has(proof.id)) {
      const file = await getFile(proof.id)
      // ponytail: these object URLs are never revoked; they go when the page does
      if (file) fileUrls.set(proof.id, URL.createObjectURL(file))
    }
    proof.fileUrl = fileUrls.get(proof.id)
  }
  return task
}

function checkTask(db, { childId, category, title, instructions, dueAt, points }, dueChanged) {
  ownChild(db, childId)
  const due = new Date(dueAt)
  refuse({
    category: !CATEGORIES.includes(category) && 'required',
    title: (title.trim().length < 3 || title.trim().length > 80) && 'length',
    instructions: (!instructions.trim() || instructions.length > 500) && 'length',
    dueAt: (Number.isNaN(due.getTime()) || (dueChanged && due <= now())) && 'past',
    points: !(Number.isInteger(points) && points >= 5 && points <= 100 && points % 5 === 0) && 'range',
  })
  screen(`${title} ${instructions}`)
}

/** Rule 8: refuses text that uses a blocked word, and names the word. Tasks, rewards and quest surprises all pass here. */
function screen(text) {
  const lower = text.toLowerCase()
  const word = BLOCKED_WORDS.find((w) => new RegExp(`\\b${w}\\b`).test(lower))
  if (word) throw new ApiError('SCREENED', { word })
}

const byDue = (a, b) => new Date(a.dueAt) - new Date(b.dueAt) || new Date(a.createdAt) - new Date(b.createdAt)

export const listTasks = () => answer((db) => visibleTasks(db).sort(byDue).map((t) => asTask(db, t)))

export const getTask = async (id) => withFiles(await answer((db) => asTask(db, visibleTask(db, id))))

export const createTask = (details) =>
  answer((db) => {
    only('parent', db)
    checkTask(db, details, true)
    const { childId, category, title, instructions, dueAt, points } = details
    const task = {
      id: crypto.randomUUID(), childId, category, title: title.trim(), instructions: instructions.trim(),
      dueAt: new Date(dueAt).toISOString(), points,
      status: 'todo', createdAt: now().toISOString(), proofs: [], resultSeen: true,
    }
    db.tasks.push(task)
    return asTask(db, task)
  })

export const updateTask = (id, details) =>
  answer((db) => {
    only('parent', db)
    const task = visibleTask(db, id)
    if (task.proofs.length > 0) throw new ApiError('LOCKED') // rule 2: editable until the first proof is sent
    const dueAt = new Date(details.dueAt).toISOString()
    checkTask(db, details, dueAt.slice(0, 16) !== task.dueAt.slice(0, 16)) // the form works in minutes
    Object.assign(task, {
      childId: details.childId, category: details.category, title: details.title.trim(),
      instructions: details.instructions.trim(), dueAt, points: details.points,
    })
    return asTask(db, task)
  })

export async function deleteTask(id) {
  const proofs = await answer((db) => {
    only('parent', db)
    const task = visibleTask(db, id)
    if (task.status === 'approved') throw new ApiError('LOCKED') // rule 2: deletable until it is approved
    unpin(db, task)
    db.tasks = db.tasks.filter((t) => t !== task)
    return task.proofs
  })
  await eraseFiles(proofs.filter((p) => p.fileType).map((p) => p.id))
}

const OPEN = ['todo', 'sentBack'] // the statuses in which a task takes proof

export async function sendProof(taskId, { file, note = '' }, { onProgress } = {}) {
  const mode = devMode()
  // refuse what can be refused before a single byte is sent, as a server would
  await answer((db) => {
    only('child', db)
    if (!OPEN.includes(visibleTask(db, taskId).status)) throw new ApiError('LOCKED')
    refuse({ proof: !file && !note.trim() && 'required', note: note.length > 500 && 'length' })
    if (file && !FILE_TYPES.includes(file.type)) throw new ApiError('FILE_TYPE')
    if (file && file.size > MAX_FILE_BYTES) throw new ApiError('FILE_TOO_LARGE')
  })
  const proofId = crypto.randomUUID()
  if (file) {
    for (let tenths = 1; tenths <= 10; tenths++) {
      await wait(mode === 'upload-slow' ? 700 : 120)
      if (mode === 'upload-fail' && tenths === 6) throw new ApiError('NETWORK')
      onProgress?.(tenths / 10)
    }
    await putFile(proofId, file)
  }
  const record = (db) => {
    const stored = visibleTask(db, taskId)
    if (!OPEN.includes(stored.status)) throw new ApiError('LOCKED') // sent from somewhere else meanwhile
    const sentAt = now().toISOString()
    stored.proofs.push({
      id: proofId, note: note.trim(), sentAt,
      late: sentAt > stored.dueAt, // rule 1: late proof is accepted, and marked
      ...(file && { fileName: file.name, fileType: file.type, fileSize: file.size }),
    })
    stored.status = 'review'
    unpin(db, stored)
    return asTask(db, stored)
  }
  const task = await answer(record).catch(async (error) => {
    if (file) await deleteFile(proofId) // the task went away or was answered meanwhile: keep no orphan
    throw error
  })
  return withFiles(task)
}

/**
 * A parent's answer to the newest proof. It lands once: by the time a second tab, a second press
 * or a slow answer arrives, the task is no longer in review and the attempt is refused.
 *
 * An approval may carry a cheer (rule 20), which is checked only then. One with no kind and no
 * words is not stored. An approval that reaches the child's quest target for the week its proof
 * was sent in completes that quest (rule 19), from the quest as it is now, before the stickers
 * are worked out, so that a quest sticker is earned by this same approval.
 */
function review(taskId, proofId, result, note = '', cheer) {
  return answer((db) => {
    const me = only('parent', db)
    const task = visibleTask(db, taskId)
    const proof = task.proofs.at(-1)
    if (task.status !== 'review' || proof.id !== proofId) throw new ApiError('REVIEWED')
    const given = result === 'approved' && cheer
    const kind = given ? (cheer.kind ?? null) : null
    const line = given ? (cheer.line ?? '').trim() : ''
    refuse({
      note: (result === 'sentBack' && !note.trim() && 'required') || (note.length > 300 && 'length'),
      cheer: kind !== null && !CHEER_KINDS.includes(kind) && 'kind',
      line: line.length > 120 && 'length',
    })
    proof.review = { result, note: note.trim(), by: me.name, at: now().toISOString(), ...((kind || line) && { cheer: { kind, line } }) }
    task.status = result
    task.resultSeen = false // rule 4: Today shows it as new until the child has seen it
    if (result === 'approved') {
      const approval = { earnedAt: proof.review.at, taskId: task.id, taskTitle: task.title }
      const quest = db.quests[task.childId]
      const week = questCompletedBy(tasksOf(db, task.childId), quest, db.questAwards[task.childId], task)
      if (week) {
        const { target, bonus, surprise } = quest
        db.questAwards[task.childId] ??= {}
        db.questAwards[task.childId][week] = { week, target, bonus, surprise, ...approval }
        quest.surprise = null // opened now: next week's quest does not promise it again unless the parent writes one
      }
      recordAwards(db, task.childId, approval)
    }
    return asTask(db, task)
  }).then(withFiles)
}

export const approveProof = (taskId, proofId, cheer) => review(taskId, proofId, 'approved', '', cheer)
export const sendBackProof = (taskId, proofId, note) => review(taskId, proofId, 'sentBack', note)

export const markResultsSeen = (taskIds) =>
  answer((db) => {
    const me = only('child', db)
    for (const task of db.tasks) if (task.childId === me.id && taskIds.includes(task.id)) task.resultSeen = true
  })

export const countProofsWaiting = () => answer((db) => visibleTasks(db).filter((t) => t.status === 'review').length)

const tasksOf = (db, childId) => db.tasks.filter((t) => t.childId === childId)
const restOf = (db, childId) => db.restDays[childId] ?? []
/** The quests the child has completed, newest first. */
const questAwardsOf = (db, childId) =>
  Object.values(db.questAwards[childId] ?? {}).sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
/** Whether the child has seen the approval an award came with on Today (rule 13). An award with no task is seen. */
const awardSeen = (db, award) => db.tasks.find((t) => t.id === award.taskId)?.resultSeen ?? true
/** A task as the child has been shown it: an approval they have not yet seen on Today still waits. */
const notShown = (t) => (t.status === 'approved' && !t.resultSeen ? { ...t, status: 'review' } : t)

/**
 * Records every sticker the child's tasks now earn and did not have. A recorded award stays,
 * whatever happens to the tasks later. approval is the one being given now, which the new
 * stickers belong to; without it (the demo's history) each keeps the approval the rules trace it to.
 */
function recordAwards(db, childId, approval) {
  const have = (db.awards[childId] ??= {})
  const input = { rest: restOf(db, childId), questAwards: questAwardsOf(db, childId) }
  for (const { id, earnedAt, taskId, taskTitle } of stickers(tasksOf(db, childId), input)) {
    if (earnedAt && !have[id]) have[id] = approval ?? { earnedAt, taskId, taskTitle }
  }
}

/**
 * A child's score by the award rules, and beside it the score as the child has been shown it:
 * an approval they have not yet seen on Today still counts as waiting there, and so does a quest
 * completed with it. balance is what the child can spend (rule 17); the child's own, in shown,
 * is what a request is checked against. A quest comes with its surprise and whether it is sealed
 * for a parent, who always reads it; getGrowth takes it back for the child.
 */
export function growthOf(db, childId) {
  const theirs = tasksOf(db, childId)
  const rest = restOf(db, childId)
  const def = db.quests[childId] ?? null
  const byWeek = db.questAwards[childId] ?? {}
  const awards = questAwardsOf(db, childId)
  const held = db.requests.filter((r) => r.childId === childId)
  const sealed = (quest) => quest && { ...quest, sealed: Boolean(quest.surprise) && !quest.completed }
  const current = score(theirs, now(), rest)
  current.balance = balanceOf(current.points, awards, held)
  current.quest = sealed(questOf(theirs, def, byWeek, now()))
  const shownTasks = theirs.map(notShown)
  const seenAwards = awards.filter((a) => awardSeen(db, a))
  const shownByWeek = Object.fromEntries(Object.entries(byWeek).filter(([, a]) => awardSeen(db, a)))
  const shownScore = score(shownTasks, now(), rest)
  const shown = {
    ...shownScore,
    // what is waiting for a parent is the same either way: an approval not yet seen is not waiting for one
    waitingXp: current.waitingXp,
    balance: balanceOf(shownScore.points, seenAwards, held),
    quest: sealed(questOf(shownTasks, def, shownByWeek, now())),
  }
  return { ...current, questAwards: awards.map((a) => ({ ...a, seen: awardSeen(db, a) })), shown }
}

/**
 * A quest as a child may read it. The surprise stays sealed until the week's quest is complete and
 * they have seen it (rule 19). After that it reads as the award does: a parent who changes the quest
 * later in the week is setting up a later week, so nothing of the change opens early.
 */
function questForChild(quest, award) {
  if (!quest) return quest
  if (!award) return { ...quest, surprise: null, sealed: Boolean(quest.surprise) }
  const { target, bonus, surprise } = award
  return { ...quest, target, bonus, done: target, surprise, sealed: false }
}

/** Growth as a child is given it. Takes a db so that fake.check.js can run it. */
export function growthForChild(db, childId) {
  const growth = growthOf(db, childId)
  const { completed, week } = growth.shown.quest ?? {} // shown only counts the quests the child has seen
  const award = completed ? growth.questAwards.find((a) => a.week === week) : undefined
  return { ...growth, quest: questForChild(growth.quest, award), shown: { ...growth.shown, quest: questForChild(growth.shown.quest, award) } }
}

export const getGrowth = () => answer((db) => growthForChild(db, only('child', db).id))

export const listGrowth = () =>
  answer((db) => {
    const me = only('parent', db)
    const children = db.users.filter((u) => u.role === 'child' && u.parentId === me.id)
    return Object.fromEntries(children.map((child) => [child.id, growthOf(db, child.id)]))
  })

export const listStickers = () =>
  answer((db) => {
    const me = only('child', db)
    const seenAwards = questAwardsOf(db, me.id).filter((a) => awardSeen(db, a))
    const record = recordOf(tasksOf(db, me.id).map(notShown), now(), { rest: restOf(db, me.id), quests: seenAwards.length })
    return STICKERS.map((s) => {
      const award = db.awards[me.id]?.[s.id]
      const seen = award && awardSeen(db, award)
      const sticker = award ? { ...s, ...award, seen } : s
      // a sticker not yet earned, or not yet seen, shows how far along it is
      return seen ? sticker : { ...sticker, have: Math.min(s.need, record[s.measure]) }
    })
  })

/**
 * One child's progress for their parent (rule 14): the real score, the weeks, the calendar, the
 * counts and the stickers. All of it is read from the child's tasks when asked; none is stored.
 */
export const getProgress = (childId) =>
  answer((db) => {
    const child = ownChild(db, childId)
    const theirs = tasksOf(db, child.id)
    const open = theirs.filter((t) => OPEN.includes(t.status))
    const rest = restOf(db, child.id)
    return {
      child: asChild(child),
      ...score(theirs, now(), rest),
      ...progress(theirs, now(), rest),
      counts: {
        approved: theirs.filter((t) => t.status === 'approved').length,
        waiting: theirs.filter((t) => t.status === 'review').length,
        open: open.length,
        overdue: open.filter((t) => t.status === 'todo' && new Date(t.dueAt) < now()).length,
      },
      stickers: STICKERS.map((s) => ({ ...s, ...db.awards[child.id]?.[s.id] })),
    }
  })

export const countNewResults = () => answer((db) => tasksOf(db, only('child', db).id).filter((t) => !t.resultSeen).length)

// ------------------------------------------------------------------ rewards, quests and the rest (rules 17 to 24)

/** The parent whose family the signed-in parent or child belongs to. A moderator has none. */
function familyOf(db) {
  const me = signedIn(db)
  if (me.role === 'moderator') throw new ApiError('NOT_ALLOWED')
  return me.role === 'parent' ? me.id : me.parentId
}

const asReward = ({ id, title, cost }) => ({ id, title, cost })

export const listRewards = () =>
  answer((db) => {
    const family = familyOf(db)
    const mine = db.rewards.filter((r) => r.parentId === family)
    return mine.sort((a, b) => a.cost - b.cost || a.createdAt.localeCompare(b.createdAt)).map(asReward)
  })

export const saveReward = ({ id, title, cost }) =>
  answer((db) => {
    const me = only('parent', db)
    const existing = db.rewards.find((r) => r.id === id && r.parentId === me.id)
    if (id && !existing) throw new ApiError('NOT_FOUND')
    refuse({
      title: (title.trim().length < 3 || title.trim().length > 60) && 'length',
      cost: !(Number.isInteger(cost) && cost >= 10 && cost <= 1000 && cost % 10 === 0) && 'range',
    })
    screen(title)
    const reward = existing ?? { id: crypto.randomUUID(), parentId: me.id, createdAt: now().toISOString() }
    Object.assign(reward, { title: title.trim(), cost })
    if (!existing) db.rewards.push(reward)
    return asReward(reward)
  })

export const deleteReward = (id) =>
  answer((db) => {
    const me = only('parent', db)
    if (!db.rewards.some((r) => r.id === id && r.parentId === me.id)) throw new ApiError('NOT_FOUND')
    db.rewards = db.rewards.filter((r) => r.id !== id) // requests made for it keep their own copy of the title and cost
  })

/** A request as anyone is given it: with the child's name, without the parent's id. */
function asRequest(db, request) {
  const { parentId: _family, ...copy } = structuredClone(request)
  return { ...copy, childName: db.users.find((u) => u.id === request.childId)?.name ?? '' }
}

/**
 * A child asks for one of their parent's rewards (rule 18). The points are held at once. The
 * balance is read here, inside the one call that pushes the request, so that two tabs cannot
 * spend the same points twice. Takes a db so that fake.check.js can run it.
 */
export function requestIn(db, rewardId) {
  const me = only('child', db)
  const reward = db.rewards.find((r) => r.id === rewardId && r.parentId === me.parentId)
  if (!reward) throw new ApiError('NOT_FOUND')
  if (growthOf(db, me.id).shown.balance < reward.cost) throw new ApiError('NOT_ENOUGH')
  const request = {
    id: crypto.randomUUID(), childId: me.id, parentId: me.parentId, rewardId: reward.id,
    title: reward.title, cost: reward.cost, status: 'requested', note: '', requestedAt: now().toISOString(),
  }
  db.requests.push(request)
  return asRequest(db, request)
}

export const requestReward = (rewardId) => answer((db) => requestIn(db, rewardId))

export const listRequests = () =>
  answer((db) => {
    const me = signedIn(db)
    if (me.role === 'moderator') throw new ApiError('NOT_ALLOWED')
    const mine = db.requests.filter((r) => (me.role === 'child' ? r.childId : r.parentId) === me.id)
    return mine.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)).map((r) => asRequest(db, r))
  })

/**
 * A parent gives or declines a request in their family. It is answered once: a second answer, from
 * anywhere, is refused. Declining gives the points back, because a declined request no longer holds
 * any (see balanceOf). Takes a db so that fake.check.js can run it.
 */
export function answerIn(db, id, result, note = '') {
  const me = only('parent', db)
  const request = db.requests.find((r) => r.id === id && r.parentId === me.id)
  if (!request) throw new ApiError('NOT_FOUND')
  if (request.status !== 'requested') throw new ApiError('REVIEWED')
  refuse({ result: !['given', 'declined'].includes(result) && 'required', note: note.length > 200 && 'length' })
  request.status = result
  request.note = result === 'declined' ? note.trim() : ''
  request.answer = { by: me.name, at: now().toISOString() }
  return asRequest(db, request)
}

export const answerRequest = (id, result, note) => answer((db) => answerIn(db, id, result, note))

export const countRequestsWaiting = () =>
  answer((db) => {
    const me = only('parent', db)
    return db.requests.filter((r) => r.parentId === me.id && r.status === 'requested').length
  })

/** Sets or removes a child's quest. Takes a db so that fake.check.js can run it. */
export function setQuestIn(db, childId, def) {
  const child = ownChild(db, childId)
  if (!def) {
    delete db.quests[child.id]
    return null
  }
  const { target, bonus } = def
  const surprise = (def.surprise ?? '').trim() || null // an empty surprise means none
  // a quest completes on an approval, so one already reached this week would show as full and never pay
  const week = weekKey(now())
  const passed = !db.questAwards[child.id]?.[week] && target <= approvedInWeek(tasksOf(db, child.id), week)
  refuse({
    target: (!(Number.isInteger(target) && target >= 2 && target <= 20) && 'range') || (passed && 'done'),
    bonus: !(Number.isInteger(bonus) && bonus >= 10 && bonus <= 200 && bonus % 5 === 0) && 'range',
    surprise: (surprise ?? '').length > 80 && 'length',
  })
  if (surprise) screen(surprise)
  db.quests[child.id] = { target, bonus, surprise, setAt: now().toISOString() }
  return { target, bonus, surprise }
}

export const setQuest = (childId, def) => answer((db) => setQuestIn(db, childId, def))

/** The day this many days from today (negative for the past), as 'YYYY-MM-DD'. */
const dayKeyIn = (days) => {
  const day = now()
  day.setDate(day.getDate() + days)
  return dayKey(day)
}

/** Whether text names a real calendar day: the pattern alone lets 2026-02-31 through. */
function isDay(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const [y, m, d] = text.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d)) === text
}

/** The rest days a parent can still change: from 7 days ago onward. Earlier ones stay, and still count. */
const recentRest = (db, childId) => restOf(db, childId).filter((day) => day >= dayKeyIn(-7))

export const listRestDays = (childId) => answer((db) => recentRest(db, ownChild(db, childId).id))

export const setRestDay = (childId, day, rest) =>
  answer((db) => {
    const child = ownChild(db, childId)
    refuse({ day: !(typeof day === 'string' && isDay(day) && day >= dayKeyIn(-7) && day <= dayKeyIn(90)) && 'range' })
    const days = new Set(restOf(db, child.id))
    if (rest) days.add(day)
    else days.delete(day)
    db.restDays[child.id] = [...days].sort() // keys of 'YYYY-MM-DD' sort as dates
    return recentRest(db, child.id)
  })

export const pinTask = (taskId) =>
  answer((db) => {
    const me = only('child', db)
    if (taskId === null) delete me.pinnedTaskId
    else {
      const task = visibleTask(db, taskId) // a child sees only their own, so another's is not found
      if (!OPEN.includes(task.status)) throw new ApiError('LOCKED')
      me.pinnedTaskId = task.id // one at a time: this replaces any earlier choice
    }
    return visibleTasks(db).sort(byDue).map((t) => asTask(db, t))
  })

export const getLeaderboard = () =>
  answer((db) => {
    const me = only('child', db)
    const siblings = db.users.filter((u) => u.role === 'child' && u.parentId === me.parentId)
    if (siblings.length < 2 || !db.settings[me.parentId]?.leaderboard) return null
    const week = weekKey(now())
    // only approvals each child has been shown count (rule 13), so no one learns of a sibling's result before they do
    return siblings
      .map((c) => ({ name: c.name, tasks: approvedInWeek(tasksOf(db, c.id).map(notShown), week), you: c.id === me.id }))
      .sort((a, b) => b.tasks - a.tasks || a.name.localeCompare(b.name))
  })

export const getSettings = () => answer((db) => ({ leaderboard: Boolean(db.settings[only('parent', db).id]?.leaderboard) }))

export const setLeaderboard = (on) =>
  answer((db) => {
    const me = only('parent', db)
    db.settings[me.id] = { ...db.settings[me.id], leaderboard: Boolean(on) }
    return { leaderboard: db.settings[me.id].leaderboard }
  })

// ------------------------------------------------------------------ reports (rule 15)

/**
 * What a report keeps of the task it was sent from, copied at that moment so that a later edit
 * or delete cannot change what was reported. Words only: the task as the parent wrote it and the
 * notes the parent sent proof back with. Never a proof file, a child's note or anybody's name.
 */
export const itemOf = (task) => ({
  title: task.title,
  instructions: task.instructions,
  dueAt: task.dueAt,
  points: task.points,
  notes: task.proofs.filter((p) => p.review?.note).map((p) => p.review.note),
  proofs: task.proofs.length,
})

/** A report as anyone is given it: without who sent it. */
const asReport = ({ byId: _who, ...report }) => report

export const sendReport = ({ details, taskId }) =>
  answer((db) => {
    const me = signedIn(db)
    if (me.role === 'moderator') throw new ApiError('NOT_ALLOWED')
    refuse({ details: (!details.trim() && 'required') || (details.length > 1000 && 'length') })
    // a task that is not theirs to see is left out without a word, and the report still goes
    const task = taskId && visibleTasks(db).find((t) => t.id === taskId)
    const report = {
      id: crypto.randomUUID(), byId: me.id, from: me.role, details: details.trim(), sentAt: now().toISOString(),
      ...(task && { item: itemOf(task) }),
    }
    db.reports.push(report) // straight to the moderator's list: no parent is asked, told or shown
    return asReport(report)
  })

export const listMyReports = () =>
  answer((db) => {
    const me = signedIn(db)
    return db.reports.filter((r) => r.byId === me.id).map(asReport).reverse()
  })

/** What the moderator is handed, kept apart from the stored data so that fake.check.js can run it. */
export function reportsFor(db) {
  only('moderator', db)
  return db.reports.map(asReport)
}

/** The moderator's answer. A report whose sender was deleted has nobody to read it, so it goes (rule 16). */
export function answerReport(db, id, note) {
  only('moderator', db)
  const report = db.reports.find((r) => r.id === id)
  if (!report) throw new ApiError('NOT_FOUND')
  if (report.resolution) throw new ApiError('LOCKED')
  refuse({ note: (!note.trim() && 'required') || (note.length > 500 && 'length') })
  report.resolution = { note: note.trim(), at: now().toISOString() }
  if (!report.byId) db.reports = db.reports.filter((r) => r !== report)
  return asReport(report)
}

export const listReports = () => answer(reportsFor)

export const resolveReport = (id, note) => answer((db) => answerReport(db, id, note))

// ------------------------------------------------------------------ development helpers

export const listDemoSignIns = async () =>
  import.meta.env.DEV
    ? DEMO_USERS.map((u) => ({ who: `${u.name} (${u.role})`, identifier: u.email ?? u.username, password: u.password }))
    : []
