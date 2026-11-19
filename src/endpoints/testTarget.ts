import type { Endpoint } from 'payload'
import { endpoint, fail, json } from '../lib/respond'

// The integration tests send writes to a running server, and their database guard only sees the
// test process's own DATABASE_URL. This lets them confirm the server uses the same disposable
// database. It exists only on a server started with the test-only rate-limit opt-out, which is
// never set on a deployed environment.
export const testTargetEndpoints: Endpoint[] = [
  {
    path: '/test-target',
    method: 'get',
    handler: endpoint(async () => {
      if (process.env.HUB_DISABLE_RATE_LIMIT !== '1') throw fail.notFound()
      let database = ''
      try {
        database = new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '')
      } catch {
        // an unreadable URL reports an empty name, which the test guard refuses
      }
      return json({ database })
    }),
  },
]
