import assert from 'node:assert/strict'
import test from 'node:test'
import { faviconUrl } from '../src/lib/favicon.js'

test('favicon requests contain only the public hostname over HTTPS', () => {
  assert.equal(
    faviconUrl('https://www.ipcc.ch/report/ar6/?token=private#chapter'),
    'https://www.ipcc.ch/favicon.ico',
  )
  assert.equal(
    faviconUrl('http://climate.nasa.gov:8080/resources'),
    'https://climate.nasa.gov/favicon.ico',
  )
})

test('invalid, credentialed and local resource URLs use the fallback', () => {
  for (const value of [
    null,
    '',
    '/relative',
    'javascript:alert(1)',
    'data:image/png;base64,abc',
    'https://person:password@example.org/report',
    'http://localhost:8898',
    'http://127.0.0.1/',
    'http://192.168.1.1/',
    'http://[::1]/',
    'https://hub.local/',
    'https://hub.internal/',
    'https://hub.test/',
  ]) {
    assert.equal(faviconUrl(value), null, String(value))
  }
})
