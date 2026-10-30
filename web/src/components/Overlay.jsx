import { useEffect } from 'react'
import { cx } from '../utils/cx'
function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
}
function Overlay({ kind, name, open, onClose, title, children, className, hideClose = false, ...rest }) {
  useEscape(open, onClose)
  const state = open ? 'open' : 'closed'
  const id = `${name}-${kind}`
  return (
    <>
      <div id={`${name}-backdrop`} data-state={state} aria-hidden="true" onClick={onClose} />
      <div
        id={id}
        className={cx(kind === 'modal' && 'card', className)}
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-header`}
        {...rest}
      >
        <header id={`${id}-header`} className="row row-between">
          <span>{title}</span>
          {!hideClose && (
            <button className="btn" type="button" onClick={onClose}>
              Close
            </button>
          )}
        </header>
        {children}
      </div>
    </>
  )
}
export function Modal(props) {
  return <Overlay kind="modal" {...props} />
}
export function Drawer(props) {
  return <Overlay kind="drawer" {...props} />
}
