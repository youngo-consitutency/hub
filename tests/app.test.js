import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../server/app.js'

async function withApp(run, options) {
  const server = createApp(options).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address()

  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  }
}

test('complete app exposes health and security headers without framework leakage', async () => {
  await withApp(async (origin) => {
    const response = await fetch(`${origin}/healthz`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(body, { ok: true, db: 'fixtures', version: '0.1.0' })
    assert.equal(response.headers.get('x-powered-by'), null)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin')
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/)
  }, { env: {} })
})

test('private routes override public caching and enforce authentication', async () => {
  await withApp(async (origin) => {
    const publicResponse = await fetch(`${origin}/api/events`)
    assert.equal(publicResponse.status, 200)
    assert.equal(
      publicResponse.headers.get('cache-control'),
      'public, max-age=60, stale-while-revalidate=300',
    )

    for (const path of ['/api/auth/me', '/api/member/course']) {
      const privateResponse = await fetch(`${origin}${path}`)
      const body = await privateResponse.json()
      assert.equal(privateResponse.status, 401)
      assert.equal(privateResponse.headers.get('cache-control'), 'no-store')
      assert.equal(body.error.code, 'unauthorized')
    }
  })
})

test('malformed and oversized JSON receive client errors instead of generic 500s', async () => {
  await withApp(async (origin) => {
    const malformed = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"email":',
    })
    assert.equal(malformed.status, 400)
    assert.equal(malformed.headers.get('x-content-type-options'), 'nosniff')
    assert.equal((await malformed.json()).error.code, 'invalid_json')

    const oversized = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(270 * 1024) }),
    })
    assert.equal(oversized.status, 413)
    assert.equal(oversized.headers.get('x-content-type-options'), 'nosniff')
    assert.equal((await oversized.json()).error.code, 'payload_too_large')
  })
})
