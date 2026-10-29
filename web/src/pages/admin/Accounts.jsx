import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../../layout/AppShell'
import { useAuth } from '../../hooks/useAuth'
import { listUsers, removeUser, updateUserStatus } from '../../services/users'
import { accountServiceError, createHospitalAccount, deleteAuthAccount } from '../../services/accounts'
import { Btn, Card, Field, Input, Modal, PageHeader, Select } from '../../components'

/**
 * Admin account management (FR-040).
 *
 * Lists and inspects donor and hospital accounts, creates hospital accounts
 * through the `createHospitalAccount` callable, and suspends, restores or
 * removes an account. Every destructive action confirms first and records a
 * reason. Enforcement is server-side: `firestore.rules` (`accountActive()`)
 * closes every protected path for a Suspended or Removed profile, and
 * `pages/public/Blocked.jsx` explains it to the signed-in account.
 */

const EMPTY_HOSPITAL = {
  facilityName: '',
  address: '',
  contactNumber: '',
  city: '',
  latitude: '',
  longitude: '',
  email: '',
  password: '',
  fullName: '',
  hospitalId: '',
}

const STATUS_TONE = { Active: 'active', Suspended: 'inactive', Removed: 'emergency' }

function statusTone(status) {
  return STATUS_TONE[status] || 'inactive'
}

