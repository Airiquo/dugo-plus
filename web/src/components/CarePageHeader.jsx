import { cx } from '../utils/cx'

/** Page introduction with a shared care motif and an optional action slot. */
export function CarePageHeader({ kicker, title, description, actions, className, ...rest }) {
  return <header className={cx('care-page-header', className)} {...rest}>
    <div><p className="care-kicker">{kicker}</p><h1>{title}</h1>{description && <p className="care-page-description">{description}</p>}</div>
    {actions ? <div className="care-page-actions">{actions}</div> : <div className="care-connection-mark" aria-hidden="true"><span /><i /><b /></div>}
  </header>
}
