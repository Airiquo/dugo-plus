import { cx } from '../utils/cx'
export function Field({ label, labelHidden, children, className, as: Tag = 'div', ...rest }) {
  if (labelHidden) {
    return (
      <Tag className={cx('field', className)} {...rest}>
        <label className="sr-only">{label}</label>
        {children}
      </Tag>
    )
  }
  return (
    <Tag className={cx('field', className)} {...rest}>
      <label>
        <span>{label}</span>
        {children}
      </label>
    </Tag>
  )
}
export function Input(props) {
  const { className, ...rest } = props
  return <input className={cx(className)} {...rest} />
}
export function Select({ options, className, ...rest }) {
  return (
    <select className={cx(className)} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
export function Textarea(props) {
  const { className, ...rest } = props
  return <textarea className={cx(className)} {...rest} />
}
