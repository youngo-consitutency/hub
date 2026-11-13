import { TbGlobe as Globe, TbMapPin as MapPin, TbUsers as Users } from 'react-icons/tb'
import { useApi } from '../../lib/api'
import { regionKey } from '../../lib/regions'
import { NumberTicker } from '../../components/fx/NumberTicker'

// "our reach": the size of the work in numbers, counted from the same public lists the sections use
export function WorkReach() {
  const groups = useApi('/groups').data?.items ?? []
  const conferences = useApi('/coys').data?.items ?? []
  const regions = new Set(
    conferences.map((coy: { region?: string }) => regionKey(coy.region)).filter(Boolean),
  )
  const stats = [
    { icon: Users, value: groups.length, label: 'Working groups' },
    { icon: MapPin, value: conferences.length, label: 'Conferences of Youth' },
    { icon: Globe, value: regions.size, label: 'World regions' },
  ].filter((stat) => stat.value > 0)
  if (!stats.length) return null
  return (
    <dl className="siteReach" aria-label="Our reach">
      {stats.map(({ icon: Icon, value, label }) => (
        <div key={label} className="siteReachItem">
          <Icon size={22} strokeWidth={1.5} aria-hidden />
          <dd>
            <NumberTicker value={value} />
          </dd>
          <dt>{label}</dt>
        </div>
      ))}
    </dl>
  )
}
