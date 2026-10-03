import { canManageGroup, canManageGroups } from './lib/groupPermissions'
import { Shell } from './components/Shell'
import { AccessGate } from './components/AccessGate'
import { AccountProvider, useAccount } from './lib/accountContext'
import { usePath, navigate, replace } from './lib/router'
import { lazy, Suspense, useEffect } from 'react'
import { A, Button, Empty, Skeletons, PageHeader } from './components/ui'
import { signOut } from './lib/session'
import { TbCompass as Compass, TbLock as Lock } from 'react-icons/tb'
import { Privacy } from './pages/Privacy'
import { RoutePeek } from './components/RoutePeek'

const lazyPage = (loader: any, name: any) =>
  lazy(() => loader().then((module: any) => ({ default: module[name] })))
const Home = lazyPage(() => import('./pages/Home'), 'Home')
const Calendar = lazyPage(() => import('./pages/Calendar'), 'Calendar')
const Submissions = lazyPage(() => import('./pages/Submissions'), 'Submissions')
const Council = lazyPage(() => import('./features/platform/Platform.tsx'), 'Decisions')
const Platform = lazyPage(() => import('./features/platform/Platform.tsx'), 'Platform')
const Work = lazyPage(() => import('./features/platform/Platform.tsx'), 'Work')
const Coys = lazyPage(() => import('./pages/Coys'), 'Coys')
const Groups = lazyPage(() => import('./pages/Groups'), 'Groups')
const Members = lazyPage(() => import('./pages/Directory'), 'Members')
const MembershipLifecycle = lazyPage(
  () => import('./features/platform/MembershipLifecycle.tsx'),
  'MembershipLifecycle',
)
const Directory = lazyPage(() => import('./pages/Directory'), 'Directory')
const Search = lazyPage(() => import('./pages/Search'), 'Search')
const Statement = lazyPage(() => import('./pages/Statement'), 'Statement')
const Opportunities = lazyPage(() => import('./pages/Opportunities'), 'Opportunities')
const EventDetail = lazyPage(() => import('./pages/EventDetail'), 'EventDetail')
const SubmissionDetail = lazyPage(() => import('./pages/SubmissionDetail'), 'SubmissionDetail')
const SubmissionProposal = lazyPage(
  () => import('./pages/SubmissionProposal'),
  'SubmissionProposal',
)
const AmendmentProposal = lazyPage(() => import('./pages/AmendmentProposal'), 'AmendmentProposal')
const SubmissionWorkspace = lazyPage(
  () => import('./pages/SubmissionWorkspace'),
  'SubmissionWorkspace',
)
const Negotiations = lazyPage(() => import('./pages/Negotiations'), 'Negotiations')
const NegotiationDetail = lazyPage(() => import('./pages/NegotiationDetail'), 'NegotiationDetail')
const DecisionDetail = lazyPage(
  () => import('./features/platform/DecisionPage.tsx'),
  'DecisionPage',
)
const CoyDetail = lazyPage(() => import('./pages/CoyDetail'), 'CoyDetail')
const GroupDetail = lazyPage(() => import('./pages/GroupDetail'), 'GroupDetail')
const TaskForce = lazyPage(() => import('./pages/TaskForce'), 'TaskForce')
const Onboarding = lazyPage(() => import('./pages/Onboarding'), 'Onboarding')
const Course = lazyPage(() => import('./pages/Course'), 'Course')
const ResourceIssues = lazyPage(() => import('./pages/ResourceIssues'), 'ResourceIssues')
const Resources = lazyPage(() => import('./pages/Resources'), 'Resources')
const Workspace = lazyPage(() => import('./pages/Workspace'), 'Workspace')
const CpManage = lazyPage(() => import('./pages/CpManage'), 'CpManage')
const NgoPortal = lazyPage(() => import('./pages/NgoPortal'), 'NgoPortal')
const Admin = lazyPage(() => import('./pages/Admin'), 'Admin')
const CpOverview = lazyPage(() => import('./pages/CpOverview'), 'CpOverview')
const FocalPoint = lazyPage(() => import('./pages/FocalPoint'), 'FocalPoint')
const MembershipTeam = lazyPage(() => import('./pages/MembershipTeam'), 'MembershipTeam')
const MembershipAppeal = lazyPage(() => import('./pages/MembershipAppeal'), 'MembershipAppeal')
const GysPolicyTeam = lazyPage(() => import('./pages/GysPolicyTeam'), 'GysPolicyTeam')
const ContentWorkspace = lazyPage(() => import('./pages/ContentWorkspace'), 'ContentWorkspace')
const Profile = lazyPage(() => import('./pages/Profile'), 'Profile')
const ReviewQueue = lazyPage(() => import('./pages/ReviewQueue'), 'ReviewQueue')
const CpCallBook = lazyPage(() => import('./pages/CpCallBook'), 'CpCallBook')
const Help = lazyPage(() => import('./pages/Help'), 'Help')

// These pages remain available while the membership course is incomplete.
const PRE_VERIFY = [
  /^\/onboarding/,
  /^\/library/,
  /^\/resources/,
  /^\/recognition/,
  /^\/privacy/,
  /^\/help/,
  /^\/about/,
  /^\/membership\/appeal/,
]

