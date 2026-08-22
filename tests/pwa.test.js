import test from 'node:test'
import assert from 'node:assert/strict'
import {
  disablePWAInDevelopment,
  needsHomeScreenInstall,
  subscribeToPush,
} from '../src/lib/pwa.js'

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'

function stubDevice(t, { userAgent, standalone }) {
  const originalNavigator = globalThis.navigator
  const originalWindow = globalThis.window
  t.after(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent, maxTouchPoints: 5, standalone },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      navigator: { standalone },
      matchMedia: () => ({ matches: Boolean(standalone) }),
    },
  })
}

// iOS delivers Web Push only to a home-screen install. Getting this wrong
// shows an "enable" button that can never succeed, which is the single most
// common support question from members on iPhones.
test('iPhone Safari is told to install before it can be offered notifications', (t) => {
  stubDevice(t, { userAgent: IPHONE_UA, standalone: false })
  assert.equal(needsHomeScreenInstall(), true)
})

test('an installed iPhone app and any Android browser skip the install step', (t) => {
  stubDevice(t, { userAgent: IPHONE_UA, standalone: true })
  assert.equal(needsHomeScreenInstall(), false)
})

test('Android Chrome is offered notifications directly', (t) => {
  stubDevice(t, { userAgent: ANDROID_UA, standalone: false })
  assert.equal(needsHomeScreenInstall(), false)
})

test('development cleanup unregisters workers and removes only Hub caches', async (t) => {
  const deleted = []
  let unregistered = 0
  const originalNavigator = globalThis.navigator
  const originalWindow = globalThis.window
  t.after(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        getRegistrations: async () => [
          {
            unregister: async () => {
              unregistered += 1
            },
          },
        ],
      },
    },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      caches: {
        keys: async () => ['youngo-hub-static-v2', 'another-app-cache'],
        delete: async (name) => {
          deleted.push(name)
        },
      },
    },
  })

  await disablePWAInDevelopment()
  assert.equal(unregistered, 1)
  assert.deepEqual(deleted, ['youngo-hub-static-v2'])
})

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
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
    globalThis.fetch = originalFetch
  })
  const registration = {
    pushManager: {
      getSubscription: async () => existing,
      subscribe: async () => {
        throw new Error('must reuse existing subscription')
      },
    },
  }
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        // `getRegistration` rather than `ready`: `ready` never settles when no
        // worker is installed, which would hang the settings UI.
        getRegistration: async () => registration,
        ready: Promise.resolve(registration),
      },
    },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      PushManager: class PushManager {},
      Notification: { permission: 'granted' },
    },
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
  assert.equal(
    JSON.parse(requests[0].options.body).subscription.endpoint,
    existing.endpoint,
  )
})
