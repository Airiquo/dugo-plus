import { useEffect, useRef, useState } from "react";
import { AppShell } from "../../layout/AppShell";
import { useAuth } from "../../hooks/useAuth";
import {
  DEFAULT_CONFIG,
  readSystemConfig,
  saveSystemConfig,
  validateConfig,
} from "../../services/systemConfig";
import { Btn, Field, Icon, Input, PageHeader } from "../../components";
const toDraft = (config) => ({
  notifRetryLimit: String(config.notifRetryLimit),
  notifRetryInterval: String(config.notifRetryInterval),
  radiusTiers: config.radiusTiers.map((tier) => ({
    radiusKm: String(tier.radiusKm),
    waitMinutes: String(tier.waitMinutes),
  })),
});
function dateLabel(value) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : "Not saved yet";
}

/** Notification retry editor that retains the saved matching configuration. */
export default function Settings() {
  const { user } = useAuth();
  const [draft, setDraft] = useState(toDraft(DEFAULT_CONFIG));
  const [saved, setSaved] = useState(toDraft(DEFAULT_CONFIG));
  const [metadata, setMetadata] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState([]);
  const [note, setNote] = useState("");
  const generation = useRef(0);
  const validation = useRef(null);
  async function load() {
    const version = ++generation.current;
    setLoading(true);
    setLoadFailed(false);
    setError("");
    try {
      const config = await readSystemConfig();
      if (version !== generation.current) return false;
      setDraft(toDraft(config));
      setSaved(toDraft(config));
      setMetadata(config);
      setErrors([]);
      return true;
    } catch {
      if (version === generation.current) setLoadFailed(true);
      return false;
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    load();
    return () => {
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (errors.length) validation.current?.focus();
  }, [errors]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const locked = loading || loadFailed || busy;
  const clearMessages = () => {
    setError("");
    setErrors([]);
    setNote("");
  };
  const setNumber = (key) => (event) => {
    const value = event.target.value;
    setDraft((prev) => ({ ...prev, [key]: value }));
    clearMessages();
  };
  function discard() {
    setDraft(structuredClone(saved));
    clearMessages();
  }
  function defaults() {
    setDraft({ ...toDraft(DEFAULT_CONFIG), radiusTiers: structuredClone(saved.radiusTiers) });
    clearMessages();
    setNote("Retry defaults loaded into your draft. Save changes to apply them.");
  }
  async function save(event) {
    event.preventDefault();
    if (locked || !dirty) return;
    clearMessages();
    const checked = validateConfig(draft);
    if (!draft.notifRetryLimit.trim()) {
      setErrors(["Enter a retry limit. Use 0 for no retries."]);
      return;
    }
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setBusy(true);
    try {
      await saveSystemConfig(checked.config, user?.uid);
      const refreshed = await load();
      setNote(
        refreshed
          ? "Settings saved. The values below reflect the saved configuration."
          : "Settings were saved, but the refreshed values could not be loaded. Retry loading before editing again.",
      );
    } catch (err) {
      setError(
        err?.message ||
          "Settings could not be saved. Your draft is still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell>
      <div className="admin-workspace">
        <PageHeader title="Settings" />
        <section className="aw-intro settings-intro">
          <div>
            <p className="admin-care-eyebrow">A system that connects</p>
            <h2>
              Keep messages moving.
              <br />
              <em>Keep care moving.</em>
            </h2>
            <p>Choose how interrupted notifications retry.</p>
          </div>
          <div className="settings-saved">
            <span className="admin-care-eyebrow">Last saved</span>
            <strong>{dateLabel(metadata.updatedAt)}</strong>
            <span>
              {metadata.updatedBy === user?.uid
                ? "By you"
                : metadata.updatedBy
                  ? "By an administrator"
                  : "Default configuration"}
            </span>
          </div>
        </section>
        {loading && (
          <div className="aw-empty" role="status">
            Loading settings…
          </div>
        )}
        {loadFailed && (
          <div className="aw-notice aw-error" role="alert">
            <strong>Settings could not be loaded.</strong>
            <p>
              Your draft is protected. Reload the saved values before editing.
            </p>
            <Btn onClick={load}>Try again</Btn>
          </div>
        )}
        <form
          noValidate
          onSubmit={save}
          aria-busy={loading || busy}
          className="settings-layout aw-form"
        >
          <div className="aw-savebar settings-savebar">
            <span role="status">
              {loading
                ? "Loading saved values…"
                : loadFailed
                  ? "Load saved settings to continue"
                  : dirty
                    ? "You have unsaved changes"
                    : metadata.updatedAt
                      ? "All changes saved"
                      : "Default values loaded"}
              <small>
                Saving updates the notification retry policy.
              </small>
            </span>
            <div>
              <Btn onClick={discard} disabled={locked || !dirty}>
                Discard changes
              </Btn>
              <Btn variant="primary" type="submit" disabled={locked || !dirty}>
                {busy ? "Saving…" : "Save changes"}
              </Btn>
            </div>
          </div>
          <div>
            <section className="card aw-panel">
              <div className="aw-panel-heading">
                <div className="aw-step-heading">
                  <span>01</span>
                  <div>
                    <h2>Notification retries</h2>
                    <p>Give an interrupted notification another chance.</p>
                  </div>
                </div>
                <Icon name="refresh" />
              </div>
              <fieldset
                className="aw-panel-body settings-notification-fields"
                disabled={locked}
              >
                <legend className="sr-only">Retry policy</legend>
                <div className="aw-form-grid">
                  <div>
                    <Field label="Retry limit">
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step="1"
                        value={draft.notifRetryLimit}
                        onChange={setNumber("notifRetryLimit")}
                      />
                    </Field>
                    <small className="aw-field-help">
                      0–10 retries. Zero turns retries off.
                    </small>
                  </div>
                  <div>
                    <Field label="Retry interval (minutes)">
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        step="1"
                        value={draft.notifRetryInterval}
                        onChange={setNumber("notifRetryInterval")}
                      />
                    </Field>
                    <small className="aw-field-help">
                      Wait 1–1440 minutes between attempts.
                    </small>
                  </div>
                </div>
              </fieldset>
            </section>
            {!!errors.length && (
              <div
                className="aw-notice aw-error settings-validation"
                tabIndex={-1}
                ref={validation}
                role="alert"
              >
                <strong>Check these values before saving</strong>
                <ul>
                  {errors.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </div>
            )}
            {error && (
              <p className="aw-notice aw-error" role="alert">
                {error}
              </p>
            )}
            {note && (
              <p className="aw-notice" role="status">
                {note}
              </p>
            )}
          </div>
          <aside
            className="settings-preview card aw-panel"
            aria-label="Settings information"
          >
            <div className="aw-panel-heading">
              <div>
                <h2>Settings record</h2>
                <p>
                  {loading
                    ? "Loading configuration…"
                    : loadFailed
                      ? "Configuration unavailable"
                      : dirty
                        ? "Previewing unsaved changes"
                        : "Current configuration"}
                </p>
              </div>
            </div>
            <div className="aw-panel-body">
              {loading || loadFailed ? (
                <p className="settings-help">
                  Saved values will appear here after loading succeeds.
                </p>
              ) : (
                <>
                  <Btn onClick={defaults} disabled={locked}>
                    Load retry defaults into draft
                  </Btn>
                  <details className="settings-metadata">
                    <summary>Saved record</summary>
                    <dl>
                      <dt>Last saved</dt>
                      <dd>{dateLabel(metadata.updatedAt)}</dd>
                      <dt>Administrator ID</dt>
                      <dd>{metadata.updatedBy || "Not recorded"}</dd>
                    </dl>
                  </details>
                </>
              )}
            </div>
          </aside>
        </form>
      </div>
    </AppShell>
  );
}
