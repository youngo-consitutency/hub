import { TbSchool as OnboardingIcon } from 'react-icons/tb'
import { useAccount } from '../lib/accountContext'
import { A, PageHeader, Section } from '../components/ui'
import {
  TbArrowRight as ArrowRight,
  TbBook as BookOpen,
  TbCircleCheck as CheckCircle2,
  TbSchool as GraduationCap,
  TbLibrary as Library,
  TbShieldCheck as ShieldCheck,
  TbUsers as Users,
} from 'react-icons/tb'
import { useDocument } from '../lib/documents'

export function Onboarding() {
  const { doc: privacyNotice } = useDocument('privacy-notice')
  const { doc: onboardingFaq } = useDocument('onboarding-faq')
  const PRIVACY_META = privacyNotice?.PRIVACY_META || {}
  const FAQ_VERIFIED = onboardingFaq?.FAQ || []

  const { account } = useAccount()
  const verified = account?.isVerified

  return (
    <div>
      <PageHeader
        icon={OnboardingIcon}
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
            <CheckCircle2 className="actionCardIcon" size={22} strokeWidth={1.75} aria-hidden />
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
              {account?.courseScore != null && ` · Course score ${account.courseScore}`}
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
          <ShieldCheck className="actionCardIcon" size={22} strokeWidth={1.75} aria-hidden />
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
                <BookOpen size={18} strokeWidth={1.75} color="var(--accent)" aria-hidden />
                <h3>Membership course</h3>
              </div>
              <p className="meta">History, structure, engagement mechanisms, then a short test.</p>
              <div className="onboardingPathAction">
                <A href="/onboarding/course" className="btn btn-secondary btn-sm">
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
                <Library size={18} strokeWidth={1.75} color="var(--accent)" aria-hidden />
                <h3>Capacity Building library</h3>
              </div>
              <p className="meta">Practical guides, policies, and course material.</p>
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
                <Users size={18} strokeWidth={1.75} color="var(--accent)" aria-hidden />
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
              Your account is verified. Use Home, Calendar, Submissions, and Working groups to get
              started. Role-specific workspaces appear in the sidebar when they are assigned to you.
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
              {FAQ_VERIFIED.map((item: any) => (
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
