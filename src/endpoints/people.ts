import type { Endpoint } from 'payload'
import { endpoint, fail, json } from '../lib/respond'
import { accountView, requireVerifiedMember } from '../lib/accounts'
import { getAccessProfile } from '../lib/access'
import { getMemberPerson, listMemberPeople } from '../lib/memberDirectory'
import { readMemberPhoto } from '../lib/memberPhotos'

export const peopleEndpoints: Endpoint[] = [
  // ── Member people directory ───────────────────────────────────────
  {
    path: '/member/people',
    method: 'get',
    handler: endpoint(async (req) => {
      requireVerifiedMember(req)
      return json(
        await listMemberPeople({
          search: req.query?.search,
          tag: req.query?.tag,
          workingGroup: req.query?.workingGroup,
          workingGroupRole: req.query?.workingGroupRole,
          page: req.query?.page,
          pageSize: req.query?.pageSize,
        }),
      )
    }),
  },
  {
    path: '/member/people/:id',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const access = await getAccessProfile(req, account)
      const person = await getMemberPerson({ ...accountView(account), access }, req.routeParams?.id)
      if (!person) throw fail.notFound('Member profile not found.')
      return json({ person })
    }),
  },

  {
    path: '/member/people/:id/photo',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const access = await getAccessProfile(req, account)
      const id = Number(req.routeParams?.id)
      const person = await getMemberPerson({ ...accountView(account), access }, id)
      if (!person) throw fail.notFound('Profile photo not found.')
      const photo = await readMemberPhoto(id)
      if (!photo) throw fail.notFound('Profile photo not found.')
      return new Response(new Uint8Array(photo.bytes), {
        headers: {
          'Content-Type': photo.content_type,
          'Content-Length': String(photo.byte_size),
          'Content-Disposition': 'inline',
          'Cache-Control': 'private, no-store',
        },
      })
    }),
  },
]
