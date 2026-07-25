import { Shell } from './components/Shell.jsx'
import { AccessGate } from './components/AccessGate.jsx'
import { AccountProvider, useAccount } from './lib/accountContext.jsx'
import { usePath, navigate } from './lib/router.js'
import { lazy, Suspense, useEffect } from 'react'
import { Empty, Skeletons } from './components/ui.jsx'
import { Compass, Lock } from 'lucide-react'
import { Privacy } from './pages/Privacy.jsx'

const lazyPage = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })))
const Home = lazyPage(() => import('./pages/Home.jsx'), 'Home')
const Calendar = lazyPage(() => import('./pages/Calendar.jsx'), 'Calendar')
const Submissions = lazyPage(() => import('./pages/Submissions.jsx'), 'Submissions')
const Council = lazyPage(() => import('./pages/Council.jsx'), 'Council')
const Coys = lazyPage(() => import('./pages/Coys.jsx'), 'Coys')
const Groups = lazyPage(() => import('./pages/Groups.jsx'), 'Groups')
const Directory = lazyPage(() => import('./pages/Directory.jsx'), 'Directory')
const Search = lazyPage(() => import('./pages/Search.jsx'), 'Search')
const Statement = lazyPage(() => import('./pages/Statement.jsx'), 'Statement')
const EventDetail = lazyPage(() => import('./pages/EventDetail.jsx'), 'EventDetail')
const SubmissionDetail = lazyPage(() => import('./pages/SubmissionDetail.jsx'), 'SubmissionDetail')
const DecisionDetail = lazyPage(() => import('./pages/DecisionDetail.jsx'), 'DecisionDetail')
const CoyDetail = lazyPage(() => import('./pages/CoyDetail.jsx'), 'CoyDetail')
const GroupDetail = lazyPage(() => import('./pages/GroupDetail.jsx'), 'GroupDetail')
const Onboarding = lazyPage(() => import('./pages/Onboarding.jsx'), 'Onboarding')
const Course = lazyPage(() => import('./pages/Course.jsx'), 'Course')
const Library = lazyPage(() => import('./pages/Library.jsx'), 'Library')
const Workspace = lazyPage(() => import('./pages/Workspace.jsx'), 'Workspace')
const CpManage = lazyPage(() => import('./pages/CpManage.jsx'), 'CpManage')
const NgoPortal = lazyPage(() => import('./pages/NgoPortal.jsx'), 'NgoPortal')
const Admin = lazyPage(() => import('./pages/Admin.jsx'), 'Admin')
const CpOverview = lazyPage(() => import('./pages/CpOverview.jsx'), 'CpOverview')
const FocalPoint = lazyPage(() => import('./pages/FocalPoint.jsx'), 'FocalPoint')
const Messages = lazyPage(() => import('./pages/Messages.jsx'), 'Messages')
const MembershipTeam = lazyPage(() => import('./pages/MembershipTeam.jsx'), 'MembershipTeam')
const GysPolicyTeam = lazyPage(() => import('./pages/GysPolicyTeam.jsx'), 'GysPolicyTeam')
const StaffPoints = lazyPage(() => import('./pages/StaffPoints.jsx'), 'StaffPoints')
const Recognition = lazyPage(() => import('./pages/Recognition.jsx'), 'Recognition')
const Intelligence = lazyPage(() => import('./pages/Intelligence.jsx'), 'Intelligence')
const Profile = lazyPage(() => import('./pages/Profile.jsx'), 'Profile')

// Paths allowed before membership course verification
const PRE_VERIFY = [
  /^\/onboarding/,
  /^\/library/,
  /^\/recognition/,
  /^\/privacy/,
]

const ROUTES = [
  [/^\/onboarding\/course$/, Course],
  [/^\/onboarding$/, Onboarding],
  [/^\/library$/, Library],
  [/^\/privacy$/, Privacy],
  [/^\/workspace\/(.+)$/, Workspace],
  [/^\/messages$/, Messages],
  [/^\/focal$/, FocalPoint],
  [/^\/cp$/, CpOverview],
  [/^\/cp\/(.+)$/, CpManage],
  [/^\/team\/membership$/, MembershipTeam],
  [/^\/team\/gys$/, GysPolicyTeam],
  [/^\/staff\/points$/, StaffPoints],
  [/^\/recognition$/, Recognition],
  [/^\/intelligence$/, Intelligence],
  [/^\/profile$/, Profile],
  [/^\/ngo\/accept$/, NgoPortal],
  [/^\/ngo$/, NgoPortal],
  [/^\/admin$/, Admin],
  [/^\/$/, Home],
  [/^\/calendar\/(.+)$/, EventDetail],
  [/^\/calendar/, Calendar],
  [/^\/submissions\/(.+)$/, SubmissionDetail],
  [/^\/submissions/, Submissions],
  [/^\/council\/(.+)$/, DecisionDetail],
  [/^\/council/, Council],
  [/^\/coys\/(.+)$/, CoyDetail],
  [/^\/coys/, Coys],
  [/^\/groups\/(.+)$/, GroupDetail],
  [/^\/groups/, Groups],
  [/^\/directory/, Directory],
  [/^\/gys/, Statement],
  [/^\/search/, Search],
]

