import { useAccount } from '../lib/accountContext.jsx'
import { A, Section } from '../components/ui.jsx'
import { BookOpen, CheckCircle2, GraduationCap, HelpCircle, Library, Users } from 'lucide-react'

const FAQ_VERIFIED = [
  {
    q: 'Am I fully verified now?',
    a: 'Yes. You finished account verification on YOUNGO Hub — your membership course is complete and you can use the full platform. Keep this Onboarding page bookmarked; you can return anytime to revisit the course or library.',
  },
  {
    q: 'What should I do first as a verified member?',
    a: 'Start with Home (live meetings and deadlines), open Calendar so you do not miss calls, then browse Working groups. Pick a WG you care about and complete its short workspace onboarding to unlock WhatsApp and contact-point details.',
  },
  {
    q: 'Do I still need the Membership Team onboarding call?',
    a: 'The hub course unlocks this platform. Official YOUNGO membership processes (including Membership Team onboarding cycles in July and December for Constituency Work) still run with the Membership Team. Watch your email and Membership Team communications for those steps.',
  },
  {
    q: 'How do Working Groups work from here?',
    a: 'Interests you selected at signup are only preferences. To join a WG space here: Groups → open a WG → WG workspace → read the presentation and accept the rules. After that you get the channel links and CP contacts for that group.',
  },
  {
    q: 'Where do I find submissions, Council decisions, and COYs?',
    a: 'They are in the main navigation once you are verified: Submissions, Council, and COY tracker. Closing deadlines also appear on Home so you can act quickly.',
  },
  {
    q: 'I am with an accredited NGO — where is that?',
    a: 'If you registered as an organisation (or accepted an NGO seat invite), open NGO platform in the sidebar for deadlines, endorsement/submission requests, and team seats. Individual members without an NGO seat will not see that section.',
  },
  {
    q: 'Can I speak on behalf of YOUNGO?',
    a: 'No — not automatically. Passing hub verification does not make you a spokesperson. You may only speak or act for YOUNGO (or a WG) if selected through a formal process under YOUNGO guidelines.',
  },
  {
    q: 'How do I reset my password or get help?',
    a: 'Use Sign in → Forgot password, or ask an admin for a reset link. For membership policy questions, contact membership@youngoclimate.org or youngomembership@gmail.com. For hub bugs, reach your platform admin.',
  },
]

export function Onboarding() {
  const { account } = useAccount()
  const verified = account?.isVerified

  return (
    <div>
      <p className="metaMuted" style={{ marginBottom: 6 }}>Membership journey</p>
      <h1>Onboarding</h1>
      <p className="meta" style={{ marginTop: 6, maxWidth: 560 }}>
        {verified
          ? 'You are verified — welcome in. Use this space anytime for the course, library, and answers about life after verification.'
          : 'Your hub account is created. Complete the membership course and test to unlock the full platform.'}
      </p>

      <div className="stack" style={{ marginTop: 16 }}>
        <div className="card rowBetween">
          <div className="rowGap">
            {verified
              ? <CheckCircle2 size={22} strokeWidth={1.75} color="var(--accent)" aria-hidden />
              : <GraduationCap size={22} strokeWidth={1.75} color="var(--warn)" aria-hidden />}
            <div>
              <h3>Status: {verified ? 'Verified member' : 'Pending course'}</h3>
              <p className="meta" style={{ marginTop: 4 }}>
                {account?.name} · {account?.email}
                {account?.courseScore != null && ` · Course score ${account.courseScore}`}
              </p>
            </div>
          </div>
          {!verified && (
            <A href="/onboarding/course" className="btn btn-primary btn-glow">Start membership course</A>
          )}
          {verified && (
            <A href="/onboarding/course" className="btn btn-secondary">Review course</A>
          )}
        </div>

        <Section label="Path">
          <div className="grid2">
            <div className="card cardTight">
              <div className="rowGap" style={{ marginBottom: 8 }}>
                <BookOpen size={18} strokeWidth={1.75} color="var(--accent)" aria-hidden />
                <h3>1. Membership course</h3>
              </div>
              <p className="meta">History, structure, engagement mechanisms, then a short test.</p>
              <div style={{ marginTop: 10 }}>
                <A href="/onboarding/course" className="btn btn-secondary btn-sm">Open course</A>
              </div>
            </div>
            <div className="card cardTight">
              <div className="rowGap" style={{ marginBottom: 8 }}>
                <Library size={18} strokeWidth={1.75} color="var(--accent)" aria-hidden />
                <h3>2. Capacity Building library</h3>
              </div>
              <p className="meta">Open-access guides and workflows. Expand over time.</p>
              <div style={{ marginTop: 10 }}>
                <A href="/library" className="btn btn-secondary btn-sm">Open library</A>
              </div>
            </div>
            <div className="card cardTight">
              <div className="rowGap" style={{ marginBottom: 8 }}>
                <Users size={18} strokeWidth={1.75} color="var(--accent)" aria-hidden />
                <h3>3. Working Group workspaces</h3>
              </div>
              <p className="meta">
                {verified
                  ? 'Complete each WG’s presentation + rules to unlock WhatsApp and CP contacts.'
                  : 'Unlocks after you pass the membership course.'}
              </p>
              <div style={{ marginTop: 10 }}>
                <A href={verified ? '/groups' : '/onboarding/course'} className="btn btn-secondary btn-sm">
                  {verified ? 'Browse groups' : 'Finish course first'}
                </A>
              </div>
            </div>
          </div>
        </Section>

        {verified && (
          <div className="card cardTight">
            <p className="meta">
              You finished verification — the hub is open. Explore Home, Calendar, Submissions, and Working groups.
              Contact Points and Accredited NGOs see extra sections in the sidebar.
            </p>
            <div className="detailActions" style={{ marginTop: 10 }}>
              <A href="/" className="btn btn-primary">Enter home feed</A>
            </div>
          </div>
        )}

        <Section label="FAQ">
          <div className="card faqCard">
            <div className="rowGap" style={{ marginBottom: 12, alignItems: 'flex-start' }}>
              <HelpCircle size={20} strokeWidth={1.75} color="var(--accent)" aria-hidden />
              <div>
                <h2 style={{ fontSize: 17 }}>
                  {verified ? 'You’re in — common questions' : 'After you verify — common questions'}
                </h2>
                <p className="meta" style={{ marginTop: 4 }}>
                  {verified
                    ? 'Straight answers for members who have completed account verification on the hub.'
                    : 'Written for life after verification. Finish the course above, then these steps apply in full.'}
                </p>
              </div>
            </div>
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
