import { now } from '../api/clock.js'
import { fileSizeText, fromLocalInput } from './format.js'

// What each form field must be. Each rule returns what to do, or null when the value is fine.
// The server checks the same things again; these exist so the form can answer as you type.

/** What a proof file may be (FRONTEND-SITEMAP.md section 12, rule 5). */
export const PROOF_TYPES = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime'
const PROOF_MAX_BYTES = 25 * 1024 * 1024

/** The server's limits (sitemap rule 27): a name is at most 60 characters, a password at most 72 bytes (the bcrypt limit). */
const nameTooLong = (v) => v.trim().length > 60
const passwordTooLong = (v) => new TextEncoder().encode(v).length > 72
/** A whole number typed into a field, from min to max in steps of step; '' and anything else is not one (Number('') is 0). */
const whole = (v, min, max, step) => {
  const n = Number(String(v).trim() === '' ? NaN : v)
  return Number.isInteger(n) && n >= min && n <= max && n % step === 0
}
const TOO_LONG = 'That password is too long. Use 72 characters or fewer (fewer if it uses letters outside A to Z).'

export const rules = {
  name: (v) => (!v.trim() ? 'Enter a name.' : nameTooLong(v) ? 'Use 60 characters or fewer.' : null),
  email: (v) => (/^\S+@\S+\.\S+$/.test(v.trim()) ? null : 'Enter an email address, like name@example.com.'),
  parentPassword: (v) => (v.length < 8 ? 'Use at least 8 characters.' : passwordTooLong(v) ? TOO_LONG : null),
  username: (v) => (/^[a-z0-9]{3,20}$/.test(v) ? null : 'Use 3 to 20 lowercase letters or numbers, with no spaces.'),
  childPassword: (v) => (v.length < 8 ? 'Use at least 8 characters.' : passwordTooLong(v) ? TOO_LONG : null),

  taskTitle: (v) => (v.trim().length >= 3 && v.trim().length <= 80 ? null : 'Give the task a title of 3 to 80 characters.'),
  taskInstructions: (v) => (v.trim() ? null : 'Say what has to be done and what proof to send.'),
  /** mustBeAhead is false when an existing task keeps the due time it already had. */
  due: (v, who, mustBeAhead) => {
    const at = fromLocalInput(v) // P13: the family's wall clock
    if (!at) return `Add a day and time so ${who} knows when it is due.`
    return mustBeAhead && new Date(at) <= now() ? 'Pick a time that has not passed yet.' : null
  },
  // Rules 18 and 19: a reward and a weekly quest, as the server checks them
  rewardTitle: (v) => (v.trim().length >= 3 && v.trim().length <= 60 ? null : 'Give the reward a name of 3 to 60 characters.'),
  rewardCost: (v) => (whole(v, 10, 1000, 10) ? null : 'Choose 10 to 1,000 points, in tens.'),
  questTarget: (v) => (whole(v, 2, 20, 1) ? null : 'Choose 2 to 20 tasks.'),
  questBonus: (v) => (whole(v, 10, 200, 5) ? null : 'Choose 10 to 200 points, in fives.'),
  questSurprise: (v) => (v.trim().length <= 80 ? null : 'Keep the surprise to 80 characters.'),
  proofFile: (file) => {
    if (!PROOF_TYPES.split(',').includes(file.type)) return 'That kind of file cannot be sent. Choose a photo or a video.'
    if (file.size > PROOF_MAX_BYTES) return `That file is ${fileSizeText(file.size)}. The most that can be sent is 25 MB. Choose a smaller one.`
    return null
  },
}

/** What a username field keeps as the parent types: lowercase letters and digits only. */
export const asUsername = (typed) => typed.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
