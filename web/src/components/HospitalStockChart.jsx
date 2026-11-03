import { cx } from "../utils/cx";
import { stockBand } from "../utils/hospitalReports";

/** Relative stock bars use exact units, quantity bands and optional group filtering. */
export function HospitalStockChart({
  rows,
  selectedGroup = "all",
  onSelect,
  className,
  ...rest
}) {
  const max = Math.max(1, ...rows.map((row) => row.unitsAvailable));
  return (
    <div className={cx("hw-stock-chart", className)} {...rest}>
      {rows.map((row) => (
        <button
          type="button"
          key={row.bloodType}
          data-band={stockBand(row.unitsAvailable)}
          aria-pressed={selectedGroup === row.bloodType}
          onClick={() => onSelect(row.bloodType)}
          aria-label={`${row.bloodType}: ${row.unitsAvailable} units. Filter this blood group.`}
        >
          <strong>{row.bloodType}</strong>
          <span className="hw-stock-chart-track" aria-hidden="true">
            <i style={{ width: `${(row.unitsAvailable / max) * 100}%` }} />
          </span>
          <span>
            {row.unitsAvailable}
            <small> units</small>
          </span>
        </button>
      ))}
    </div>
  );
}
