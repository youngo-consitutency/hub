import { useMemo } from 'react'
import { avatarDataUri } from '../../shared/avatar'

interface AvatarProps {
  /** the account id, so a member's avatar is the same everywhere */
  seed: string | number
  options?: unknown
  alt: string
  className?: string
}

/** The one avatar renderer: the library draws it from allowlisted picks over a seeded default. */
export function Avatar({ seed, options, alt, className }: AvatarProps) {
  const src = useMemo(() => avatarDataUri(seed, options), [seed, options])
  return <img src={src} alt={alt} decoding="async" className={className} />
}

interface MemberAvatarProps {
  /** Anything person-shaped: a directory entry, a profile or a hand-built stub. */
  person?: {
    id?: string | number
    accountId?: string | number
    name?: string | null
    displayName?: string | null
    avatar?: unknown
  } | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function MemberAvatar({ person, size = 'md', className = '' }: MemberAvatarProps) {
  const name = person?.displayName || person?.name || 'YOUNGO member'
  return (
    <span className={`memberAvatar memberAvatar-${size} ${className}`.trim()}>
      <Avatar
        seed={person?.id ?? person?.accountId ?? name}
        options={person?.avatar}
        alt={`Avatar of ${name}`}
      />
    </span>
  )
}
