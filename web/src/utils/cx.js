/**
 * Shared helpers for the Dugo+ component library.
 *
 * The stylesheet drives nearly all state through `data-*` attributes
 * (`.btn[data-active=true]`, `.chip[data-status=urgent]`, `.card[data-state=closed]`,
 * `[id$=-drawer]`, …). Components therefore accept and forward arbitrary
 * `data-*` props — that is the intended extension point, not a workaround.
 */
/** Tiny classnames join (avoids a dependency for one helper). */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}
