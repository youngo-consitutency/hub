import { useState } from 'react'
import { TbWorld } from 'react-icons/tb'
import { faviconUrl } from '../lib/favicon'

export function SiteFavicon({ url }: any) {
  const src = faviconUrl(url)
  const [failed, setFailed] = useState<any>(null)
  return (
    <span className="siteFavicon" aria-hidden="true">
      {src && failed !== src ? (
        <img
          key={src}
          src={src}
          width="28"
          height="28"
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
        />
      ) : (
        <TbWorld size={24} strokeWidth={1.75} />
      )}
    </span>
  )
}
