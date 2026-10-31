/**
 * Every API function rejects with one of these.
 *
 * WRONG_DETAILS   sign-in details do not match an account
 * WRONG_PASSWORD  the password typed to confirm a change is not the account's password
 * EMAIL_TAKEN     sign-up with an email that already has an account
 * USERNAME_TAKEN  a child's username is already in use
 * INVALID         the server refused the input; `fields` names what is wrong
 * SCREENED        content screening refused a task; `fields.word` is the word it found
 * LOCKED          the task can no longer be changed that way (see the rules on each function)
 * REVIEWED        the proof has already been approved or sent back, or is no longer the newest
 * NOT_ENOUGH      a reward costs more points than the child has to spend
 * FILE_TYPE      a proof file is not a photo, a video or a PDF
 * FILE_TOO_LARGE  a proof file is over the size limit
 * NOT_SIGNED_IN   no session, or it has expired
 * NOT_ALLOWED     signed in, but this role may not do that
 * NOT_FOUND       no such thing, or it belongs to another family
 * NETWORK         the server could not be reached
 * SERVER          the server failed
 *
 * @typedef {'WRONG_DETAILS' | 'WRONG_PASSWORD' | 'EMAIL_TAKEN' | 'USERNAME_TAKEN' | 'INVALID' | 'SCREENED' | 'LOCKED'
 *   | 'REVIEWED' | 'NOT_ENOUGH' | 'FILE_TYPE' | 'FILE_TOO_LARGE' | 'NOT_SIGNED_IN' | 'NOT_ALLOWED' | 'NOT_FOUND' | 'NETWORK'
 *   | 'SERVER'} ApiErrorCode
 */
export class ApiError extends Error {
  /**
   * @param {ApiErrorCode} code
   * @param {Record<string, string>} [fields] field name to what is wrong, for INVALID and SCREENED
   */
  constructor(code, fields) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.fields = fields
  }
}