const ROUTES = [
  [/^\/platform\/people$/, PeopleRedirect],
  [/^\/platform(?:\/(partnerships))?$/, Platform],
  [/^\/work$/, Work],
  [/^\/onboarding\/course$/, Course],
  [/^\/onboarding$/, Onboarding],
  [/^\/library$/, LibraryRedirect],
  [/^\/resources$/, Resources],
  [/^\/resources\/issues$/, ResourceIssues],
  [/^\/privacy$/, Privacy],
  [/^\/workspace\/(.+)$/, Workspace],
  [/^\/focal$/, FocalPoint],
  [/^\/cp$/, CpOverview],
  [/^\/cp\/(.+)$/, CpManage],
  [/^\/team\/membership$/, MembershipTeam],
  [/^\/team\/membership\/renewals$/, MembershipLifecycle],
  [/^\/team\/gys$/, GysPolicyTeam],
  [/^\/staff\/points$/, RetiredPoints],
  [/^\/staff\/content$/, ContentWorkspace],
  [/^\/staff\/review(?:\/(opportunities))?$/, ReviewQueue],
  [/^\/recognition$/, RetiredPoints],
  [/^\/help$/, Help],
  [/^\/intelligence$/, SearchRedirect],
  [/^\/profile$/, Profile],
  [/^\/ngo\/accept$/, NgoPortal],
  [/^\/ngo$/, NgoPortal],
  [/^\/admin$/, Admin],
  [/^\/book$/, CpCallBook],
  [/^\/membership\/appeal$/, MembershipAppeal],
  [/^\/$/, Home],
  [/^\/calendar\/(.+)$/, EventDetail],
  [/^\/calendar/, Calendar],
  [/^\/negotiations\/(.+)$/, NegotiationDetail],
  [/^\/negotiations$/, Negotiations],
  [/^\/submissions\/new$/, SubmissionProposal],
  [/^\/submissions\/amendments\/new$/, AmendmentProposal],
  [/^\/submissions\/workspace\/(.+)$/, SubmissionWorkspace],
  [/^\/submissions\/workspace$/, SubmissionWorkspace],
  [/^\/submissions\/(.+)$/, SubmissionDetail],
  [/^\/submissions/, Submissions],
  [/^\/council\/(.+)$/, DecisionDetail],
  [/^\/council/, Council],
  [/^\/coys\/(.+)$/, CoyDetail],
  [/^\/coys/, Coys],
  [/^\/groups\/([^/]+)\/([^/]+)$/, TaskForce],
  [/^\/groups\/(.+)$/, GroupDetail],
  [/^\/groups/, Groups],
  [/^\/opportunities/, Opportunities],
  [/^\/directory\/people$/, Members],
  [/^\/directory/, Directory],
  [/^\/gys/, Statement],
  [/^\/search/, Search],
]

const PEEK_ROUTES = [
  /^\/calendar\/(.+)$/,
  /^\/submissions\/(.+)$/,
  /^\/council\/(.+)$/,
  /^\/coys\/(.+)$/,
  /^\/groups\/([^/]+)\/([^/]+)$/,
  /^\/groups\/(.+)$/,
]

function routeFor(path: any) {
  const match = ROUTES.find(([pattern]) => (pattern as any).test(path))
  if (!match) return { Page: NotFound, slug: null, extra: null }
  const captured = path.match(match[0])
  return {
    Page: match[1] as any,
    slug: captured?.[1] ?? null,
    extra: captured?.[2] ?? null,
  }
}

function canPeek(path: any) {
  return PEEK_ROUTES.some((pattern) => pattern.test(path))
}

function NotFound() {
  return (
    <Empty
      icon={Compass}
      title="Page not found"
      body="That link doesn’t lead anywhere yet."
      cta={
        <A className="btn btn-secondary" href="/">
          Back home
        </A>
      }
    />
  )
}

/** Redirect legacy contribution-points routes to the work page while showing a loading placeholder. */
function RetiredPoints() {
  useEffect(() => {
    replace('/work')
  }, [])
  return <Skeletons n={2} />
}

/** Redirect the legacy library route to the guides view of Resources. */
function LibraryRedirect() {
  useEffect(() => {
    replace('/resources?view=guides')
  }, [])
  return <Skeletons n={2} />
}

function PeopleRedirect() {
  const { account } = useAccount()
  const membershipTeam = (account?.access?.teamRoles || account?.teamRoles || []).includes(
    'membership_team',
  )
  useEffect(() => {
    replace(membershipTeam ? '/team/membership/renewals' : '/directory/people')
  }, [membershipTeam])
  return <Skeletons n={2} />
}

function SearchRedirect() {
  useEffect(() => {
    navigate('/search')
  }, [])
  return <Skeletons n={2} />
}

