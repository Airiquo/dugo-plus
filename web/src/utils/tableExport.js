/** Plain-value tabular serialization and complete cursor traversal. */
export function exportValue(value) {
  if (value == null) return ''
  if (typeof value?.toDate === 'function') value = value.toDate()
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}
export function csvCell(value) {
  let text = exportValue(value)
  // Spreadsheet applications must not evaluate untrusted text as a formula.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) && typeof value !== 'number') text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}
export function tableCsv(columns, rows) {
  return '\uFEFF' + [columns.map(column => csvCell(column.label)).join(','),
    ...rows.map(row => columns.map(column => csvCell(column.value(row))).join(','))].join('\r\n') + '\r\n'
}
export const escapeHtml = value => exportValue(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
function printValue(value) {
  const date = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value
    : typeof value === 'string' && /^\d{4}-\d\d-\d\dT.*Z$/.test(value) ? new Date(value) : null
  if (!date || !Number.isFinite(date.getTime())) return exportValue(value)
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(date) + '\n'
    + new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hour12:false}).format(date) + ' PHT'
}
export function tablePrintHtml(title, scope, columns, rows, generatedAt = new Date()) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
@page{size:A4 landscape;margin:12mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font:8pt Arial,sans-serif;color:#46565a}}*{box-sizing:border-box}body{font:9pt/1.35 Arial,sans-serif;color:#15272c;margin:24px}h1{font-size:20pt;margin:0 0 8px}.meta{color:#46565a;margin:0 0 20px}.controls{display:flex;gap:12px;align-items:center;margin:20px 0}button{padding:10px 18px;font:inherit;cursor:pointer}table{border-collapse:collapse;width:100%;table-layout:fixed}thead{display:table-header-group}th,td{border:1px solid #a9b7bb;padding:5px;text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}th{background:#eaf0f2;font-size:9pt}tr{break-inside:avoid}h1,.meta{break-after:avoid}.empty{padding:20px;border:1px solid #a9b7bb}@media print{body{margin:0}.controls{display:none}th{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><h1>${escapeHtml(title)}</h1><p class="meta">${escapeHtml(scope)} · ${rows.length} records · Generated ${escapeHtml(generatedAt)}</p><div class="controls"><button id="print">Print / Save as PDF</button><span>Choose “Save as PDF” in your browser’s print dialog.</span></div><table><colgroup>${columns.map(column => `<col${column.printWidth ? ` style="width:${Number(column.printWidth)}%"` : ''}/>`).join('')}</colgroup><thead><tr>${columns.map(column => `<th scope="col">${escapeHtml(column.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(column => `<td>${escapeHtml(printValue(column.value(row)))}</td>`).join('')}</tr>`).join('')}</tbody></table>${rows.length ? '' : '<p class="empty">No records match this export.</p>'}</body></html>`
}

/** Collect every page; a failed or repeated cursor never produces a partial export. */
export async function collectExportPages(loadPage, { rowsKey = 'rows', cursorKey = 'cursor', onProgress = () => {} } = {}) {
  const rows = [], seen = new Set()
  let cursor = null
  do {
    const page = await loadPage(cursor)
    if (!Array.isArray(page?.[rowsKey])) throw new Error('The export response is invalid. Try again.')
    rows.push(...page[rowsKey])
    onProgress(rows.length)
    cursor = page[cursorKey] ?? null
    if (cursor !== null) {
      const key = cursor?.ref?.path || cursor?.id || cursor
      if (seen.has(key) || !page[rowsKey].length) throw new Error('The data changed while preparing the export. Refresh and try again.')
      seen.add(key)
    }
  } while (cursor !== null)
  return rows
}
