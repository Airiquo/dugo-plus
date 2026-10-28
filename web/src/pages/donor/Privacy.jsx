import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { createDataRequest, listMyDataRequests } from '../../services/dataRequests'
import { Card, Field, PageHeader, Select, Btn } from '../../components'

/**
 * Donor privacy / data requests (FR-039/NFR-19).
 *
 * Submit access/correction/erasure/export requests; view status/history.
 */
export default function Privacy() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [type, setType] = useState('Access')

  const load = () => {
    if (!user?.uid) return
    setLoading(true)
    listMyDataRequests(user.uid)
      .then(setRequests)
      .catch(() => setError('Could not load requests.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [user?.uid])

  const submit = async (e) => {
    e.preventDefault()
    if (!user?.uid) return
    setBusy(true)
    setError('')
    setNote('')
    try {
      await createDataRequest(user.uid, type)
      setNote('Request submitted.')
      load()
    } catch {
      setError('Could not submit request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px' }}>
      <PageHeader title="Privacy & Data Requests" />
      <Card as="form" noValidate onSubmit={submit}>
        <header>
          <h2>Submit a request</h2>
          <p className="muted">Request access, correction, erasure, or export of your personal data (RA 10173).</p>
        </header>
        <Field label="Request type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="Access">Access</option>
            <option value="Rectification">Rectification</option>
            <option value="Erasure">Erasure</option>
            <option value="Export">Export</option>
          </Select>
        </Field>
        {error && <p data-state="error" role="alert">{error}</p>}
        {note && <p className="muted" role="status">{note}</p>}
        <Btn variant="primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</Btn>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <header>
          <h2>Your requests</h2>
        </header>
        {loading && <p className="muted">Loading…</p>}
        {!loading && requests.length === 0 && <p className="muted">No requests yet.</p>}
        {!loading && requests.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Resolved</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.requestType}</td>
                    <td>{r.status}</td>
                    <td>{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : '—'}</td>
                    <td>{r.resolvedAt?.toDate ? r.resolvedAt.toDate().toLocaleString() : r.resolvedAt ? 'Yes' : '—'}</td>
                    <td>{r.adminNote || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
