import test from 'node:test'
import assert from 'node:assert/strict'
import { validatedPushEndpoint } from '../server/lib/pushStore.js'

test('push URL validation permits supported providers and rejects parser tricks', () => {
  for (const value of [
    'https://fcm.googleapis.com/fcm/send/token',
    'https://updates.push.services.mozilla.com/wpush/v2/token',
    'https://web.push.apple.com/token',
    'https://wns2.notify.windows.com/token',
  ])
    assert.equal(validatedPushEndpoint(value), value)
  for (const value of [
    '',
    null,
    {},
    'http://fcm.googleapis.com/token',
    'https://localhost/a',
    'https://127.0.0.1/a',
    'https://2130706433/a',
    'https://0x7f000001/a',
    'https://[::1]/a',
    'https://169.254.169.254/a',
    'https://fcm.googleapis.com.attacker.example/a',
    'https://evilnotify.windows.com/a',
    'https://fcm.googleapis.com@attacker.example/a',
    'https://user@fcm.googleapis.com/a',
    'https://fcm.googleapis.com:8443/a',
    'https://fcm.googleapis.com/a#fragment',
    'https://fcm.googleapis.com\\@127.0.0.1/a',
    'https://fcm.google\napis.com/a',
  ])
    assert.throws(() => validatedPushEndpoint(value), /supported browser push/)
})
