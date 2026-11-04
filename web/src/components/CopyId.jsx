import { useState } from 'react'
import { cx } from '../utils/cx'

/** Truncates the displayed reference while Copy writes the full `value`. Clipboard failures remain visible. */
export function CopyId({ value, label = 'record ID', className, ...rest }) {
  const [message, setMessage] = useState('')
  async function copy() {
    try { await navigator.clipboard.writeText(String(value)); setMessage('Copied') }
    catch { setMessage('Copy unavailable. Select the ID to copy it.') }
  }
  return <span className={cx('copy-id', className)} {...rest}>
    <code title={value}>{value || 'Not recorded'}</code>
    {value && <button type="button" onClick={copy} aria-label={`Copy ${label}`}>Copy</button>}
    {message && <span className="copy-id-feedback" role="status">{message}</span>}
  </span>
}
