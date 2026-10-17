import { cx } from './types'
/**
 * Data table (`.table`), optionally wrapped in `.table-scroll`.
 *
 * @param {Array<object>} columns - column descriptors `{ key, header, cellProps?, render? }`.
 *   `cellProps` is applied to every cell in that column; pass a function
 *   `(row, i) => props` when the attributes depend on the row — the stylesheet
 *   targets cells directly (e.g. `#requests-table td[data-status=urgent]`).
 * @param {object[]} rows - row data; `row[col.key]` is the default cell text.
 * @param {(row: object, i: number) => string} [rowKey] - stable key for each row.
 * @param {boolean} [scroll] - wrap the table in `.table-scroll` (default true).
 * @param {(row: object, i: number) => object} [rowProps] - attributes for each `<tr>`.
 */
export function Table({ columns, rows, rowKey, scroll = true, className, rowProps, ...rest }) {
  const attrs = (props, row, i) => (typeof props === 'function' ? props(row, i) : props)
  const table = (
    <table className={cx('table', className)} {...rest}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} scope="col">
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={rowKey ? rowKey(row, i) : i} {...attrs(rowProps, row, i)}>
            {columns.map((col) => (
              <td key={col.key} {...attrs(col.cellProps, row, i)}>
                {col.render ? col.render(row, i) : String(row[col.key] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
  return scroll ? <div className="table-scroll">{table}</div> : table
}
