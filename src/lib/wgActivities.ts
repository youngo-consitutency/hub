import type { PayloadRequest } from 'payload'
import type { AnyValue } from './domain'
import { ApiError, fail } from './respond'
import { audit } from './audit'
import { getDocument } from './documents'
import { wgActivityView } from './views'
import { TASK_FORCE_SLUGS } from '../shared/protocol'

// One create path for working-group activity, shared by the contact-point
// console and the agent gateway, so both validate and audit the same way.
// The caller has already checked wg.manage for `wg`.
export async function createWgActivity(
  req: PayloadRequest,
  account: AnyValue,
  wg: string,
  b: AnyValue,
  auditExtra: AnyValue = {},
) {
  const title = String(b.title || '')
    .trim()
    .slice(0, 200)
  if (!title || !b.kind) throw fail.validation({ title: 'title and kind are required.' })
  const options = await getDocument(req, 'content-options')
  const kinds = (options?.body?.wgActivityKinds || []).map((k: AnyValue) => String(k.value))
  if (!kinds.includes(String(b.kind)))
    throw new ApiError(400, 'validation', 'Invalid activity kind.')
  if (b.startsAt && Number.isNaN(Date.parse(b.startsAt)))
    throw new ApiError(400, 'validation', 'Invalid start date.')
  const taskForceSlug = b.taskForceSlug ? String(b.taskForceSlug) : null
  if (taskForceSlug && !TASK_FORCE_SLUGS.has(taskForceSlug))
    throw new ApiError(400, 'validation', 'Unknown task force.')
  if (b.url && !/^https?:\/\//.test(String(b.url)))
    throw fail.validation({ url: 'Link must be a full http:// or https:// URL.' })
  const created = await req.payload.create({
    collection: 'wg-activities',
    data: {
      wgSlug: wg,
      kind: String(b.kind),
      title,
      body: b.body ? String(b.body).slice(0, 2000) : null,
      startsAt: b.startsAt || null,
      endsAt: b.endsAt || null,
      url: b.url ? String(b.url) : null,
      taskForceSlug,
      createdBy: account.id,
    },
    overrideAccess: true,
    req,
  })
  const activity = wgActivityView(created)
  await audit(req, account, {
    action: 'wg.activity_created',
    targetType: 'wg_activity',
    targetId: String(created.id),
    after: { ...activity, ...auditExtra },
  })
  return activity
}
