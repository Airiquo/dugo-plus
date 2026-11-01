import { useEffect, useRef } from 'react'
import { cx } from '../utils/cx'
import { Icon } from './Icon'

/**
 * Confirms a final request status. `request` carries the row, status and display labels.
 * `fallbackFocusRef` receives focus when the original Apply button leaves the queue.
 */
export function RequestStatusDialog({
  name = 'request-status',
  request,
  fallbackFocusRef,
  busy,
  error,
  onClose,
  onConfirm,
  className,
  ...rest
}) {
  const ref = useRef(null)
  useEffect(() => {
    if (!request || !ref.current) return
    const dialog = ref.current
    const trigger = document.activeElement
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.isConnected && dialog.open) dialog.close()
      requestAnimationFrame(() => {
        const target =
          trigger?.isConnected && !trigger.disabled ? trigger : fallbackFocusRef?.current
        target?.focus()
      })
    }
  }, [request, fallbackFocusRef])
  if (!request) return null
  const id = `${name}-modal`
  return (
    <dialog
      ref={ref}
      id={id}
      className={cx('hreq-confirm', className)}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      {...rest}
    >
      <div className="hreq-confirm-copy">
        <span className="hreq-confirm-icon">
          <Icon name={request.status === 'fulfilled' ? 'check' : 'x'} size={26} />
        </span>
        <p className="care-kicker">Confirm status update</p>
        <h2 id={`${id}-title`}>Mark this request as {request.label.toLowerCase()}?</h2>
        <p id={`${id}-description`}>
          Request <strong>#{request.shortId}</strong> · {request.row.bloodType} ·{' '}
          {request.component}
          <br />
          This removes it from the active queue. You can still find it in{' '}
          <strong>{request.label}</strong>.
        </p>
        {error && (
          <p className="hreq-confirm-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="hreq-confirm-actions">
        <button className="btn" type="button" autoFocus disabled={busy} onClick={onClose}>
          Keep current status
        </button>
        <button className="btn" data-primary type="button" disabled={busy} onClick={onConfirm}>
          {busy ? 'Saving…' : `Mark ${request.label.toLowerCase()}`}
        </button>
      </div>
    </dialog>
  )
}
