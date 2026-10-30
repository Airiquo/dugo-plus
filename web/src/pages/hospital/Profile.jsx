import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { readHospital, saveHospital } from '../../services/hospitals'
import { validateHospital } from '../../utils/validate'
import { HospitalShell } from '../../layout/HospitalShell'
import { Badge, Btn, Card, Field, FieldError, Input, PageHeader } from '../../components'

const EMPTY = { name: '', address: '', contactNumber: '', latitude: '', longitude: '' }

/** The form's state shape, from a facility read. */
function formFrom(hospital) {
  return {
    name: hospital?.name ?? '',
    address: hospital?.address ?? '',
    contactNumber: hospital?.contactNumber ?? '',
    latitude: hospital?.latitude ? String(hospital.latitude) : '',
    longitude: hospital?.longitude ? String(hospital.longitude) : '',
  }
}

/** The status tone for a facility badge. */
function statusTone(status) {
  if (status === 'Active') return 'active'
  if (status === 'Suspended') return 'warning'
  return 'inactive'
}

/**
 * Hospital facility profile — `/hospital/profile` (FR-013).
 *
 * Edits the facility's name, address, contact number and coordinates on
 * `hospitals/{hospitalId}` (schema §2.3). Status is shown read-only: suspension
 * is an administrator action. The account's link to the facility comes from
 * `users/{uid}.hospitalId`.
 */
