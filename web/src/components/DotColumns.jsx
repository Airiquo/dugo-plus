/**
 * Dot-columns chart — one column of dots per category, filled from the bottom
 * to the value's height. The geometry below mirrors the mockups exactly
 * (viewBox 176x148, columns 22px apart from x=11, rows 13px apart from y=6.5,
 * axis labels at y=144) so the stylesheet's `.dot-on/.dot-off/.dot-axis` fills
 * line up with the 8-week charts in the dashboard.
 */
const COL_X0 = 11
const COL_DX = 22
const ROW_Y0 = 6.5
const ROW_DY = 13
const ROWS = 10
const VIEW_W = 176
const VIEW_H = 148
const AXIS_Y = 144
export function DotColumns({ values, labels, rows = ROWS, label, ...rest }) {
  const max = Math.max(...values, 1)
  return (
    <svg
      className="dot-columns"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMinYMid meet"
      {...rest}
    >
      {values.map((value, col) => {
        const x = COL_X0 + col * COL_DX
        const filled = Math.max(1, Math.round((value / max) * rows))
        return (
          <g key={col}>
            {Array.from({ length: rows }, (_, row) => (
              <circle
                key={row}
                cx={x}
                cy={ROW_Y0 + row * ROW_DY}
                r={3.4}
                className={row >= rows - filled ? 'dot-on' : 'dot-off'}
              />
            ))}
            {labels?.[col] != null && (
              <text x={x} y={AXIS_Y} textAnchor="middle" className="dot-axis">
                {labels[col]}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
