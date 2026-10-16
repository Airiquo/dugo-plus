import { cx } from './types'
/**
 * Dot meter — a compact "filled dots out of total" gauge. Colour comes from
 * `data-tone` (`red` default accent, `blue`, `green`).
 */
export function DotMeter({ value, total, tone, label, className, ...rest }) {
  const on = Math.max(0, Math.min(total, Math.round(value)))
  const off = Math.max(0, total - on)
  return (
    <span
      className={cx('dot-meter', className)}
      data-tone={tone}
      role="img"
      aria-label={label}
      {...rest}
    >
      <span className="dot-meter-on">{'●'.repeat(on)}</span>
      <span className="dot-meter-off">{'●'.repeat(off)}</span>
    </span>
  )
}
/**
 * A labelled line in an inventory readout: label · dot meter · big value.
 */
export function DotRow({ label, value, total, tone, className, ...rest }) {
  return (
    <div className={cx('dot-row', className)} {...rest}>
      <span>{label}</span>
      <DotMeter value={value} total={total} tone={tone} label={`${label}: ${value}`} />
      <span className="dot-row-value">{value}</span>
    </div>
  )
}
