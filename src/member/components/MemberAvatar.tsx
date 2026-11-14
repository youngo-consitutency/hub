import { useMemo } from 'react'
import type { AnyValue } from '../lib/types'
import { avatarDataUri } from '../../shared/avatar'

interface MemberAvatarProps {
  person?: AnyValue
  size?: AnyValue
  className?: string
}

// drawn by the library from allowlisted picks, seeded by the account id so
// every member has one before they ever open the builder
export function MemberAvatar({ person, size = 'md', className = '' }: MemberAvatarProps) {
  const name = person?.displayName || person?.name || 'YOUNGO member'
  const seed = person?.id ?? person?.accountId ?? name
  const avatar = person?.avatar
  const src = useMemo(() => avatarDataUri(seed, avatar), [seed, avatar])

  return (
    <span className={`memberAvatar memberAvatar-${size} ${className}`.trim()}>
      <img src={src} alt={`Avatar of ${name}`} decoding="async" />
    </span>
  )
}
