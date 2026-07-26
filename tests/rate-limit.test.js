import test from 'node:test'
import assert from 'node:assert/strict'
import { createRateLimiter } from '../server/lib/rateLimit.js'

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) {
      this.headers[name] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

test('rate limiter permits the configured budget and rejects the next request', () => {
  let now = 1_000
  const limiter = createRateLimiter({
    windowMs: 60_000,
    max: 2,
    now: () => now,
  })
  const req = { ip: '203.0.113.8', headers: {} }

  let nextCalls = 0
  limiter(req, response(), () => {
    nextCalls += 1
  })
  limiter(req, response(), () => {
    nextCalls += 1
  })
  const blocked = response()
  limiter(req, blocked, () => {
    nextCalls += 1
  })

  assert.equal(nextCalls, 2)
  assert.equal(blocked.statusCode, 429)
  assert.equal(blocked.body.error.code, 'rate_limited')
  assert.ok(Number(blocked.headers['Retry-After']) >= 1)

  now += 60_001
  limiter(req, response(), () => {
    nextCalls += 1
  })
  assert.equal(nextCalls, 3)
})

test('rate limiter bounds tracked client buckets', () => {
  const limiter = createRateLimiter({
    max: 1,
    maxBuckets: 2,
    key: (req) => req.ip,
  })
  let nextCalls = 0
  const next = () => {
    nextCalls += 1
  }

  limiter({ ip: 'one' }, response(), next)
  limiter({ ip: 'two' }, response(), next)
  limiter({ ip: 'three' }, response(), next)
  limiter({ ip: 'one' }, response(), next)

  assert.equal(nextCalls, 4)
})

test('a limiter can be keyed on the target account rather than the caller IP', () => {
  const limiter = createRateLimiter({
    max: 2,
    windowMs: 60_000,
    key: (req) => `email:${String(req.body?.email || '').toLowerCase()}`,
  })
  const res = () => {
    const r = {
      statusCode: null,
      set: () => r,
      status: (s) => {
        r.statusCode = s
        return r
      },
      json: () => r,
    }
    return r
  }
  const attempt = (email, ip) => {
    const r = res()
    let passed = false
    limiter({ ip, body: { email } }, r, () => {
      passed = true
    })
    return { passed, status: r.statusCode }
  }

  // The same account guessed from three different addresses is still throttled.
  assert.equal(attempt('victim@example.org', '198.51.100.1').passed, true)
  assert.equal(attempt('VICTIM@example.org', '198.51.100.2').passed, true)
  const third = attempt('victim@example.org', '198.51.100.3')
  assert.equal(third.passed, false)
  assert.equal(third.status, 429)

  // A different account is unaffected.
  assert.equal(attempt('someone@example.org', '198.51.100.3').passed, true)
})
