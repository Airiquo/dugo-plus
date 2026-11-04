import { SupportContact } from '../../components/SupportContact'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { readProfile, saveProfile, BLOOD_TYPES, GENDERS, roleLabel } from '../../services/users'
import { saveDonorLocation } from '../../services/donorLocations'
import { cityFromCoordinates } from '../../services/reverseGeocoding'
import { latestDonorDonation } from '../../services/donations'
import { eligibilityFor, toDate } from '../../utils/eligibility'
import { phNational, phE164 } from '../../utils/phone'
import { asPoint } from '../../utils/geo'
import { validateProfile } from '../../utils/validate'
import { ProfileCompletionBanner, CityAutocomplete, HospitalLocationMap, SignOutButton, FieldError, Icon, CarePageHeader, CareDonorCard, ProfilePhotoEditor } from '../../components'
import { DonorNav } from '../../layout/DonorNav'

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
    fullName: profile?.fullName ?? '',
    bloodType: profile?.bloodType ?? '',
    dateOfBirth: dateInputValue(profile?.dateOfBirth),
    gender: profile?.gender ?? '',
    phoneNumber: phNational(profile?.phoneNumber),
    latitude: profile?.geohash ? String(profile.latitude) : '',
    longitude: profile?.geohash ? String(profile.longitude) : '',
    city: profile?.city ?? '',
    coordinates:
      profile?.geohash
        ? { lat: profile.latitude, lng: profile.longitude }
        : null,
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
 * Location is captured from the browser's geolocation prompt on request. An
 * authenticated Worker suggests a city from the point; donors can edit it.
 */
