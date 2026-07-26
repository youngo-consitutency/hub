import { useAccount } from '../lib/accountContext.jsx'
import { A, PageHeader, Section } from '../components/ui.jsx'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Library,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { PRIVACY_META } from '../../shared/privacyNotice.js'

const FAQ_VERIFIED = [
  {
    q: 'Am I fully verified now?',
    a: 'Yes. You passed the membership course and your Hub account is verified. You can return here at any time to review the course or open the library.',
  },
  {
    q: 'What should I do first as a verified member?',
    a: 'Check Home for current meetings and deadlines, then open Calendar and Working groups. Each group has a short introduction and its own participation rules.',
  },
  {
    q: 'Do I still need the Membership Team onboarding call?',
    a: 'Yes, if the Membership Team asks you to attend. The Hub course verifies your account, but it does not replace YOUNGO membership processes or the July and December Constituency Work onboarding cycles.',
  },
  {
    q: 'How do Working Groups work from here?',
    a: 'The interests selected during registration are preferences, not memberships. Open a group, enter its workspace, read the introduction, and accept the rules. The Hub will then show that group’s channel links and Contact Point details.',
  },
  {
    q: 'Where do I find submissions, Council decisions, and COYs?',
    a: 'Use Submissions, Council, and COY tracker in the main navigation. Home also shows approaching deadlines.',
  },
  {
    q: 'Where is my accredited NGO workspace?',
    a: 'If you registered an organisation or accepted a seat invitation, open NGO platform in the sidebar. It contains deadlines, endorsement and submission requests, and team seats. Members without an organisation seat do not see it.',
  },
  {
    q: 'Can I speak on behalf of YOUNGO?',
    a: 'Not unless you have been selected through the relevant YOUNGO process. A verified Hub account does not make someone a spokesperson for YOUNGO or a working group.',
  },
  {
    q: 'How does the Hub use my personal data?',
    a: 'The Privacy Notice explains what the registration form collects, why it is needed, who can see it, and how long it is kept. Your account records the notice version you accepted. Email membership@youngoclimate.org to request a copy, correction, or deletion.',
  },
  {
    q: 'How do I reset my password or get help?',
    a: 'Use Forgot password from the sign-in form, or ask an admin for a reset link. Send membership questions to membership@youngoclimate.org or youngomembership@gmail.com. Report Hub problems to your platform admin.',
  },
]

export function Onboarding() {
  const { account } = useAccount()
  const verified = account?.isVerified

  return (
    <div>
      <PageHeader
        eyebrow="Membership journey"
        title="Onboarding"
        description={
          verified
            ? 'Your account is verified. Return here to review the membership course, read the library, or check what to do next.'
            : 'Your account is ready. Complete the membership course and test to use the rest of the Hub.'
        }
      />

      <div className="stack">
        <div className="card actionCard">
          {verified ? (
            <CheckCircle2
              className="actionCardIcon"
              size={22}
              strokeWidth={1.75}
              aria-hidden
            />
          ) : (
            <GraduationCap
              className="actionCardIcon actionCardIconWarning"
              size={22}
              strokeWidth={1.75}
              aria-hidden
            />
          )}
          <div className="actionCardCopy">
            <h3>Status: {verified ? 'Verified member' : 'Pending course'}</h3>
            <p className="meta">
              {account?.name} · {account?.email}
              {account?.courseScore != null &&
                ` · Course score ${account.courseScore}`}
            </p>
          </div>
          {!verified && (
            <A href="/onboarding/course" className="btn btn-primary btn-glow">
              Start membership course
            </A>
          )}
          {verified && (
            <A href="/onboarding/course" className="btn btn-secondary">
              Review course
            </A>
          )}
        </div>

        <div className="card actionCard">
          <ShieldCheck
            className="actionCardIcon"
            size={22}
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="actionCardCopy">
            <h3>Your data</h3>
            <p className="meta">
              What the hub collects, who can see it, and how to have it deleted.
              {account?.privacyNoticeVersion
                ? ` You consented to version ${account.privacyNoticeVersion}.`
                : ` Notice version ${PRIVACY_META.version}.`}
            </p>
          </div>
          <A href="/privacy" className="btn btn-secondary">
            Privacy notice
          </A>
        </div>

        <Section label="Path">
          <div className="onboardingPathGrid">
            <div className="card cardTight onboardingPathCard">
              <div className="rowGap onboardingPathTitle">
                <BookOpen
                  size={18}
                  strokeWidth={1.75}
                  color="var(--accent)"
                  aria-hidden
                />
                <h3>Membership course</h3>
              </div>
              <p className="meta">
                History, structure, engagement mechanisms, then a short test.
              </p>
              <div className="onboardingPathAction">
                <A
                  href="/onboarding/course"
                  className="btn btn-secondary btn-sm"
                >
                  Open course
                </A>
              </div>
            </div>
            <ArrowRight
              className="onboardingPathConnector"
              size={20}
              strokeWidth={1.75}
              aria-hidden
            />
            <div className="card cardTight onboardingPathCard">
              <div className="rowGap onboardingPathTitle">
                <Library
                  size={18}
                  strokeWidth={1.75}
                  color="var(--accent)"
                  aria-hidden
                />
                <h3>Capacity Building library</h3>
              </div>
              <p className="meta">
                Practical guides, policies, and course material.
              </p>
              <div className="onboardingPathAction">
                <A href="/library" className="btn btn-secondary btn-sm">
                  Open library
                </A>
              </div>
            </div>
            <ArrowRight
              className="onboardingPathConnector"
              size={20}
              strokeWidth={1.75}
              aria-hidden
            />
            <div className="card cardTight onboardingPathCard">
              <div className="rowGap onboardingPathTitle">
                <Users
                  size={18}
                  strokeWidth={1.75}
                  color="var(--accent)"
                  aria-hidden
                />
                <h3>Working Group workspaces</h3>
              </div>
              <p className="meta">
                {verified
                  ? 'Read each group’s introduction and accept its rules to view channel links and Contact Point details.'
                  : 'Available after you pass the membership course.'}
              </p>
              <div className="onboardingPathAction">
                <A
                  href={verified ? '/groups' : '/onboarding/course'}
                  className="btn btn-secondary btn-sm"
                >
                  {verified ? 'Browse groups' : 'Finish course first'}
                </A>
              </div>
            </div>
          </div>
        </Section>

        {verified && (
          <div className="card cardTight">
            <p className="meta">
              Your account is verified. Use Home, Calendar, Submissions, and
              Working groups to get started. Role-specific workspaces appear in
              the sidebar when they are assigned to you.
            </p>
            <div className="detailActions" style={{ marginTop: 10 }}>
              <A href="/" className="btn btn-primary">
                Enter home feed
              </A>
            </div>
          </div>
        )}

        <Section label="FAQ">
          <div className="card faqCard">
            <p className="meta faqIntro">
              {verified
                ? 'Answers about using the Hub and taking part in YOUNGO.'
                : 'These answers apply after you finish the membership course.'}
            </p>
            <div className="faqList">
              {FAQ_VERIFIED.map((item) => (
                <details key={item.q} className="faqItem">
                  <summary>{item.q}</summary>
                  <p className="meta faqAnswer">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
