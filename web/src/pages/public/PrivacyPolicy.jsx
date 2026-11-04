import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../../utils/support'
import { Link } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { PubThemeToggle } from '../../components'
import { PRIVACY_NOTICE_VERSION } from '../../utils/privacy'

/**
 * Public privacy and consent notice (FR-019).
 *
 * The text names the fields the app actually stores, who can read them, how
 * long they are kept, and how to use the request flow in
 * `pages/donor/Privacy.jsx`. It is the consent text linked from registration
 * and from every data-request screen.
 *
 * Chrome: a signed-out public page, so it carries the landing page's `.pub`
 * header and no `AppShell`.
 */

const SECTIONS = [
  {
    title: 'Who we are',
    body: (
      <>
        Dugo+ is a blood-donation service for the Philippines. The Dugo+ team decides what is
        collected and answers requests. For anything in this notice, write to{' '}
        <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>.
      </>
    ),
  },
  {
    title: 'What we collect',
    items: [
      'Account details: full name, email address, phone number, account type and account status.',
      'Optional profile picture: an image you choose to upload, hosted by Cloudinary, and its image link stored with your account.',
      'Donor profile: blood type, date of birth, gender, city and optional coordinates you place on the map, enter manually or allow the browser to locate. Coordinates are stored as latitude/longitude and a geohash. Age is calculated from your birth date when displayed; it is never stored or sent as an age field to matching.',
      'Donation activity: matches, donations, consents you grant and the blood requests you post.',
      'Requests to Dugo+: your data-subject requests and the administrator’s note recording what was done.',
      'Operational records: error reports written by the browser, and a server-side audit chain that holds hashed references rather than readable personal data.',
    ],
  },
  {
    title: 'Why we hold it',
    items: [
      'To show eligible donors near a blood request and let a hospital invite them.',
      'To keep a donation history and the deferral interval that protects your health.',
      'To answer access, correction, export and erasure requests.',
      'To keep the service secure and investigate faults.',
    ],
  },
  {
    title: 'Who can read it',
    items: [
      'You, for your own profile and your own requests.',
      'Dugo+ administrators, for account management, support and data-subject requests.',
      'Hospital staff, only for matches, donations and stock belonging to their own hospital. With your current match-specific data-sharing consent, they may see your contact details, gender and age in responses and their facility donor directory.',
      'Other donors cannot read your profile, matches, donations or requests.',
    ],
  },
  {
    title: 'Where it is stored and how it is protected',
    body: (
      <>
        City search text is sent through our authenticated service to Photon, which uses OpenStreetMap data. An approximate location is sent to OpenStreetMap for a city suggestion when you request it; map tiles are loaded from OpenStreetMap. You can enter a city manually if suggestions are unavailable.
        Data lives in Google Firebase (Cloud Firestore and Firebase Authentication). Google encrypts
        data in transit and at rest as part of the platform. Access is enforced by server-side
        Firestore rules, not by the screens: a suspended or removed account loses every protected
        read and write, and a changed role in the browser does not grant administrator access. Dugo+
        does not hold a service-account key in the web app.
        {' '}Optional profile pictures are sent to Cloudinary and served through public image links.
        Anyone with an image link can view that picture; avoid uploading sensitive documents or images.
      </>
    ),
  },
  {
    title: 'How long we keep it',
    items: [
      'Your profile stays while your account is active.',
      'If you ask for erasure, the identifying fields (name, email, phone, city, coordinates, blood type, birth date, gender) are scrubbed and the account is closed, and an administrator deletes the sign-in record that holds your email. Donation and audit records are kept in de-identified form so blood-safety and traceability records stay complete.',
      'A suspended or removed account keeps its profile for audit until a deletion request is processed.',
      'Removing or replacing a profile picture clears its link from your account. The stored image can remain on Cloudinary; ask support to delete that copy. Account erasure clears the current picture link and also needs this provider cleanup.',
      'Error reports are kept for troubleshooting and hold no profile data beyond an optional account id.',
    ],
  },
  {
    title: 'Your rights',
    body: (
      <>
        Under the Data Privacy Act of 2012 (RA 10173) you may ask to be informed, to access, to
        correct, to object, to have data erased or blocked, and to receive a copy in a portable
        format. You may also complain to the National Privacy Commission.
      </>
    ),
  },
  {
    title: 'How to make a request',
    body: (
      <>
        Sign in and open <Link to="/donor/settings?tab=privacy">Privacy &amp; data requests</Link>. Say what you
        want exported, corrected or erased. An administrator works the queue, records the action
        taken, and closes the request. We aim to answer within 15 working days.
      </>
    ),
  },
  {
    title: 'Consent',
    body: (
      <>
        Registration asks you to tick a box accepting this notice before a Dugo+ account is
        created, and the acceptance is recorded on your profile with the notice version
        ({PRIVACY_NOTICE_VERSION}) and the time. Creating an account means you agree to Dugo+
        storing the fields above for the purposes listed. Blood type and donation history are
        health-related, so we ask for your consent before a hospital can use them to contact you.
        You can withdraw consent or ask for erasure at any time through the request flow;
        withdrawing does not undo processing that already happened.
      </>
    ),
  },
  {
    title: 'What this notice is not',
    body: (
      <>
        This is the project’s working notice, written against the data the app actually stores. It
        is not a legal opinion, and Dugo+ has not been certified compliant with RA 10173 by a lawyer
        or the National Privacy Commission. The open items — a named Data Protection Officer, a
        formal retention schedule, and legal review of the consent wording — are tracked in the
        project documentation.
      </>
    ),
  },
]

export default function PrivacyPolicy() {
  const { theme } = useTheme()

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
          <Link to="/">Home</Link>
          <Link to="/register">Register</Link>
          <Link to="/login">Sign in</Link>
        </nav>
        <div className="pub-nav-end">
          <PubThemeToggle />
        </div>
      </header>

      <main id="top" className="profile-main">
        <article className="pub-card privacy-notice">
          <header>
            <p className="pub-kicker">Dugo+ · privacy</p>
            <h3>Privacy &amp; consent notice</h3>
            <p className="pub-muted">
              Last updated 1 November 2026 (version {PRIVACY_NOTICE_VERSION}). This notice covers
              the Dugo+ web app and its donor, hospital and administrator accounts.
            </p>
          </header>

          {SECTIONS.map((section) => (
            <section className="privacy-section" key={section.title}>
              <h4>{section.title}</h4>
              {section.body && <p>{section.body}</p>}
              {section.items && (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div className="privacy-notice-foot">
            <Link className="pub-btn pub-btn-ghost" to="/">
              Back to Dugo+
            </Link>
            <Link className="pub-btn" to="/register">
              Create an account
            </Link>
          </div>
        </article>
      </main>
    </div>
  )
}
