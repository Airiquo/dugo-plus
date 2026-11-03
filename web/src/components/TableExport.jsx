import { useEffect, useRef, useState } from 'react'
import { cx } from '../utils/cx'
import { tableCsv, tablePrintHtml } from '../utils/tableExport'
import { Btn } from './Btn'

/** `getRows(scope, onProgress)` returns every authorized filtered/all row; columns are plain-value {label,value} descriptors. */
export function TableExport({ name, title, columns, getRows, disabled = false, className, ...rest }) {
  const [scope, setScope] = useState('filtered')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function run(format) {
    setError(''); setMessage('Preparing all records…'); setBusy(true)
    // Open synchronously so asynchronous paginated reads do not trigger popup blocking.
    const preview = format === 'pdf' ? window.open('', '_blank') : null
    if (format === 'pdf' && !preview) {
      setError('Allow pop-ups for this site to open the PDF print view.'); setMessage(''); setBusy(false); return
    }
    if (preview) { preview.opener = null; preview.document.body.textContent = 'Preparing your print view…' }
    try {
      const rows = await getRows(scope, count => {
        if (!alive.current || preview?.closed) throw new Error('The export was closed. Try again.')
        setMessage(`Preparing ${count} records…`)
      })
      if (!Array.isArray(rows)) throw new Error('The export could not be prepared.')
      if (!alive.current) { preview?.close(); return }
      if (format === 'csv') {
        const url = URL.createObjectURL(new Blob([tableCsv(columns, rows)], { type: 'text/csv;charset=utf-8' }))
        const link = document.createElement('a')
        link.href = url; link.download = `${name}-${scope}-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.append(link); link.click(); link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      } else {
        if (preview.closed) throw new Error('The print view was closed. Try again.')
        preview.document.open(); preview.document.write(tablePrintHtml(title, scope === 'filtered' ? 'Filtered results' : 'All table data', columns, rows)); preview.document.close()
        const print = () => { if (!preview.closed) { preview.focus(); preview.print() } }
        preview.document.getElementById('print').addEventListener('click', print)
        preview.setTimeout(print, 250)
      }
      setMessage(`${rows.length} records ${format === 'csv' ? 'exported to CSV' : 'ready to print or save as PDF'}.`)
    } catch (caught) {
      preview?.close()
      if (alive.current) { setError(caught?.message || 'Export failed. Try again.'); setMessage('') }
    } finally { if (alive.current) setBusy(false) }
  }
  return <div className={cx('table-export', className)} aria-label={`${title} exports`} data-export-name={name} {...rest}>
    <div className="table-export-actions">
      <label><span className="care-sr-only">Export scope for {title}</span><select value={scope} disabled={busy || disabled} onChange={event => { setScope(event.target.value); setMessage(''); setError('') }}>
        <option value="filtered">Filtered results</option><option value="all">All table data</option>
      </select></label>
      <Btn disabled={disabled || busy} onClick={() => run('csv')}>Export CSV</Btn>
      <Btn disabled={disabled || busy} onClick={() => run('pdf')}>Print / PDF</Btn>
    </div>
    {message && <p role="status">{message}</p>}{error && <p className="table-export-error" role="alert">{error}</p>}
  </div>
}
