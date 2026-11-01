import { cx } from '../utils/cx'
import React from 'react'
import { useMotion, useVisibility } from './CareMotion.jsx'

const donations = Array.from({ length: 36 }, (_, index) => {
  const angle = index * 2.3999632297
  const delay = index / 35 * 2.8
  const progressAtArrival = Math.min((delay + 1.2 - .2) / 4, 1)
  const x = 160 + Math.cos(angle) * 22
  const y = 34 + 136 * (1 - progressAtArrival)
  const sx = 160 + Math.cos(angle) * 152
  const sy = 102 + Math.sin(angle) * 94
  return { x, y, sx, sy, mx: (sx + x) / 2 + Math.sin(angle) * 16, my: (sy + y) / 2 + Math.cos(angle) * 12, delay }
})

export default function DonationMark({ className, ...rest }) {
  const { ref, entered } = useVisibility()
  const { reduced } = useMotion()
  return <div ref={ref} className={cx('donation-mark', className)} data-entered={entered} data-reduced={reduced} role="img" aria-label="Incoming donation dots restore the Dugo+ symbol to solid crimson from bottom to top" {...rest}>
    <span className="donation-mark-base" aria-hidden="true" />
    <span className="donation-mark-fill" aria-hidden="true" />
    <svg viewBox="0 0 320 204" aria-hidden="true">{donations.map((dot, index) => <circle key={index} r="2.4" className="donation-particle" style={{ '--sx': `${dot.sx}px`, '--sy': `${dot.sy}px`, '--mx': `${dot.mx}px`, '--my': `${dot.my}px`, '--tx': `${dot.x}px`, '--ty': `${dot.y}px`, '--arrival': `${dot.delay}s` }} />)}</svg>
  </div>
}
