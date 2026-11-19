import { createHash } from 'node:crypto'
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
      // a digest of host, port and database name: enough to tell two servers apart, and it
      // reveals no credentials
      let identity = ''
      try {
        const url = new URL(process.env.DATABASE_URL ?? '')
        identity = createHash('sha256')
          .update(`${url.hostname}:${url.port || '5432'}${url.pathname}`)
          .digest('hex')
      } catch {
        // an unreadable URL reports nothing, which the test guard refuses
      }
      return json({ identity })
    }),
  },
]
