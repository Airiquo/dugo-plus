import { useEffect, useRef, useState } from "react";
import { AppShell } from "../../layout/AppShell";
import { useAuth } from "../../hooks/useAuth";
import {
  CONFIG_LIMITS,
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

/** Matching reach and notification retry editor with an unsaved-draft preview. */
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
  const setTier = (index, key) => (event) => {
    const value = event.target.value;
    setDraft((prev) => ({
      ...prev,
      radiusTiers: prev.radiusTiers.map((tier, i) =>
        i === index ? { ...tier, [key]: value } : tier,
      ),
    }));
    clearMessages();
  };
  function addTier() {
    setDraft((prev) => {
      const last = prev.radiusTiers.at(-1);
      return {
        ...prev,
        radiusTiers: [
          ...prev.radiusTiers,
          {
            radiusKm: String(Math.min(100, (Number(last?.radiusKm) || 0) + 5)),
            waitMinutes: String(
              Math.min(1440, (Number(last?.waitMinutes) || 5) + 5),
            ),
          },
        ],
      };
    });
    clearMessages();
  }
  function removeTier(index) {
    setDraft((prev) => ({
      ...prev,
      radiusTiers: prev.radiusTiers.filter((_, i) => i !== index),
    }));
    clearMessages();
  }
  function discard() {
    setDraft(structuredClone(saved));
    clearMessages();
  }
  function defaults() {
    setDraft(toDraft(DEFAULT_CONFIG));
    clearMessages();
    setNote("Defaults loaded into your draft. Save changes to apply them.");
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
  const radii = draft.radiusTiers
    .map((tier) => Number(tier.radiusKm))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 100);
  const maximum = Math.max(1, ...radii);
  const addDisabled =
    locked ||
    draft.radiusTiers.length >= CONFIG_LIMITS.tiers.max ||
    Number(draft.radiusTiers.at(-1)?.radiusKm) >= CONFIG_LIMITS.radiusKm.max;
  return (
    <AppShell>
      <div className="admin-workspace">
        <PageHeader title="Settings" />
        <section className="aw-intro settings-intro">
          <div>
            <p className="admin-care-eyebrow">A system that connects</p>
            <h2>
              Set the reach.
              <br />
              <em>Keep care moving.</em>
            </h2>
            <p>Shape how the search expands and how notifications retry.</p>
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
                Saving updates the shared matching and retry configuration.
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
                    <h2>Matching reach</h2>
                    <p>Start nearby, then expand through each radius tier.</p>
                  </div>
                </div>
                <span className="pill">{draft.radiusTiers.length}/8 tiers</span>
              </div>
              <div className="aw-panel-body">
                <p className="settings-help">
                  Each radius must be larger than the one before it. Configure
                  1–8 tiers, up to 100 km.
                </p>
                <fieldset disabled={locked} className="settings-tier-list">
                  <legend className="sr-only">Radius tiers</legend>
                  {draft.radiusTiers.map((tier, index) => (
                    <div key={index} className="settings-tier">
                      <div className="settings-tier-label">
                        <span>0{index + 1}</span>
                        <strong>
                          {index === 0
                            ? "Start here"
                            : `Expand to tier ${index + 1}`}
                        </strong>
                      </div>
                      <Field label="Radius (km)">
                        <Input
                          type="number"
                          aria-label={`Radius ${index + 1} (km)`}
                          min={1}
                          max={100}
                          step="any"
                          value={tier.radiusKm}
                          onChange={setTier(index, "radiusKm")}
                        />
                      </Field>
                      <Field label="Wait (minutes)">
                        <Input
                          type="number"
                          aria-label={`Wait ${index + 1} (minutes)`}
                          min={1}
                          max={1440}
                          step="1"
                          value={tier.waitMinutes}
                          onChange={setTier(index, "waitMinutes")}
                        />
                      </Field>
                      <Btn
                        icon="x"
                        aria-label={`Remove tier ${index + 1}`}
                        title={
                          draft.radiusTiers.length === 1
                            ? "Keep at least one tier"
                            : `Remove tier ${index + 1}`
                        }
                        onClick={() => removeTier(index)}
                        disabled={draft.radiusTiers.length <= 1}
                      />
                    </div>
                  ))}
                </fieldset>
                <Btn icon="plus" onClick={addTier} disabled={addDisabled}>
                  Add radius tier
                </Btn>
                {Number(draft.radiusTiers.at(-1)?.radiusKm) >= 100 && (
                  <p className="aw-field-help settings-limit-note">
                    Maximum search radius reached.
                  </p>
                )}
              </div>
            </section>
            <section className="card aw-panel">
              <div className="aw-panel-heading">
                <div className="aw-step-heading">
                  <span>02</span>
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
            aria-label="Draft configuration preview"
          >
            <div className="aw-panel-heading">
              <div>
                <h2>Your search ladder</h2>
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
                  <svg
                    className="settings-reach-figure"
                    viewBox="0 0 240 240"
                    aria-hidden="true"
                  >
                    {radii.map((radius, index) => (
                      <circle
                        key={index}
                        cx="120"
                        cy="120"
                        r={20 + (radius / maximum) * 85}
                      />
                    ))}
                    <circle
                      cx="120"
                      cy="120"
                      r="9"
                      className="settings-reach-center"
                    />
                  </svg>
                  <div className="settings-preview-radius">
                    <strong>{radii.length ? maximum : "—"}</strong>
                    <span>km draft reach</span>
                  </div>
                  <ol className="settings-preview-tiers">
                    {draft.radiusTiers.map((tier, index) => (
                      <li key={index}>
                        <span>Tier {index + 1}</span>
                        <strong>{tier.radiusKm || "—"} km</strong>
                        <small>{tier.waitMinutes || "—"} min wait</small>
                      </li>
                    ))}
                  </ol>
                  <p className="aw-footnote">
                    Search begins at the first tier. Every following tier
                    reaches farther.
                  </p>
                  <Btn onClick={defaults} disabled={locked}>
                    Load defaults into draft
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
