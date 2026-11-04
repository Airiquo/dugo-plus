import { Link } from 'react-router-dom'
import { missingDonorProfileFields } from '../utils/profileCompletion'
import { cx } from '../utils/cx'
import { Icon } from './Icon'

/** Persistent completion prompt; does not block navigation or change acceptance rules. */
export function ProfileCompletionBanner({ profile, className, ...rest }) {
  const missing = missingDonorProfileFields(profile || {})
  if (!profile?.gender) missing.push('gender')
  if (!missing.length) return null
  return <aside className={cx('profile-completion-banner', className)} role="status" {...rest}><Icon name="user" size={22} /><div><strong>Complete your donor profile</strong><p>Add your {missing.join(', ')} so your account is ready.</p><Link to="/home">Review my profile</Link></div></aside>
}
