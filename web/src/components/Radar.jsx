import { cx } from '../utils/cx'
/**
 * Radar — the donor-proximity scope. Concentric dashed rings, an animated sweep
 * (CSS `d-sweep`, pausable via `data-paused=true`) and donor dots; the "hot"
 * dot is the newest match. Coordinates are in the 360x360 viewBox, matching the
 * stylesheet's `transform-origin: 180px 180px` on `.radar-sweep`.
 */
const CENTER = 180
export function Radar({ points, rings = [60, 110, 160], label, paused, className, ...rest }) {
  return (
    <svg
      className={cx('radar', className)}
      data-paused={paused ? 'true' : 'false'}
      viewBox="0 0 360 360"
      role="img"
      aria-label={label}
      {...rest}
    >
      {rings.map((r) => (
        <circle key={r} cx={CENTER} cy={CENTER} r={r} className="radar-ring" />
      ))}
      <path
        className="radar-sweep"
        d={`M${CENTER} ${CENTER} L340 ${CENTER} A160 160 0 0 0 302.37474996551816 76.92517004196944 Z`}
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.r ?? (p.hot ? 4.5 : 3)}
          className={p.hot ? 'radar-hot' : 'radar-dot'}
        />
      ))}
    </svg>
  )
}
