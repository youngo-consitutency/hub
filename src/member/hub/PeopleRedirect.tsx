import { useEffect } from 'react'
import { useAccount } from '../lib/accountContext'
import { replace } from '../lib/router'
import { Skeletons } from '../components/ui'

// the membership team lands on renewals; everyone else on the people directory
export function PeopleRedirect() {
  const { account } = useAccount()
  const membershipTeam = (account?.access?.teamRoles || account?.teamRoles || []).includes(
    'membership_team',
  )
  useEffect(() => {
    replace(membershipTeam ? '/team/membership/renewals' : '/directory/people')
  }, [membershipTeam])
  return <Skeletons n={2} />
}
