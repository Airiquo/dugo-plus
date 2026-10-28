import { useEffect, useState } from 'react'
import { AppShell } from '../../layout/AppShell'
import { useAuth } from '../../hooks/useAuth'
import { listAllDataRequests, updateDataRequest } from '../../services/dataRequests'
import { Btn, Card, Input, PageHeader, Select } from '../../components'

/**
 * Admin data-subject request queue (FR-039/NFR-19).
 *
 * Move requests between Pending/InProgress/Completed/Rejected, record `processedBy`,
 * `resolvedAt`, and an admin note.
 */
export default function DataRequests() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [notes, setNotes] = useState({})

  const load = () => {
    setLoading(true)
    setError('')
    listAllDataRequests()
      .then((list) => setRequests(list.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0
        return tb - ta
      })))
      .catch(() => setError('Could not load data requests.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const update = async (req, status) => {
    if (!req?.id) return
    setBusyId(req.id)
    setError('')
    try {
      const changes = {
        status,
        processedBy: user?.uid || null,
        adminNote: notes[req.id] ?? req.adminNote ?? '',
      }
      if (status === 'Completed' || status === 'Rejected') {
        changes.resolvedAt = new Date()
      } else if (status === 'InProgress') {
        changes.resolvedAt = null
      }
      await updateDataRequest(req.id, changes)
      await load()
    } catch {
      setError('Could not update request.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <AppShell>
      <PageHeader title="Data Requests" />
      <div id="page-body">
        <Card>
          <header>
            <h2>Data subject requests</h2>
            <p className="muted">Review access/correction/erasure/export requests and record actions taken (D26).</p>
          </header>

          {error && <p data-state="error" role="alert">{error}</p>}
          {loading && <p className="muted">Loading requests…</p>}
          {!loading && requests.length === 0 && <p className="muted">No requests.</p>}

          {!loading && requests.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>User</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Admin note</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const busy = busyId === req.id
                    return (
                      <tr key={req.id}>
                        <td>
                          <div>{req.id}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString() : '—'}
                          </div>
                        </td>
                        <td>{req.userId || '—'}</td>
                        <td>{req.requestType || '—'}</td>
                        <td>{req.status || 'Pending'}</td>
                        <td style={{ minWidth: 220 }}>
                          <Input
                            placeholder="Add note (export/erasure details)"
                            value={notes[req.id] ?? req.adminNote ?? ''}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Btn onClick={() => update(req, 'InProgress')} disabled={busy || req.status === 'InProgress'}>In Progress</Btn>
                            <Btn onClick={() => update(req, 'Completed')} disabled={busy} variant="primary">Complete</Btn>
                            <Btn onClick={() => update(req, 'Rejected')} disabled={busy}>Reject</Btn>
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
      </div>
    </AppShell>
  )
}
