import test from 'node:test'
import assert from 'node:assert/strict'
import { subscribeToPush } from '../src/lib/pwa.js'

test('an existing push subscription is registered for the current account again', async (t) => {
  const existing = {
    endpoint: 'https://push.example/shared',
    toJSON: () => ({
      endpoint: 'https://push.example/shared',
      keys: { p256dh: 'key', auth: 'auth' },
    }),
  }
  const requests = []
  const originalNavigator = globalThis.navigator
  const originalWindow = globalThis.window
  const originalFetch = globalThis.fetch
  t.after(() => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
    globalThis.fetch = originalFetch
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: async () => existing,
            subscribe: async () => { throw new Error('must reuse existing subscription') },
          },
        }),
      },
    },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { PushManager: class PushManager {} },
  })
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })
    return { ok: true }
  }

  const result = await subscribeToPush('unused-for-existing-subscription')
  assert.equal(result.success, true)
  assert.equal(result.isNew, false)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, '/api/push/subscribe')
  assert.equal(JSON.parse(requests[0].options.body).subscription.endpoint, existing.endpoint)
})
