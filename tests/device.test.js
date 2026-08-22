import assert from 'node:assert/strict'
import test from 'node:test'
import { detectDevice } from '../src/lib/device.js'

test('notification help selects the current device family', () => {
  assert.equal(detectDevice({ userAgent: 'Mozilla/5.0 (iPhone)' }), 'ios')
  assert.equal(
    detectDevice({
      userAgent: 'Mozilla/5.0 (Macintosh)',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    }),
    'ios',
  )
  assert.equal(
    detectDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 16)' }),
    'android',
  )
  assert.equal(
    detectDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }),
    'desktop',
  )
})
