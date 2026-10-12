import { now } from '../api/clock.js'
import { fileSizeText } from './format.js'

// What each form field must be. Each rule returns what to do, or null when the value is fine.
// The server checks the same things again; these exist so the form can answer as you type.

/** What a proof file may be (FRONTEND-SITEMAP.md section 12, rule 5). */
export const PROOF_TYPES = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,application/pdf'
const PROOF_MAX_BYTES = 25 * 1024 * 1024

export const rules = {
  name: (v) => (v.trim() ? null : 'Enter a name.'),
  email: (v) => (/^\S+@\S+\.\S+$/.test(v.trim()) ? null : 'Enter an email address, like name@example.com.'),
  parentPassword: (v) => (v.length >= 8 ? null : 'Use at least 8 characters.'),
  username: (v) => (/^[a-z0-9]{3,20}$/.test(v) ? null : 'Use 3 to 20 lowercase letters or numbers, with no spaces.'),
  childPassword: (v) => (v.length >= 6 ? null : 'Use at least 6 characters.'),

  taskTitle: (v) => (v.trim().length >= 3 && v.trim().length <= 80 ? null : 'Give the task a title of 3 to 80 characters.'),
  taskInstructions: (v) => (v.trim() ? null : 'Say what has to be done and what proof to send.'),
  /** mustBeAhead is false when an existing task keeps the due time it already had. */
  due: (v, who, mustBeAhead) => {
    if (!v || Number.isNaN(new Date(v).getTime())) return `Add a day and time so ${who} knows when it is due.`
    return mustBeAhead && new Date(v) <= now() ? 'Pick a time that has not passed yet.' : null
  },
  proofFile: (file) => {
    if (!PROOF_TYPES.split(',').includes(file.type)) return 'That kind of file cannot be sent. Choose a photo, a video or a PDF.'
    if (file.size > PROOF_MAX_BYTES) return `That file is ${fileSizeText(file.size)}. The most that can be sent is 25 MB. Choose a smaller one.`
    return null
  },
}

/** What a username field keeps as the parent types: lowercase letters and digits only. */
export const asUsername = (typed) => typed.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
