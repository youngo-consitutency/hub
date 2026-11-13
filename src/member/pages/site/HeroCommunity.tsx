'use client'

import { motion } from 'motion/react'
import { TbPlus as Plus } from 'react-icons/tb'
import { A } from '../../components/ui'

const PEEPS = ['amara', 'jun', 'lucia', 'tariq', 'ingrid', 'kofi']

// a ring of illustrated members around an open seat; the seat is the join link
export function HeroCommunity({ href, label }: { href: string; label: string }) {
  return (
    <div className="ldCommunity">
      <div className="ldOrbit" aria-hidden>
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
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
        <A href={href} className="ldSeat">
          <Plus size={26} strokeWidth={1.5} aria-hidden />
          <span>{label}</span>
        </A>
      </motion.div>
    </div>
  )
}
