import { Shell } from './components/Shell.jsx'
import { AccessGate } from './components/AccessGate.jsx'
import { AccountProvider, useAccount } from './lib/accountContext.jsx'
import { usePath, navigate } from './lib/router.js'
import { useEffect } from 'react'
import { Home } from './pages/Home.jsx'
import { Calendar } from './pages/Calendar.jsx'
import { Submissions } from './pages/Submissions.jsx'
import { Council } from './pages/Council.jsx'
import { Coys } from './pages/Coys.jsx'
import { Groups } from './pages/Groups.jsx'
import { Directory } from './pages/Directory.jsx'
import { Search } from './pages/Search.jsx'
import { Statement } from './pages/Statement.jsx'
import { Gallery } from './pages/Gallery.jsx'
import { EventDetail } from './pages/EventDetail.jsx'
import { SubmissionDetail } from './pages/SubmissionDetail.jsx'
import { DecisionDetail } from './pages/DecisionDetail.jsx'
import { CoyDetail } from './pages/CoyDetail.jsx'
import { GroupDetail } from './pages/GroupDetail.jsx'
import { Onboarding } from './pages/Onboarding.jsx'
import { Course } from './pages/Course.jsx'
import { Library } from './pages/Library.jsx'
import { Workspace } from './pages/Workspace.jsx'
import { CpManage } from './pages/CpManage.jsx'
import { NgoPortal } from './pages/NgoPortal.jsx'
import { Admin } from './pages/Admin.jsx'
import { Empty } from './components/ui.jsx'
import { Compass, Lock } from 'lucide-react'

// Paths allowed before membership course verification
const PRE_VERIFY = [
  /^\/onboarding/,
  /^\/library/,
  /^\/gallery/,
]

const ROUTES = [
  [/^\/onboarding\/course$/, Course],
  [/^\/onboarding$/, Onboarding],
  [/^\/library$/, Library],
  [/^\/workspace\/(.+)$/, Workspace],
  [/^\/cp\/(.+)$/, CpManage],
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
  [/^\/gallery/, Gallery],
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

  const verified = account?.isVerified || account?.role === 'admin'

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
    return <Shell><Empty icon={Lock} title="Admin only" body="Set ADMIN_EMAILS to your email on Railway." /></Shell>
  }
  // NGO portal: org accounts, ngo_admin role (seat holders), or admin
  if (path.startsWith('/ngo') && account && !account.isNgo && account.role !== 'admin' && account.role !== 'ngo_admin') {
    // Allow accept route for any signed-in user
    if (!path.startsWith('/ngo/accept')) {
      return <Shell><Empty icon={Lock} title="NGO accounts only" body="Register as an organisation or accept a seat invite." /></Shell>
    }
  }
  if (path.startsWith('/cp/') && account && !account.isWgContact && account.role !== 'admin') {
    return <Shell><Empty icon={Lock} title="WG Contact Points only" body="Ask an admin to grant the WG CP role." /></Shell>
  }

  return (
    <Shell>
      <Page slug={slug && decodeURIComponent(slug)} />
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
