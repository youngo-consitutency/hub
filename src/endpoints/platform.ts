import type { Endpoint } from 'payload'
import { endpoint, json } from '../lib/respond'
import { requireAccount } from '../lib/accounts'
import { rateLimit } from '../lib/rateLimit'
import * as platform from '../modules/platform/service'
import * as bridge from '../modules/platform/decisionsBridge'
import type { Actor } from '../modules/platform/service'

const enquiryLimit = rateLimit({
  windowMs: 3_600_000,
  max: 5,
  scope: 'platform-enquiry',
})

const actor = async (req: any): Promise<Actor> => {
  const account = await requireAccount(req)
  return account as unknown as Actor
}
const body = async (req: any) => ((await req.json?.()) || {}) as Record<string, unknown>
const p = (req: any, key: string) => String(req.routeParams?.[key] || '')

export const platformEndpoints: Endpoint[] = [
  {
    path: '/platform/public',
    method: 'get',
    handler: endpoint(async () => json(await platform.publicPlatform())),
  },
  {
    path: '/platform/enquiries',
    method: 'post',
    handler: endpoint(async (req) => {
      await enquiryLimit(req)
      return json(await platform.createEnquiry(await body(req)), {
        status: 201,
      })
    }),
  },
  {
    path: '/platform/members/:id/membership',
    method: 'post',
    handler: endpoint(async (req) => {
      await platform.membershipAction(await actor(req), p(req, 'id'), await body(req))
      return json({ ok: true })
    }),
  },
  {
    path: '/platform/overview',
    method: 'get',
    handler: endpoint(async (req) => json(await platform.overview(await actor(req)))),
  },
  {
    path: '/platform/bodies',
    method: 'post',
    handler: endpoint(async (req) =>
      json(await platform.saveBody(await actor(req), await body(req)), {
        status: 201,
      }),
    ),
  },
  {
    path: '/platform/bodies/:id',
    method: 'patch',
    handler: endpoint(async (req) =>
      json(await platform.saveBody(await actor(req), await body(req), p(req, 'id'))),
    ),
  },
  {
    path: '/platform/bodies/:id/publish',
    method: 'post',
    handler: endpoint(async (req) => {
      const b = await body(req)
      await platform.publishBody(await actor(req), p(req, 'id'), b.version)
      return json({ ok: true })
    }),
  },
  {
    path: '/platform/bodies/:id/join',
    method: 'post',
    handler: endpoint(async (req) => {
      await platform.joinBody(await actor(req), p(req, 'id'))
      return json({ ok: true })
    }),
  },
  {
    path: '/platform/bodies/:id/withdraw-publication',
    method: 'post',
    handler: endpoint(async (req) => {
      await platform.withdrawPublication(
        await actor(req),
        'body',
        p(req, 'id'),
        await body(req),
      )
      return json({ ok: true })
    }),
  },
  {
    path: '/platform/assignments',
    method: 'post',
    handler: endpoint(async (req) => {
      await platform.assign(await actor(req), await body(req))
      return json({ ok: true }, { status: 201 })
    }),
  },
  {
    path: '/platform/assignments/:id/revoke',
    method: 'post',
    handler: endpoint(async (req) => {
      const b = await body(req)
      await platform.revoke(
        await actor(req),
        p(req, 'id'),
        platform.text(b, 'reason', 2000),
      )
      return json({ ok: true })
    }),
  },
  {
    path: '/platform/tasks',
    method: 'post',
    handler: endpoint(async (req) =>
      json(await platform.saveTask(await actor(req), await body(req)), {
        status: 201,
      }),
    ),
  },
  {
    path: '/platform/tasks/:id',
    method: 'patch',
    handler: endpoint(async (req) =>
      json(await platform.saveTask(await actor(req), await body(req), p(req, 'id'))),
    ),
  },
  {
    path: '/platform/decisions',
    method: 'post',
    handler: endpoint(async (req) =>
      json(await bridge.saveDecision(req, await actor(req), await body(req)), {
        status: 201,
      }),
    ),
  },
  {
    path: '/platform/decisions/:id',
    method: 'get',
    handler: endpoint(async (req) =>
      json(await bridge.decisionDetail(req, await actor(req), p(req, 'id'))),
    ),
  },
  {
    path: '/platform/decisions/:id',
    method: 'patch',
    handler: endpoint(async (req) =>
      json(
        await bridge.saveDecision(req, await actor(req), await body(req), p(req, 'id')),
      ),
    ),
  },
  {
    path: '/platform/decisions/:id/transition',
    method: 'post',
    handler: endpoint(async (req) => {
      await bridge.transition(req, await actor(req), p(req, 'id'), await body(req))
      return json({ ok: true })
    }),
  },
  {
    path: '/platform/decisions/:id/contributions',
    method: 'post',
    handler: endpoint(async (req) => {
      await bridge.contribute(req, await actor(req), p(req, 'id'), await body(req))
      return json({ ok: true }, { status: 201 })
    }),
  },
  {
    path: '/platform/contributions/:id/resolve',
    method: 'post',
    handler: endpoint(async (req) => {
      await bridge.resolveContribution(req, await actor(req), p(req, 'id'), await body(req))
      return json({ ok: true })
    }),
  },
  {
    path: '/platform/decisions/:id/publish',
    method: 'post',
    handler: endpoint(async (req) => {
      const b = await body(req)
      await bridge.publishDecision(req, await actor(req), p(req, 'id'), b.version)
      return json({ ok: true })
    }),
  },
  {
    path: '/platform/decisions/:id/withdraw-publication',
    method: 'post',
    handler: endpoint(async (req) => {
      await bridge.withdrawDecisionPublication(
        req,
        await actor(req),
        p(req, 'id'),
        await body(req),
      )
      return json({ ok: true })
    }),
  },
  {
    path: '/platform/enquiries/:id',
    method: 'patch',
    handler: endpoint(async (req) => {
      await platform.updateEnquiry(await actor(req), p(req, 'id'), await body(req))
      return json({ ok: true })
    }),
  },
]
