interface BrandProps {
  constituencyOnly?: boolean
}

// transparent logo art, in a light and an on-dark variant; css shows the one that suits the surface
export function Brand({ constituencyOnly = false }: BrandProps) {
  const name = constituencyOnly ? 'youngo-logo' : 'youngo-hub-logo'
  const [width, height] = constituencyOnly ? [336, 98] : [768, 139]
  return (
    <span className="brandLockup" aria-hidden="true">
      <img
        className="brandLogo brandLogoLight"
        src={`/brand/${name}.png`}
        alt=""
        width={width}
        height={height}
      />
      <img
        className="brandLogo brandLogoDark"
        src={`/brand/${name}-on-dark.png`}
        alt=""
        width={width}
        height={height}
      />
    </span>
  )
}
