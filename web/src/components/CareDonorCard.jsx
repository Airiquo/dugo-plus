import { Link } from 'react-router-dom'
import { cx } from '../utils/cx'
import { Icon } from './Icon'
import { Badge } from './Status'
import { ProfileAvatar } from './ProfileAvatar'

/** Live profile summary. Eligibility is derived by the caller, never self-declared. */
export function CareDonorCard({ bloodType, city, eligibility, loaded, error, photoURL, name, className, ...rest }) {
  return <aside className={cx('care-donor-card', className)} {...rest}>
    <div className="care-donor-card-top"><span className="care-kicker">Your donor card</span><span className="care-mini-mark" aria-hidden="true" /></div>
    <div className="care-donor-identity">
      <div className="care-donor-photo-ring"><ProfileAvatar className="care-donor-photo" src={photoURL} name={name} /></div>
      <strong>{name || 'Donor profile'}</strong>
      <div className="care-donor-blood"><span>{loaded ? bloodType || '—' : error ? '—' : '…'}</span><span>Your blood type</span></div>
    </div>
    <div className="care-donor-card-detail"><p className="care-kicker">Donation readiness</p><Badge data-eligibility={eligibility?.status === 'eligible' ? 'eligible' : eligibility?.status === 'unknown' ? 'unknown' : 'deferred'}>{loaded ? eligibility?.label : error ? 'Profile unavailable' : 'Loading your profile'}</Badge><p>{loaded ? eligibility?.detail : error ? 'Reload the page to try your saved details again.' : 'Checking your saved details.'}</p></div>
    <p className="care-donor-location"><Icon name="target" />{city || 'Add your city to find nearby care'}</p>
    <Link id="nav-donor-requests" to="/donor/requests" className="pub-btn">Explore blood requests<Icon name="arrow-right" /></Link>
    <p className="pub-fine">A facility confirms eligibility before every donation. Your contact details are shared with your consent.</p>
  </aside>
}
