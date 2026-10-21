import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { readProfile, saveProfile, BLOOD_TYPES, roleLabel } from '../../services/users'
import { eligibilityFor, toDate } from '../../utils/eligibility'
import { validateProfile } from '../../utils/validate'
import { FieldError, Badge, Icon, PubThemeToggle } from '../../components'

/** `2026-10-20` from a Date, for an `<input type="date">`. */
function dateInputValue(value) {
  const date = toDate(value)
  if (!date) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** The form's state shape, from a profile read. */
function formFrom(profile) {
  return {
    name: profile?.name ?? '',
    bloodType: profile?.bloodType ?? '',
    dateOfBirth: dateInputValue(profile?.dateOfBirth),
    phone: profile?.contact?.phone ?? '',
    city: profile?.location?.city ?? '',
    address: profile?.location?.address ?? '',
    coordinates: profile?.location?.coordinates ?? null,
    lastDonationAt: profile?.lastDonationAt ?? null,
  }
}

/**
 * Donor profile (FR-04, FR-010, FR-031).
 *
 * The donor's own screen: identity, blood type, date of birth, contact details,
 * and location. Eligibility is shown read-only, derived from the dates rather
 * than saved, so it cannot be self-declared (see `utils/eligibility.js`).
 *
 * Chrome: donor accounts have no `AppShell` (that is the admin area's), so this
 * reuses the same `pub-nav` + `.pub` scope the sign-in screens and `Welcome`
 * use, which is what makes both themes carry unchanged.
 *
 * Location is captured from the browser's geolocation prompt on request, with
 * the city as a manual field. Declining the prompt, or a browser that blocks it
 * on an insecure origin, is a normal state: the city alone is saved and the
 * screen says the coordinates are missing rather than failing the save.
 */
export default function Profile() {
  const { theme } = useTheme()
  const { user, loading, role, roleLoading, signOut } = useAuth()

  const [profileLoaded, setProfileLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [form, setForm] = useState(formFrom(null))
  const [saved, setSaved] = useState(formFrom(null))
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)

  // Load the profile once the session is known. `readProfile` is the only
  // reader; the session's own `profile` in the context is identity-only and
  // would go stale after a save here.
  useEffect(() => {
    if (!user?.uid) return
    let current = true
    setLoadFailed(false)
    readProfile(user.uid)
      .then((found) => {
        if (!current) return
        const next = formFrom(found)
        setForm(next)
        setSaved(next)
        setProfileLoaded(true)
      })
      .catch(() => {
        if (!current) return
        // Distinguish "no profile stored yet" from "the read failed", so an
        // empty form is not mistaken for a fresh account and overwritten.
        setLoadFailed(true)
        setProfileLoaded(true)
      })
    return () => {
      current = false
    }
  }, [user?.uid])

  const eligibility = useMemo(
    () => eligibilityFor({ dateOfBirth: form.dateOfBirth, lastDonationAt: saved.lastDonationAt }),
    [form.dateOfBirth, saved.lastDonationAt],
  )

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved])

  if (loading || roleLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p className="pub-msg">Checking account…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  // Guards above already bounce a roleless session; this only renders with a
  // role, so the fallback is a plain home link rather than another redirect.
  if (!role) return <Navigate to="/" replace />

  const set = (key) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }))
    setMessage('')
    setNote('')
  }

  const clearCoordinates = () => {
    setForm((prev) => ({ ...prev, coordinates: null }))
    setNote('Location removed. Your city is still saved.')
  }

  const useMyLocation = () => {
    setMessage('')
    setNote('')
    if (!navigator.geolocation) {
      setNote('This browser cannot read your location. Enter your city instead.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          coordinates: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        }))
        setLocating(false)
        setNote('Coordinates captured. Save to keep them.')
      },
      (error) => {
        setLocating(false)
        // Denied, unavailable, and timed out all mean the same thing here: no
        // coordinates, and the city alone is still a valid profile.
        const reason =
          error?.code === 1
            ? 'Your browser blocked the location request. Enter your city instead.'
            : 'Your location could not be read. Enter your city instead.'
        setNote(reason)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!profileLoaded || loadFailed) return
    const found = validateProfile(form)
    setErrors(found)
    if (Object.keys(found).length) {
      setMessage('')
      return
    }
    setBusy(true)
    setMessage('')
    setNote('')
    try {
      await saveProfile(user.uid, {
        name: form.name,
        bloodType: form.bloodType,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth) : null,
        contact: { phone: form.phone },
        // Sent only when the donor changed location details, so a save that
        // touches nothing else never rewrites the stored coordinates.
        ...(locChanged(form, saved)
          ? {
              location: {
                coordinates: form.coordinates,
                city: form.city,
                address: form.address,
              },
            }
          : {}),
      })
      setSaved(form)
      setNote('Profile saved.')
    } catch {
      setMessage('Your profile could not be saved. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="pub"
      data-theme={theme}
      style={{ display: 'grid', gridTemplateRows: 'auto 1fr' }}
    >
      <header className="pub-nav">
        <Link className="pub-logo" to="/" aria-label="Dugo+ home">
          <span className="pub-mark" aria-hidden="true" />
          <span className="pub-word">
            Dugo<span>+</span>
          </span>
        </Link>
        <nav aria-label="Sections">
          <Link to="/welcome">Home</Link>
        </nav>
        <div className="pub-nav-end">
          <PubThemeToggle />
        </div>
      </header>

      <main id="top" className="profile-main">
        <form className="pub-card pub-form profile-card" noValidate onSubmit={submit}>
          <p className="pub-kicker">Your profile</p>
          <h3>Donor details</h3>
          <p className="pub-muted">
            {user.emailVerified
              ? 'Keep these up to date so facilities can match you to nearby requests.'
              : 'Your email is not verified yet. You can still fill this in.'}
          </p>

          {!profileLoaded && <p className="pub-msg">Loading your profile…</p>}
          {loadFailed && (
            <p className="pub-msg" data-kind="error" role="alert">
              Your saved profile could not be loaded, so saving now would replace it with what is
              on screen. Check your connection and reload the page before editing.
            </p>
          )}

          {/* Identity ------------------------------------------------ */}
          <div className="profile-section">
            <h4 className="profile-section-h">Identity</h4>
            <label>
              <span>Name</span>
              <input
                autoComplete="name"
                type="text"
                value={form.name}
                aria-invalid={Boolean(errors.name) || undefined}
                aria-describedby={errors.name ? 'profile-name-error' : undefined}
                onChange={set('name')}
              />
              <FieldError id="profile-name-error">{errors.name}</FieldError>
            </label>
            <label>
              <span>Email</span>
              <input type="email" value={user.email ?? ''} readOnly disabled />
            </label>
            <p className="pub-fine">
              {roleLabel(role)} account. Your email cannot be changed here.
            </p>
          </div>

          {/* Donor details ------------------------------------------- */}
          <div className="profile-section">
            <h4 className="profile-section-h">Donor details</h4>
            <label>
              <span>Blood type</span>
              <select
                value={form.bloodType}
                aria-invalid={Boolean(errors.bloodType) || undefined}
                aria-describedby={errors.bloodType ? 'profile-blood-error' : undefined}
                onChange={set('bloodType')}
              >
                <option value="">Not set</option>
                {BLOOD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <FieldError id="profile-blood-error">{errors.bloodType}</FieldError>
            </label>
            <label>
              <span>Date of birth</span>
              <input
                type="date"
                max={dateInputValue(new Date())}
                value={form.dateOfBirth}
                aria-invalid={Boolean(errors.dateOfBirth) || undefined}
                aria-describedby={errors.dateOfBirth ? 'profile-dob-error' : undefined}
                onChange={set('dateOfBirth')}
              />
              <FieldError id="profile-dob-error">{errors.dateOfBirth}</FieldError>
            </label>
          </div>

          {/* Contact ------------------------------------------------- */}
          <div className="profile-section">
            <h4 className="profile-section-h">Contact</h4>
            <label>
              <span>Phone</span>
              <input
                autoComplete="tel"
                placeholder="0917 000 0000"
                type="tel"
                value={form.phone}
                aria-invalid={Boolean(errors.phone) || undefined}
                aria-describedby={errors.phone ? 'profile-phone-error' : undefined}
                onChange={set('phone')}
              />
              <FieldError id="profile-phone-error">{errors.phone}</FieldError>
            </label>
          </div>

          {/* Location ------------------------------------------------ */}
          <div className="profile-section">
            <h4 className="profile-section-h">Location</h4>
            <p className="pub-fine">
              Used to match you to requests nearby. Coordinates are optional.
            </p>
            <label>
              <span>City</span>
              <input
                autoComplete="address-level2"
                placeholder="Malolos, Bulacan"
                type="text"
                value={form.city}
                aria-invalid={Boolean(errors.city) || undefined}
                aria-describedby={errors.city ? 'profile-city-error' : undefined}
                onChange={set('city')}
              />
              <FieldError id="profile-city-error">{errors.city}</FieldError>
            </label>
            <label>
              <span>Address</span>
              <input
                autoComplete="street-address"
                placeholder="Optional"
                type="text"
                value={form.address}
                onChange={set('address')}
              />
            </label>

            <div className="profile-coords">
              <span className="profile-coords-state" data-state={form.coordinates ? 'set' : 'unset'}>
                <Icon name={form.coordinates ? 'target' : 'alert'} size={14} />
                {form.coordinates
                  ? `Coordinates saved (${form.coordinates.lat.toFixed(3)}, ${form.coordinates.lng.toFixed(3)})`
                  : 'No coordinates saved. Your city is enough to be matched.'}
              </span>
              <div className="profile-coords-actions">
                <button
                  className="pub-btn pub-btn-ghost"
                  type="button"
                  disabled={locating || busy}
                  onClick={useMyLocation}
                >
                  {locating ? 'Locating…' : form.coordinates ? 'Update location' : 'Use my location'}
                </button>
                {form.coordinates && (
                  <button
                    className="auth-forgot"
                    type="button"
                    disabled={busy}
                    onClick={clearCoordinates}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Eligibility --------------------------------------------- */}
          <div className="profile-section">
            <h4 className="profile-section-h">Donor eligibility</h4>
            {/* The badge carries the shared `data-eligibility` tone (green for
                eligible, red for a refusal, neutral for not enough data), so
                both themes colour it from the same tokens as every other
                status in the app. */}
            <div className="profile-elig">
              <Badge data-eligibility={eligibilityTone(eligibility.status)}>
                {eligibility.label}
              </Badge>
              <span className="profile-elig-detail">{eligibility.detail}</span>
            </div>
            <p className="pub-fine">
              Calculated from your date of birth and donations. A facility confirms eligibility at
              the donation itself.
            </p>
          </div>

          {message && (
            <p className="pub-msg" data-kind="error" role="alert">
              {message}
            </p>
          )}
          {note && (
            <p className="pub-msg" data-kind="info" role="status">
              {note}
            </p>
          )}

          <div className="profile-actions">
            <button className="pub-btn pub-btn-wide" type="submit" disabled={busy || !dirty || !profileLoaded || loadFailed}>
              {busy ? 'Saving…' : !profileLoaded ? 'Loading…' : dirty ? 'Save profile' : 'Saved'}
              {!busy && dirty && <Icon name="arrow-right" size={14} />}
            </button>
            <button
              className="pub-btn pub-btn-ghost pub-btn-wide"
              type="button"
              disabled={busy}
              onClick={() => signOut()}
            >
              Sign out
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

/**
 * Map a derived eligibility status onto the shared `data-eligibility` tone
 * vocabulary, which the stylesheet already colours for both themes: `eligible`
 * green, `deferred` and the refusals red, `unknown` neutral.
 */
function eligibilityTone(status) {
  if (status === 'eligible') return 'eligible'
  if (status === 'unknown') return 'unknown'
  if (status === 'deferred') return 'deferred'
  return 'permanently-deferred'
}

/** True when any location field differs from what was loaded. */
function locChanged(form, saved) {  return (
    form.city !== saved.city ||
    form.address !== saved.address ||
    JSON.stringify(form.coordinates) !== JSON.stringify(saved.coordinates)
  )
}
