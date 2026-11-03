import { SupportContact } from '../components/SupportContact'
import { Link } from 'react-router-dom'
import { PubThemeToggle } from '../components/PubThemeToggle'
import { Icon } from '../components/Icon'
import { useTheme } from '../hooks/useTheme'

/** Shared public account chrome, with a care introduction beside the existing form. */
export default function AuthLayout({ kicker, heading, blurb, children }) {
  const { theme } = useTheme()
  return <div className="pub pub-auth care-auth" data-theme={theme}>
    <a className="care-skip-link" href="#top">Skip to content</a>
    <header className="pub-nav"><Link className="pub-logo" to="/" aria-label="Dugo+ home"><span className="pub-mark" aria-hidden="true" /><span className="pub-word">dugo<span>+</span></span></Link><nav aria-label="Sections"><Link to="/#platform">Our platform</Link><Link to="/partner">Partner with us</Link></nav><div className="pub-nav-end"><PubThemeToggle /><Link className="care-nav-cta" to="/login">Sign In<Icon name="arrow-right" /></Link></div></header>
    <main id="top"><section className="pub-section pub-signin-band"><div className="pub-signin-grid">
      <div className="care-auth-intro"><p className="pub-kicker">{kicker}</p><h1>{heading}</h1><p className="pub-muted pub-measure">{blurb ?? 'One connection can make all the difference. Donor accounts are open to everyone; hospital accounts are set up by the Dugo+ team.'}</p><div className="care-auth-photo"><img src="/care/hero-donating-blood-pexels.jpg" alt="Blood donation collection beside a donor’s chair" /><span><i className="care-mini-mark" />Connected by care</span></div><div className="care-trust-row"><span><Icon name="check" />Consent-led sharing</span><span><Icon name="target" />Closer connections</span></div></div>
      {children}
    </div></section></main>
    <footer className="care-auth-footer"><Link className="pub-logo" to="/"><span className="pub-mark" aria-hidden="true" /><span className="pub-word">dugo<span>+</span></span></Link><p>A little of you. A lifeline for someone.</p><nav aria-label="Footer"><Link to="/privacy">Privacy notice</Link><Link to="/partner">Hospital partnerships</Link></nav><SupportContact /><span>© 2026 Dugo+</span></footer>
  </div>
}
