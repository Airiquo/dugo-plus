import { useEffect, useId, useState } from 'react'
import { searchCities } from '../services/reverseGeocoding'
import { cx } from '../utils/cx'

/** Worker-backed city suggestions. `inputProps` forwards native input attributes; root props go to the wrapper. Free text remains available on failure. */
export function CityAutocomplete({ value, onChange, disabled, inputProps, className, ...rest }) {
  const id = useId()
  const [cities, setCities] = useState([])
  const [message, setMessage] = useState('')
  useEffect(() => {
    setCities([]); setMessage('')
    if (disabled || value.trim().length < 3) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setMessage('Looking up cities…')
      searchCities(value, { signal: controller.signal }).then(rows => {
        if (!controller.signal.aborted) { setCities(rows); setMessage(rows.length ? '' : 'No suggestions. You can enter your city manually.') }
      }).catch(error => { if (!controller.signal.aborted) setMessage(error.message || 'City lookup unavailable. Enter your city manually.') })
    }, 500)
    return () => { clearTimeout(timer); controller.abort() }
  }, [value, disabled])
  return <span className={cx('city-autocomplete', className)} {...rest}><input value={value} onChange={onChange} disabled={disabled} autoComplete="address-level2" list={`${id}-cities`} {...inputProps} /><datalist id={`${id}-cities`}>{cities.map(city => <option key={city} value={city} />)}</datalist><small role="status">{message}</small></span>
}
