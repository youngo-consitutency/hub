export type HeroArtKind = 'network' | 'shelf' | 'structure'

// line drawings for the page heroes, one idea per page: a network of groups, a shelf of
// resources, an organisation around its core. decoration only, drawn in the band's own colours
const NODES = [
  [200, 150, 11],
  [96, 88, 7],
  [312, 76, 8],
  [330, 196, 7],
  [226, 262, 8],
  [92, 214, 7],
  [160, 28, 5],
  [376, 138, 5],
  [40, 150, 5],
]
const LINKS = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [1, 6],
  [2, 7],
  [3, 7],
  [1, 8],
  [5, 8],
  [4, 3],
]

function Network() {
  return (
    <>
      {LINKS.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={NODES[a][0]}
          y1={NODES[a][1]}
          x2={NODES[b][0]}
          y2={NODES[b][1]}
          className="heroArtLine"
        />
      ))}
      {NODES.map(([x, y, r], i) => (
        <g key={i} className="heroArtNode" style={{ animationDelay: `${i * 0.45}s` }}>
          <circle cx={x} cy={y} r={r + 9} className="heroArtHalo" />
          <circle cx={x} cy={y} r={r} className={i === 0 ? 'heroArtCore' : 'heroArtDot'} />
        </g>
      ))}
    </>
  )
}

const CARDS = [
  [34, 120, 78, 150],
  [128, 84, 78, 186],
  [222, 52, 78, 218],
  [316, 104, 56, 166],
]

function Shelf() {
  return (
    <>
      {CARDS.map(([x, y, w, h], i) => (
        <g key={i} className="heroArtCard" style={{ animationDelay: `${i * 0.6}s` }}>
          <rect x={x} y={y} width={w} height={h} rx="12" className="heroArtPanel" />
          <circle
            cx={x + 18}
            cy={y + 20}
            r="7"
            className={i === 2 ? 'heroArtCore' : 'heroArtDot'}
          />
          <line x1={x + 14} y1={y + 46} x2={x + w - 14} y2={y + 46} className="heroArtLine" />
          <line x1={x + 14} y1={y + 60} x2={x + w - 26} y2={y + 60} className="heroArtLine" />
          <line x1={x + 14} y1={y + 74} x2={x + w - 18} y2={y + 74} className="heroArtLine" />
        </g>
      ))}
      <line x1="14" y1="292" x2="386" y2="292" className="heroArtLine heroArtBase" />
    </>
  )
}

function Structure() {
  return (
    <>
      {[56, 104, 152].map((r) => (
        <circle key={r} cx="200" cy="160" r={r} className="heroArtOrbit" />
      ))}
      <g className="heroArtNode">
        <circle cx="200" cy="160" r="30" className="heroArtHalo" />
        <circle cx="200" cy="160" r="16" className="heroArtCore" />
      </g>
      {[
        [200, 56, 9],
        [290, 212, 9],
        [110, 212, 9],
        [352, 160, 7],
        [48, 160, 7],
      ].map(([x, y, r], i) => (
        <g key={i} className="heroArtNode" style={{ animationDelay: `${i * 0.5}s` }}>
          <circle cx={x} cy={y} r={r + 8} className="heroArtHalo" />
          <circle cx={x} cy={y} r={r} className="heroArtDot" />
        </g>
      ))}
    </>
  )
}

const ART = { network: Network, shelf: Shelf, structure: Structure }

export function HeroArt({ kind }: { kind: HeroArtKind }) {
  const Art = ART[kind]
  return (
    <svg className="heroArt" viewBox="0 0 400 320" aria-hidden focusable="false">
      <Art />
    </svg>
  )
}
