import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { grantConsent, readMyConsent, revokeConsent } from '../../services/consents'
import {
  CONSENT_CATEGORIES,
  CONSENT_VERSION,
  consentStatusLabel,
} from '../../utils/consent'
import { Badge, ConsentStatus, FieldError, Modal, PubThemeToggle } from '../../components'

/** `29 Oct 2026` from a Date, for the consent's audit lines. */
function dateLabel(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : value.toDate?.()
  if (!date) return '—'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

/**
 * Donor hospital-access consent (FR-038 / NFR-16).
 *
 * The donor reads what a hospital may see, why it is needed, and which
 * categories are shared, then grants or withdraws consent. The record is
 * `donorConsents/{uid}`; the security rules refuse hospital profile reads
 * without a current granted record, so this screen is the way a donor opens
 * that gate and the way they close it.
 *
 * Registration's privacy-notice acceptance is deliberately shown as a separate
 * thing: it is not treated as consent to hospital access.
 */
export default function Consent() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const [consent, setConsent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [note, setNote] = useState('')
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [reason, setReason] = useState('')

  const load = () => {
    if (!user?.uid) return
    setLoading(true)
    setError('')
    readMyConsent(user.uid)
      .then(setConsent)
      .catch(() => setError('Your consent record could not be loaded. Check your connection and try again.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [user?.uid])

  const grant = async () => {
    setActionError('')
    setNote('')
    if (!ack) {
      setActionError('Tick the box to confirm you have read what hospitals can see.')
      return
    }
    if (!user?.uid) {
      setActionError('Sign in again to record your consent.')
      return
    }
    setBusy(true)
    try {
      const next = await grantConsent(user.uid)
      setConsent(next)
      setAck(false)
      setNote('Consent recorded. Hospitals can now open the profile fields listed here.')
    } catch (err) {
      setActionError(
        err?.code === 'permission-denied'
          ? 'Dugo+ could not record the consent. Ask the team to check that the current Firestore rules are deployed.'
          : err?.message || 'Consent could not be recorded. Check your connection and try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async () => {
    setActionError('')
    setNote('')
    if (!user?.uid) {
      setActionError('Sign in again to withdraw consent.')
      return
    }
    if (reason.trim().length > 500) {
      setActionError('Keep the reason under 500 characters.')
      return
    }
    setBusy(true)
    try {
      await revokeConsent(user.uid, reason)
      setConsent(await readMyConsent(user.uid))
      setConfirmWithdraw(false)
      setReason('')
      setNote('Consent withdrawn. Hospitals can no longer open your donor profile.')
    } catch (err) {
      setActionError(
        err?.code === 'permission-denied'
          ? 'Dugo+ could not withdraw the consent. Ask the team to check that the current Firestore rules are deployed.'
          : err?.message || 'Consent could not be withdrawn. Check your connection and try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const status = loading ? 'loading' : error ? 'error' : consent?.status || 'none'
  const granted = status === 'granted'
  const revoked = status === 'revoked'

  return (
    <div
      className="pub"
      data-theme={theme}
      style={{ display: 'grid', gridTemplateRows: 'auto 1fr' }}
    >
      <header className="pub-nav">
        <Link className="pub-logo" to="/" aria-label="Dugo+ home">
          <span className="pub-mark" aria-hidden="true" />
          <span className="pub-word">
            Dugo<span>+</span>
          </span>
        </Link>
        <nav aria-label="Sections">
          <Link to="/donor/profile">Profile</Link>
          <Link to="/donor/privacy">Privacy &amp; data requests</Link>
          <Link to="/privacy">Privacy notice</Link>
        </nav>
        <div className="pub-nav-end">
          <PubThemeToggle />
        </div>
      </header>

      <main id="top" className="profile-main">
        <div className="privacy-stack">
          <section className="pub-card pub-form profile-card privacy-card" aria-labelledby="consent-heading">
            <p className="pub-kicker">Hospital access</p>
            <h3 id="consent-heading">Your consent</h3>
            <p className="pub-muted">
              A hospital may open your donor profile only after you agree here. Agreeing is
              optional, and you can withdraw it at any time.
            </p>

            <ConsentStatus consent={consent} loading={loading} error={error} />

            {status === 'error' && (
              <button className="pub-btn pub-btn-ghost" type="button" onClick={load}>
                Try again
              </button>
            )}

            <div className="profile-section">
              <h4 className="profile-section-h">What a hospital can see</h4>
              <ul className="consent-categories">
                {CONSENT_CATEGORIES.map((category) => (
                  <li key={category.key}>
                    <strong>{category.label}</strong>
                    <span>{category.detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="profile-section">
              <h4 className="profile-section-h">Why it is needed</h4>
              <p className="pub-muted">
                Hospital staff use these fields to check that you are a compatible donor near their
                facility, apply the waiting interval that protects your health, and contact you
                about a blood request you were matched to. They do not receive a donor directory,
                and another donor cannot read your profile.
              </p>
              <p className="pub-muted">
                Consent version <span className="consent-status-mono">{CONSENT_VERSION}</span>.
                A new version of this notice asks you again rather than carrying the old agreement
                forward.
              </p>
            </div>

            {!loading && !error && (
              <div className="profile-section">
                <h4 className="profile-section-h">
                  {granted ? 'Consent is active' : revoked ? 'Consent is withdrawn' : 'No consent recorded'}
                </h4>

                {granted ? (
                  <>
                    <p className="pub-muted">
                      Granted on {dateLabel(consent?.grantedAt)}. Hospitals can open the fields
                      above until you withdraw.
                    </p>
                    <p className="pub-fine">
                      Withdrawing stops future access. Records already created by a hospital, such
                      as a donation record kept for blood safety, are not deleted by this action.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="pub-muted">
                      {revoked
                        ? `Withdrawn on ${dateLabel(consent?.revokedAt)}. Hospitals cannot open your profile. You can agree again below.`
                        : 'No hospital can open your profile through Dugo+ until you agree.'}
                    </p>
                    <label className="pub-consent">
                      <input
                        type="checkbox"
                        checked={ack}
                        disabled={busy}
                        aria-invalid={Boolean(actionError) || undefined}
                        onChange={(event) => {
                          setAck(event.target.checked)
                          setActionError('')
                          setNote('')
                        }}
                      />
                      <span className="pub-consent-copy">
                        <span className="pub-consent-main">
                          <span className="pub-consent-box" aria-hidden="true" />
                          <span className="pub-consent-text">
                            I have read what hospitals can see and why, and I agree that Dugo+
                            partner hospitals may open those fields when I am matched to a blood
                            request.
                          </span>
                        </span>
                        <Link className="pub-consent-link" to="/privacy" target="_blank" rel="noreferrer">
                          Read the full privacy notice
                        </Link>
                      </span>
                    </label>
                  </>
                )}

                {actionError && (
                  <FieldError role="alert" aria-live="polite">
                    {actionError}
                  </FieldError>
                )}
                {note && (
                  <p className="pub-msg" data-kind="info" role="status">
                    {note}
                  </p>
                )}

                <div className="profile-actions">
                  {granted ? (
                    <button
                      className="pub-btn pub-btn-ghost pub-btn-wide"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setActionError('')
                        setNote('')
                        setConfirmWithdraw(true)
                      }}
                    >
                      Withdraw consent
                    </button>
                  ) : (
                    <button
                      className="pub-btn pub-btn-wide"
                      type="button"
                      disabled={busy || !ack}
                      onClick={grant}
                    >
                      {busy ? 'Recording…' : revoked ? 'Agree again' : 'Record my consent'}
                    </button>
                  )}
                </div>
              </div>
            )}

            <p className="pub-fine">
              You can also <Link to="/donor/privacy">ask for a copy, a correction or deletion</Link>{' '}
              of your personal data. Registering for Dugo+ accepted the privacy notice, but that is
              a separate record from this hospital-access consent.
            </p>
          </section>

          <section className="pub-card pub-form profile-card privacy-card" aria-labelledby="consent-admin-h">
            <p className="pub-kicker">Who else can read it</p>
            <h3 id="consent-admin-h">Administrators and support</h3>
            <p className="pub-muted">
              Dugo+ administrators can read consent records to answer your requests and to
              investigate misuse. They cannot grant consent for you, and they can only withdraw a
              record when they close an account in answer to an erasure request. Your consent is
              never changed by another donor.
            </p>
            <p className="pub-fine">
              Current state:{' '}
              <Badge data-status={status === 'granted' ? 'active' : status === 'error' ? 'rejected' : status === 'loading' ? 'pending' : 'pending'}>
                {loading ? 'Checking…' : error ? 'Unavailable' : consentStatusLabel(consent?.status)}
              </Badge>
            </p>
            <div className="profile-actions">
              <Link className="pub-btn pub-btn-ghost pub-btn-wide" to="/donor/profile">
                Back to your profile
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Modal
        name="consent-withdraw"
        open={confirmWithdraw}
        onClose={() => (busy ? null : setConfirmWithdraw(false))}
        title="Withdraw hospital access?"
      >
        <div className="consent-modal">
          <p>
            Hospitals will immediately lose access to your donor profile. You can agree again at
            any time. This does not delete donation records a hospital already holds for blood
            safety.
          </p>
          <label>
            <span>Reason (optional)</span>
            <textarea
              rows={3}
              maxLength={500}
              value={reason}
              disabled={busy}
              placeholder="For example: I no longer want to be contacted."
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <p className="pub-fine">{reason.length}/500 characters</p>
          <div className="consent-modal-actions">
            <button
              className="pub-btn pub-btn-ghost"
              type="button"
              disabled={busy}
              onClick={() => setConfirmWithdraw(false)}
            >
              Keep consent
            </button>
            <button className="pub-btn" type="button" disabled={busy} onClick={withdraw}>
              {busy ? 'Withdrawing…' : 'Withdraw consent'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
