import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

test('service worker never reads or writes cache for API requests', async () => {
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
  const listeners = {}
  let cacheCalls = 0
  const context = {
    self: {
      addEventListener: (name, handler) => { listeners[name] = handler },
      clients: { claim: async () => {} },
      registration: {},
      skipWaiting: async () => {},
    },
    location: { origin: 'https://hub.example' },
    URL,
    Response,
    fetch: async () => { throw new Error('offline') },
    caches: {
      open: async () => { cacheCalls += 1; throw new Error('API cache must not open') },
      keys: async () => [],
      delete: async () => true,
      match: async () => { cacheCalls += 1; return null },
    },
    console,
    Date,
  }
  vm.runInNewContext(source, context)

  let responsePromise
  listeners.fetch({
    request: {
      method: 'GET',
      url: 'https://hub.example/api/member/messages',
      headers: { get: () => 'application/json' },
    },
    respondWith: (promise) => { responsePromise = promise },
  })

  const response = await responsePromise
  assert.equal(response.status, 503)
  assert.equal(cacheCalls, 0)
  assert.equal((await response.json()).error.code, 'offline')
})
