import { useState } from 'react'
import { cx } from '../utils/cx'

/** `src` is optional; absent or failed pictures display initials from `name`. */
export function ProfileAvatar({ src, name = '', className, ...rest }) {
  const [failed, setFailed] = useState('')
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'D'
  return <span className={cx('profile-avatar', className)} aria-hidden="true" {...rest}>
    {src && src !== failed
      ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(src)} />
      : initials}
  </span>
}