export default function Profile() {
  const { profile } = useAuth()
  const hospitalId = profile?.hospitalId ?? ''

  const [source, setSource] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saved, setSaved] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!hospitalId) {
      setLoading(false)
      return undefined
    }
    let current = true
    setLoading(true)
    setLoadFailed(false)
    readHospital(hospitalId)
      .then((found) => {
        if (!current) return
        const next = formFrom(found)
        setSource(found)
        setForm(next)
        setSaved(next)
      })
      .catch(() => {
        if (current) setLoadFailed(true)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [hospitalId, reloadKey])

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved])

  const set = (key) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }))
    setMessage('')
    setNote('')
  }

  const useMyLocation = () => {
    setMessage('')
    setNote('')
    if (!navigator.geolocation) {
      setNote('This browser cannot read your location. Enter coordinates instead.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }))
        setLocating(false)
        setNote('Coordinates captured. Save to keep them.')
      },
      () => {
        setLocating(false)
        setNote('Your location could not be read. Enter coordinates instead.')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!source || loadFailed || busy) return
    const found = validateHospital(form)
    setErrors(found)
    setMessage('')
    setNote('')
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      const changes = {
        name: form.name.trim(),
        address: form.address.trim(),
        contactNumber: form.contactNumber.trim(),
      }
      if (form.latitude !== '' && form.longitude !== '') {
        changes.latitude = Number(form.latitude)
        changes.longitude = Number(form.longitude)
      }
      await saveHospital(hospitalId, changes)
      setSaved(form)
      setNote('Facility profile saved.')
      // Refresh the read-only facts (status, geohash) after the write. A stale
      // dashboard is preferable to reporting a save as failed.
      readHospital(hospitalId)
        .then((fresh) => {
          if (!fresh) return
          setSource(fresh)
          setForm(formFrom(fresh))
          setSaved(formFrom(fresh))
        })
        .catch(() => {})
    } catch {
      setMessage('Your facility profile could not be saved. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setForm(saved)
    setErrors({})
    setMessage('')
    setNote('')
  }

  return (
    <HospitalShell facility={source?.name}>
      <PageHeader tag="Dugo+ hospital" title="Facility profile" />
      <div id="page-body">
        <div className="hospital-profile">
          <Card as="form" noValidate onSubmit={submit} aria-busy={busy || loading}>
            <header>
              <h2>Facility details</h2>
              <p className="muted">
                These details identify your blood bank to donors and appear on its requests.
              </p>
            </header>

            {loading && <p className="hospital-state">Loading your facility…</p>}

            {!loading && !hospitalId && (
              <p className="hospital-state" data-kind="warn" role="status">
                This account is not linked to a facility yet. Ask an administrator to set your
                hospital, then reload.
              </p>
            )}

            {!loading && hospitalId && loadFailed && (
              <div role="alert">
                <p className="hospital-state" data-kind="error">
                  Your facility could not be loaded, so saving now would overwrite it with what is
                  on screen. Check your connection and try again.
                </p>
                <Btn onClick={() => setReloadKey((key) => key + 1)}>Try again</Btn>
              </div>
            )}

            {!loading && hospitalId && !loadFailed && !source && (
              <p className="hospital-state" data-kind="warn" role="status">
                No facility record was found for this account. Ask an administrator to check the
                link.
              </p>
            )}

            {source && (
              <>
                <section className="hospital-profile-section">
                  <h3 className="hospital-profile-h">Identity</h3>
                  <Field label="Facility name">
                    <Input
                      autoComplete="organization"
                      type="text"
                      value={form.name}
                      disabled={busy}
                      aria-invalid={Boolean(errors.name) || undefined}
                      aria-describedby={errors.name ? 'hospital-name-error' : undefined}
                      onChange={set('name')}
                    />
                    <FieldError id="hospital-name-error">{errors.name}</FieldError>
                  </Field>

                  <Field label="Address">
                    <Input
                      autoComplete="street-address"
                      type="text"
                      value={form.address}
                      disabled={busy}
                      aria-invalid={Boolean(errors.address) || undefined}
                      aria-describedby={errors.address ? 'hospital-address-error' : undefined}
                      onChange={set('address')}
                    />
                    <FieldError id="hospital-address-error">{errors.address}</FieldError>
                  </Field>

                  <Field label="Contact number">
                    <Input
                      autoComplete="tel"
                      placeholder="044 791 0000"
                      type="tel"
                      value={form.contactNumber}
                      disabled={busy}
                      aria-invalid={Boolean(errors.contactNumber) || undefined}
                      aria-describedby={
                        errors.contactNumber ? 'hospital-contact-error' : undefined
                      }
                      onChange={set('contactNumber')}
                    />
                    <FieldError id="hospital-contact-error">{errors.contactNumber}</FieldError>
                  </Field>
                </section>

                <section className="hospital-profile-section">
                  <h3 className="hospital-profile-h">Location</h3>
                  <p className="hospital-note">
                    Coordinates place the facility for nearby donor matching. Leave both blank to
                    keep the stored location unchanged.
                  </p>
                  <div className="hospital-coords">
                    <Field label="Latitude">
                      <Input
                        inputMode="decimal"
                        placeholder="14.599500"
                        type="number"
                        step="any"
                        value={form.latitude}
                        disabled={busy}
                        aria-invalid={Boolean(errors.latitude) || undefined}
                        aria-describedby={errors.latitude ? 'hospital-latitude-error' : undefined}
                        onChange={set('latitude')}
                      />
                    </Field>
                    <Field label="Longitude">
                      <Input
                        inputMode="decimal"
                        placeholder="120.984200"
                        type="number"
                        step="any"
                        value={form.longitude}
                        disabled={busy}
                        aria-invalid={Boolean(errors.latitude) || undefined}
                        onChange={set('longitude')}
                      />
                    </Field>
                  </div>
                  <FieldError id="hospital-latitude-error">{errors.latitude}</FieldError>
                  <div className="hospital-coords-actions">
                    <Btn icon="target" onClick={useMyLocation} disabled={busy || locating}>
                      {locating ? 'Locating…' : 'Use current location'}
                    </Btn>
                  </div>
                </section>

                <section className="hospital-profile-section">
                  <h3 className="hospital-profile-h">Record</h3>
                  <dl className="hospital-facts">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <Badge data-status={statusTone(source.status)}>
                          {source.status || 'Unknown'}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt>Facility ID</dt>
                      <dd>
                        <code>{source.id}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Geohash</dt>
                      <dd>{source.geohash || '—'}</dd>
                    </div>
                  </dl>
                </section>

                {message && (
                  <p className="hospital-state" data-kind="error" role="alert">
                    {message}
                  </p>
                )}
                {note && (
                  <p className="hospital-state" role="status">
                    {note}
                  </p>
                )}

                <div className="hospital-form-actions">
                  <Btn
                    variant="primary"
                    type="submit"
                    disabled={busy || loading || loadFailed || !dirty}
                  >
                    {busy ? 'Saving…' : 'Save changes'}
                  </Btn>
                  <Btn onClick={reset} disabled={busy || loading || loadFailed || !dirty}>
                    Discard
                  </Btn>
                  <span className="muted" aria-live="polite">
                    {dirty ? 'Unsaved changes' : 'No changes to save'}
                  </span>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </HospitalShell>
  )
}
