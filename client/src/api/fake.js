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
import { CHART, progress, score, stickers } from './scoring.js'

const KEY = 'growkid.fake.v5'
const DEV_KEY = 'growkid.dev'

// Rule 5, proof files: one photo, video or PDF of up to 25 MB, or a note with no file.
const MAX_FILE_BYTES = 25 * 1024 * 1024
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf']
const CATEGORIES = ['chores', 'study', 'reading', 'creative', 'outdoors', 'health']
// Rule 8, content screening: a task may not use these words. A sample list; the server owns the real one.
const BLOCKED_WORDS = ['secret', 'dare', "don't tell"]

const DEMO_USERS = [
  { id: 'demo-parent', role: 'parent', name: 'Meera Joshi', email: 'meera@example.com', password: 'growkid-demo' },
  { id: 'demo-aarav', role: 'child', name: 'Aarav', username: 'aarav', password: 'plants42', parentId: 'demo-parent' },
  { id: 'demo-diya', role: 'child', name: 'Diya', username: 'diya', password: 'books77', parentId: 'demo-parent' },
  { id: 'demo-moderator', role: 'moderator', name: 'Moderator', email: 'moderator@example.com', password: 'growkid-demo' },
]

/**
 * The demo family's tasks, dated from the moment the data is first created. Aarav has a few days
 * of history and one approval he has not seen yet; Diya is new. No level, streak or sticker is
 * stored anywhere: they all come from these tasks by the award rules in ./scoring.js.
 */
function demoTasks() {
  const at = (days, hour) => {
    const day = now()
    day.setDate(day.getDate() + days)
    day.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0)
    return day.toISOString()
  }
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

function read() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return { reports: [], ...JSON.parse(saved) } // data saved before there were reports
  } catch {
    // unreadable or blocked: start again from the demo data
  }
  // the demo family's stickers come from running the award rules over its tasks, like everything else
  const db = { users: structuredClone(DEMO_USERS), tasks: demoTasks(), session: null, awards: {}, reports: [] }
  for (const user of db.users) if (user.role === 'child') recordAwards(db, user.id)
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
 * Removes these users and everything held for them: their tasks with every proof, their awards
 * and the reports they sent that the moderator has answered. A report not yet answered stays for
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
  for (const id of gone) delete db.awards[id]
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

const asTask = (db, task) => ({
  ...structuredClone(task),
  childName: db.users.find((u) => u.id === task.childId)?.name ?? '',
})

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
  const text = `${title} ${instructions}`.toLowerCase()
  const word = BLOCKED_WORDS.find((w) => new RegExp(`\\b${w}\\b`).test(text))
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
 */
function review(taskId, proofId, result, note = '') {
  return answer((db) => {
    const me = only('parent', db)
    const task = visibleTask(db, taskId)
    const proof = task.proofs.at(-1)
    if (task.status !== 'review' || proof.id !== proofId) throw new ApiError('REVIEWED')
    refuse({ note: (result === 'sentBack' && !note.trim() && 'required') || (note.length > 300 && 'length') })
    proof.review = { result, note: note.trim(), by: me.name, at: now().toISOString() }
    task.status = result
    task.resultSeen = false // rule 4: Today shows it as new until the child has seen it
    if (result === 'approved') recordAwards(db, task.childId, { earnedAt: proof.review.at, taskId: task.id, taskTitle: task.title })
    return asTask(db, task)
  }).then(withFiles)
}

export const approveProof = (taskId, proofId) => review(taskId, proofId, 'approved')
export const sendBackProof = (taskId, proofId, note) => review(taskId, proofId, 'sentBack', note)

export const markResultsSeen = (taskIds) =>
  answer((db) => {
    const me = only('child', db)
    for (const task of db.tasks) if (task.childId === me.id && taskIds.includes(task.id)) task.resultSeen = true
  })

export const countProofsWaiting = () => answer((db) => visibleTasks(db).filter((t) => t.status === 'review').length)

const tasksOf = (db, childId) => db.tasks.filter((t) => t.childId === childId)

/**
 * Records every sticker the child's tasks now earn and did not have. A recorded award stays,
 * whatever happens to the tasks later. approval is the one being given now, which the new
 * stickers belong to; without it (the demo's history) each keeps the approval the rules trace it to.
 */
function recordAwards(db, childId, approval) {
  const have = (db.awards[childId] ??= {})
  for (const { id, earnedAt, taskId, taskTitle } of stickers(tasksOf(db, childId))) {
    if (earnedAt && !have[id]) have[id] = approval ?? { earnedAt, taskId, taskTitle }
  }
}

/**
 * A child's score by the award rules, and beside it the score as the child has been shown it:
 * an approval they have not yet seen on Today still counts as waiting there.
 */
function growthOf(db, childId) {
  const theirs = tasksOf(db, childId)
  const notShown = (t) => (t.status === 'approved' && !t.resultSeen ? { ...t, status: 'review' } : t)
  const current = score(theirs, now())
  // what is waiting for a parent is the same either way: an approval not yet seen is not waiting for one
  return { ...current, shown: { ...score(theirs.map(notShown), now()), waitingXp: current.waitingXp } }
}

export const getGrowth = () => answer((db) => growthOf(db, only('child', db).id))

export const listGrowth = () =>
  answer((db) => {
    const me = only('parent', db)
    const children = db.users.filter((u) => u.role === 'child' && u.parentId === me.id)
    return Object.fromEntries(children.map((child) => [child.id, growthOf(db, child.id)]))
  })

export const listStickers = () =>
  answer((db) => {
    const me = only('child', db)
    const seen = (award) => db.tasks.find((t) => t.id === award.taskId)?.resultSeen ?? true
    return CHART.map((s) => {
      const award = db.awards[me.id]?.[s.id]
      return award ? { ...s, ...award, seen: seen(award) } : s
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
    return {
      child: asChild(child),
      ...score(theirs, now()),
      ...progress(theirs, now()),
      counts: {
        approved: theirs.filter((t) => t.status === 'approved').length,
        waiting: theirs.filter((t) => t.status === 'review').length,
        open: open.length,
        overdue: open.filter((t) => t.status === 'todo' && new Date(t.dueAt) < now()).length,
      },
      stickers: CHART.map((s) => ({ ...s, ...db.awards[child.id]?.[s.id] })),
    }
  })

export const countNewResults = () => answer((db) => tasksOf(db, only('child', db).id).filter((t) => !t.resultSeen).length)

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
