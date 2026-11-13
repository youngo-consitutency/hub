import {
  TbChevronRight as ChevronRight,
  TbLayoutDashboard as Dashboard,
  TbUserPlus as UserPlus,
} from 'react-icons/tb'
import { A } from '../../components/ui'
import { HUB_ROOT } from '../../../lib/hubUrl'
import { useSignedIn } from '../../lib/useSignedIn'

interface JoinButtonProps {
  /** the signed-out label; members always see "Open your Hub" */
  label: string
  size?: 'sm' | 'lg'
  glow?: boolean
  className?: string
}

// the one primary action of the public site: join, or for a member, open the Hub
export function JoinButton({ label, size = 'lg', glow = false, className = '' }: JoinButtonProps) {
  const signedIn = useSignedIn()
  const Icon = signedIn ? Dashboard : UserPlus
  const classes = ['btn', 'btn-primary', glow && 'btn-glow', `btn-${size}`, className]
  return (
    <A className={classes.filter(Boolean).join(' ')} href={signedIn ? HUB_ROOT : '/join'}>
      <Icon size={size === 'sm' ? 16 : 18} strokeWidth={1.75} aria-hidden />
      {signedIn ? 'Open your Hub' : label}
      <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
    </A>
  )
}
