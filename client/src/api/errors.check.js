// The runnable check of how a failed request becomes an ApiError: `npm run check`. A wrong code reaches the pages as the wrong message.
import assert from 'node:assert/strict'
import { ApiError, toApiError } from './errors.js'

const answered = (data) => toApiError({ response: { status: 400, data } })

// the server's code and fields come through as sent
const invalid = answered({ code: 'INVALID', fields: { title: 'length' } })
assert.ok(invalid instanceof ApiError)
assert.deepEqual([invalid.code, invalid.fields], ['INVALID', { title: 'length' }])
assert.equal(answered({ code: 'TOO_MANY' }).code, 'TOO_MANY')

// a code that is not text, no code, no body, or a proxy's page of HTML: the server failed
for (const data of [{ code: 500 }, { code: null }, {}, null, undefined, '<html>502 Bad Gateway</html>']) {
  assert.equal(answered(data).code, 'SERVER', JSON.stringify(data))
}

// no answer at all: the network
for (const failure of [new Error('Network Error'), { code: 'ECONNABORTED' }, { request: {} }, undefined, null]) {
  assert.equal(toApiError(failure).code, 'NETWORK')
}

// an ApiError (a development switch throws one) passes through untouched
const already = new ApiError('SERVER')
assert.equal(toApiError(already), already)

console.log('api errors hold')
