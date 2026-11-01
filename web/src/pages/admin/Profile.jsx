import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../../layout/AppShell'
import { useAuth } from '../../hooks/useAuth'
import { readProfile, saveProfile, roleLabel } from '../../services/users'
import { updateDisplayName } from '../../services/auth'
import { Btn, Card, Field, Input, PageHeader } from '../../components'

/** The editable part of the page's state, from a profile read. */
function formFrom(profile) {
  return {
    fullName: profile?.fullName ?? '',
    phoneNumber: profile?.phoneNumber ?? '',
  }
}

/** The tone a status badge should wear; both are defined in the shared sheet. */
function statusTone(status) {
  return status === 'Active' ? 'active' : 'inactive'
}

/** A readable date for the last profile write, or a dashed placeholder. */
function updatedLabel(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(value)
}

/**
 * Admin profile — `/admin/profile` (FR-047).
 *
 * The signed-in administrator's own account: name and phone are editable, the
 * rest is read-only because email, account type and status are managed outside
 * this screen (the account type lives in `users.role` and custom claims, the
 * status is an admin action on `/admin/accounts`, D26).
 *
 * Reads `users/{uid}` directly rather than trusting the session context, so a
 * save here shows the stored values immediately and a suspended account cannot
 * reach the screen at all (`layout/RequireAuth.jsx`).
 */
export default function Profile() {
  const { user, role, reloadUser } = useAuth()

  const [source, setSource] = useState(null)
  const [form, setForm] = useState(formFrom(null))
  const [saved, setSaved] = useState(formFrom(null))
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    if (!user?.uid) return undefined
    let current = true
    setLoading(true)
    setLoadFailed(false)
    readProfile(user.uid)
      .then((found) => {
        if (!current) return
        const next = formFrom(found)
        setSource(found)
        setForm(next)
        setSaved(next)
        setLoading(false)
      })
      .catch(() => {
        if (!current) return
        setLoadFailed(true)
        setLoading(false)
      })
    return () => {
      current = false
    }
  }

  useEffect(load, [user?.uid])

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved])

  const set = (key) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }))
    setMessage('')
    setNote('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!source || loadFailed) return
    const found = {}
    if (!form.fullName.trim()) found.fullName = 'Enter the name your team should see.'
    setErrors(found)
    setMessage('')
    setNote('')
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      const next = {
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
      }
      await saveProfile(user.uid, next)
      // The shell greets the admin by their Firebase display name, so keep the
      // two in step; a failure here leaves the stored profile intact.
      if (next.fullName !== (user.displayName ?? '')) {
        await updateDisplayName(next.fullName)
          .then(() => reloadUser())
          .catch(() => {})
      }
      setForm(next)
      setSaved(next)
      // The read only refreshes on mount, so carry the write time into the
      // facts card; a reload shows the server's own timestamp.
      setSource((prev) => ({ ...prev, ...next, updatedAt: new Date() }))
      setNote('Profile saved.')
    } catch {
      setMessage('Your profile could not be saved. Check your connection and try again.')
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
    <AppShell>
      <PageHeader title="My profile" />
      <div id="page-body">
        <div className="admin-profile">
          <Card as="form" noValidate onSubmit={submit} aria-busy={busy || loading}>
            <header>
              <h2>Your details</h2>
              <p className="muted">
                This name and number appear beside your admin actions. Your sign-in email is not
                editable here.
              </p>
            </header>

            {loading && <p className="muted">Loading your profile…</p>}
            {loadFailed && (
              <div role="alert">
                <p data-state="error">
                  Your profile could not be loaded, so saving now would overwrite it with what is on
                  screen.
                </p>
                <Btn onClick={load}>Try again</Btn>
              </div>
            )}

            <Field label="Full name">
              <Input
                autoComplete="name"
                type="text"
                value={form.fullName}
                disabled={loading || loadFailed || busy}
                aria-invalid={Boolean(errors.fullName) || undefined}
                aria-describedby={errors.fullName ? 'admin-profile-name-error' : undefined}
                onChange={set('fullName')}
              />
              {errors.fullName && (
                <span id="admin-profile-name-error" data-state="error">
                  {errors.fullName}
                </span>
              )}
            </Field>

            <Field label="Phone">
              <Input
                autoComplete="tel"
                placeholder="0917 000 0000"
                type="tel"
                value={form.phoneNumber}
                disabled={loading || loadFailed || busy}
                onChange={set('phoneNumber')}
              />
            </Field>

            <Field label="Sign-in email">
              <Input type="email" value={user?.email ?? ''} readOnly disabled />
            </Field>

            {message && (
              <p data-state="error" role="alert">
                {message}
              </p>
            )}
            {note && (
              <p className="muted" role="status">
                {note}
              </p>
            )}

            <div className="admin-profile-actions">
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
          </Card>

          <Card as="aside" aria-label="Account facts">
            <header>
              <h2>Account</h2>
              <p className="muted">Managed by Dugo+; contact support to change these.</p>
            </header>
            {loading ? (
              <p className="muted">Loading…</p>
            ) : loadFailed ? (
              <p className="muted">Unavailable until the profile loads.</p>
            ) : (
              <dl className="admin-profile-facts">
                <div>
                  <dt>Account type</dt>
                  <dd>{roleLabel(role) || 'Administrator'}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className="badge" data-status={statusTone(source?.status)}>
                      {source?.status ?? 'Active'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Email verified</dt>
                  <dd>{user?.emailVerified ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>{updatedLabel(source?.updatedAt)}</dd>
                </div>
              </dl>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
