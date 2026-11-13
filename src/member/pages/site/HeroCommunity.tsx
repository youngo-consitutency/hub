'use client'

import { motion } from 'motion/react'
import { TbPlus as Plus } from 'react-icons/tb'

// the roles that make the constituency work, drawn as characters; deliberately not real people
const FIGURES = [
  { name: 'amara', role: 'Global Focal Point' },
  { name: 'jun', role: 'Working group contact point' },
  { name: 'lucia', role: 'COY organiser' },
  { name: 'tariq', role: 'COP delegate' },
  { name: 'ingrid', role: 'Policy drafter' },
  { name: 'kofi', role: 'New member' },
]

// a ring of illustrated members around an open seat. the seat is decoration: the page already
// has a join button beside it, so it is not a second one
export function HeroCommunity({ label }: { label: string }) {
  return (
    <div className="ldCommunity" aria-hidden>
      <div className="ldOrbit">
        {FIGURES.map(({ name, role }, i) => (
          <span
            key={name}
            className="ldPeep"
            data-role={role}
            style={{ '--angle': `${(360 / FIGURES.length) * i}deg` } as React.CSSProperties}
          >
            <motion.img
              src={`/illustrations/community/${name}.svg`}
              alt=""
              width={96}
              height={96}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 5 + i * 0.7, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.12 }}
            />
          </span>
        ))}
      </div>
      <span className="ldSeat">
        <Plus size={26} strokeWidth={1.5} />
        <span>{label}</span>
      </span>
    </div>
  )
}
