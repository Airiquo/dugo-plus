import { cx } from '../utils/cx'
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

const MotionContext = createContext({ paused: false, reduced: false, toggle: () => {} })
export const useMotion = () => useContext(MotionContext)

export function MotionProvider({ children, theme, className, ...rest }) {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return <MotionContext.Provider value={{ paused: reduced, reduced }}>
    <div className={cx('landing care-landing', className)} data-theme={theme} data-motion={reduced ? 'paused' : 'playing'} {...rest}>{children}</div>
  </MotionContext.Provider>
}

export function useVisibility() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setVisible(true); setEntered(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting)
      if (entry.isIntersecting) setEntered(true)
    }, { threshold: 0.15 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return { ref, visible, entered }
}

export function MotionSection({ children, className = '', ...props }) {
  const { ref, visible, entered } = useVisibility()
  return <section ref={ref} className={cx('motion-zone', className)} data-active={visible} data-entered={entered} {...props}>{children}</section>
}

export function CountUp({ value, className, ...rest }) {
  const { ref, entered } = useVisibility()
  const { paused } = useMotion()
  const [count, setCount] = useState(value)
  const completed = useRef(false)
  useEffect(() => {
    if (!entered || completed.current || paused) return
    let frame
    let start
    const tick = time => {
      start ??= time
      const progress = Math.min((time - start) / 1400, 1)
      setCount(Math.round(value * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(tick)
      else completed.current = true
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [entered, paused, value])
  return <span ref={ref} className={className} aria-label={value.toLocaleString('en-US')} {...rest}><span aria-hidden="true">{paused ? value.toLocaleString('en-US') : count.toLocaleString('en-US')}</span></span>
}
