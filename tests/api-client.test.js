import test from 'node:test'
import assert from 'node:assert/strict'
import {
  apiGet,
  apiPost,
  apiPatch,
  apiPutFile,
  apiDelete,
} from '../src/lib/api.js'

test('API requests preserve JSON, file, cookie and idempotency semantics', async (t) => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, ...options })
    return Response.json({ ok: true })
  })
  const file = new Blob(['photo'], { type: 'image/png' })
  assert.deepEqual(await apiGet('/events'), { ok: true })
  await apiPost(
    '/member/content',
    { title: 'Event' },
    { 'x-idempotency-key': 'once' },
  )
  await apiPatch('/member/profile', { bio: 'Hello' })
  await apiPutFile('/member/profile/photo', file)
  await apiDelete('/member/profile/photo')

  assert.deepEqual(
    requests.map((request) => request.method),
    ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  )
  assert.ok(requests.every((request) => request.credentials === 'same-origin'))
  assert.equal(requests[0].url, '/api/events')
  assert.equal(requests[1].body, JSON.stringify({ title: 'Event' }))
  assert.equal(requests[1].headers['x-idempotency-key'], 'once')
  assert.equal(requests[2].headers['Content-Type'], 'application/json')
  assert.equal(requests[3].headers['Content-Type'], 'image/png')
  assert.equal(requests[3].body, file)
  assert.equal(requests[4].body, undefined)
})

test('API errors retain field feedback and only rejected session reads clear cached identity', async (t) => {
  const removed = []
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { removeItem: (key) => removed.push(key) },
  })
  t.after(() => {
    if (descriptor)
      Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
  })
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      {
        error: {
          message: 'Sign in',
          code: 'unauthorized',
          fields: { email: 'Required' },
        },
      },
      { status: 401 },
    ),
  )

  const expected = {
    message: 'Sign in',
    status: 401,
    code: 'unauthorized',
    fields: { email: 'Required' },
  }
  await assert.rejects(apiPost('/auth/login', {}), expected)
  await assert.rejects(apiGet('/member/profile'), expected)
  assert.deepEqual(removed, [])
  await assert.rejects(apiGet('/auth/me'), expected)
  assert.ok(removed.includes('youngo-hub:session-account'))
})

test('empty mutation responses succeed while malformed reads and HTTP errors stay visible', async (t) => {
  const responses = [
    new Response(null, { status: 204 }),
    new Response('not JSON', { status: 200 }),
    new Response('Service unavailable', { status: 503 }),
  ]
  t.mock.method(globalThis, 'fetch', async () => responses.shift())
  assert.deepEqual(await apiDelete('/member/profile/photo'), {})
  await assert.rejects(apiGet('/events'), SyntaxError)
  await assert.rejects(apiPatch('/member/profile', {}), {
    message: 'Request failed (503)',
    status: 503,
  })
})
