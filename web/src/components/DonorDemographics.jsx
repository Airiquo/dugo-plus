import { ageOn } from '../utils/eligibility'
import { cx } from '../utils/cx'

/** Gender and age derived from the supplied birth date; neither computes eligibility. */
export function DonorDemographics({ profile, className, ...rest }) {
  const age = ageOn(profile?.dateOfBirth)
  return <span className={cx('donor-demographics', className)} {...rest}>{profile?.gender || 'Gender not recorded'} · {age === null ? 'Age not recorded' : `${age} years old`}</span>
}
