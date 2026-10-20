/**
 * Google "G" brand mark, in its official four colours.
 *
 * The one sanctioned exception to the token-only colour rule (see
 * CONVENTIONS.md): this is a third-party brand asset, so it keeps Google's
 * published colours rather than `currentColor`. The palette and both themes
 * are untouched by it, and the fills live only in this file.
 *
 * Decorative, so it is hidden from assistive tech — the button's own label
 * carries the accessible name.
 *
 * `size`: rendered width/height in px.
 */
const BRAND = {
  blue: '#4285F4',
  green: '#34A853',
  yellow: '#FBBC05',
  red: '#EA4335',
}

export function GoogleMark({ size = 17, className, ...rest }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 18 18"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path
        fill={BRAND.blue}
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"
      />
      <path
        fill={BRAND.green}
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill={BRAND.yellow}
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill={BRAND.red}
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  )
}
