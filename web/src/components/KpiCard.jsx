import { Card } from './Card'
import { Chip } from './Status'
import { Sparkline } from './Sparkline'
import { cx } from '../utils/cx'
/**
 * KPI card + grid.
 *
 * The stylesheet scopes the KPI look to `#dashboard-kpi-row` (grid of five, big
 * display-font value via `[id$=-value]`, coloured trend via `[data-trend]`), so
 * <KpiRow> renders that container and <KpiCard> derives its ids the same way the
 * mockups do: `<name>-label`, `<name>-value`, `<name>-trend`, `<name>-chart`.
 */
export function KpiRow({ id = 'dashboard-kpi-row', children, className }) {
  return (
    <section id={id} className={cx(className)}>
      {children}
    </section>
  )
}
export function KpiCard({
  name,
  label,
  value,
  trend,
  trendLabel,
  status,
  values,
  tone,
  chartLabel,
  live,
}) {
  return (
    <Card id={name} data-status={status} data-trend={trend}>
      <Chip id={`${name}-label`}>{label}</Chip>
      <span id={`${name}-value`}>{value}</span>
      {trendLabel != null && <span id={`${name}-trend`}>{trendLabel}</span>}
      {values && (
        <Card
          id={`${name}-chart`}
          data-chart="sparkline"
          data-trend={tone}
          data-live={live ? 'true' : undefined}
        >
          <Sparkline values={values} label={chartLabel ?? String(label)} data-tone={tone} />
        </Card>
      )}
    </Card>
  )
}
