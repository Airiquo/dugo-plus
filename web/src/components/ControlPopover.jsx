import { useEffect, useRef, useState } from 'react'
import { cx } from '../utils/cx'
import { Btn } from './Btn'
import { Icon } from './Icon'

/** Anchored, nonmodal overlay; `name` scopes IDs. Children retain their own input/application behavior. */
export function ControlPopover({ name, label = 'Date range', icon = 'clock', triggerLabel, showDone = true, disabled = false, children, className, ...rest }) {
  const trigger = useRef(null), panel = useRef(null)
  const [open, setOpen] = useState(false)
  function position() {
    const rect = trigger.current.getBoundingClientRect(), node = panel.current
    node.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - node.offsetWidth - 8))}px`
    const below = rect.bottom + 8
    node.style.top = `${Math.max(8, Math.min(below, window.innerHeight - node.offsetHeight - 8))}px`
  }
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true) }
  }, [open])
  return <div className={cx('control-popover', className)} {...rest}>
    <Btn ref={trigger} disabled={disabled} icon={icon} aria-label={triggerLabel || label} aria-expanded={open} aria-haspopup="dialog" aria-controls={`${name}-popover`} onClick={() => {
      if (panel.current.matches(':popover-open')) { panel.current.hidePopover(); setOpen(false) }
      else { panel.current.showPopover(); position(); setOpen(true) }
    }}>{label}<Icon name="chevron-down" size={14} /></Btn>
    <div ref={panel} popover="auto" id={`${name}-popover`} role="dialog" aria-label={label} className="control-popover-panel" onToggle={event => setOpen(event.newState === 'open')}>
      {children}{showDone && <div className="control-popover-close"><Btn onClick={() => { panel.current.hidePopover(); trigger.current?.focus() }}>Done</Btn></div>}
    </div>
  </div>
}
