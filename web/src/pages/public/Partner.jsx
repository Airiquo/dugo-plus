import { useState } from 'react'
import { Link } from 'react-router-dom'
import { validatePartner } from '../../utils/validate'
import AuthLayout from '../../layout/AuthLayout'
import { Icon, FieldError } from '../../components'

/**
 * Partnership intake (D21) — `/partner`.
 *
 * Hospitals, blood banks, and other facilities ask for an account here; the
 * request is an email, not a Firestore document, so the form posts to the
 * Formspree endpoint in `VITE_FORMSPREE_ENDPOINT` (`web/.env.example`) and
 * lands in the partners mailbox. Hospital accounts are then created by the
 * Dugo+ team — there is no self-serve hospital sign-up (D20).
 *
 * States: the idle form, a busy submit, the success panel ("we reply within
 * 2–3 business days", with the mailbox as the fallback), and an error that
 * keeps the form filled so a retry does not retype anything. Every field is
 * checked on submit and each message renders under its own input.
 *
 * Chrome is `AuthLayout`'s band — the same public shell the sign-in screens
 * wear — so both themes and the footer come through unchanged.
 */
const PARTNERSHIP_TYPES = [
  'Hospital or blood bank',
  'Clinic or infirmary',
  'Local government unit',
  'Organization or school',
  'Other',
]

const FALLBACK_EMAIL = 'partners@dugoplus.ph'

export default function Partner() {
  const [facility, setFacility] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [partnershipType, setPartnershipType] = useState(PARTNERSHIP_TYPES[0])
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const found = validatePartner({ facility, contactPerson, email, phone, message })
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) return

    const endpoint = import.meta.env.VITE_FORMSPREE_ENDPOINT
    if (!endpoint) {
      setFormError(
        `The partnership form is not configured on this build. Email ${FALLBACK_EMAIL} instead and we will set you up.`,
      )
      return
    }

    setBusy(true)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          facility: facility.trim(),
          contactPerson: contactPerson.trim(),
          email: email.trim(),
          phone: phone.trim(),
          partnershipType,
          message: message.trim(),
        }),
      })
      if (!response.ok) throw new Error(`Formspree responded ${response.status}`)
      setSent(true)
    } catch {
      // The form keeps its values, so a retry (or the mailbox fallback below)
      // never costs the visitor their typing. The raw status is not shown:
      // it names nothing the visitor can act on.
      setFormError(
        `Your request could not be sent. Try again in a moment, or email ${FALLBACK_EMAIL} directly.`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      kicker="Hospital partnerships"
      heading="Become a partner"
      blurb="Hospitals, blood banks, and facilities join Dugo+ by request. Tell us who you are and the team will set up your account and walk you through posting blood requests."
    >
      {sent ? (
        <div className="pub-card pub-form" role="status">
          <p className="pub-kicker">Request received</p>
          <h3>Thank you — we have your request.</h3>
          <p className="pub-muted">
            A member of the Dugo+ team will reply within <strong>2–3 business days</strong> to set
            up your facility's account.
          </p>
          <p className="pub-muted">
            Need us sooner? Email <a href={`mailto:${FALLBACK_EMAIL}`}>{FALLBACK_EMAIL}</a>.
          </p>
          <Link className="pub-btn pub-btn-wide" to="/">
            Back to Dugo+
            <Icon name="arrow-right" size={14} />
          </Link>
        </div>
      ) : (
        <form className="pub-card pub-form pub-form-wide" noValidate onSubmit={submit}>
          <h3>Request a partnership</h3>
          <p className="pub-muted">
            This reaches the Dugo+ team directly. Hospital accounts are created by us — there is
            no self sign-up for facilities.
          </p>
          <label>
            <span>Facility or organization</span>
            <input
              autoComplete="organization"
              placeholder="Bulacan Medical Center"
              type="text"
              value={facility}
              aria-invalid={Boolean(errors.facility) || undefined}
              aria-describedby={errors.facility ? 'partner-facility-error' : undefined}
              onChange={(event) => {
                setFacility(event.target.value)
                if (errors.facility) setErrors((prev) => ({ ...prev, facility: '' }))
              }}
            />
            <FieldError id="partner-facility-error">{errors.facility}</FieldError>
          </label>
          <label>
            <span>Contact person</span>
            <input
              autoComplete="name"
              placeholder="Dr. Juan Dela Cruz"
              type="text"
              value={contactPerson}
              aria-invalid={Boolean(errors.contactPerson) || undefined}
              aria-describedby={errors.contactPerson ? 'partner-contact-error' : undefined}
              onChange={(event) => {
                setContactPerson(event.target.value)
                if (errors.contactPerson) setErrors((prev) => ({ ...prev, contactPerson: '' }))
              }}
            />
            <FieldError id="partner-contact-error">{errors.contactPerson}</FieldError>
          </label>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              placeholder="name@hospital.ph"
              type="email"
              value={email}
              aria-invalid={Boolean(errors.email) || undefined}
              aria-describedby={errors.email ? 'partner-email-error' : undefined}
              onChange={(event) => {
                setEmail(event.target.value)
                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }))
              }}
            />
            <FieldError id="partner-email-error">{errors.email}</FieldError>
          </label>
          <label>
            <span>Phone (optional)</span>
            <input
              autoComplete="tel"
              placeholder="044 791 0000"
              type="tel"
              value={phone}
              aria-invalid={Boolean(errors.phone) || undefined}
              aria-describedby={errors.phone ? 'partner-phone-error' : undefined}
              onChange={(event) => {
                setPhone(event.target.value)
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }))
              }}
            />
            <FieldError id="partner-phone-error">{errors.phone}</FieldError>
          </label>
          <label>
            <span>Partnership type</span>
            <select
              value={partnershipType}
              onChange={(event) => setPartnershipType(event.target.value)}
            >
              {PARTNERSHIP_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Message</span>
            <textarea
              placeholder="Tell us about your facility and what you need from Dugo+."
              rows={4}
              value={message}
              aria-invalid={Boolean(errors.message) || undefined}
              aria-describedby={errors.message ? 'partner-message-error' : undefined}
              onChange={(event) => {
                setMessage(event.target.value)
                if (errors.message) setErrors((prev) => ({ ...prev, message: '' }))
              }}
            />
            <FieldError id="partner-message-error">{errors.message}</FieldError>
          </label>
          {formError && (
            <p className="pub-msg" data-kind="error" role="alert">
              {formError}
            </p>
          )}
          <button className="pub-btn pub-btn-wide" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send request'}
            <Icon name="arrow-right" size={14} />
          </button>
          <p className="pub-fine">
            Already a partner? <Link to="/login">Sign in</Link> · Or email{' '}
            <a href={`mailto:${FALLBACK_EMAIL}`}>{FALLBACK_EMAIL}</a>
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
