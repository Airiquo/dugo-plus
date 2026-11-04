import { cx } from '../utils/cx'
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

const MotionContext = createContext({ paused: false, reduced: false, toggle: () => {} })
export const useMotion = () => useContext(MotionContext)

export function MotionProvider({ children, theme, className, ...rest }) {
  const [userPaused, setUserPaused] = useState(false)
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return <MotionContext.Provider value={{ paused: reduced || userPaused, reduced, toggle: () => setUserPaused(value => !value) }}>
    <div className={cx('landing care-landing', className)} data-theme={theme} data-motion={reduced || userPaused ? 'paused' : 'playing'} {...rest}>{children}</div>
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
  const { paused, reduced } = useMotion()
  const [count, setCount] = useState(0)
  const elapsed = useRef(0)
  const completed = useRef(false)
  useEffect(() => {
    if (!entered || completed.current || paused) return
    let frame, previous
    const tick = time => {
      if (previous !== undefined) elapsed.current += Math.min(time - previous, 50)
      previous = time
      const progress = Math.min(elapsed.current / 1400, 1)
      setCount(Math.round(value * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(tick)
      else completed.current = true
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [entered, paused, value])
  return <span ref={ref} className={className} aria-label={value.toLocaleString('en-US')} {...rest}><span aria-hidden="true">{(reduced ? value : count).toLocaleString('en-US')}</span></span>
}

/** A card's pause button and hover affect only its own animation subtree. */
export function MotionCard({ children, label, className, ...rest }) {
  const parent = useMotion()
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const stopped = parent.paused || paused || hovered
  return <MotionContext.Provider value={{ ...parent, paused: stopped }}><article className={cx('motion-card', className)} data-card-paused={stopped} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} {...rest}>
    {children}<button type="button" className="card-motion-control" aria-label={`${paused ? 'Resume' : 'Pause'} ${label} animation`} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? '▶' : 'Ⅱ'}</button>
  </article></MotionContext.Provider>
}
