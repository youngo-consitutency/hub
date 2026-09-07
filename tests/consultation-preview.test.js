import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../server/app.js'

async function startPreview() {
  const app = createApp({
    env: {
      READ_ONLY_PREVIEW: '1',
    },
  })
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance))
  })
  const { port } = server.address()
  return {
    server,
    origin: `http://127.0.0.1:${port}`,
  }
}

test('consultation preview serves public reads and rejects member mutations', async (t) => {
  const { server, origin } = await startPreview()
  t.after(() => server.close())

  const health = await fetch(`${origin}/healthz`)
  assert.equal(health.status, 200)
  assert.equal((await health.json()).ok, true)

  const mutation = await fetch(`${origin}/api/auth/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'member@example.org', password: 'secret' }),
  })
  assert.equal(mutation.status, 503)
  assert.equal(
    (await mutation.json()).error.code,
    'consultation_preview_read_only',
  )
})
