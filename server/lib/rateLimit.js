function requestKey(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown')
}

export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 20,
  maxBuckets = 10_000,
  now = Date.now,
  key = requestKey,
} = {}) {
  const buckets = new Map()

  return function rateLimit(req, res, next) {
    const timestamp = now()
    const id = key(req)

    if (!buckets.has(id) && buckets.size >= maxBuckets) {
      for (const [bucketId, bucket] of buckets) {
        if (bucket.resetAt <= timestamp) buckets.delete(bucketId)
      }
      while (buckets.size >= maxBuckets) {
        buckets.delete(buckets.keys().next().value)
      }
    }

    const current = buckets.get(id)
    const bucket =
      !current || current.resetAt <= timestamp
        ? { count: 0, resetAt: timestamp + windowMs }
        : current

    bucket.count += 1
    buckets.set(id, bucket)

    if (bucket.count <= max) {
      next()
      return
    }

    const retryAfter = Math.max(
      1,
      Math.ceil((bucket.resetAt - timestamp) / 1000),
    )
    res.set('Retry-After', String(retryAfter))
    res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many requests. Please wait and try again.',
      },
    })
  }
}
