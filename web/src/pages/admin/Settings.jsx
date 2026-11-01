import { useEffect, useState } from 'react'
import { AppShell } from '../../layout/AppShell'
import { useAuth } from '../../hooks/useAuth'
import {
  CONFIG_LIMITS,
  DEFAULT_CONFIG,
  readSystemConfig,
  saveSystemConfig,
  validateConfig,
} from '../../services/systemConfig'
import { Btn, Card, Field, Input, PageHeader } from '../../components'

/**
 * Admin system settings — the F9 half of FR-041.
 *
 * Edits `systemConfig/global`: the notification retry parameters and the
 * tiered search radius the matcher walks. The bounds live in
 * `services/systemConfig.js` and in `firestore.rules`, so the same values are
 * refused whether they arrive from this form or a hand-written client.
 */

function toDraft(config) {
  return {
    notifRetryLimit: String(config.notifRetryLimit),
    notifRetryInterval: String(config.notifRetryInterval),
    radiusTiers: config.radiusTiers.map((tier) => ({
      radiusKm: String(tier.radiusKm),
      waitMinutes: String(tier.waitMinutes),
    })),
  }
}

function fromDraft(draft) {
  return {
    notifRetryLimit: draft.notifRetryLimit,
    notifRetryInterval: draft.notifRetryInterval,
    radiusTiers: draft.radiusTiers.map((tier) => ({
      radiusKm: tier.radiusKm,
      waitMinutes: tier.waitMinutes,
    })),
  }
}

