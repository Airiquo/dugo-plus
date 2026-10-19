# Component Conventions

New components are expected and welcome — reach for an existing primitive first,
and when the design needs something new, build it here following the patterns
below, then export it from `index.js`.

These patterns are about keeping components consistent (props, `{...rest}`
forwarding, `cx()`), not about copying any particular screen. Layout and
composition are yours to design; the look (palette, type, base class styling)
is the part to keep.

## Pattern A: Button-like
```jsx
import { cx } from '../utils/cx'
import { Icon } from './Icon'

/**
 * `variant`: 'default' | 'primary' | 'alert' | 'ghost'
 * `icon`: any <Icon> name
 */
export function Btn({ variant, icon, className, children, type = 'button', ...rest }) {
  const cls = cx('btn', variant === 'ghost' && 'tx', className)
  const attrs =
    variant === 'primary' ? { 'data-primary': true }
    : variant === 'alert' ? { 'data-status': 'emergency' }
    : {}
  return (
    <button type={type} className={cls} {...attrs} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  )
}
```

## Pattern B: Surface-like (Card)
```jsx
import { cx } from '../utils/cx'

/** `dark`: terminal-style panel (`.card.dk`); `as`: root tag, default 'div'. */
export function Card({ dark, as: Tag = 'div', className, children, ...rest }) {
  return (
    <Tag className={cx('card', dark && 'dk', className)} {...rest}>
      {children}
    </Tag>
  )
}
```

## Pattern C: Inline/status-like
```jsx
import { cx } from '../utils/cx'

export function Chip({ className, children, ...rest }) {
  return (
    <span className={cx('chip', className)} {...rest}>
      {children}
    </span>
  )
}
```

## Rules
- `...rest` is **always last** (caller override wins)
- Forward arbitrary `data-*`/HTML props through `{...rest}`
- Use `cx()` to merge classes
- Document non-obvious props in JSDoc (values, allowed tags, shape of objects)
- Keep base class names exactly as in `dugo.css`
- Don't filter props; forward everything unknown via rest
- Respect id-suffix conventions for overlays/KPI
- Filename = PascalCase, matches export(s)
- Colour comes from the design tokens. The one exception is a third-party brand
  mark, which keeps its official colours in its own component (e.g.
  `GoogleMark.jsx`) and is documented as such.
