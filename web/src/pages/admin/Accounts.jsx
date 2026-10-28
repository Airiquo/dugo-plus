import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../../layout/AppShell'
import { useAuth } from '../../hooks/useAuth'
import { listUsers, updateUserStatus } from '../../services/users'
import { Btn, Card, Field, Input, PageHeader, Select } from '../../components'

/**
 * Admin account management (FR-040).
 *
 * Lists accounts, filters by role/status, and suspends/reactivates with a reason.
 * Suspension is enforced by `firestore.rules` (`accountActive()`) and surfaces on
 * `pages/public/Blocked.jsx` (D26).
 */
export default function Accounts() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [busyId, setBusyId] = useState('')
  const [reason, setReason] = useState({})

  const load = () => {
    setLoading(true)
    setError('')
    listUsers()
      .then((list) => setUsers(list))
      .catch(() => setError('Could not load accounts.'))
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

  const suspend = async (target) => {
    if (!target?.id) return
    const r = (reason[target.id] || '').trim()
    if (!r) {
      setError('Add a reason before suspending an account.')
      return
    }
    setBusyId(target.id)
    setError('')
    try {
      await updateUserStatus(target.id, { status: 'Suspended', statusReason: r })
      setReason((prev) => ({ ...prev, [target.id]: '' }))
      await load()
    } catch {
      setError('Could not update this account.')
    } finally {
      setBusyId('')
    }
  }

  const reactivate = async (target) => {
    if (!target?.id) return
    setBusyId(target.id)
    setError('')
    try {
      await updateUserStatus(target.id, { status: 'Active', statusReason: '' })
      await load()
    } catch {
      setError('Could not update this account.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <AppShell>
      <PageHeader title="Accounts" />
      <div id="page-body">
        <Card>
          <header>
            <h2>Account management</h2>
            <p className="muted">Suspend or reactivate donor and hospital accounts. Admin accounts are managed by the team.</p>
          </header>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
            <Field label="Search">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email, or ID" />
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
            <Btn onClick={load} disabled={loading}>Refresh</Btn>
          </div>

          {error && <p data-state="error" role="alert">{error}</p>}
          {loading && <p className="muted">Loading accounts…</p>}
          {!loading && filtered.length === 0 && <p className="muted">No accounts match.</p>}

          {!loading && filtered.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Reason</th>
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
                          <div className="muted" style={{ fontSize: 12 }}>{u.id}</div>
                        </td>
                        <td>{u.email || '—'}</td>
                        <td>{u.role || '—'}</td>
                        <td>
                          <span className="badge" data-status={status === 'Active' ? 'active' : 'inactive'}>{status}</span>
                        </td>
                        <td style={{ maxWidth: 240 }}>
                          {status === 'Suspended' && u.statusReason ? (
                            <span title={u.statusReason}>{u.statusReason.length > 60 ? u.statusReason.slice(0, 57) + '…' : u.statusReason}</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          {status === 'Active' && u.role !== 'admin' && !isSelf ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Input
                                placeholder="Reason to suspend"
                                value={reason[u.id] || ''}
                                onChange={(e) => setReason((prev) => ({ ...prev, [u.id]: e.target.value }))}
                                style={{ minWidth: 200 }}
                              />
                              <Btn variant="primary" onClick={() => suspend(u)} disabled={busy}>{busy ? 'Saving…' : 'Suspend'}</Btn>
                            </div>
                          ) : status === 'Suspended' ? (
                            <Btn onClick={() => reactivate(u)} disabled={busy || isSelf}>{busy ? 'Saving…' : 'Reactivate'}</Btn>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
