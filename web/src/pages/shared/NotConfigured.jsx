import AuthLayout from '../../layout/AuthLayout'

/**
 * Shown instead of the router when `VITE_FIREBASE_*` is missing or empty.
 *
 * The app does not run unconfigured any more: sessions, account types and every
 * write go to Firebase, so a project with no credentials has nothing to show.
 * Rather than letting `initializeApp()` throw and leaving a blank page, this
 * names the keys that are missing and says what to do about them.
 *
 * `App.jsx` supplies `missing`, because it sits at the head of the auth chain
 * and `lib/firebase.js` is not for pages to import directly.
 */
export default function NotConfigured({ missing = [] }) {
  return (
    <AuthLayout kicker="Setup" heading="Connect a Firebase project">
      <form className="pub-card pub-form" noValidate onSubmit={(event) => event.preventDefault()}>
        <h3>No credentials found</h3>
        <p className="pub-muted">
          Dugo+ keeps accounts and account types in Firebase, and this build has no project to talk
          to.
        </p>
        {missing.length > 0 && (
          <>
            <p className="pub-kicker">Missing from web/.env.local</p>
            <ul className="pub-fine" style={{ margin: 0, paddingLeft: 18 }}>
              {missing.map((key) => (
                <li key={key}>
                  <code>{key}</code>
                </li>
              ))}
            </ul>
          </>
        )}
        <ol className="pub-fine" style={{ margin: 0, paddingLeft: 18 }}>
          <li>
            Copy <code>web/.env.example</code> to <code>web/.env.local</code> if it does not exist
            yet.
          </li>
          <li>Fill in the six VITE_FIREBASE_* values from your Firebase project settings.</li>
          <li>
            Restart the dev server (<code>npm run dev</code>).
          </li>
        </ol>
        <p className="pub-fine">
          Then enable Email/Password and Google under Authentication → Sign-in method, create the
          Firestore database, and publish <code>firestore.rules</code>. See README,
          “Authentication”.
        </p>
      </form>
    </AuthLayout>
  )
}