function dateLabel(value) {
  if (!value) return 'never'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export default function Settings() {
  const { user } = useAuth()
  const [source, setSource] = useState(DEFAULT_CONFIG)
  const [draft, setDraft] = useState(toDraft(DEFAULT_CONFIG))
  const [saved, setSaved] = useState(toDraft(DEFAULT_CONFIG))
  const [updatedBy, setUpdatedBy] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState([])
  const [note, setNote] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    readSystemConfig()
      .then((config) => {
        const next = toDraft(config)
        setSource(config)
        setDraft(next)
        setSaved(next)
        setUpdatedBy(config.updatedBy || '')
        setUpdatedAt(config.updatedAt || null)
      })
      .catch(() => setError('Could not load settings. Check your connection and your admin role.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const dirty = !same(draft, saved)

  const setNumber = (key) => (event) => {
    setDraft((prev) => ({ ...prev, [key]: event.target.value }))
    setNote('')
    setErrors([])
    setError('')
  }

  const setTier = (index, key) => (event) => {
    setDraft((prev) => ({
      ...prev,
      radiusTiers: prev.radiusTiers.map((tier, i) =>
        i === index ? { ...tier, [key]: event.target.value } : tier,
      ),
    }))
    setNote('')
    setErrors([])
    setError('')
  }

  const addTier = () => {
    setDraft((prev) => {
      const last = prev.radiusTiers[prev.radiusTiers.length - 1]
      const radiusKm = last ? Number(last.radiusKm) + 5 : 5
      const waitMinutes = last ? Number(last.waitMinutes) + 5 : 10
      return {
        ...prev,
        radiusTiers: [
          ...prev.radiusTiers,
          { radiusKm: String(radiusKm), waitMinutes: String(waitMinutes) },
        ],
      }
    })
    setNote('')
    setErrors([])
  }

  const removeTier = (index) => {
    setDraft((prev) => ({
      ...prev,
      radiusTiers: prev.radiusTiers.filter((_, i) => i !== index),
    }))
    setNote('')
    setErrors([])
  }

  const reset = () => {
    const next = toDraft(DEFAULT_CONFIG)
    setDraft(next)
    setErrors([])
    setError('')
    setNote('Defaults loaded. Save to apply them.')
  }

  const save = async (event) => {
    event.preventDefault()
    setError('')
    setNote('')
    const checked = validateConfig(fromDraft(draft))
    if (!checked.ok) {
      setErrors(checked.errors)
      return
    }
    setErrors([])
    setBusy(true)
    try {
      await saveSystemConfig(checked.config, user?.uid)
      setNote('Settings saved.')
      load()
    } catch (err) {
      setError(err?.message || 'Could not save settings.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell>
      <PageHeader title="Settings" />
      <div id="page-body">
        <Card as="form" noValidate onSubmit={save} aria-busy={loading || busy}>
          <header>
            <h2>System configuration</h2>
            <p className="muted">
              Notification retries and the tiered search radius, stored in <code>systemConfig/global</code>.
              The P5 matching service and notification worker are its readers.
            </p>
          </header>

          {loading && <p className="muted">Loading settings…</p>}
          {error && (
            <p data-state="error" role="alert">
              {error}
            </p>
          )}
          {note && (
            <p className="muted" role="status">
              {note}
            </p>
          )}

          {!loading && (
            <>
              <h3>Notification retry</h3>
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                }}
              >
                <Field label="Retry limit">
                  <Input
                    type="number"
                    min={CONFIG_LIMITS.retryLimit.min}
                    max={CONFIG_LIMITS.retryLimit.max}
                    step="1"
                    value={draft.notifRetryLimit}
                    onChange={setNumber('notifRetryLimit')}
                    disabled={busy}
                  />
                </Field>
                <Field label="Retry interval (minutes)">
                  <Input
                    type="number"
                    min={CONFIG_LIMITS.retryInterval.min}
                    max={CONFIG_LIMITS.retryInterval.max}
                    step="1"
                    value={draft.notifRetryInterval}
                    onChange={setNumber('notifRetryInterval')}
                    disabled={busy}
                  />
                </Field>
              </div>

              <h3 style={{ marginTop: 20 }}>Radius tiers</h3>
              <p className="muted">
                The matching service searches the first tier, waits, then expands to the next. Each radius
                must be larger than the one before it. Between {CONFIG_LIMITS.tiers.min} and{' '}
                {CONFIG_LIMITS.tiers.max} tiers.
              </p>

              <div style={{ display: 'grid', gap: 8 }}>
                {draft.radiusTiers.map((tier, index) => (
                  <div
                    key={`tier-${index}`}
                    style={{
                      display: 'grid',
                      gap: 12,
                      gridTemplateColumns: 'auto repeat(2, minmax(140px, 1fr)) auto',
                      alignItems: 'end',
                    }}
                  >
                    <span className="muted" style={{ paddingBottom: 8 }}>
                      Tier {index + 1}
                    </span>
                    <Field label={`Radius ${index + 1} (km)`}>
                      <Input
                        type="number"
                        min={CONFIG_LIMITS.radiusKm.min}
                        max={CONFIG_LIMITS.radiusKm.max}
                        step="any"
                        value={tier.radiusKm}
                        onChange={setTier(index, 'radiusKm')}
                        disabled={busy}
                      />
                    </Field>
                    <Field label={`Wait ${index + 1} (minutes)`}>
                      <Input
                        type="number"
                        min={CONFIG_LIMITS.waitMinutes.min}
                        max={CONFIG_LIMITS.waitMinutes.max}
                        step="1"
                        value={tier.waitMinutes}
                        onChange={setTier(index, 'waitMinutes')}
                        disabled={busy}
                      />
                    </Field>
                    <Btn
                      onClick={() => removeTier(index)}
                      disabled={busy || draft.radiusTiers.length <= CONFIG_LIMITS.tiers.min}
                    >
                      Remove
                    </Btn>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Btn
                  onClick={addTier}
                  disabled={busy || draft.radiusTiers.length >= CONFIG_LIMITS.tiers.max}
                >
                  Add tier
                </Btn>
                <Btn onClick={reset} disabled={busy}>
                  Load defaults
                </Btn>
              </div>

              {errors.length > 0 && (
                <div data-state="error" role="alert" style={{ marginTop: 12 }}>
                  <p>Fix these before saving:</p>
                  <ul>
                    {errors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
                <Btn variant="primary" type="submit" disabled={busy || !dirty}>
                  {busy ? 'Saving…' : 'Save changes'}
                </Btn>
                <Btn onClick={load} disabled={busy}>
                  Reload
                </Btn>
                <span className="muted" aria-live="polite">
                  {dirty ? 'Unsaved changes' : 'No changes to save'}
                </span>
              </div>

              <p className="muted" style={{ marginTop: 12 }}>
                Last saved{' '}
                {updatedBy ? (
                  <>
                    by <strong>{updatedBy}</strong> on {dateLabel(updatedAt)}
                  </>
                ) : (
                  'never; the defaults above are in use'
                )}
                . Seed values: {source.radiusTiers.map((t) => `${t.radiusKm} km`).join(' → ')}.
              </p>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
