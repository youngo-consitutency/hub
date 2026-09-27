import { TbChevronDown as ChevronDown } from 'react-icons/tb'
import { A } from '../../components/ui.jsx'

const FAQS = [
  {
    q: 'Who can join YOUNGO?',
    a: 'All children and youth up to the age of 35 can join YOUNGO — individually or through a youth-led organisation, group, delegation, or network. Membership is free. It is impossible to represent “all” youth, so YOUNGO strives to listen to and engage every young person who wants to take part.',
  },
  {
    q: 'How does YOUNGO work?',
    a: 'YOUNGO has a structure with as little hierarchy as possible. Every member is invited to take the initiative and start a submission, action, or working group. The thematic working groups work quite independently, and the Global Coordination Team keeps an overview of engagement across the constituency. The two Global Focal Points — one from the Global South and one from the Global North — are responsible for communication with official entities, especially the UNFCCC Secretariat and COP hosts, and with the other constituencies. Once a month, members meet in a constituency call.',
  },
  {
    q: 'How is YOUNGO structured?',
    a: 'Flat, by design. None of YOUNGO’s roles and institutions have designated or de facto decision-making power; they function as facilitating and supporting elements for the wider constituency. All decisions are taken by consensus via established decision-making guidelines, and all engaging entities — different NGOs, irrespective of their scale — have an equal voice.',
  },
  {
    q: 'How does YOUNGO ensure inclusivity?',
    a: 'YOUNGO is an open, cost-free, and accessible space that aims to build a global community of youth working to solve the climate crisis. Inclusivity is at the heart of the constituency and reflected in its principles: a horizontal, decentralised, and non-hierarchical work ethic that welcomes constructive, critical, and diverse views. YOUNGO works to improve language diversity and accessibility for youth with special needs, refugees, and youth from marginalised communities. All members are expected to respect cultural differences and support each other. YOUNGO condemns all types of harassment and maintains an internal Awareness Team and a Code of Conduct, including an Anti-Harassment Policy.',
  },
  {
    q: 'Which language is used within YOUNGO?',
    a: 'The working language of the constituency is English. Members are continuously working to lower language barriers, including translations of key documents where capacity allows.',
  },
  {
    q: 'Does YOUNGO membership let me attend COP?',
    a: 'No. YOUNGO membership does not grant UNFCCC badges or a place in your country’s delegation. For a national delegation, contact the ministry in your country responsible for COP delegations. YOUNGO members can, however, follow the negotiations, join working groups, and contribute to constituency work year-round — and some members attend sessions through YOUNGO observer organisations.',
  },
  {
    q: 'What is the UNFCCC, and what is the COP?',
    a: 'The UNFCCC is the United Nations Framework Convention on Climate Change — the treaty framework under which countries negotiate the global response to climate change. The COP (Conference of the Parties) is its annual decision-making meeting. YOUNGO members observe and report on these negotiations and the implications of their outcomes.',
  },
  {
    q: 'What guides YOUNGO?',
    a: 'The constituency is guided by its principles and its Code of Conduct. YOUNGO is one of the nine civil society constituencies officially recognised by the UNFCCC, and its internal structure was designed entirely by young people.',
  },
  {
    q: 'Where do I manage my membership?',
    a: 'Membership is managed through the YOUNGO Hub — the constituency’s member platform. Register, pass the short membership course, and the Hub opens: the constituency calendar, working groups, submissions, the Youth Statement process, opportunities, and the tools attached to your responsibilities.',
  },
]

function FaqItem({ q, a, id }) {
  return (
    <li>
      <details className="siteFaqItem" id={id}>
        <summary>
          <span>{q}</span>
          <ChevronDown size={17} strokeWidth={1.75} aria-hidden />
        </summary>
        <p className="meta">{a}</p>
      </details>
    </li>
  )
}

export function SiteFaq() {
  return (
    <div className="siteMain">
      <header className="sitePageHeader">
        <p className="pageEyebrow">Questions, answered</p>
        <h1>Frequently asked questions</h1>
        <p className="sitePageLead">
          Everything newcomers usually want to know about YOUNGO — how it works,
          who can join, and how it fits into the UN climate process.
        </p>
      </header>

      <ul className="siteFaqList">
        {FAQS.map((faq, index) => (
          <FaqItem key={faq.q} q={faq.q} a={faq.a} id={`faq-${index}`} />
        ))}
      </ul>

      <p className="meta siteFaqMore">
        Still stuck? See the{' '}
        <A href="/about/contact" className="inlineLink">
          contact page
        </A>{' '}
        for where to direct your question, or{' '}
        <A href="/about" className="inlineLink">
          read the introduction
        </A>{' '}
        first.
      </p>
    </div>
  )
}
