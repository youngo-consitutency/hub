'use client'

import { useEffect } from 'react'
import { replace } from '../../../../../member/lib/router'
import { useAccount } from '../../../../../member/lib/accountContext'
import { Skeletons } from '../../../../../member/components/ui'

export default function Page() {
  const { account } = useAccount()
  const membershipTeam = (account?.access?.teamRoles || account?.teamRoles || []).includes(
    'membership_team',
  )
  useEffect(() => {
    replace(membershipTeam ? '/team/membership/renewals' : '/directory/people')
  }, [membershipTeam])
  return <Skeletons n={2} />
}
