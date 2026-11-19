import type { PayloadRequest } from 'payload'
import type { GuardianEnquiry } from '../payload-types'
import { retentionCutoff } from '../shared/guardianEnquiry'

// Guardian requests are kept only while the Membership Team needs them:
// expired rows are purged on every create, list and close, and by the daily cron.
export async function purgeExpiredGuardianEnquiries(req: PayloadRequest) {
  await req.payload.delete({
    collection: 'guardian-enquiries',
    where: { createdAt: { less_than: retentionCutoff().toISOString() } },
    overrideAccess: true,
    req,
  })
}

const view = (row: GuardianEnquiry) => ({
  id: row.id,
  guardianName: row.guardianName,
  guardianEmail: row.guardianEmail,
  relationship: row.relationship,
  consentStatement: row.consentStatement,
  consentedAt: row.consentedAt,
  createdAt: row.createdAt,
})

/** What validateGuardianEnquiry returns for a valid request. */
export type GuardianEnquiryInput = Omit<
  GuardianEnquiry,
  'id' | 'createdAt' | 'updatedAt' | 'relationship'
> & {
  relationship: string
}

export async function createGuardianEnquiry(req: PayloadRequest, data: GuardianEnquiryInput) {
  await purgeExpiredGuardianEnquiries(req)
  const row = await req.payload.create({
    collection: 'guardian-enquiries',
    // the relationship was checked against the allowed list by validateGuardianEnquiry
    data: { ...data, relationship: data.relationship as GuardianEnquiry['relationship'] },
    overrideAccess: true,
    req,
  })
  return view(row)
}

export async function listGuardianEnquiries(req: PayloadRequest) {
  await purgeExpiredGuardianEnquiries(req)
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

export async function closeGuardianEnquiry(req: PayloadRequest, id: number) {
  await purgeExpiredGuardianEnquiries(req)
  const { docs } = await req.payload.delete({
    collection: 'guardian-enquiries',
    where: { id: { equals: id } },
    overrideAccess: true,
    req,
  })
  return docs.length > 0
}
