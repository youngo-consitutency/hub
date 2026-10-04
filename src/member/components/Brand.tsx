import type { AnyValue } from '../lib/types'
interface BrandProps {
  constituencyOnly?: AnyValue
}

export function Brand({ constituencyOnly = false }: BrandProps) {
  const src = constituencyOnly ? '/brand/youngo-logo.png' : '/brand/youngo-hub-logo.png'

  return (
    <span
      className="brandLockup"
      data-brand={constituencyOnly ? 'youngo' : 'hub'}
      aria-hidden="true"
    >
      <span className="brandLogoPlate">
        <img
          src={src}
          alt=""
          width={constituencyOnly ? 336 : 768}
          height={constituencyOnly ? 98 : 139}
        />
      </span>
    </span>
  )
}
