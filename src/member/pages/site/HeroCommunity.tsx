'use client'

import { motion } from 'motion/react'
import { TbPlus as Plus } from 'react-icons/tb'

const PEEPS = ['amara', 'jun', 'lucia', 'tariq', 'ingrid', 'kofi']

// a ring of illustrated members around an open seat. the seat is decoration: the page already
// has a join button beside it, so it is not a second one
export function HeroCommunity({ label }: { label: string }) {
  return (
    <div className="ldCommunity" aria-hidden>
      <div className="ldOrbit">
        {PEEPS.map((name, i) => (
          <span
            key={name}
            className="ldPeep"
            style={{ '--angle': `${(360 / PEEPS.length) * i}deg` } as React.CSSProperties}
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