function NotFound() {
  return <Empty icon={Compass} title="Page not found" body="That link doesn’t lead anywhere yet." />
}

function Locked() {
  return (
    <Empty
      icon={Lock}
      title="Complete membership course first"
      body="Your account is registered. Pass the short membership course to unlock the rest of the hub."
      cta={<a className="btn btn-primary btn-glow" href="/onboarding/course" onClick={(e) => { e.preventDefault(); navigate('/onboarding/course') }}>Start course</a>}
    />
  )
}

function isPreVerify(path) {
  return PRE_VERIFY.some((re) => re.test(path))
}

function AppRoutes() {
  const path = usePath()
  const { account } = useAccount()
  const match = ROUTES.find(([re]) => re.test(path))
  const Page = match ? match[1] : NotFound
  const slug = match ? (path.match(match[0])?.[1] ?? null) : null

  const verified = Boolean(account?.isVerified)

  useEffect(() => {
    // After first login/register while unverified, land on onboarding if on home
    if (account && !verified && path === '/') {
      navigate('/onboarding')
    }
  }, [account, verified, path])

  if (account && !verified && !isPreVerify(path)) {
    return <Shell><Locked /></Shell>
  }

  // Role gates (soft): show empty-ish message for wrong role
  if (path.startsWith('/admin') && account && account.role !== 'admin') {
    return <Shell><Empty icon={Lock} title="Admin only" body="An existing verified account must be promoted with the explicit bootstrap command." /></Shell>
  }
  if (path.startsWith('/staff/points') && account) {
    const canAward = account.role === 'admin'
      || account.role === 'focal_point'
      || account.teamRoles?.includes('membership_team')
      || account.access?.teamRoles?.includes('membership_team')
      || account.access?.capabilities?.includes('points.award')
    if (!canAward) {
      return <Shell><Empty icon={Lock} title="Staff only" body="Contribution points are awarded by admins, Focal Points, or Membership Team." /></Shell>
    }
  }
  if (path.startsWith('/focal') && account && !['admin', 'focal_point'].includes(account.role)) {
    return <Shell><Empty icon={Lock} title="Focal Points only" body="This workspace is for constituency Focal Points and admins." /></Shell>
  }
  // NGO portal: approved organisation owners, invited seat holders, or admin.
  if (
    path.startsWith('/ngo') &&
    account &&
    account.role !== 'admin' &&
    account.role !== 'ngo_admin' &&
    !account.access?.ngo
  ) {
    // Allow accept route for any signed-in user
    if (!path.startsWith('/ngo/accept')) {
      return <Shell><Empty icon={Lock} title="NGO access required" body="An approved organisation seat is required. You can also accept a seat invite." /></Shell>
    }
  }
  if (path.startsWith('/cp/') && account && account.role !== 'admin') {
    const requestedWg = path.split('/')[2]
    const managesRequestedWg = account.access?.managedWgs?.includes(requestedWg)
      || account.access?.wgAssignments?.some((item) => item.wgSlug === requestedWg)
    if (!managesRequestedWg) {
      return <Shell><Empty icon={Lock} title="WG Contact Points only" body="A contact or lead assignment for this working group is required." /></Shell>
    }
  }
  const access = account?.access
  const hasCpWorkspace = account?.role === 'admin' || account?.isWgContact || access?.wgAssignments?.length > 0
    || access?.managedWgs?.length > 0
  if (path === '/cp' && account && access && !hasCpWorkspace) {
    return <Shell><Empty icon={Lock} title="WG Contact Points only" body="Ask an admin to grant the WG CP role." /></Shell>
  }
  if (path.startsWith('/team/membership') && account && access && !access.teamRoles?.includes('membership_team')) {
    return <Shell><Empty icon={Lock} title="Membership Team only" body="Ask an admin to add this team responsibility to your account." /></Shell>
  }
  if (path.startsWith('/team/gys') && account && access && !access.teamRoles?.includes('gys_policy_team')) {
    return <Shell><Empty icon={Lock} title="GYS Policy Team only" body="Ask an admin to add this team responsibility to your account." /></Shell>
  }

  return (
    <Shell>
      <Suspense fallback={<Skeletons n={4} />}>
        <Page slug={slug && decodeURIComponent(slug)} />
      </Suspense>
    </Shell>
  )
}

export default function App() {
  return (
    <AccessGate>
      {(account) => (
        <AccountProvider initialAccount={account}>
          <AppRoutes />
        </AccountProvider>
      )}
    </AccessGate>
  )
}
