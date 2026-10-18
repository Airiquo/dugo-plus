import { cx } from '../utils/cx'
export function Tabs({ label, tabs, value, onChange, className, ...rest }) {
  return (
    <nav aria-label={label} className={cx(className)} role="tablist" {...rest}>
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            className="tab"
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange?.(tab.value)}
          >
            <span>{tab.label}</span>
            {tab.count != null && <span>{tab.count}</span>}
          </button>
        )
      })}
    </nav>
  )
}
