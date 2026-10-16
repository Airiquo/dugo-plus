import { cx } from './types'
export function Table({ columns, rows, rowKey, scroll = true, className, rowProps, ...rest }) {
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
          <tr key={rowKey ? rowKey(row, i) : i} {...rowProps?.(row, i)}>
            {columns.map((col) => (
              <td key={col.key} {...col.cellProps}>
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
