import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import {
  REQUEST_TYPES,
  DETAILS_LIMIT,
  createDataRequest,
  listMyDataRequests,
  requestStatusLabel,
  requestTypeLabel,
} from '../../services/dataRequests'
import { Badge, FieldError } from '../../components'
import { DonorNav } from '../../layout/DonorNav'

/**
 * Donor privacy and data requests (FR-039/NFR-19).
 *
 * Submits an access, correction, erasure or export request with the detail the
 * administrator needs to act on it, and lists this account's own requests with
 * the team's answer. The linked notice is the consent text the account agreed
 * to.
 *
 * Chrome: the donor surface has no `AppShell`, so this carries the same `.pub`
 * scope as the profile and sign-in screens, which is what makes both themes
 * work unchanged.
 */

const TYPE_HINTS = {
  Access: 'A copy of what Dugo+ holds about you, sent by the support team.',
  Rectification: 'Correct a name, phone number or city that is wrong or out of date.',
  Erasure: 'Have your identifying details removed and your account closed.',
  Export: 'A machine-readable copy of your records you can take elsewhere.',
}

const STATUS_TONE = {
  Pending: 'pending',
  InProgress: 'info',
  Completed: 'active',
  Rejected: 'rejected',
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

export default function Privacy() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [type, setType] = useState('Access')
  const [details, setDetails] = useState('')
  const [formError, setFormError] = useState('')

  const load = () => {
    if (!user?.uid) return
    setLoading(true)
    setError('')
    listMyDataRequests(user.uid)
      .then(setRequests)
      .catch(() => setError('Could not load your requests. Check your connection and try again.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [user?.uid])

  const submit = async (event) => {
    event.preventDefault()
    setFormError('')
    setError('')
    setNote('')
    if (!details.trim()) {
      setFormError('Describe what you need so the team can act on it.')
      return
    }
    if (details.trim().length > DETAILS_LIMIT) {
      setFormError(`Keep the description under ${DETAILS_LIMIT} characters.`)
      return
    }
    if (!user?.uid) {
      setFormError('Sign in again to submit a request.')
      return
    }

    setBusy(true)
    try {
      await createDataRequest(user.uid, type, details)
      setDetails('')
      setNote('Request submitted. Its status appears below.')
      load()
    } catch (err) {
      setFormError(err?.message || 'Could not submit the request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="pub"
      data-theme={theme}
      style={{ display: 'grid', gridTemplateRows: 'auto 1fr' }}
    >
      <DonorNav />

      <main id="top" className="profile-main">
        <div className="privacy-stack">
          <form className="pub-card pub-form profile-card privacy-card" noValidate onSubmit={submit}>
            <p className="pub-kicker">Your data</p>
            <h3>Privacy &amp; data requests</h3>
            <p className="pub-muted">
              Ask to see what we hold, correct it, export it, or have it erased. The{' '}
              <Link to="/privacy">privacy notice</Link> says what is kept and why.
            </p>

            <div className="profile-section">
              <label>
                <span>What are you asking for?</span>
                <select
                  value={type}
                  disabled={busy}
                  onChange={(event) => {
                    setType(event.target.value)
                    setFormError('')
                    setNote('')
                  }}
                >
                  {REQUEST_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {requestTypeLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="pub-fine">{TYPE_HINTS[type]}</p>
            </div>

            <div className="profile-section">
              <label>
                <span>Details</span>
                <textarea
                  rows={4}
                  value={details}
                  maxLength={DETAILS_LIMIT}
                  disabled={busy}
                  aria-invalid={Boolean(formError) || undefined}
                  aria-describedby={formError ? 'privacy-details-error' : 'privacy-details-count'}
                  placeholder="Which fields to correct, what to erase, or where to send the copy."
                  onChange={(event) => {
                    setDetails(event.target.value)
                    setFormError('')
                    setNote('')
                  }}
                />
              </label>
              <FieldError id="privacy-details-error">{formError}</FieldError>
              <p className="pub-fine" id="privacy-details-count">
                {details.length}/{DETAILS_LIMIT} characters
              </p>
            </div>

            {error && (
              <p className="pub-msg" data-kind="error" role="alert">
                {error}
              </p>
            )}
            {note && (
              <p className="pub-msg" data-kind="info" role="status">
                {note}
              </p>
            )}

            <div className="profile-actions">
              <button className="pub-btn pub-btn-wide" type="submit" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit request'}
              </button>
              <Link className="pub-btn pub-btn-ghost pub-btn-wide" to="/donor/profile">
                Back to your profile
              </Link>
            </div>
          </form>

          <section className="pub-card pub-form profile-card privacy-card" aria-labelledby="privacy-history-h">
            <p className="pub-kicker">History</p>
            <h3 id="privacy-history-h">Your requests</h3>
            <p className="pub-muted">Only you and the Dugo+ team can see these.</p>

            {loading && <p className="pub-msg">Loading your requests…</p>}
            {!loading && error && requests.length === 0 && (
              <p className="pub-msg" data-kind="error" role="alert">
                {error}
              </p>
            )}
            {!loading && !error && requests.length === 0 && (
              <p className="pub-muted">You have not submitted a request yet.</p>
            )}

            {requests.length > 0 && (
              <ul className="privacy-requests">
                {requests.map((request) => (
                  <li key={request.id}>
                    <div className="privacy-request-head">
                      <span className="privacy-request-type">
                        {requestTypeLabel(request.requestType)}
                      </span>
                      <Badge data-status={STATUS_TONE[request.status] ?? 'pending'}>
                        {requestStatusLabel(request.status)}
                      </Badge>
                    </div>
                    {request.details && (
                      <p className="privacy-request-details">{request.details}</p>
                    )}
                    <p className="privacy-request-meta">
                      <span>Sent {dateLabel(request.createdAt)}</span>
                      <span>
                        {request.resolvedAt
                          ? `Answered ${dateLabel(request.resolvedAt)}`
                          : 'Awaiting an answer'}
                      </span>
                    </p>
                    {request.adminNote && (
                      <p className="privacy-request-note">
                        <strong>Dugo+</strong> {request.adminNote}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
