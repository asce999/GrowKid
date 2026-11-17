/**
 * The API's error codes and the HTTP status each one travels with (plan section 6).
 * Same names as client/src/api/errors.js, plus TOO_MANY (assumption A3). NETWORK is client-only.
 */
export const STATUS = {
  INVALID: 400,
  SCREENED: 400,
  WRONG_DETAILS: 401,
  NOT_SIGNED_IN: 401,
  NEEDS_CODE: 401, // T1: a moderator's password was right; the authenticator's code is missing or wrong (fields.code 'wrong')
  WRONG_PASSWORD: 403,
  NOT_ALLOWED: 403,
  PAUSED: 403, // C6: sign-in to a family paused while a report is looked at
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  USERNAME_TAKEN: 409,
  LOCKED: 409,
  REVIEWED: 409,
  NOT_ENOUGH: 409,
  QUOTA: 409, // rule 27, L6 and L9: fields.quota says which cap

  FILE_TOO_LARGE: 413,
  FILE_TYPE: 415,
  TOO_MANY: 429,
  SERVER: 500,
}

export class ApiError extends Error {
  /**
   * @param {keyof typeof STATUS} code
   * @param {Record<string, string | number>} [fields] field name to what is wrong, for INVALID and SCREENED; `quota` for QUOTA; `minutes` for TOO_MANY
   */
  constructor(code, fields) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.fields = fields
  }
}

/** Ends the request with one of the codes above; handlers use it instead of try/catch (Express 5 forwards the throw). */
export const refuse = (code, fields) => {
  throw new ApiError(code, fields)
}

/** INVALID with the fields that are wrong: pass { field: problem-or-falsy }, and it throws only when some problem is set. */
export const invalid = (fields) => {
  const wrong = Object.fromEntries(Object.entries(fields).filter(([, problem]) => problem))
  if (Object.keys(wrong).length) refuse('INVALID', wrong)
}

/**
 * The boundary type check (section 7): a string stays itself, anything else becomes '' and fails the normal length check.
 * PostgreSQL and Prisma refuse a NUL character and a lone surrogate, which would otherwise be a 500: a NUL is removed and a lone
 * surrogate becomes U+FFFD, and nothing else the person typed is lost.
 */
export const text = (v) => (typeof v === 'string' ? v.replaceAll('\0', '').toWellFormed() : '')
