// Route guards shared by the App Router member layout and the legacy
// AppRoutes. They improve the interface only — the API still enforces every
// permission.
import type { AnyValue } from './types'
import { canManageGroup, canManageGroups } from './groupPermissions'
import { Locked } from '../components/Locked'

// Routes reachable while the membership course is incomplete.
export const PRE_VERIFY = [
  /^\/onboarding/,
  /^\/library/,
  /^\/resources/,
  /^\/recognition/,
  /^\/privacy/,
  /^\/help/,
  /^\/about/,
  /^\/membership\/appeal/,
]

export function isPreVerify(path: AnyValue) {
  return PRE_VERIFY.some((re) => re.test(path))
}

// Returns the Locked screen this path+account resolves to, or null.
export function lockedFor(path: string, account: AnyValue) {
  const verified = Boolean(account?.isVerified)
  if (account && !verified && !isPreVerify(path)) {
    return <Locked course />
  }

  const capabilities = account?.access?.capabilities || []
  const canManageAccounts =
    account?.access?.canAdminister || capabilities.includes('accounts.manage')
  if (
    path.startsWith('/staff/review') &&
    !canManageAccounts &&
    !account?.access?.teamRoles?.includes('membership_team')
  ) {
    return (
      <Locked
        title="Review team only"
        body="Feedback and posting review are available to platform operators and the Membership Team."
      />
    )
  }
  if (path.startsWith('/admin') && account && !canManageAccounts) {
    return (
      <Locked title="Admin only" body="This workspace requires platform administration access." />
    )
  }
  if (path.startsWith('/staff/content') && account) {
    if (!capabilities.includes('content.draft') && !capabilities.includes('content.review')) {
      return (
        <Locked
          title="Website permission required"
          body="Ask a platform administrator to record your approved website drafting or publishing access."
        />
      )
    }
  }
  if (path.startsWith('/focal') && account && !account.access?.isFocalPoint) {
    return (
      <Locked title="Focal Points only" body="This workspace is for the Global Focal Points." />
    )
  }
  // The NGO portal needs an organisation context — an active seat or an
  // organisation-scope authority record. Any signed-in account may open an
  // invitation before it has a seat.
  if (path.startsWith('/ngo') && account && !account.access?.ngo) {
    if (!path.startsWith('/ngo/accept')) {
      return (
        <Locked
          title="NGO access required"
          body="An approved organisation seat is required. You can also accept a seat invite."
        />
      )
    }
  }
  if (path.startsWith('/cp/') && account) {
    const requestedWg = path.split('/')[2]
    if (!canManageGroup(account, requestedWg)) {
      return (
        <Locked
          title="WG Contact Points only"
          body="A current Contact Point assignment for this working group is required."
        />
      )
    }
  }
  if (path === '/cp' && account && account.access && !canManageGroups(account)) {
    return (
      <Locked
        title="WG Contact Points only"
        body="A current Working Group Contact Point mandate must be recorded for your account."
      />
    )
  }
  if (
    path.startsWith('/team/membership') &&
    account?.access &&
    !account.access.teamRoles?.includes('membership_team')
  ) {
    return (
      <Locked
        title="Membership Team only"
        body="Ask an admin to add this team responsibility to your account."
      />
    )
  }
  if (
    path.startsWith('/team/gys') &&
    account?.access &&
    !account.access.teamRoles?.includes('gys_policy_team')
  ) {
    return (
      <Locked
        title="GYS Policy Team only"
        body="Ask an admin to add this team responsibility to your account."
      />
    )
  }
  return null
}
