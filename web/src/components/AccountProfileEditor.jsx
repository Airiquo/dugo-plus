import { useEffect, useRef, useState } from 'react'
import { getAccountProfile, updateAccountProfile, accountServiceError } from '../services/accounts'
import { cx } from '../utils/cx'
import { asPoint } from '../utils/geo'
import { AdminDialog } from './AdminDialog'
import { HospitalLocationMap } from './HospitalLocationMap'
import { Btn } from './Btn'
import { Field, Input, Select, Textarea } from './Field'

function formValues(details) {
  const values = (source) => source ? Object.fromEntries(Object.entries(source)
    .map(([key, value]) => [key, value == null ? '' : String(value)])) : null
  return { profile: values(details.profile), facility: values(details.facility) }
}
function payloadValues(source) {
  return source ? { ...source,
    ...('latitude' in source ? {
      latitude: source.latitude.trim() === '' ? null : Number(source.latitude),
      longitude: source.longitude.trim() === '' ? null : Number(source.longitude),
    } : {}),
  } : null
}

/** Admin-only profile/facility editor. `onSaved` receives the audited operation result. */
export function AccountProfileEditor({ name = 'account-edit', account, open, onClose, onSaved,
  className, ...rest }) {
  const [details, setDetails] = useState(null)
  const [draft, setDraft] = useState(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [errors, setErrors] = useState({})
  const form = useRef(null)
  const errorRef = useRef(null)
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  useEffect(() => {
    if (!open || !account?.id) return
    let active = true
    setDetails(null); setDraft(null); setReason(''); setError(''); setErrors({}); setLoading(true)
    getAccountProfile(account.id).then((result) => {
      if (active) { setDetails(result); setDraft(formValues(result)) }
    }).catch((failure) => { if (active) setError(accountServiceError(failure)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, account?.id, attempt])
  const change = (scope, key, value) => {
    setDraft((previous) => ({ ...previous, [scope]: { ...previous[scope], [key]: value } }))
    setErrors({}); setError('')
  }
  const field = (scope, key, label, options = {}) => {
    const id = `${name}-${scope}-${key}`
    return <Field label={`${label}${options.required ? ' *' : ''}`} key={key} className={options.wide ? 'aa-span' : ''}>
      <Input id={id} value={draft[scope][key]} type={options.type || 'text'} maxLength={options.maxLength || 240}
        step={options.type === 'number' ? 'any' : undefined} required={options.required}
        onChange={(event) => change(scope, key, event.target.value)}
        aria-invalid={Boolean(errors[`${scope}.${key}`])}
        aria-describedby={errors[`${scope}.${key}`] ? `${id}-error` : undefined} />
      {errors[`${scope}.${key}`] && <small id={`${id}-error`} data-state="error">{errors[`${scope}.${key}`]}</small>}
    </Field>
  }
  const location = (scope) => <>
    <HospitalLocationMap position={asPoint(draft[scope].latitude, draft[scope].longitude)} editable disabled={busy}
      label={scope === 'facility' ? 'Edit facility location' : 'Edit donor location'}
      onChange={({ lat, lng }) => {
        setDraft((previous) => ({ ...previous, [scope]: { ...previous[scope], latitude: String(lat), longitude: String(lng) } }))
        setErrors({}); setError('')
      }} />
    <div className="aa-form-grid account-edit-coordinates">
      {field(scope, 'latitude', 'Latitude', { type: 'number' })}
      {field(scope, 'longitude', 'Longitude', { type: 'number' })}
    </div>
    <p className="muted account-edit-location-help">Use both coordinates, or leave both empty to remove the saved pin.</p>
  </>
  async function submit(event) {
    event.preventDefault()
    if (!details || !draft || busy) return
    const found = {}
    for (const [scope, source] of Object.entries(draft)) {
      if (!source) continue
      for (const key of scope === 'profile' ? ['fullName'] : ['name', 'address', 'contactNumber'])
        if (!source[key].trim()) found[`${scope}.${key}`] = 'This field is required.'
      if ('latitude' in source) {
        const lat = source.latitude.trim(), lng = source.longitude.trim()
        if (Boolean(lat) !== Boolean(lng) || (lat && (!Number.isFinite(Number(lat)) || Math.abs(Number(lat)) > 90)) ||
            (lng && (!Number.isFinite(Number(lng)) || Math.abs(Number(lng)) > 180)))
          found[`${scope}.latitude`] = found[`${scope}.longitude`] = 'Enter both coordinates within their valid ranges.'
      }
    }
    if (!reason.trim()) found.reason = 'Add a reason for this edit.'
    setErrors(found)
    if (Object.keys(found).length) {
      requestAnimationFrame(() => form.current?.querySelector('[aria-invalid="true"]')?.focus())
      return
    }
    setBusy(true); setError('')
    try {
      const result = await updateAccountProfile({ uid: details.uid, revision: details.revision,
        profile: payloadValues(draft.profile), facility: payloadValues(draft.facility), reason: reason.trim() })
      onSaved(result)
    } catch (failure) { setError(accountServiceError(failure)) }
    finally { setBusy(false) }
  }
  const dirty = details && draft && JSON.stringify(draft) !== JSON.stringify(formValues(details))
  return <AdminDialog name={name} open={open} busy={busy} title="Edit account details" onClose={onClose}
    className={cx('account-profile-editor', className)} {...rest}>
    <p className="aa-dialog-intro">Update saved details for {account?.fullName || account?.email || 'this account'}. Your changes and reason are recorded in the audit trail.</p>
    {loading && <p role="status">Loading current details…</p>}
    {error && <div ref={errorRef} className="account-edit-error" role="alert" tabIndex={-1}><p data-state="error">{error}</p>
      <Btn disabled={busy} onClick={() => setAttempt((value) => value + 1)}>Reload current details</Btn></div>}
    {draft && <form ref={form} noValidate onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend><span>01</span> {details.role === 'hospital' ? 'Account contact' : 'Donor details'}</legend>
        <div className="aa-form-grid">
          {field('profile', 'fullName', 'Name', { required: true, maxLength: 120 })}
          {field('profile', 'phoneNumber', 'Account phone', { type: 'tel', maxLength: 40 })}
          <Field label="Sign-in email"><Input value={details.email} readOnly aria-readonly="true" /></Field>
          {details.role === 'donor' && <>
            {field('profile', 'city', 'City', { maxLength: 120 })}
            <Field label="Blood type"><Select id={`${name}-blood-type`} value={draft.profile.bloodType}
              aria-label="Blood type"
              options={[{ value: '', label: 'Not set' }, ...['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((value) => ({ value, label: value }))]}
              onChange={(event) => change('profile', 'bloodType', event.target.value)} /></Field>
            {field('profile', 'dateOfBirth', 'Date of birth', { type: 'date' })}
          </>}
        </div>
      </fieldset>
      {draft.facility ? <fieldset disabled={busy}>
        <legend><span>02</span> Facility details</legend>
        <div className="aa-form-grid">
          {field('facility', 'name', 'Facility name', { required: true, maxLength: 160 })}
          {field('facility', 'contactNumber', 'Facility phone', { required: true, type: 'tel', maxLength: 40 })}
          {field('facility', 'address', 'Facility address', { required: true, wide: true })}
          {field('facility', 'city', 'City', { maxLength: 120 })}
        </div>
        {location('facility')}
      </fieldset> : <fieldset disabled={busy}><legend><span>02</span> Saved donor location</legend>{location('profile')}</fieldset>}
      <fieldset disabled={busy}>
        <Field label="Reason for this edit *"><Textarea id={`${name}-reason`} value={reason} maxLength={1500} required
          onChange={(event) => { setReason(event.target.value); setErrors({}) }}
          aria-invalid={Boolean(errors.reason)} aria-describedby={errors.reason ? `${name}-reason-error` : undefined} /></Field>
        {errors.reason && <small id={`${name}-reason-error`} data-state="error">{errors.reason}</small>}
      </fieldset>
      <footer className="aa-dialog-actions"><span>Changes are saved with an audit record. Hospital location changes apply to newly posted requests.</span>
        <Btn disabled={busy} onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" type="submit" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</Btn>
      </footer>
    </form>}
    {!draft && !loading && <div className="aa-dialog-actions"><Btn onClick={onClose}>Close</Btn></div>}
  </AdminDialog>
}
