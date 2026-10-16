import { cx } from './types'
/**
 * Page header: the small "Dugo+ admin" kicker, the `<h1>`, an actions slot and
 * the dotted divider. The stylesheet targets it as `#page-content > #page-header`.
 */
export function PageHeader({ tag = 'Dugo+ admin', title, actions, className }) {
  return (
    <>
      <div id="page-header" className={cx(className)}>
        <div>
          <div id="page-tag" className="k">
            {tag}
          </div>
          <h1 id="page-title">{title}</h1>
        </div>
        <div id="page-actions">{actions}</div>
      </div>
      <div id="page-divider" className="dv" />
    </>
  )
}
/** Dotted divider on its own (`.dv`). */
export function Divider({ className }) {
  return <div className={cx('dv', className)} />
}
