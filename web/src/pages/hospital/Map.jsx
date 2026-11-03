import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HospitalShell } from "../../layout/HospitalShell";
import { useAuth } from "../../hooks/useAuth";
import { readHospital } from "../../services/hospitals";
import { asPoint } from "../../utils/geo";
import {
  Btn,
  HospitalLocationMap,
  HospitalNotice,
  HospitalPageHeader,
  Icon,
} from "../../components";

/** Saved facility location, map context and administrator-managed address details. */
export default function HospitalMap() {
  const { profile, roleLoading } = useAuth();
  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (roleLoading) return;
    let active = true;
    setLoading(true);
    setError(false);
    readHospital(profile?.hospitalId)
      .then((found) => {
        if (active) {
          setHospital(found);
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
  const position = asPoint(hospital?.latitude, hospital?.longitude);
  return (
    <HospitalShell facility={hospital?.name}>
      <HospitalPageHeader
        title="Hospital map"
        eyebrow="Facility / Saved location"
        description="The place where your donors connect with care."
        actions={
          <Link to="/hospital/facility" className="btn">
            Facility details <Icon name="arrow-right" size={16} />
          </Link>
        }
      />
      {loading ? (
        <p role="status" className="hw-loading">
          Loading facility location…
        </p>
      ) : error ? (
        <HospitalNotice
          tone="error"
          title="Your facility location couldn’t load"
        >
          <p>
            Check your connection, or ask your administrator to confirm your
            facility link.
          </p>
          <Btn onClick={() => setAttempt((n) => n + 1)}>Try again</Btn>
        </HospitalNotice>
      ) : (
        <div className="hw-map-layout">
          <section className="card hw-map-panel">
            <div className="hw-panel-heading">
              <div>
                <p className="hw-eyebrow">Collection location</p>
                <h2>{hospital?.name || "Your facility"}</h2>
              </div>
              <span className="hw-lock-label">
                <Icon name="lock" size={13} />
                Saved pin
              </span>
            </div>
            {position ? (
              <HospitalLocationMap
                position={position}
                label={`${hospital?.name || "Hospital"} saved location`}
              />
            ) : (
              <div className="hw-empty">
                <Icon name="pin" size={30} />
                <h3>A map pin hasn’t been saved</h3>
                <p>Your administrator can add it from Accounts.</p>
              </div>
            )}
            <p className="hw-map-caption">
              <Icon name="compass" size={16} />
              Used to find compatible donors near your facility.
            </p>
          </section>
          <aside className="hw-map-aside">
            <section className="card hw-location-card">
              <p className="hw-eyebrow">Your facility</p>
              <h2>Find your way here</h2>
              <div className="hw-address">
                <Icon name="pin" size={23} />
                <p>{hospital?.address || "No address recorded"}</p>
              </div>
              <dl className="hw-facts">
                <div>
                  <dt>Contact</dt>
                  <dd>{hospital?.contactNumber || "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Latitude</dt>
                  <dd>{position ? position.lat.toFixed(6) : "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Longitude</dt>
                  <dd>{position ? position.lng.toFixed(6) : "Not recorded"}</dd>
                </div>
              </dl>
            </section>
            <HospitalNotice title="Administrator-managed location">
              If this address or pin needs correcting, contact your
              administrator. Location changes apply to new requests.
            </HospitalNotice>
          </aside>
        </div>
      )}
    </HospitalShell>
  );
}
