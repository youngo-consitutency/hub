// Verified-member CRM: member-controlled profiles plus governed, member-only
// people discovery. Operational roles are read from their canonical tables.
import express, { Router } from 'express'
import { requireAccount, requireVerified } from './guards.js'
import { recordAudit } from '../../lib/audit.js'
import {
  deleteMemberPhoto,
  getMemberPerson,
  getOwnMemberProfile,
  listMemberPeople,
  MEMBER_PHOTO_MAX_BYTES,
  readMemberPhoto,
  saveMemberPhoto,
  updateOwnMemberProfile,
} from '../../lib/memberProfiles.js'

export const router = Router()

async function verifiedAccount(req, res) {
  const account = await requireAccount(req, res)
  if (!account) return null
  if (!requireVerified(req, res)) return null
  return account
}

function sendProfileError(res, error) {
  if (!['validation', 'payload_too_large'].includes(error.code)) return false
  res.status(error.code === 'payload_too_large' ? 413 : 400).json({
    error: {
      code: error.code,
      message: error.message,
      fields: error.fields,
    },
  })
  return true
}

router.get('/profile', async (req, res) => {
  const account = await verifiedAccount(req, res)
  if (!account) return
  res.json({ profile: await getOwnMemberProfile(account) })
})

router.patch('/profile', async (req, res) => {
  const account = await verifiedAccount(req, res)
  if (!account) return
  try {
    const before = await getOwnMemberProfile(account)
    const profile = await updateOwnMemberProfile(account, req.body, account.id)
    await recordAudit({
      actorId: account.id,
      action: 'member.profile_updated',
      targetType: 'member_profile',
      targetId: account.id,
      before: {
        directoryVisibility: before.directoryVisibility,
        revision: before.revision,
      },
      after: {
        directoryVisibility: profile.directoryVisibility,
        revision: profile.revision,
      },
      requestId: req.requestId,
    })
    res.json({ profile })
  } catch (error) {
    if (!sendProfileError(res, error)) throw error
  }
})

router.put(
  '/profile/photo',
  express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    limit: MEMBER_PHOTO_MAX_BYTES,
  }),
  async (req, res) => {
    const account = await verifiedAccount(req, res)
    if (!account) return
    try {
      const photo = await saveMemberPhoto(
        account.id,
        req.body,
        req.get('content-type'),
        account.id,
      )
      await recordAudit({
        actorId: account.id,
        action: 'member.profile_photo_updated',
        targetType: 'member_profile',
        targetId: account.id,
        after: {
          contentType: photo.content_type,
          byteSize: photo.byte_size,
          revision: photo.revision,
        },
        requestId: req.requestId,
      })
      res.json({ profile: await getOwnMemberProfile(account) })
    } catch (error) {
      if (!sendProfileError(res, error)) throw error
    }
  },
)

router.delete('/profile/photo', async (req, res) => {
  const account = await verifiedAccount(req, res)
  if (!account) return
  const removed = await deleteMemberPhoto(account.id)
  if (removed)
    await recordAudit({
      actorId: account.id,
      action: 'member.profile_photo_removed',
      targetType: 'member_profile',
      targetId: account.id,
      requestId: req.requestId,
    })
  res.json({ ok: true, profile: await getOwnMemberProfile(account) })
})

router.get('/people', async (req, res) => {
  const account = await verifiedAccount(req, res)
  if (!account) return
  res.json(
    await listMemberPeople({
      search: req.query.search,
      tag: req.query.tag,
      workingGroup: req.query.workingGroup,
      workingGroupRole: req.query.workingGroupRole,
      page: req.query.page,
      pageSize: req.query.pageSize,
    }),
  )
})

router.get('/people/:id/photo', async (req, res) => {
  const account = await verifiedAccount(req, res)
  if (!account) return
  const person = await getMemberPerson(account, req.params.id)
  if (!person)
    return res.status(404).json({
      error: { code: 'not_found', message: 'Profile photo not found.' },
    })
  const photo = await readMemberPhoto(req.params.id)
  if (!photo)
    return res.status(404).json({
      error: { code: 'not_found', message: 'Profile photo not found.' },
    })
  res.set('Content-Type', photo.content_type)
  res.set('Content-Length', String(photo.byte_size))
  res.set('Content-Disposition', 'inline')
  res.send(photo.bytes)
})

router.get('/people/:id', async (req, res) => {
  const account = await verifiedAccount(req, res)
  if (!account) return
  const person = await getMemberPerson(account, req.params.id)
  if (!person)
    return res.status(404).json({
      error: { code: 'not_found', message: 'Member profile not found.' },
    })
  res.json({ person })
})
