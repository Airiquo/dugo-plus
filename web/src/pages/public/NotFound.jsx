import { Link } from 'react-router-dom'
import AuthLayout from '../../layout/AuthLayout'

/** Missing-route page with shared public navigation, theme control and support. */
export default function NotFound() {
  return <AuthLayout kicker="404" heading="Page not found." blurb="The page may have moved, or the link may be incomplete.">
    <section className="pub-card pub-form"><h2>Find your way back.</h2><p>Return home to continue your Dugo+ journey.</p><Link className="pub-btn" to="/">Go to home</Link></section>
  </AuthLayout>
}
