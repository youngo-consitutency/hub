/** Self-paced YOUNGO membership course + quiz (Capacity Building onboarding). */

export const COURSE_VERSION = '2025-onboarding-v1'
export const PASS_SCORE = 4 // of 5

export const COURSE_MODULES = [
  {
    id: 'what-is-youngo',
    title: 'What is YOUNGO?',
    minutes: 4,
    body: [
      'YOUNGO is the official Children and Youth Constituency of the UNFCCC — a mandated mechanism for child and youth engagement, not a single NGO.',
      'It is a platform and network of individuals (up to age 35) and child/youth organisations working on climate.',
      'Working Groups (WGs), Operational Teams, and Task Forces are where thematic and coordination work happens.',
    ],
  },
  {
    id: 'membership-tracks',
    title: 'Membership tracks',
    minutes: 3,
    body: [
      'YOUNGO Network: newsletters, actions, campaigns, sharing opportunities, light support.',
      'Constituency Work: internal coordination, WGs, policy/advocacy, decision-making, mandated roles — after onboarding.',
      'Constituency Work renews every February; miss renewal and you remain in the Network.',
    ],
  },
  {
    id: 'conduct',
    title: 'Conduct & safeguarding',
    minutes: 3,
    body: [
      'All members must follow the Code of Conduct, Principles, Safeguarding, Child Safeguarding, and Conflict of Interest policies.',
      'You may only speak or act on behalf of YOUNGO if selected through a formal process.',
      'Declare conflicts of interest; under-18s need guardian consent.',
      'Full official texts live in the YOUNGO Policies & Guidelines Drive folder — open them from Library → Official policies.',
    ],
  },
  {
    id: 'how-to-engage',
    title: 'How to engage',
    minutes: 4,
    body: [
      'Join Working Group channels after WG workspace onboarding (presentation + rules).',
      'Use the hub for calendar, submissions, council decisions, COYs, and directory contacts.',
      'Contact Points (CPs) coordinate WGs; Membership Team handles registration and official onboarding cycles (July & December).',
    ],
  },
  {
    id: 'next-steps',
    title: 'After you pass',
    minutes: 2,
    body: [
      'Passing this course verifies your hub account so you can use platform features.',
      'You can reopen the onboarding area anytime to re-read modules or re-take the test.',
      'Join WGs you care about from Working groups → complete that WG’s short onboarding to unlock WhatsApp and CP details.',
    ],
  },
]

export const QUIZ = [
  {
    id: 'q1',
    prompt: 'YOUNGO is best described as:',
    choices: [
      { id: 'a', text: 'A single international NGO with membership fees' },
      {
        id: 'b',
        text: 'The official children & youth constituency of the UNFCCC (a platform/network)',
      },
      { id: 'c', text: 'A UN agency that hires climate staff' },
    ],
    correct: 'b',
  },
  {
    id: 'q2',
    prompt:
      'Constituency Work differs from the YOUNGO Network mainly because members can:',
    choices: [
      { id: 'a', text: 'Only receive newsletters' },
      {
        id: 'b',
        text: 'Join internal coordination, WGs, policy work, and decision-making (after onboarding)',
      },
      { id: 'c', text: 'Skip all codes of conduct' },
    ],
    correct: 'b',
  },
  {
    id: 'q3',
    prompt: 'When may you speak on behalf of YOUNGO?',
    choices: [
      { id: 'a', text: 'Anytime after creating a hub account' },
      { id: 'b', text: 'Only if selected through a formal YOUNGO process' },
      { id: 'c', text: 'Whenever you post on social media' },
    ],
    correct: 'b',
  },
  {
    id: 'q4',
    prompt: 'Constituency Work membership must typically be renewed:',
    choices: [
      { id: 'a', text: 'Every February' },
      { id: 'b', text: 'Every day' },
      { id: 'c', text: 'Never' },
    ],
    correct: 'a',
  },
  {
    id: 'q5',
    prompt:
      'To unlock a Working Group’s WhatsApp and contact details in the hub you should:',
    choices: [
      {
        id: 'a',
        text: 'Complete that WG’s workspace onboarding (presentation + rules)',
      },
      { id: 'b', text: 'Email every Party delegate' },
      { id: 'c', text: 'Pay a WG fee' },
    ],
    correct: 'a',
  },
]

export function scoreQuiz(answers) {
  let score = 0
  for (const q of QUIZ) {
    if (answers?.[q.id] === q.correct) score += 1
  }
  return { score, total: QUIZ.length, passed: score >= PASS_SCORE }
}
