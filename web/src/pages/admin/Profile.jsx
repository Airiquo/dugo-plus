import { phNational, phE164 } from '../../utils/phone'
import { Fragment, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../layout/AppShell";
import { useAuth } from "../../hooks/useAuth";
import { readProfile, saveProfile, roleLabel } from "../../services/users";
import { updateDisplayName } from "../../services/auth";
import {
  Btn,
  Field,
  Icon,
  Input,
  PageHeader,
  ProfilePhotoEditor,
  ProfileAvatar,
} from "../../components";
const formFrom = (profile) => ({
  fullName: profile?.fullName || "",
  phoneNumber: phNational(profile?.phoneNumber),
});
function dateLabel(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)
    : "Not recorded";
}

/** Administrator identity, contact details and read-only access facts. */
export default function Profile({ embedded = false }) {
  const Shell = embedded ? Fragment : AppShell;
  const { user, profile, role, reloadUser } = useAuth();
  const [source, setSource] = useState(null);
  const [form, setForm] = useState(formFrom(null));
  const [saved, setSaved] = useState(formFrom(null));
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const generation = useRef(0),
    nameInput = useRef(null);
  const readAbort = useRef(null);
  async function load() {
    readAbort.current?.abort();
    const controller = new AbortController();
    readAbort.current = controller;
    if (!user?.uid) return;
    const version = ++generation.current;
    setLoading(true);
    setLoadFailed(false);
    setMessage("");
    try {
      const found = await readProfile(user.uid, { signal: controller.signal });
      if (!found) throw new Error("Profile unavailable");
      if (version !== generation.current) return;
      setSource(found);
      setForm(formFrom(found));
      setSaved(formFrom(found));
      setErrors({});
    } catch {
      if (version === generation.current) setLoadFailed(true);
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    load();
    return () => {
      readAbort.current?.abort();
      generation.current++;
    };
  }, [user?.uid]);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const locked = loading || loadFailed || busy;
  function set(key) {
    return (event) => {
      const value = key === "phoneNumber" ? phNational(event.target.value) : event.target.value;
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: "" }));
      setNote("");
      setMessage("");
    };
  }
  function discard() {
    setForm({ ...saved });
    setErrors({});
    setMessage("");
    setNote("");
  }
  async function submit(event) {
    event.preventDefault();
    if (locked || !source || !dirty) return;
    if (!form.fullName.trim()) {
      setErrors({ fullName: "Enter the name your team should see." });
      nameInput.current?.focus();
      return;
    }
    if (form.phoneNumber && ![9,10].includes(phNational(form.phoneNumber).length)) { setErrors({ phoneNumber: "Enter 9–10 digits after +63." }); return; }
    setErrors({});
    setMessage("");
    setNote("");
    setBusy(true);
    const next = {
      fullName: form.fullName.trim(),
      phoneNumber: phE164(form.phoneNumber),
    };
    try {
      await saveProfile(user.uid, next);
      let refreshIssue = false;
      if (next.fullName !== saved.fullName)
        try {
          await updateDisplayName(next.fullName);
        } catch {
          refreshIssue = true;
        }
      try {
        await reloadUser();
      } catch {
        refreshIssue = true;
      }
      let updated = null;
      try {
        updated = await readProfile(user.uid);
      } catch {
        refreshIssue = true;
      }
      setSource((prev) => ({
        ...prev,
        ...next,
        updatedAt: updated?.updatedAt || null,
      }));
      setForm(formFrom(next));
      setSaved(formFrom(next));
      setNote(
        refreshIssue
          ? "Your details are saved. Some account display information could not refresh; reload this page to check it."
          : "Your profile details are saved.",
      );
    } catch {
      setMessage(
        "Your details could not be saved. Your edits are still here; try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const status = source?.status || "Active";
  return (
    <Shell>
      <div className="admin-workspace">
        {!embedded && <PageHeader title="My Profile" />}
        <p className="profile-page-note">
          Manage your contact details and administrator identity.
        </p>
        {loadFailed && (
          <div className="aw-notice aw-error" role="alert">
            <strong>Your profile could not be loaded.</strong>
            <p>Editing is disabled until your saved details are available.</p>
            <Btn onClick={load}>Try again</Btn>
          </div>
        )}
        <div className="admin-profile-layout">
          <aside
            className="card aw-panel admin-profile-identity"
            aria-label="Your administrator identity"
          >
            <div className="profile-identity-band">
              <Icon name="shield" />
              <span>Administrator profile</span>
            </div>
            <div className="profile-identity-summary">
              <ProfileAvatar
                src={profile?.photoURL}
                name={source?.fullName || user?.displayName || user?.email}
              />
              <div className="profile-identity-details">
                <p className="admin-care-eyebrow">Signed in as</p>
                <h2>
                  {loading
                    ? "Loading profile…"
                    : loadFailed
                      ? "Profile unavailable"
                      : source?.fullName || "Administrator"}
                </h2>
                <p>{user?.email || "Email unavailable"}</p>
                <span className="pill">
                  {roleLabel(role) || "Administrator"}
                </span>
              </div>
            </div>
            <details className="profile-photo-settings">
              <summary>
                <span>Profile photo</span>
                <span>
                  Change <Icon name="chevron-right" />
                </span>
              </summary>
              <ProfilePhotoEditor
                className="admin-profile-photo"
                disabled={locked}
              />
            </details>
            <div className="profile-activity-link">
              <Link
                to={`/admin/audit-trail?actor=${encodeURIComponent(user?.uid || "")}`}
              >
                <Icon name="file" />
                View my activity
                <Icon name="arrow-right" />
              </Link>
            </div>
          </aside>
          <div className="admin-profile-main">
            <form
              className="card aw-panel aw-form"
              noValidate
              onSubmit={submit}
              aria-busy={loading || busy}
            >
              <div className="aw-panel-heading">
                <div>
                  <h2>Contact details</h2>
                  <p>
                    Your name and contact number for the people you work with.
                  </p>
                </div>
                <Icon name="user" />
              </div>
              <div className="aw-panel-body">
                {loading && (
                  <p className="settings-help" role="status">
                    Loading your saved details…
                  </p>
                )}
                <fieldset disabled={locked} className="profile-contact-fields">
                  <legend className="sr-only">Editable profile details</legend>
                  <Field label="Full name">
                    <Input
                      ref={nameInput}
                      autoComplete="name"
                      maxLength={120}
                      value={form.fullName}
                      onChange={set("fullName")}
                      aria-invalid={!!errors.fullName || undefined}
                      aria-describedby={
                        errors.fullName
                          ? "admin-profile-name-error"
                          : "admin-profile-name-help"
                      }
                    />
                  </Field>
                  {errors.fullName ? (
                    <p
                      id="admin-profile-name-error"
                      className="aw-field-help profile-field-error"
                      role="alert"
                    >
                      {errors.fullName}
                    </p>
                  ) : (
                    <p id="admin-profile-name-help" className="aw-field-help">
                      Use the name your team will recognize beside your actions.
                    </p>
                  )}
                  <Field label="Phone number">
                    <Input
                      type="tel" inputMode="numeric"
                      autoComplete="tel"
                      maxLength={40}
                      aria-invalid={Boolean(form.phoneNumber && ![9,10].includes(form.phoneNumber.length))}
                      aria-describedby="admin-profile-phone-help"
                      value={form.phoneNumber}
                      onChange={set("phoneNumber")}
                    />
                  </Field>
                  <p id="admin-profile-phone-help" className="aw-field-help" role={form.phoneNumber && ![9,10].includes(form.phoneNumber.length) ? 'alert' : undefined}>
                    {form.phoneNumber && ![9,10].includes(form.phoneNumber.length) ? 'Enter 9–10 digits after +63.' : 'Optional Philippine number. Enter the digits after +63.'}
                  </p>
                </fieldset>
                {message && (
                  <p className="aw-notice aw-error" role="alert">
                    {message}
                  </p>
                )}
                {note && (
                  <p className="aw-notice" role="status">
                    {note}
                  </p>
                )}
              </div>
              <div className="aw-savebar profile-savebar">
                <span role="status">
                  {loading
                    ? "Loading…"
                    : loadFailed
                      ? "Load your profile to continue"
                      : dirty
                        ? "You have unsaved changes"
                        : "Your saved details are up to date"}
                </span>
                <div>
                  <Btn onClick={discard} disabled={locked || !dirty}>
                    Discard
                  </Btn>
                  <Btn
                    type="submit"
                    variant="primary"
                    disabled={locked || !dirty}
                  >
                    {busy ? "Saving…" : "Save details"}
                  </Btn>
                </div>
              </div>
            </form>
            <section
              className="card aw-panel profile-access"
              aria-labelledby="profile-access-title"
            >
              <div className="aw-panel-heading">
                <div>
                  <h2 id="profile-access-title">Account & access</h2>
                  <p>Read-only details for this administrator account.</p>
                </div>
                <Icon name="lock" />
              </div>
              <div className="aw-panel-body">
                {loading ? (
                  <p role="status" className="settings-help">
                    Loading account details…
                  </p>
                ) : loadFailed ? (
                  <p className="settings-help">
                    Account details will appear after your profile loads.
                  </p>
                ) : (
                  <>
                    <dl className="aw-facts">
                      <div>
                        <dt>Sign-in email</dt>
                        <dd>{user?.email || "Not recorded"}</dd>
                      </div>
                      <div>
                        <dt>Email verification</dt>
                        <dd>
                          <span className="profile-verification">
                            <Icon
                              name={user?.emailVerified ? "check" : "clock"}
                            />
                            {user?.emailVerified ? "Verified" : "Not verified"}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>Access status</dt>
                        <dd>
                          <span
                            className="chip"
                            data-status={
                              status === "Active"
                                ? "active"
                                : status === "Removed"
                                  ? "emergency"
                                  : "inactive"
                            }
                          >
                            {status}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>Details last updated</dt>
                        <dd>{dateLabel(source?.updatedAt)}</dd>
                      </div>
                    </dl>
                    <p className="aw-footnote">
                      Your role, sign-in email and access status are managed
                      through account administration.
                    </p>
                    <details className="profile-account-record">
                      <summary>Account reference</summary>
                      <dl>
                        <dt>Account ID</dt>
                        <dd>{user?.uid}</dd>
                        <dt>Account type</dt>
                        <dd>{roleLabel(role) || "Administrator"}</dd>
                      </dl>
                    </details>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </Shell>
  );
}
