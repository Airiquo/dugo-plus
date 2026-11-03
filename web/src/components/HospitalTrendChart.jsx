import { cx } from "../utils/cx";

/** Zero-based collection trend. Bucket buttons expose exact counts and filter dates. */
export function HospitalTrendChart({ buckets, onSelect, className, ...rest }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.units));
  const points = buckets.map((bucket, index) => ({
    x: buckets.length === 1 ? 360 : 44 + (index / (buckets.length - 1)) * 650,
    y: 176 - (bucket.units / max) * 140,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <div className={cx("hw-trend", className)} {...rest}>
      <svg
        viewBox="0 0 720 205"
        role="img"
        aria-label="Collection trend in units. Exact values and date filters are listed below."
      >
        {[0, 0.5, 1].map((step) => (
          <g key={step}>
            <line
              x1="44"
              x2="696"
              y1={176 - step * 140}
              y2={176 - step * 140}
              className="hw-chart-gridline"
            />
            <text x="32" y={180 - step * 140} textAnchor="end">
              {Number((step * max).toFixed(1))}
            </text>
          </g>
        ))}
        {!!points.length && (
          <>
            <polygon
              points={`${points[0].x},176 ${line} ${points.at(-1).x},176`}
              className="hw-chart-area"
            />
            <polyline points={line} className="hw-chart-line" />
            {points.map((point, index) => (
              <circle
                key={buckets[index].key}
                cx={point.x}
                cy={point.y}
                r="4"
                className="hw-chart-dot"
              >
                <title>
                  {buckets[index].label}: {buckets[index].units} units
                </title>
              </circle>
            ))}
          </>
        )}
      </svg>
      <div
        className="hw-trend-values"
        aria-label="Filter collections by chart interval"
      >
        {buckets.map((bucket) => (
          <button
            type="button"
            key={bucket.key}
            onClick={() => onSelect(bucket)}
            title={`${bucket.from} to ${bucket.to}`}
            aria-label={`${bucket.label}: ${bucket.units} units from ${bucket.count} donations. Filter this interval.`}
          >
            <strong>{bucket.units}</strong>
            <span>{bucket.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
