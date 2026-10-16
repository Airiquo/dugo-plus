import { cx } from './types'
export function Card({ dark, as: Tag = 'div', className, children, ...rest }) {
  return (
    <Tag className={cx('card', dark && 'dk', className)} {...rest}>
      {children}
    </Tag>
  )
}
export function CardHeader({ row, className, children, ...rest }) {
  return (
    <header className={cx(row && 'row row-between', className)} {...rest}>
      {children}
    </header>
  )
}
