import type { IconType } from 'react-icons'
import { NumberTicker } from '../../components/fx/NumberTicker'
import {
  TbArrowUpRight as ArrowUpRight,
  TbBook as BookOpen,
  TbMapPin as MapPin,
  TbUsers as Users,
} from 'react-icons/tb'
import { A } from '../../components/ui'
import { useApi } from '../../lib/api'
import { UpcomingEvents } from './UpcomingEvents'

// live counts come from the same public endpoints the Hub pages use, so landing and Hub never drift
const STATS: { path: string; label: string; href: string; icon: IconType }[] = [
  { path: '/groups', label: 'Working groups', href: '/about/working-groups', icon: Users },
  { path: '/coys', label: 'Conferences of Youth', href: '/about/coy', icon: MapPin },
  { path: '/resources', label: 'Science resources', href: '/about/resources', icon: BookOpen },
]

function Stat({ path, label, href, icon: Icon }: (typeof STATS)[number]) {
  const { data } = useApi(path)
  const count = data?.items?.length ?? 0
  // an empty or failed count is left out rather than shown as zero
  if (!count) return null
  return (
    <A href={href} className="ldCard ldStat">
      <span className="ldTileTop">
        <span className="ldIcon" aria-hidden>
          <Icon size={22} strokeWidth={1.5} />
        </span>
        <ArrowUpRight className="ldArrow" size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <strong>
        <NumberTicker value={count} />
      </strong>
      <span>{label}</span>
    </A>
  )
}

export function HubPulse() {
  return (
    <div className="ldPulse">
      <UpcomingEvents />
      <div className="ldStats">
        {STATS.map((stat) => (
          <Stat key={stat.path} {...stat} />
        ))}
      </div>
    </div>
  )
}