function dateLabel(value) {
  if (!value) return '—'
  const date = typeof value.toDate === 'function' ? value.toDate() : value
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function roleFilterLabel(role) {
  if (role === 'donor') return 'Donor'
  if (role === 'hospital') return 'Hospital'
  if (role === 'admin') return 'Admin'
  return '—'
}

/** What the confirmation modal is about to do. */
const CONFIRM_COPY = {
  suspend: {
    title: 'Suspend this account?',
    body: 'Every protected screen and every Firestore read or write closes for this account until it is restored. The profile stays in place.',
    confirm: 'Suspend account',
  },
  remove: {
    title: 'Remove this account?',
    body: 'The account is closed and cannot sign back in to Dugo+. Its profile stays on file for audit; use a deletion request if the personal data must be erased.',
    confirm: 'Remove account',
  },
  reactivate: {
    title: 'Restore this account?',
    body: 'The account regains access immediately on its next load. Its previous reason for suspension is cleared.',
    confirm: 'Restore account',
  },
}

export default function Accounts() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [busyId, setBusyId] = useState('')
  const [modal, setModal] = useState(null)
  const [reason, setReason] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [draft, setDraft] = useState(EMPTY_HOSPITAL)
  const [formErrors, setFormErrors] = useState({})
  const [creating, setCreating] = useState(false)
  const [createNote, setCreateNote] = useState('')
  const [createError, setCreateError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    listUsers()
      .then((list) =>
        setUsers(
          list.sort((a, b) => {
            const roleA = a.role ?? ''
            const roleB = b.role ?? ''
            if (roleA !== roleB) return roleA.localeCompare(roleB)
            return (a.fullName || a.email || '').localeCompare(b.fullName || b.email || '')
          }),
        ),
      )
      .catch(() => setError('Could not load accounts. Only an administrator can list them.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (statusFilter !== 'all' && (u.status || 'Active') !== statusFilter) return false
      if (!q) return true
      return (
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.id || '').toLowerCase().includes(q)
      )
    })
  }, [users, query, roleFilter, statusFilter])

  const counts = useMemo(() => {
    return users.reduce(
      (acc, u) => {
        const status = u.status || 'Active'
        acc[status] = (acc[status] || 0) + 1
        return acc
      },
      { Active: 0, Suspended: 0, Removed: 0 },
    )
  }, [users])

  const openConfirm = (kind, account) => {
    setReason('')
    setNote('')
    setError('')
    setModal({ kind, account })
  }

  const closeModal = () => {
    if (busyId) return
    setModal(null)
    setReason('')
  }

  const runAction = async () => {
    if (!modal?.account) return
    const target = modal.account
    const trimmed = reason.trim()

    if ((modal.kind === 'suspend' || modal.kind === 'remove') && !trimmed) {
      setError('Add a reason before closing an account.')
      return
    }

    setBusyId(target.id)
    setError('')
    setNote('')
    try {
      if (modal.kind === 'suspend') {
        await updateUserStatus(target.id, { status: 'Suspended', statusReason: trimmed })
        setNote(`Suspended ${target.fullName || target.email || 'the account'}.`)
      } else if (modal.kind === 'remove') {
        await removeUser(target.id, trimmed)
        setNote(`Removed ${target.fullName || target.email || 'the account'}.`)
      } else if (modal.kind === 'reactivate') {
        await updateUserStatus(target.id, { status: 'Active' })
        setNote(`Restored ${target.fullName || target.email || 'the account'}.`)
      }
      setModal(null)
      setReason('')
      await load()
    } catch (err) {
      setError(err?.message || 'Could not update this account.')
    } finally {
      setBusyId('')
    }
  }

  const runDeleteAuth = async (target) => {
    setBusyId(target.id)
    setError('')
    setNote('')
    try {
      await deleteAuthAccount(target.id)
      setNote('The sign-in record was deleted; the profile stays closed.')
      await load()
    } catch (err) {
      setError(accountServiceError(err))
    } finally {
      setBusyId('')
    }
  }

  const setDraftField = (key) => (event) => {
    setDraft((prev) => ({ ...prev, [key]: event.target.value }))
    if (formErrors[key]) setFormErrors((prev) => ({ ...prev, [key]: '' }))
    setCreateError('')
    setCreateNote('')
  }

  const submitCreate = async (event) => {
    event.preventDefault()
    const found = {}
    if (!draft.facilityName.trim()) found.facilityName = 'Name the facility.'
    if (!draft.address.trim()) found.address = 'Add the facility address.'
    if (!draft.contactNumber.trim()) found.contactNumber = 'Add a contact number.'
    if (!draft.fullName.trim()) found.fullName = 'Name the person who will sign in.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      found.email = 'Enter a valid email address.'
    }
    if (draft.password.length < 8) found.password = 'Use at least 8 characters.'
    const lat = draft.latitude === '' ? null : Number(draft.latitude)
    const lng = draft.longitude === '' ? null : Number(draft.longitude)
    if ((lat === null) !== (lng === null)) {
      found.coordinates = 'Give both coordinates, or neither.'
    } else if (lat !== null && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
      found.coordinates = 'Coordinates must be numbers.'
    }
    setFormErrors(found)
    if (Object.keys(found).length) return

    setCreating(true)
    setCreateError('')
    setCreateNote('')
    try {
      const result = await createHospitalAccount({
        email: draft.email.trim(),
        password: draft.password,
        fullName: draft.fullName.trim(),
        facilityName: draft.facilityName.trim(),
        address: draft.address.trim(),
        contactNumber: draft.contactNumber.trim(),
        city: draft.city.trim(),
        latitude: lat,
        longitude: lng,
        hospitalId: draft.hospitalId.trim() || undefined,
      })
      setDraft(EMPTY_HOSPITAL)
      setShowCreate(false)
      setCreateNote(
        `Hospital account created. Facility id ${result.hospitalId}; give the hospital its email and temporary password.`,
      )
      await load()
    } catch (err) {
      setCreateError(accountServiceError(err))
    } finally {
      setCreating(false)
    }
  }

  const editing = modal?.account
  const copy = modal ? CONFIRM_COPY[modal.kind] : null

  return (
    <AppShell>
      <PageHeader title="Accounts" />
      <div id="page-body">
        <Card>
          <header>
            <h2>Accounts</h2>
            <p className="muted">
              Donor and hospital accounts. Suspending or removing one closes it on the server, not just in
              this table.
            </p>
          </header>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
            <Field label="Search">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email, or ID"
              />
            </Field>
            <Field label="Role">
              <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="donor">Donor</option>
                <option value="hospital">Hospital</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Removed">Removed</option>
              </Select>
            </Field>
            <Btn onClick={load} disabled={loading}>
              Refresh
            </Btn>
          </div>

          <p className="muted" role="status">
            {counts.Active} active · {counts.Suspended} suspended · {counts.Removed} removed
          </p>

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
          {loading && <p className="muted">Loading accounts…</p>}
          {!loading && filtered.length === 0 && (
            <p className="muted">No accounts match this search.</p>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const status = u.status || 'Active'
                    const isSelf = user?.uid === u.id
                    const busy = busyId === u.id
                    return (
                      <tr key={u.id}>
                        <td>
                          <div>{u.fullName || '—'}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {u.id}
                          </div>
                        </td>
                        <td>{u.email || '—'}</td>
                        <td>{roleFilterLabel(u.role)}</td>
                        <td>
                          <span className="badge" data-status={statusTone(status)}>
                            {status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Btn onClick={() => setModal({ kind: 'details', account: u })}>View</Btn>
                            {status === 'Active' && !isSelf && u.role !== 'admin' && (
                              <>
                                <Btn
                                  onClick={() => openConfirm('suspend', u)}
                                  disabled={busy}
                                  variant="alert"
                                >
                                  Suspend
                                </Btn>
                                <Btn onClick={() => openConfirm('remove', u)} disabled={busy}>
                                  Remove
                                </Btn>
                              </>
                            )}
                            {status !== 'Active' && !isSelf && u.role !== 'admin' && (
                              <Btn onClick={() => openConfirm('reactivate', u)} disabled={busy}>
                                Restore
                              </Btn>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card style={{ marginTop: 16 }}>
          <header>
            <h2>Create a hospital account</h2>
            <p className="muted">
              Creates the sign-in account, its profile, the facility record and the hospital claim in one
              step. Needs the account service deployed or the <code>create:hospital</code> script.
            </p>
          </header>

          {createNote && (
            <p className="muted" role="status">
              {createNote}
            </p>
          )}
          {createError && (
            <p data-state="error" role="alert">
              {createError}
            </p>
          )}

          {!showCreate ? (
            <Btn variant="primary" onClick={() => setShowCreate(true)}>
              New hospital account
            </Btn>
          ) : (
            <form noValidate onSubmit={submitCreate}>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <Field label="Facility name">
                  <Input value={draft.facilityName} onChange={setDraftField('facilityName')} />
                  {formErrors.facilityName && <span data-state="error">{formErrors.facilityName}</span>}
                </Field>
                <Field label="Address">
                  <Input value={draft.address} onChange={setDraftField('address')} />
                  {formErrors.address && <span data-state="error">{formErrors.address}</span>}
                </Field>
                <Field label="Contact number">
                  <Input type="tel" value={draft.contactNumber} onChange={setDraftField('contactNumber')} />
                  {formErrors.contactNumber && <span data-state="error">{formErrors.contactNumber}</span>}
                </Field>
                <Field label="City">
                  <Input value={draft.city} onChange={setDraftField('city')} />
                </Field>
                <Field label="Latitude (optional)">
                  <Input type="number" step="any" value={draft.latitude} onChange={setDraftField('latitude')} />
                </Field>
                <Field label="Longitude (optional)">
                  <Input type="number" step="any" value={draft.longitude} onChange={setDraftField('longitude')} />
                </Field>
                {formErrors.coordinates && (
                  <p data-state="error" role="alert">
                    {formErrors.coordinates}
                  </p>
                )}
                <Field label="Sign-in email">
                  <Input type="email" autoComplete="off" value={draft.email} onChange={setDraftField('email')} />
                  {formErrors.email && <span data-state="error">{formErrors.email}</span>}
                </Field>
                <Field label="Temporary password">
                  <Input
                    type="text"
                    autoComplete="new-password"
                    value={draft.password}
                    onChange={setDraftField('password')}
                  />
                  {formErrors.password && <span data-state="error">{formErrors.password}</span>}
                </Field>
                <Field label="Contact person">
                  <Input value={draft.fullName} onChange={setDraftField('fullName')} />
                  {formErrors.fullName && <span data-state="error">{formErrors.fullName}</span>}
                </Field>
                <Field label="Facility id (optional)">
                  <Input
                    value={draft.hospitalId}
                    onChange={setDraftField('hospitalId')}
                    placeholder="auto from the name"
                  />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Btn variant="primary" type="submit" disabled={creating}>
                  {creating ? 'Creating…' : 'Create account'}
                </Btn>
                <Btn
                  onClick={() => {
                    setShowCreate(false)
                    setDraft(EMPTY_HOSPITAL)
                    setFormErrors({})
                    setCreateError('')
                  }}
                  disabled={creating}
                >
                  Cancel
                </Btn>
              </div>
            </form>
          )}
        </Card>
      </div>

      <Modal
        name="account-details"
        open={modal?.kind === 'details'}
        onClose={() => setModal(null)}
        title={editing?.fullName || editing?.email || 'Account'}
      >
        {editing && (
          <div>
            <dl className="admin-profile-facts">
              <div>
                <dt>Account id</dt>
                <dd>{editing.id}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{roleFilterLabel(editing.role)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className="badge" data-status={statusTone(editing.status)}>
                    {editing.status || 'Active'}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{editing.email || '—'}</dd>
              </div>
              <div>
                <dt>Privacy consent</dt>
                <dd>
                  {editing.privacyConsentAt
                    ? `${dateLabel(editing.privacyConsentAt)} · v${editing.privacyNoticeVersion}`
                    : 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{editing.phoneNumber || '—'}</dd>
              </div>
              <div>
                <dt>City</dt>
                <dd>{editing.city || '—'}</dd>
              </div>
              <div>
                <dt>Blood type</dt>
                <dd>{editing.bloodType || '—'}</dd>
              </div>
              <div>
                <dt>Hospital</dt>
                <dd>{editing.hospitalId || '—'}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{dateLabel(editing.updatedAt)}</dd>
              </div>
            </dl>

            {editing.status !== 'Active' && editing.statusReason && (
              <p className="muted">
                Reason on file: {editing.statusReason} ({dateLabel(editing.statusUpdatedAt)})
              </p>
            )}

            {editing.status === 'Removed' && (
              <div style={{ marginTop: 12 }}>
                <p className="muted">
                  The profile is closed. Deleting the sign-in record removes the ability to sign in; the
                  profile stays for audit.
                </p>
                <Btn
                  variant="alert"
                  onClick={() => runDeleteAuth(editing)}
                  disabled={busyId === editing.id}
                >
                  {busyId === editing.id ? 'Deleting…' : 'Delete sign-in record'}
                </Btn>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        name="account-confirm"
        open={Boolean(copy)}
        onClose={closeModal}
        title={copy?.title ?? ''}
      >
        {copy && editing && (
          <div>
            <p className="muted">{copy.body}</p>
            <p className="muted">
              Account: <strong>{editing.fullName || editing.email || editing.id}</strong>
            </p>

            {(modal.kind === 'suspend' || modal.kind === 'remove') && (
              <Field label="Reason (shown to the account)">
                <Input
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    setError('')
                  }}
                  placeholder="e.g. Duplicate account confirmed by the facility"
                  autoFocus
                />
              </Field>
            )}

            {error && (
              <p data-state="error" role="alert">
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Btn
                variant={modal.kind === 'reactivate' ? 'primary' : 'alert'}
                onClick={runAction}
                disabled={Boolean(busyId)}
              >
                {busyId ? 'Working…' : copy.confirm}
              </Btn>
              <Btn onClick={closeModal} disabled={Boolean(busyId)}>
                Cancel
              </Btn>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  )
}
