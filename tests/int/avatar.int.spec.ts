import { describe, it, beforeAll, expect } from 'vitest'

import { AVATAR_CHOICES } from '../../src/shared/avatar'
import { api, session } from './helpers'

describe('member avatar builder', () => {
  let member: Awaited<ReturnType<typeof session>>
  let unverified: Awaited<ReturnType<typeof session>>
  const put = (body: unknown, cookie?: string) =>
    api('/member/profile/avatar', { method: 'PUT', cookie, body: JSON.stringify(body) })
  const valid = {
    head: AVATAR_CHOICES.head[0],
    face: AVATAR_CHOICES.face[0],
    facialHair: 'none',
    skinColor: AVATAR_CHOICES.skinColor[0],
  }

  beforeAll(async () => {
    member = await session({})
    unverified = await session({ verified: false })
  })

  it('stores allowlisted picks and returns them with the profile', async () => {
    const res = await put({ avatar: valid }, member.cookie)
    expect(res.status).toBe(200)
    expect((await res.json()).avatar).toEqual(valid)
    const profile = await (await api('/member/profile', { cookie: member.cookie })).json()
    expect(profile.profile.avatar).toEqual(valid)
  })

  it('shows the picks to other verified members', async () => {
    await api('/member/profile', {
      method: 'PATCH',
      cookie: member.cookie,
      body: JSON.stringify({ displayName: 'Avatar spec', directoryVisibility: 'members' }),
    })
    const viewer = await session({})
    const res = await api(`/member/people/${member.account.id}`, { cookie: viewer.cookie })
    expect(res.status).toBe(200)
    expect((await res.json()).person.avatar).toEqual(valid)
  })

  it('resets to the seeded default with null', async () => {
    expect((await put({ avatar: null }, member.cookie)).status).toBe(200)
    const profile = await (await api('/member/profile', { cookie: member.cookie })).json()
    expect(profile.profile.avatar).toBeNull()
  })

  it.each([
    ['an unknown key', { ...valid, src: 'https://example.test/a.png' }],
    ['an unknown value', { ...valid, head: 'crown' }],
    ['a colour outside the palette', { ...valid, skinColor: '123456' }],
    ['a non-string value', { ...valid, face: ['smile'] }],
    ['free text', 'smile'],
  ])('rejects %s', async (_label, avatar) => {
    const res = await put({ avatar }, member.cookie)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('validation')
  })

  it('rejects a body without the avatar field', async () => {
    expect((await put({}, member.cookie)).status).toBe(400)
  })

  it('requires a signed-in, verified member', async () => {
    expect((await put({ avatar: valid })).status).toBe(401)
    expect((await put({ avatar: valid }, unverified.cookie)).status).toBe(403)
  })

  it('no longer serves photo uploads', async () => {
    const upload = await api('/member/profile/photo', {
      method: 'PUT',
      cookie: member.cookie,
      headers: { 'Content-Type': 'image/png' },
      body: 'x',
    })
    expect(upload.status).toBe(404)
    const read = await api(`/member/people/${member.account.id}/photo`, { cookie: member.cookie })
    expect(read.status).toBe(404)
  })
})
