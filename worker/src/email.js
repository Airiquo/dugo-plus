/**
 * Email sending via Brevo (formerly Sendinblue).
 *
 * Single-sender verification is supported without a custom domain on Brevo's
 * free tier (300/day). The Worker uses the REST API and sends best-effort:
 * failures are logged and do not roll back a written match.
 */

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

/** True when Brevo is configured to send mail. */
export function isEmailEnabled(env) {
  return Boolean(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL && env.BREVO_SENDER_NAME)
}

/**
 * Send a plain-text email. Returns true on success.
 */
export async function sendEmail(env, { to, subject, text, html }) {
  if (!isEmailEnabled(env)) return false

  const response = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: env.BREVO_SENDER_EMAIL,
        name: env.BREVO_SENDER_NAME,
      },
      to: [{ email: to }],
      subject,
      textContent: text,
      ...(html ? { htmlContent: html } : {}),
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('brevo send failed', {
      status: response.status,
      detail: detail.slice(0, 200),
    })
    return false
  }
  return true
}

/** Short body for a match alert (email). */
export function matchEmailBody({ requestId, component, bloodType, urgencyLevel, hospitalName }) {
  const lines = [
    'Dugo+ — New blood request match',
    '',
    `Request: ${requestId}`,
    `Blood type: ${bloodType}`,
    `Component: ${component}`,
    `Urgency: ${urgencyLevel ?? 'routine'}`,
    ...(hospitalName ? [`Hospital: ${hospitalName}`] : []),
    '',
    'Sign in to Dugo+ to review and respond to this request in your Alerts inbox.',
    'This is an automated message; please do not reply.',
  ]
  return lines.join('\n')
}
