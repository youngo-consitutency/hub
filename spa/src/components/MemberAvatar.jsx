import { useEffect, useState } from 'react'

export function MemberAvatar({ person, size = 'md', className = '' }) {
  const [failed, setFailed] = useState(false)
  const name = person?.displayName || person?.name || 'YOUNGO member'
  const photoUrl = person?.photoUrl

  useEffect(() => setFailed(false), [photoUrl])

  return (
    <span className={`memberAvatar memberAvatar-${size} ${className}`.trim()} aria-hidden="true">
      {photoUrl && !failed ? (
        <img src={photoUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        name.trim().slice(0, 1).toUpperCase()
      )}
    </span>
  )
}
