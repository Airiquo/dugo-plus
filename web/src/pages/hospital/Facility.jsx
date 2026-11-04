import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { readHospital, saveHospital } from "../../services/hospitals";
import { validateHospital } from "../../utils/validate";
import { phDisplay, phE164, phNational } from "../../utils/phone";
import { HospitalShell } from "../../layout/HospitalShell";
import {
  Btn,
  Field,
  FieldError,
  HospitalNotice,
  HospitalPageHeader,
  Icon,
  Input,
} from "../../components";

const formFrom = (hospital) => ({
  name: hospital?.name || "",
  contactNumber: phNational(hospital?.contactNumber),
});

/** Facility contact editor and the administrator-managed location, kept separate from staff identity. */
export default function Facility({ embedded = false }) {
  const Shell = embedded ? "div" : HospitalShell;
  const { profile } = useAuth();
  const hospitalId = profile?.hospitalId || "";
  const formRef = useRef(null);
  const [source, setSource] = useState(null);
  const [form, setForm] = useState(formFrom(null));
  const [saved, setSaved] = useState(formFrom(null));
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!hospitalId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController()
    let active = true;
    setLoading(true);
    setFailed(false);
    readHospital(hospitalId, { signal: controller.signal })
      .then((found) => {
        if (!active) return;
        if (!found) throw new Error("Missing facility");
        setSource(found);
        setForm(formFrom(found));
        setSaved(formFrom(found));
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      controller.abort()
      active = false;
    };
  }, [hospitalId, attempt]);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const locked = loading || failed || busy || !source;
  function set(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: key === "contactNumber" ? phNational(value) : value,
    }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setMessage("");
    setNote("");
  }
  function discard() {
    setForm({ ...saved });
    setErrors({});
    setMessage("");
    setNote("");
  }
  async function submit(event) {
    event.preventDefault();
    if (locked || !dirty) return;
    const found = validateHospital(form);
    setErrors(found);
    setMessage("");
    setNote("");
    const first = Object.keys(found)[0];
    if (first) {
      formRef.current?.querySelector(`[name="${first}"]`)?.focus();
      return;
    }
    setBusy(true);
    const next = {
      name: form.name.trim(),
      contactNumber: phE164(form.contactNumber),
    };
    try {
      await saveHospital(hospitalId, next);
      const normalized = formFrom(next);
      setSource((prev) => ({ ...prev, ...next }));
      setSaved(normalized);
      setForm(normalized);
      setNote("Facility details saved.");
    } catch {
      setMessage(
        "Your changes couldn’t be saved. Your edits are still here; check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell {...(embedded ? {} : { facility: source?.name })}>
      <HospitalPageHeader
        title="Facility details"
        eyebrow="Facility / Public details"
        description="Keep the details donors see clear, current, and easy to reach."
      />
      {!hospitalId && (
        <HospitalNotice tone="attention" title="No facility linked">
          Ask your administrator to link this account to your hospital.
        </HospitalNotice>
      )}
      {loading && hospitalId && (
        <p className="hw-loading" role="status">
          Loading facility details…
        </p>
      )}
      {failed && (
        <HospitalNotice tone="error" title="Facility details couldn’t load">
          <p>Editing is paused until your saved details are available.</p>
          <Btn onClick={() => setAttempt((n) => n + 1)}>Try again</Btn>
        </HospitalNotice>
      )}
      {source && !failed && !loading && (
        <div className="hw-settings-grid">
          <form
            className="card hw-facility-editor"
            ref={formRef}
            noValidate
            onSubmit={submit}
            aria-busy={busy}
          >
            <div className="hw-panel-heading">
              <div>
                <p className="hw-eyebrow">The details behind the connection</p>
                <h2>Facility identity & contact</h2>
                <p className="hw-panel-description">
                  These details appear on your facility and its requests.
                </p>
              </div>
              <Icon name="grid" size={24} />
            </div>
            <fieldset disabled={locked} className="hw-settings-fields">
              <Field label="Facility name">
                <Input
                  name="name"
                  autoComplete="organization"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  aria-invalid={Boolean(errors.name) || undefined}
                  aria-describedby={
                    errors.name ? "facility-name-error" : undefined
                  }
                />
                <FieldError id="facility-name-error">{errors.name}</FieldError>
              </Field>
              <Field label="Contact number">
                <Input
                  name="contactNumber"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={20}
                  value={`+63 ${phDisplay(form.contactNumber)}`}
                  onChange={(e) => set("contactNumber", e.target.value)}
                  aria-invalid={Boolean(errors.contactNumber) || undefined}
                  aria-describedby={
                    errors.contactNumber
                      ? "facility-contact-error"
                      : "facility-phone-help"
                  }
                />
                <FieldError id="facility-contact-error">
                  {errors.contactNumber}
                </FieldError>
                <small id="facility-phone-help" className="hw-field-help">
                  Use a number donors can reach for collection questions.
                </small>
              </Field>
            </fieldset>
            {message && <HospitalNotice tone="error">{message}</HospitalNotice>}
            {note && <HospitalNotice tone="success">{note}</HospitalNotice>}
            <div className="hw-savebar">
              <span aria-live="polite">
                {dirty ? "You have unsaved changes" : "All changes saved"}
              </span>
              <div>
                <Btn onClick={discard} disabled={locked || !dirty}>
                  Discard
                </Btn>
                <Btn
                  variant="primary"
                  type="submit"
                  disabled={locked || !dirty}
                >
                  {busy ? "Saving…" : "Save changes"}
                </Btn>
              </div>
            </div>
          </form>
          <aside className="hw-settings-aside">
            <section className="card hw-location-card">
              <p className="hw-eyebrow">A place to connect</p>
              <div className="hw-panel-heading">
                <h2>Facility location</h2>
                <span className="hw-lock-label">
                  <Icon name="lock" size={13} />
                  Admin managed
                </span>
              </div>
              <div className="hw-address">
                <Icon name="pin" size={22} />
                <p>{source.address || "No address recorded"}</p>
              </div>
              <p className="hw-panel-description">
                Your saved pin is used for nearby donor matching. Ask your
                administrator to correct the address or location.
              </p>
              <Link to="/hospital/map" className="btn hw-map-link">
                <Icon name="map" />
                View hospital map
                <Icon name="arrow-right" />
              </Link>
            </section>
            <section className="hw-help-panel">
              <Icon name="shield" size={24} />
              <h3>Facility record</h3>
              <dl className="hw-facts">
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span
                      className="hw-record-status"
                      data-active={source.status === "Active"}
                    >
                      {source.status || "Not recorded"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Facility reference</dt>
                  <dd>
                    <code>{source.id}</code>
                  </dd>
                </div>
              </dl>
              <p>
                Account access and location are managed by your Dugo+
                administrator.
              </p>
            </section>
          </aside>
        </div>
      )}
    </Shell>
  );
}
