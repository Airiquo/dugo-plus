/**
 * Philippine contact numbers: national digits edited without the `+63` prefix,
 * stored in E.164 form. The national number is capped at 10 digits.
 */

/** National digits from a pasted/typed number: no `+63`, no leading 0. */
export function phNational(value) {
  let digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('63')) digits = digits.slice(2)
  digits = digits.replace(/^0+/, '')
  return digits.slice(0, 10)
}

/** Display grouping for the national digits: `917 123 4567`. */
export function phDisplay(national) {
  const digits = phNational(national)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
}

/** Stored form: `+63` followed by the national digits; empty stays empty. */
export function phE164(national) {
  const digits = phNational(national)
  return digits ? `+63${digits}` : ''
}
