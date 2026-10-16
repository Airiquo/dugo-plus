export function Sparkline({ values, label, width = 120, height = 36, ...rest }) {
  const pad = 4
  const span = width - pad * 2
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const range = hi - lo || 1
  const step = values.length > 1 ? span / (values.length - 1) : 0
  const points = values.map((v, i) => {
    const x = pad + i * step
    const y = height - pad - ((v - lo) / range) * (height - pad * 2)
    return { x, y }
  })
  const last = points[points.length - 1] ?? { x: pad, y: height - pad }
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      {...rest}
    >
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        strokeWidth={1.8}
      />
      <circle cx={last.x} cy={last.y} r={3} />
    </svg>
  )
}
