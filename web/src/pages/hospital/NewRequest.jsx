/**
 * Post a blood request — `/hospital/requests/new` (FR-011, FR-017, FR-021 form
 * half).
 *
 * Collects the schema §2.4 fields a facility knows at posting time and stamps
 * the facility's denormalized name/coordinates. After the document exists,
 * `triggerMatch` asks the F7 Worker to match immediately; when the endpoint is
 * unset or the call fails, the Worker's cron fallback picks the request up, so
 * the post still succeeds.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Field, FieldError, Input, LinkBtn, PageHeader, Select } from '../../components'
import { HospitalShell } from '../../layout/HospitalShell'
import { useAuth } from '../../hooks/useAuth'
import {
  COMPONENTS,
  REQUEST_PRIORITIES,
  createRequest,
  fetchHospital,
} from '../../services/requests'
import { isMatchingConfigured, triggerMatch } from '../../services/matching'
import { validateRequest } from '../../utils/validate'

const BLOOD_TYPE_OPTIONS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((value) => ({
  value,
  label: value,
}))

const COMPONENT_OPTIONS = COMPONENTS.map(({ value, label }) => ({ value, label }))

const PRIORITY_OPTIONS = REQUEST_PRIORITIES.map((value) => ({
  value,
  label: value === 'stat' ? 'Stat (within the hour)' : value,
}))

const EMPTY = { bloodType: '', component: '', quantity: '', urgencyLevel: '' }

export default function NewRequest() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const hospitalId = profile?.hospitalId ?? ''

  const [hospital, setHospital] = useState(null)
  const [facilityChecked, setFacilityChecked] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!hospitalId) {
      setFacilityChecked(true)
      return
    }
    let current = true
    fetchHospital(hospitalId)
      .then((found) => {
        if (!current) return
        setHospital(found)
        setFacilityChecked(true)
      })
      .catch(() => {
        if (current) setFacilityChecked(true)
      })
    return () => {
      current = false
    }
  }, [hospitalId])

  const linked = Boolean(hospitalId)
  const ready = facilityChecked && Boolean(hospital)

  const set = (key) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }))
    setMessage('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!ready || busy) return
    const found = validateRequest(form)
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    setMessage('')
    let requestId
    try {
      requestId = await createRequest({ hospital, values: form, createdBy: user?.uid ?? null })
    } catch (err) {
      setMessage(err?.message || 'The request could not be posted. Check your connection and try again.')
      setBusy(false)
      return
    }
    // Ask the Worker to match now; a failure here is not the post failing — the
    // cron fallback retries, so the request still goes through.
    try {
      await triggerMatch(requestId)
    } catch {
      /* best-effort: the Worker's scheduled run picks the request up */
    }
    navigate('/hospital/requests')
  }

  return (
    <HospitalShell facility={hospital?.name}>
      <PageHeader
        tag="Dugo+ hospital"
        title="New request"
        actions={<LinkBtn to="/hospital/requests">Back to requests</LinkBtn>}
      />

      {!linked ? (
        <section className="card">
          <p className="hospital-state" data-kind="warn" role="status">
            This account is not linked to a facility yet, so it cannot post requests. Ask an
            administrator to set your hospital, then reload.
          </p>
        </section>
      ) : facilityChecked && !hospital ? (
        <section className="card">
          <p className="hospital-state" data-kind="warn" role="status">
            Your facility record could not be found. Check that it exists, then reload.
          </p>
        </section>
      ) : (
        <form className="card hospital-form" noValidate onSubmit={submit}>
          <p className="hospital-note">
            {hospital
              ? `Posting for ${hospital.name}. Requests are routed to compatible donors near the facility.`
              : 'Loading your facility…'}
          </p>

          {!isMatchingConfigured() && (
            <p className="hospital-state" data-kind="warn" role="status">
              Immediate matching is offline (the Worker endpoint is not configured). The request
              will still be posted and picked up by the scheduled matching run.
            </p>
          )}

          <Field label="Blood type">
            <Select
              options={[{ value: '', label: 'Choose a type' }, ...BLOOD_TYPE_OPTIONS]}
              value={form.bloodType}
              aria-invalid={Boolean(errors.bloodType) || undefined}
              aria-describedby={errors.bloodType ? 'req-blood-error' : undefined}
              onChange={set('bloodType')}
            />
            <FieldError id="req-blood-error">{errors.bloodType}</FieldError>
          </Field>

          <Field label="Component">
            <Select
              options={[{ value: '', label: 'Choose a component' }, ...COMPONENT_OPTIONS]}
              value={form.component}
              aria-invalid={Boolean(errors.component) || undefined}
              aria-describedby={errors.component ? 'req-component-error' : undefined}
              onChange={set('component')}
            />
            <FieldError id="req-component-error">{errors.component}</FieldError>
          </Field>

          <Field label="Units needed">
            <Input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="e.g. 4"
              value={form.quantity}
              aria-invalid={Boolean(errors.quantity) || undefined}
              aria-describedby={errors.quantity ? 'req-quantity-error' : undefined}
              onChange={set('quantity')}
            />
            <FieldError id="req-quantity-error">{errors.quantity}</FieldError>
          </Field>

          <Field label="Urgency">
            <Select
              options={[{ value: '', label: 'Choose urgency' }, ...PRIORITY_OPTIONS]}
              value={form.urgencyLevel}
              aria-invalid={Boolean(errors.urgencyLevel) || undefined}
              aria-describedby={errors.urgencyLevel ? 'req-urgency-error' : undefined}
              onChange={set('urgencyLevel')}
            />
            <FieldError id="req-urgency-error">{errors.urgencyLevel}</FieldError>
          </Field>

          {message && (
            <p className="hospital-state" data-kind="error" role="alert">
              {message}
            </p>
          )}

          <div className="hospital-form-actions">
            <Btn variant="primary" type="submit" disabled={busy || !ready}>
              {busy ? 'Posting…' : 'Post request'}
            </Btn>
          </div>
        </form>
      )}
    </HospitalShell>
  )
}
