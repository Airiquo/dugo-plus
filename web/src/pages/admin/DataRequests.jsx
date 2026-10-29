import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../../layout/AppShell'
import { useAuth } from '../../hooks/useAuth'
import { listUsers, anonymiseUser, correctUserProfile } from '../../services/users'
import { collectUserData, downloadUserData } from '../../services/dataExport'
import {
  defaultResolutionAction,
  listAllDataRequests,
  requestStatusLabel,
  requestTypeLabel,
  updateDataRequest,
} from '../../services/dataRequests'
import { Btn, Card, Field, Input, Modal, PageHeader, Select, Textarea } from '../../components'

/**
 * Admin data-subject request queue (FR-039/NFR-19).
 *
 * Each request opens into the work it needs: an access/export copy assembled
 * from the subject's own records, a correction applied to the profile, or an
 * erasure that scrubs the profile and closes the account. The administrator
 * records the action and a note, and the request closes with a server time.
 */

function dateLabel(value) {
  if (!value) return '—'
  const date = typeof value.toDate === 'function' ? value.toDate() : value
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const STATUS_OPTIONS = ['Pending', 'InProgress', 'Completed', 'Rejected']

export default function DataRequests() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [activeId, setActiveId] = useState('')
  const [working, setWorking] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [resolution, setResolution] = useState('')
  const [correction, setCorrection] = useState({ fullName: '', phoneNumber: '', city: '' })
  const [confirmErase, setConfirmErase] = useState(false)

  const load = () => {
    setLoading(true)
    setError('')
    Promise.all([listAllDataRequests(), listUsers().catch(() => [])])
      .then(([list, people]) => {
        setRequests(list)
        setAccounts(people)
      })
      .catch(() => setError('Could not load data requests. Only an administrator can read the queue.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const byId = useMemo(() => {
    const map = new Map()
    accounts.forEach((a) => map.set(a.id, a))
    return map
  }, [accounts])

  const active = requests.find((r) => r.id === activeId) || null
  const subject = active ? byId.get(active.userId) : null

  const open = (request) => {
    setActiveId(request.id)
    setAdminNote(request.adminNote || '')
    setResolution(request.resolutionAction || defaultResolutionAction(request.requestType))
    setCorrection({
      fullName: byId.get(request.userId)?.fullName || '',
      phoneNumber: byId.get(request.userId)?.phoneNumber || '',
      city: byId.get(request.userId)?.city || '',
    })
    setConfirmErase(false)
    setError('')
    setNote('')
  }

  const close = () => {
    if (working) return
    setActiveId('')
    setConfirmErase(false)
  }

  const move = async (status, action = resolution, extraNote = '') => {
    if (!active) return
    setWorking(status)
    setError('')
    setNote('')
    try {
      const joined = [adminNote.trim(), extraNote.trim()].filter(Boolean).join(' ')
      await updateDataRequest(active.id, {
        status,
        processedBy: user?.uid,
        adminNote: joined,
        resolutionAction: action,
      })
      setAdminNote(joined)
      setResolution(action)
      setNote(`Request marked ${requestStatusLabel(status)}.`)
      await load()
      if (status === 'Completed' || status === 'Rejected') setActiveId('')
    } catch (err) {
      setError(err?.message || 'Could not update the request.')
    } finally {
      setWorking('')
    }
  }

  const generateExport = async () => {
    if (!active) return
    setWorking('export')
    setError('')
    setNote('')
    try {
      const bundle = await collectUserData(active.userId)
      const filename = downloadUserData(bundle, active.userId)
      setResolution('Export')
      setNote(`Data copy generated (${filename}). Send it over a channel the subject controls.`)
    } catch (err) {
      setError(err?.message || 'Could not assemble the data copy.')
    } finally {
      setWorking('')
    }
  }

  const applyCorrection = async () => {
    if (!active) return
    if (!correction.fullName.trim()) {
      setError('A corrected name is required.')
      return
    }
    setWorking('correction')
    setError('')
    setNote('')
    try {
      await correctUserProfile(active.userId, {
        fullName: correction.fullName,
        phoneNumber: correction.phoneNumber,
        city: correction.city,
      })
      setResolution('Correction')
      setNote('Profile corrected. Complete the request once the subject confirms.')
      await load()
    } catch (err) {
      setError(err?.message || 'Could not save the correction.')
    } finally {
      setWorking('')
    }
  }

  const erasePersonalData = async () => {
    if (!active) return
    if (!adminNote.trim()) {
      setError('Record the reason for erasure in the note before deleting anything.')
      return
    }
    setWorking('erasure')
    setError('')
    setNote('')
    try {
      await anonymiseUser(active.userId, adminNote.trim())
      setResolution('Deletion')
      setNote(
        'Profile personal data erased and the account closed. Donation history is retained. Delete the sign-in record from Accounts to remove the stored email.',
      )
      await load()
      setConfirmErase(false)
    } catch (err) {
      setError(err?.message || 'Could not erase the personal data.')
    } finally {
      setWorking('')
    }
  }

  return (
    <AppShell>
      <PageHeader title="Data Requests" />
      <div id="page-body">
        <Card>
          <header>
            <h2>Data subject requests</h2>
            <p className="muted">
              Access, correction, export and erasure requests. Open one to do the work, then record what was
              done.
            </p>
          </header>

          {error && !active && (
            <p data-state="error" role="alert">
              {error}
            </p>
          )}
          {note && !active && (
            <p className="muted" role="status">
              {note}
            </p>
          )}
          {loading && <p className="muted">Loading requests…</p>}
          {!loading && requests.length === 0 && <p className="muted">No requests yet.</p>}

          {!loading && requests.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Submitted</th>
                    <th>Subject</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const person = byId.get(req.userId)
                    return (
                      <tr key={req.id}>
                        <td>
                          <div>{dateLabel(req.createdAt)}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {req.id}
                          </div>
                        </td>
                        <td>
                          <div>{person?.fullName || req.userId}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {person?.email || '—'}
                          </div>
                        </td>
                        <td>{requestTypeLabel(req.requestType)}</td>
                        <td>
                          <span className="badge" data-status={req.status === 'Completed' ? 'active' : 'inactive'}>
                            {requestStatusLabel(req.status)}
                          </span>
                        </td>
                        <td>
                          <Btn onClick={() => open(req)}>Open</Btn>
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

      <Modal
        name="data-request"
        open={Boolean(active)}
        onClose={close}
        title={active ? requestTypeLabel(active.requestType) : 'Request'}
      >
        {active && (
          <div>
            <dl className="admin-profile-facts">
              <div>
                <dt>Subject</dt>
                <dd>{subject?.fullName || active.userId}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{subject?.email || '—'}</dd>
              </div>
              <div>
                <dt>Opened</dt>
                <dd>{dateLabel(active.createdAt)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{requestStatusLabel(active.status)}</dd>
              </div>
            </dl>

            <Field label="What the subject asked for">
              <p className="muted">{active.details || 'No further detail was given.'}</p>
            </Field>

            {(active.requestType === 'Access' || active.requestType === 'Export') && (
              <div style={{ marginBottom: 12 }}>
                <h3>Access / export</h3>
                <p className="muted">
                  Builds a JSON copy of this account&apos;s profile, matches, donations, rewards, consents,
                  requests and posted blood requests.
                </p>
                <Btn variant="primary" onClick={generateExport} disabled={Boolean(working)}>
                  {working === 'export' ? 'Assembling…' : 'Download data copy'}
                </Btn>
              </div>
            )}

            {active.requestType === 'Rectification' && (
              <div style={{ marginBottom: 12 }}>
                <h3>Correction</h3>
                <p className="muted">
                  Correct the fields the subject named, then complete the request once they confirm.
                </p>
                <Field label="Full name">
                  <Input
                    value={correction.fullName}
                    onChange={(e) => setCorrection((p) => ({ ...p, fullName: e.target.value }))}
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={correction.phoneNumber}
                    onChange={(e) => setCorrection((p) => ({ ...p, phoneNumber: e.target.value }))}
                  />
                </Field>
                <Field label="City">
                  <Input
                    value={correction.city}
                    onChange={(e) => setCorrection((p) => ({ ...p, city: e.target.value }))}
                  />
                </Field>
                <Btn variant="primary" onClick={applyCorrection} disabled={Boolean(working)}>
                  {working === 'correction' ? 'Saving…' : 'Apply correction'}
                </Btn>
              </div>
            )}

            {active.requestType === 'Erasure' && (
              <div style={{ marginBottom: 12 }}>
                <h3>Erasure</h3>
                <p className="muted">
                  Scrubs the profile (name, email, phone, city, location, blood type, birth date) and closes
                  the account. Donation, match and audit records are kept under the retention reasons in{' '}
                  <code>docs/PRIVACY_AND_CONSENT.md</code>. The Firebase Auth sign-in record still holds the
                  email address; delete it from Accounts with “Delete sign-in record” once the account
                  service is deployed.
                </p>
                {!confirmErase ? (
                  <Btn variant="alert" onClick={() => setConfirmErase(true)} disabled={Boolean(working)}>
                    Erase personal data
                  </Btn>
                ) : (
                  <div>
                    <p data-state="error" role="alert">
                      This cannot be undone from the console. Record the reason in the note first.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn variant="alert" onClick={erasePersonalData} disabled={Boolean(working)}>
                        {working === 'erasure' ? 'Erasing…' : 'Confirm erasure'}
                      </Btn>
                      <Btn onClick={() => setConfirmErase(false)} disabled={Boolean(working)}>
                        Cancel
                      </Btn>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Field label="Admin note (record what was done)">
              <Textarea
                rows={3}
                value={adminNote}
                onChange={(e) => {
                  setAdminNote(e.target.value)
                  setError('')
                }}
                placeholder="e.g. Exported 2026-10-29 and sent to the verified address; subject confirmed receipt."
              />
            </Field>

            <Field label="Action recorded">
              <Select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                options={[
                  { value: '', label: 'None yet' },
                  { value: 'Export', label: 'Export / access copy' },
                  { value: 'Correction', label: 'Correction applied' },
                  { value: 'Deletion', label: 'Personal data erased' },
                ]}
              />
            </Field>

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

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <Btn onClick={() => move('InProgress')} disabled={Boolean(working) || active.status === 'InProgress'}>
                {working === 'InProgress' ? 'Saving…' : 'Start'}
              </Btn>
              <Btn variant="primary" onClick={() => move('Completed')} disabled={Boolean(working)}>
                {working === 'Completed' ? 'Saving…' : 'Complete'}
              </Btn>
              <Btn onClick={() => move('Rejected')} disabled={Boolean(working)}>
                {working === 'Rejected' ? 'Saving…' : 'Reject'}
              </Btn>
              <Btn onClick={close} disabled={Boolean(working)}>
                Close
              </Btn>
            </div>

            <p className="muted" style={{ marginTop: 8 }}>
              Statuses: {STATUS_OPTIONS.map(requestStatusLabel).join(' · ')}
            </p>
          </div>
        )}
      </Modal>
    </AppShell>
  )
}
