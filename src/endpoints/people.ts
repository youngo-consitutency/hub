import type { Endpoint } from 'payload'
import { endpoint, fail, json, param } from '../lib/respond'
import { accountView, requireVerifiedMember, verifiedContext } from '../lib/accounts'
import { getMemberPerson, listMemberPeople } from '../lib/memberDirectory'

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
      const { account, access } = await verifiedContext(req)
      const person = await getMemberPerson({ ...accountView(account), access }, param(req, 'id'))
      if (!person) throw fail.notFound('Member profile not found.')
      return json({ person })
    }),
  },
]
