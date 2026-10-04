import type { PayloadRequest } from 'payload'
import type { ActorLike, AnyValue } from './domain'

// Single audit-trail writer. Everything records actor, actorEmail, and the
// inbound request id; callers supply action/target fields via entry.
export interface AuditEntry {
  action: string
  targetType?: string
  targetId?: string | null
  reason?: string | null
  before?: AnyValue
  after?: AnyValue
}

export async function audit(req: PayloadRequest, actor: ActorLike | null, entry: AuditEntry) {
  await req.payload.create({
    collection: 'audit-log',
    data: {
      actor: actor?.id != null ? Number(actor.id) : null,
      actorEmail: actor?.email ?? null,
      requestId: (req.headers.get('x-request-id') as string) || null,
      ...entry,
    },
    overrideAccess: true,
    req,
  })
}
