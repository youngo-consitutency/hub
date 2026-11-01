import type { AnyValue } from './domain'
import { retentionCutoff } from '../shared/guardianEnquiry'

// Guardian requests are kept only while the Membership Team needs them:
// expired rows are purged lazily on every create, list and close.
async function purgeExpired(req: AnyValue) {
  await req.payload.delete({
    collection: 'guardian-enquiries',
    where: { createdAt: { less_than: retentionCutoff().toISOString() } },
    overrideAccess: true,
    req,
  })
}

const view = (row: AnyValue) => ({
  id: row.id,
  guardianName: row.guardianName,
  guardianEmail: row.guardianEmail,
  relationship: row.relationship,
  consentStatement: row.consentStatement,
  consentedAt: row.consentedAt,
  createdAt: row.createdAt,
})

export async function createGuardianEnquiry(req: AnyValue, data: AnyValue) {
  await purgeExpired(req)
  const row = await req.payload.create({
    collection: 'guardian-enquiries',
    data,
    overrideAccess: true,
    req,
  })
  return view(row)
}

export async function listGuardianEnquiries(req: AnyValue) {
  await purgeExpired(req)
  const { docs } = await req.payload.find({
    collection: 'guardian-enquiries',
    sort: 'createdAt',
    limit: 500,
    pagination: false,
    overrideAccess: true,
    req,
  })
  return docs.map(view)
}

export async function closeGuardianEnquiry(req: AnyValue, id: number) {
  await purgeExpired(req)
  const { docs } = await req.payload.delete({
    collection: 'guardian-enquiries',
    where: { id: { equals: id } },
    overrideAccess: true,
    req,
  })
  return docs.length > 0
}