export default function Profile({ embedded = false }) {
  const Main = embedded ? "div" : "main";
  const { theme } = useTheme()
  const { user, profile, loading, role, roleLoading, refreshProfile } = useAuth()

  const [profileLoaded, setProfileLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [form, setForm] = useState(formFrom(null))
  const [saved, setSaved] = useState(formFrom(null))
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const [identityDraft, setIdentityDraft] = useState(null)
  const identityDialog = useRef(null)

  // Load the latest profile when the session is known. The session context is
  // not refreshed by profile edits made on this screen.
  useEffect(() => {
    if (!user?.uid) return
    const controller = new AbortController()
    let current = true
    setLoadFailed(false)
    readProfile(user.uid, { signal: controller.signal })
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
      controller.abort()
      current = false
    }
  }, [user?.uid])

  const [lastDonation, setLastDonation] = useState(null)
  useEffect(() => {
    setLastDonation(null)
    if (!user?.uid || !saved.lastDonationAt) return
    let current = true
    latestDonorDonation(user.uid)
      .then((found) => {
        if (current) setLastDonation(found)
      })
      .catch(() => {
        if (current) setLastDonation(null)
      })
    return () => {
      current = false
    }
  }, [user?.uid, saved.lastDonationAt])

  const eligibility = useMemo(
    () =>
      eligibilityFor({
        dateOfBirth: form.dateOfBirth,
        lastDonationAt: saved.lastDonationAt,
        intervalDays: lastDonation?.intervalDays || null,
      }),
    [form.dateOfBirth, saved.lastDonationAt, lastDonation],
  )

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved])

  useEffect(() => {
    const dialog = identityDialog.current
    if (!dialog) return
    if (identityDraft && !dialog.open) dialog.showModal()
    if (!identityDraft && dialog.open) dialog.close()
  }, [identityDraft])

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
    const value = key === 'phoneNumber' ? phNational(event.target.value) : event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }))
    setMessage('')
    setNote('')
  }

  const clearCoordinates = () => {
    setForm((prev) => ({ ...prev, coordinates: null, latitude: '', longitude: '' }))
    setNote('Pin removed from your draft. Save your profile to keep this change.')
  }

  const useMyLocation = () => {
    setMessage('')
    setNote('')
    if (!navigator.geolocation) {
      setNote('This browser cannot read your location. Enter your city instead.')
      return
    }
    const cityAtLookupStart = form.city
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setForm((prev) => ({ ...prev, coordinates, latitude: String(coordinates.lat), longitude: String(coordinates.lng) }))
        setNote('Location captured. Finding your city…')
        try {
          const city = await cityFromCoordinates(coordinates)
          if (!city) throw new Error('No city was found for this location.')
          setForm((prev) => ({
            ...prev,
            ...(prev.city === cityAtLookupStart ? { city } : {}),
          }))
          setNote('City suggested. Check it, then save your profile.')
        } catch {
          setNote(
            'Coordinates captured, but your city could not be found. Enter it manually.',
          )
        } finally {
          setLocating(false)
        }
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

  const persistProfile = async (draft) => {
    setBusy(true)
    setMessage('')
    setNote('')
    try {
      await saveProfile(user.uid, {
        fullName: draft.fullName,
        bloodType: draft.bloodType,
        dateOfBirth: draft.dateOfBirth ? new Date(draft.dateOfBirth) : null,
        gender: draft.gender,
        phoneNumber: phE164(draft.phoneNumber),
        // Sent only when the donor changed location details, so a save that
        // touches nothing else never rewrites the stored coordinates.
        ...(locChanged(draft, saved)
          ? {
              location: {
                coordinates: draft.coordinates,
                city: draft.city,
              },
            }
          : {}),
      })
      // Keep a thin mirror for the hospital's nearby-donor view (D31); the
      // donor's own `users` document stays owner+admin (NFR-11).
      try {
        await saveDonorLocation(user.uid, {
          latitude: draft.coordinates?.lat,
          longitude: draft.coordinates?.lng,
          city: draft.city,
          bloodType: draft.bloodType,
        })
      } catch {
        // best effort — profile save already succeeded
      }
      setForm(draft)
      setSaved(draft)
      await refreshProfile?.().catch(() => {})
      setNote('Profile saved.')
    } catch {
      setMessage('Your profile could not be saved. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!profileLoaded || loadFailed) return
    const found = validateProfile(form)
    if ((form.latitude || form.longitude) && !asPoint(form.latitude, form.longitude)) found.coordinates = "Enter both coordinates: latitude −90 to 90 and longitude −180 to 180."
    setErrors(found)
    if (Object.keys(found).length) {
      setMessage('Check the highlighted details before saving.')
      return
    }
    setMessage('')
    setNote('')
    const choosingIdentity =
      (!saved.bloodType && Boolean(form.bloodType)) ||
      (!saved.dateOfBirth && Boolean(form.dateOfBirth))
    if (choosingIdentity) {
      setIdentityDraft({ ...form })
      return
    }
    await persistProfile(form)
  }

  const confirmIdentity = async () => {
    if (!identityDraft) return
    const draft = identityDraft
    setIdentityDraft(null)
    await persistProfile(draft)
  }

  const lockedIdentity = {
    bloodType: Boolean(saved.bloodType),
    dateOfBirth: Boolean(saved.dateOfBirth),
  }
  const dateOfBirthLabel = (value) => {
    const date = toDate(value)
    return date
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date)
      : 'Not set'
  }

  return (
    <div
      className={embedded ? "donor-profile-content" : "pub donor-surface"}
      data-theme={theme}
      style={embedded ? undefined : { display: 'grid', gridTemplateRows: 'auto 1fr' }}
    >
      {!embedded && <DonorNav />}

      <Main id={embedded ? undefined : "top"} className={embedded ? "settings-profile-content" : "profile-main donor-main"}>
        {!embedded && <CarePageHeader kicker="Your donor space" title={<>{form.fullName ? `Hello, ${form.fullName.trim().split(' ')[0]}.` : 'A little of you.'}<br /><em>A lot of possibility.</em></>} description="A connection starts with knowing you. Keep your details ready for the next person who needs a donor." />}
        {profileLoaded && !loadFailed && <ProfileCompletionBanner profile={saved} />}
        <div className="donor-profile-layout">
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

          <ProfilePhotoEditor disabled={!profileLoaded || loadFailed || busy} />

          {/* Identity ------------------------------------------------ */}
          <div className="profile-section">
            <h4 className="profile-section-h">Identity</h4>
            <label>
              <span>Name</span>
              <input
                autoComplete="name"
                type="text"
                value={form.fullName}
                aria-invalid={Boolean(errors.fullName) || undefined}
                aria-describedby={errors.fullName ? 'profile-name-error' : undefined}
                onChange={set('fullName')}
              />
              <FieldError id="profile-name-error">{errors.fullName}</FieldError>
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
            <label><span>Gender</span><span className="app-select"><select aria-label="Gender" value={form.gender} onChange={set('gender')} disabled={busy}><option value="">Not set</option>{GENDERS.map(gender => <option key={gender}>{gender}</option>)}</select></span></label>
            <label>
              <span>Blood type</span>
              <span className="app-select"><select
                aria-label="Blood type" value={form.bloodType}
                disabled={!profileLoaded || busy || lockedIdentity.bloodType}
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
              </select></span>
              <FieldError id="profile-blood-error">{errors.bloodType}</FieldError>
              {lockedIdentity.bloodType && <span className="profile-locked-hint">Locked after saving</span>}
            </label>
            <label>
              <span>Date of birth</span>
              <input
                aria-label="Date of birth" type="date"
                max={dateInputValue(new Date())}
                value={form.dateOfBirth}
                disabled={!profileLoaded || busy || lockedIdentity.dateOfBirth}
                aria-invalid={Boolean(errors.dateOfBirth) || undefined}
                aria-describedby={errors.dateOfBirth ? 'profile-dob-error' : undefined}
                onChange={set('dateOfBirth')}
              />
              <FieldError id="profile-dob-error">{errors.dateOfBirth}</FieldError>
              {lockedIdentity.dateOfBirth && <span className="profile-locked-hint">Locked after saving</span>}
            </label>
            <p className="pub-fine">Blood type and date of birth can each be chosen once. You’ll review them before they’re saved.</p>
          </div>

          {/* Contact ------------------------------------------------- */}
          <div className="profile-section">
            <h4 className="profile-section-h">Contact</h4>
            <label>
              <span>Phone</span>
              <input
                autoComplete="tel"
                placeholder="0917 000 0000"
                aria-label="Phone" type="tel" inputMode="numeric"
                value={form.phoneNumber}
                aria-invalid={Boolean(errors.phoneNumber) || undefined}
                aria-describedby={errors.phoneNumber ? 'profile-phone-error' : undefined}
                onChange={set('phoneNumber')}
              />
              <FieldError id="profile-phone-error">{errors.phoneNumber || (form.phoneNumber && ![9,10].includes(form.phoneNumber.length) ? "Enter 9–10 digits after +63." : "")}</FieldError>
            </label>
          </div>

          {/* Location ------------------------------------------------ */}
          <div className="profile-section">
            <h4 className="profile-section-h">Location</h4>
            <p className="pub-fine">
              Place a pin, enter coordinates or use your location. When you tap Use my location,
              an approximate point is sent to OpenStreetMap to suggest your city. City search text is sent through our service to Photon.
              Check the suggestion before saving.
            </p>
            <p className="profile-location-attribution">
              City suggestions: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
            </p>
            <label>
              <span>City</span>
              <CityAutocomplete value={form.city} disabled={busy || !profileLoaded} onChange={set('city')} inputProps={{
                'aria-label': 'City', autoComplete: 'address-level2', placeholder: 'Malolos, Bulacan', type: 'text',
                'aria-invalid': Boolean(errors.city) || undefined,
                'aria-describedby': errors.city ? 'profile-city-error' : undefined,
              }} />
              <FieldError id="profile-city-error">{errors.city}</FieldError>
            </label>

            <HospitalLocationMap position={form.coordinates} editable disabled={busy || !profileLoaded} label="Your donor location" onChange={point => { setForm(previous => ({ ...previous, coordinates: point, latitude: String(point.lat), longitude: String(point.lng) })); setErrors(previous => ({ ...previous, coordinates: '' })); setMessage(''); setNote('Pin updated. Save your profile to keep it.') }} />
            <div className="profile-coordinate-fields">{[['latitude', 'Latitude'], ['longitude', 'Longitude']].map(([key,label]) => <label key={key}><span>{label}</span><input type="number" step="any" min={key === 'latitude' ? -90 : -180} max={key === 'latitude' ? 90 : 180} value={form[key]} disabled={busy} aria-invalid={Boolean(errors.coordinates)} aria-describedby="profile-coordinate-error" onChange={event => { const value = event.target.value; setForm(previous => { const next = { ...previous, [key]: value }; return { ...next, coordinates: asPoint(next.latitude, next.longitude) } }); setErrors(previous => ({ ...previous, coordinates: '' })); setMessage('') }} /></label>)}</div>
            <FieldError id="profile-coordinate-error">{errors.coordinates}</FieldError>
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
              {loadFailed ? 'Profile unavailable' : busy ? 'Saving…' : !profileLoaded ? 'Loading…' : dirty ? 'Save profile' : 'Saved'}
              {!busy && dirty && <Icon name="arrow-right" size={14} />}
            </button>
            <SignOutButton />

          </div>
        </form>
        <CareDonorCard bloodType={form.bloodType} city={form.city} eligibility={eligibility} loaded={profileLoaded && !loadFailed} error={loadFailed} photoURL={profile?.photoURL} name={form.fullName || user.displayName || user.email} />
        </div>
        {!embedded && <SupportContact as="footer" />}
      </Main>
      <dialog
        ref={identityDialog}
        className="profile-confirm-dialog"
        aria-labelledby="profile-confirm-title"
        onCancel={(event) => {
          event.preventDefault()
          setIdentityDraft(null)
        }}
      >
        <p className="pub-kicker profile-confirm-kicker"><Icon name="shield" size={22} />One-time details</p>
        <h2 id="profile-confirm-title">Are these details correct?</h2>
        <p>After saving, you won’t be able to change your blood type or date of birth. Please check them carefully.</p>
        <dl className="profile-confirm-values">
          <div><dt>Name</dt><dd>{identityDraft?.fullName || 'Not set'}</dd></div>
          <div><dt>Blood type</dt><dd>{identityDraft?.bloodType || 'Not set'}</dd></div>
          <div><dt>Date of birth</dt><dd>{dateOfBirthLabel(identityDraft?.dateOfBirth)}</dd></div>
          <div><dt>City</dt><dd>{identityDraft?.city || 'Not set'}</dd></div>
        </dl>
        <div className="profile-confirm-actions">
          <button className="btn" type="button" onClick={() => setIdentityDraft(null)}>Go back</button>
          <button className="btn" data-primary type="button" disabled={busy} onClick={confirmIdentity}>{busy ? 'Saving…' : 'Confirm and save'}</button>
        </div>
      </dialog>
    </div>
  )
}

/** True when any location field differs from what was loaded. */
function locChanged(form, saved) {
  return (
    form.city !== saved.city ||
    JSON.stringify(form.coordinates) !== JSON.stringify(saved.coordinates)
  )
}
