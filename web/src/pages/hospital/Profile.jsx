import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HospitalShell } from "../../layout/HospitalShell";
import { useAuth } from "../../hooks/useAuth";
import { fetchHospital } from "../../services/requests";
import {
  Btn,
  HospitalNotice,
  HospitalPageHeader,
  Icon,
  ProfileAvatar,
  ProfilePhotoEditor,
} from "../../components";

/** Personal hospital identity, picture and read-only account access, with a separate facility destination. */
export default function Profile() {
  const { user, profile, roleLoading } = useAuth();
  const [facility, setFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (roleLoading) return;
    let active = true;
    setLoading(true);
    setError(false);
    fetchHospital(profile?.hospitalId)
      .then((found) => {
        if (active) {
          setFacility(found);
          setError(!found);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile?.hospitalId, roleLoading, attempt]);
  const name = profile?.fullName || user?.displayName || "Hospital staff";
  return (
    <HospitalShell facility={facility?.name}>
      <HospitalPageHeader
        title="My profile"
        eyebrow="Account / Your identity"
        description="Your personal account, connected to the care your facility provides."
      />
      <div className="hw-profile-layout">
        <section className="card hw-personal-card">
          <div className="hw-profile-cover">
            <span className="app-mark" />
            <span>Connected by care.</span>
          </div>
          <div className="hw-personal-identity">
            <ProfileAvatar src={profile?.photoURL} name={name} />
            <p className="hw-eyebrow">Hospital team</p>
            <h2>{name}</h2>
            <p>{user?.email || "Email unavailable"}</p>
            <span className="hw-role-pill">
              <Icon name="shield" size={14} />
              Hospital / Blood Bank
            </span>
          </div>
          <details className="hw-photo-settings">
            <summary>
              <Icon name="user" size={17} />
              Profile photo
              <span>
                Change <Icon name="chevron-right" size={15} />
              </span>
            </summary>
            <ProfilePhotoEditor disabled={roleLoading || !profile} />
          </details>
        </section>
        <div className="hw-profile-main">
          <section className="card hw-panel">
            <div className="hw-panel-heading">
              <div>
                <p className="hw-eyebrow">Personal details</p>
                <h2>Your account information</h2>
              </div>
              <Icon name="user" size={21} />
            </div>
            <dl className="hw-account-facts">
              <div>
                <dt>Full name</dt>
                <dd>{name}</dd>
              </div>
              <div>
                <dt>Sign-in email</dt>
                <dd>{user?.email || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Contact number</dt>
                <dd>{profile?.phoneNumber || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Account status</dt>
                <dd>{profile?.status || "Active"}</dd>
              </div>
              <div>
                <dt>Email verification</dt>
                <dd>
                  <span className="hw-verified">
                    <Icon
                      name={user?.emailVerified ? "check" : "clock"}
                      size={15}
                    />
                    {user?.emailVerified ? "Verified" : "Awaiting verification"}
                  </span>
                </dd>
              </div>
            </dl>
            <p className="hw-footnote">
              <Icon name="lock" size={15} />
              Need a name or contact correction? Your administrator can update
              your account details.
            </p>
          </section>
          <section className="card hw-panel">
            <div className="hw-panel-heading">
              <div>
                <p className="hw-eyebrow">Your workplace</p>
                <h2>Linked facility</h2>
              </div>
              <Icon name="grid" size={22} />
            </div>
            {loading && (
              <p role="status" className="hw-loading">
                Loading your facility…
              </p>
            )}
            {error && (
              <HospitalNotice tone="attention" title="Facility unavailable">
                <p>
                  Your administrator can check the facility linked to this
                  account.
                </p>
                <Btn onClick={() => setAttempt((n) => n + 1)}>Try again</Btn>
              </HospitalNotice>
            )}
            {facility && !loading && !error && (
              <>
                <div className="hw-profile-facility">
                  <span className="hw-facility-symbol">
                    <Icon name="grid" size={24} />
                  </span>
                  <div>
                    <strong>{facility.name}</strong>
                    <p>{facility.address || "Address not recorded"}</p>
                  </div>
                </div>
                <div className="hw-profile-links">
                  <Link to="/hospital/facility" className="hw-text-link">
                    Facility details <Icon name="arrow-right" size={16} />
                  </Link>
                  <Link to="/hospital/map" className="hw-text-link">
                    Saved location <Icon name="pin" size={16} />
                  </Link>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </HospitalShell>
  );
}