function Locked({
  title = 'Complete your membership course',
  body = 'Your account is registered. Pass the short membership course to use the rest of the Hub.',
  course = false,
}: any) {
  return (
    <div>
      <PageHeader icon={Lock} title={title} />
      <Empty
        icon={Lock}
        body={body}
        cta={
          course ? (
            <>
              <A className="btn btn-primary" href="/onboarding/course">
                Start course
              </A>
              <Button variant="ghost" onClick={() => signOut()}>
                Sign out
              </Button>
            </>
          ) : undefined
        }
      />
    </div>
  )
}

function isPreVerify(path: any) {
  return PRE_VERIFY.some((re) => re.test(path))
}

function AppRoutes() {
  const path = usePath()
  const { account } = useAccount()
  const { Page, slug, extra } = routeFor(path)

  const verified = Boolean(account?.isVerified)

  useEffect(() => {
    // Send new, unverified accounts from the home route to onboarding.
    if (account && !verified && path === '/') {
      navigate('/onboarding')
    }
  }, [account, verified, path])

  if (account && !verified && !isPreVerify(path)) {
    return (
      <Shell>
        <Locked course />
      </Shell>
    )
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
      <Shell>
        <Locked
          title="Review team only"
          body="Feedback and posting review are available to platform operators and the Membership Team."
        />
      </Shell>
    )
  }

  // Route guards improve the interface; the API still enforces every permission.
  if (path.startsWith('/admin') && account && !canManageAccounts) {
    return (
      <Shell>
        <Locked title="Admin only" body="This workspace requires platform administration access." />
      </Shell>
    )
  }
  if (path.startsWith('/staff/content') && account) {
    if (!capabilities.includes('content.draft') && !capabilities.includes('content.review')) {
      return (
        <Shell>
          <Locked
            title="Website permission required"
            body="Ask a platform administrator to record your approved website drafting or publishing access."
          />
        </Shell>
      )
    }
  }
  if (path.startsWith('/focal') && account && !account.access?.isFocalPoint) {
    return (
      <Shell>
        <Locked title="Focal Points only" body="This workspace is for the Global Focal Points." />
      </Shell>
    )
  }
  // The NGO portal needs an organisation context — an active seat or an
  // organisation-scope authority record.
  if (path.startsWith('/ngo') && account && !account.access?.ngo) {
    // Any signed-in account may open an invitation before it has an NGO seat.
    if (!path.startsWith('/ngo/accept')) {
      return (
        <Shell>
          <Locked
            title="NGO access required"
            body="An approved organisation seat is required. You can also accept a seat invite."
          />
        </Shell>
      )
    }
  }
  if (path.startsWith('/cp/') && account) {
    const requestedWg = path.split('/')[2]
    const managesRequestedWg = canManageGroup(account, requestedWg)
    if (!managesRequestedWg) {
      return (
        <Shell>
          <Locked
            title="WG Contact Points only"
            body="A current Contact Point assignment for this working group is required."
          />
        </Shell>
      )
    }
  }
  const access = account?.access
  const hasCpWorkspace = canManageGroups(account)
  if (path === '/cp' && account && access && !hasCpWorkspace) {
    return (
      <Shell>
        <Locked
          title="WG Contact Points only"
          body="A current Working Group Contact Point mandate must be recorded for your account."
        />
      </Shell>
    )
  }
  if (
    path.startsWith('/team/membership') &&
    account &&
    access &&
    !access.teamRoles?.includes('membership_team')
  ) {
    return (
      <Shell>
        <Locked
          title="Membership Team only"
          body="Ask an admin to add this team responsibility to your account."
        />
      </Shell>
    )
  }
  if (
    path.startsWith('/team/gys') &&
    account &&
    access &&
    !access.teamRoles?.includes('gys_policy_team')
  ) {
    return (
      <Shell>
        <Locked
          title="GYS Policy Team only"
          body="Ask an admin to add this team responsibility to your account."
        />
      </Shell>
    )
  }

  const peekBackground = window.history.state?.peekBackground
  const peekRoute =
    canPeek(path) && typeof peekBackground === 'string' ? routeFor(peekBackground) : null

  const BackgroundPage = peekRoute?.Page || Page
  const backgroundSlug = peekRoute ? peekRoute.slug : slug
  const backgroundExtra = peekRoute ? peekRoute.extra : extra
  return (
    <Shell>
      <Suspense fallback={<Skeletons n={4} />}>
        <BackgroundPage
          slug={backgroundSlug && decodeURIComponent(backgroundSlug)}
          extra={backgroundExtra && decodeURIComponent(backgroundExtra)}
        />
        {peekRoute && (
          <RoutePeek key={path}>
            <Page
              slug={slug && decodeURIComponent(slug)}
              extra={extra && decodeURIComponent(extra)}
            />
          </RoutePeek>
        )}
      </Suspense>
    </Shell>
  )
}

export default function App() {
  return (
    <>
      {process.env.NEXT_PUBLIC_HUB_DEMO === 'true' && (
        <div className="demoNotice">
          <strong>Demo environment.</strong> Fictional accounts and records. Do not enter personal
          information.
        </div>
      )}
      <AccessGate>
        {(account: any) => (
          <AccountProvider initialAccount={account}>
            <AppRoutes />
          </AccountProvider>
        )}
      </AccessGate>
    </>
  )
}
