import { cx } from '../utils/cx'

/** Blood-type emblem with a continuous lifeline through the donation drop. */
export function BloodlineMark({ bloodType, className, ...rest }) {
  return (
    <div
      className={cx('bloodline-mark', className)}
      role="img"
      aria-label={
        bloodType
          ? `Your blood type: ${bloodType}`
          : 'A donation connects two lives'
      }
      {...rest}
    >
      <svg viewBox="0 0 200 152" aria-hidden="true" focusable="false">
        <circle className="bloodline-orbit" cx="100" cy="76" r="63" />
        <circle className="bloodline-inner-orbit" cx="100" cy="76" r="51" />
        <path
          className="bloodline-pulse"
          d="M8 85h26l9-14 12 28 12-21h66l10-19 13 34 10-13h26"
        />
        <circle className="bloodline-node" cx="8" cy="85" r="4" />
        <circle className="bloodline-node" cx="192" cy="80" r="4" />
        <path
          className="bloodline-drop-shadow"
          d="M100 25c-8 14-34 36-34 61a34 34 0 0 0 68 0c0-25-26-47-34-61Z"
        />
        <path
          className="bloodline-drop"
          d="M100 19c-8 14-34 36-34 61a34 34 0 0 0 68 0c0-25-26-47-34-61Z"
        />
        <path className="bloodline-highlight" d="M84 58c-5 8-9 15-9 23" />
        <text className="bloodline-type" x="100" y="89" textAnchor="middle">
          {bloodType || '+'}
        </text>
        <path className="bloodline-spark" d="M157 29v10m-5-5h10" />
        <circle className="bloodline-small-node" cx="44" cy="119" r="3" />
      </svg>
    </div>
  )
}
