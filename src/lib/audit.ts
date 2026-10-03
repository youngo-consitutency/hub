import type { PayloadRequest } from 'payload'
import type { ActorLike, DocData } from './domain'

// Single audit-trail writer. Everything records actor, actorEmail, and the
// inbound request id; callers supply action/target fields via entry.
export async function audit(
  req: PayloadRequest,
  actor: ActorLike | null,
  entry: Record<string, any>,
) {
  await req.payload.create({
    collection: 'audit-log',
    data: {
      actor: actor?.id,
      actorEmail: actor?.email,
      requestId: (req.headers.get('x-request-id') as string) || null,
      ...entry,
    } as DocData,
    overrideAccess: true,
    req,
  })
}
