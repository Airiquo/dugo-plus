import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Btn,
  Field,
  FieldError,
  HospitalNotice,
  HospitalPageHeader,
  Icon,
  Input,
  LinkBtn,
  Select,
} from "../../components";
import { HospitalShell } from "../../layout/HospitalShell";
import { useAuth } from "../../hooks/useAuth";
import {
  COMPONENTS,
  componentLabel,
  createRequest,
  fetchHospital,
} from "../../services/requests";
import { isMatchingConfigured, triggerMatch } from "../../services/matching";
import { validateRequest } from "../../utils/validate";

const GROUPS = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];
const PRIORITIES = [
  {
    value: "routine",
    label: "Routine",
    detail: "Standard collection needs",
    icon: "droplet",
  },
  {
    value: "urgent",
    label: "Urgent",
    detail: "Time-sensitive care",
    icon: "clock",
  },
  {
    value: "stat",
    label: "Stat",
    detail: "Needed within the hour",
    icon: "alert",
  },
];
const EMPTY = { bloodType: "", component: "", quantity: "", urgencyLevel: "" };

/** Facility request composer with explicit choices and a live summary before posting. */
export default function NewRequest() {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const { user, profile } = useAuth();
  const hospitalId = profile?.hospitalId || "";
  const [hospital, setHospital] = useState(null);
  const [checked, setChecked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!hospitalId) {
      setChecked(true);
      return;
    }
    let active = true;
    setChecked(false);
    fetchHospital(hospitalId)
      .then((found) => {
        if (active) setHospital(found);
      })
      .catch(() => {
        if (active) setHospital(null);
      })
      .finally(() => {
        if (active) setChecked(true);
      });
    return () => {
      active = false;
    };
  }, [hospitalId, attempt]);
  const ready = checked && Boolean(hospital);
  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setMessage("");
  }
  async function submit(event) {
    event.preventDefault();
    if (!ready || busy) return;
    const found = validateRequest(form);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      formRef.current?.querySelector(`[name="${first}"]`)?.focus();
      return;
    }
    setBusy(true);
    setMessage("");
    let requestId;
    try {
      requestId = await createRequest({
        hospital,
        values: form,
        createdBy: user?.uid || null,
      });
    } catch (error) {
      setMessage(
        error?.message ||
          "Your request could not be posted. Your entries are saved here; try again.",
      );
      setBusy(false);
      return;
    }
    try {
      await triggerMatch(requestId);
    } catch {
      /* Scheduled matching also discovers newly posted requests. */
    }
    navigate("/hospital/requests");
  }
  return (
    <HospitalShell facility={hospital?.name}>
      <HospitalPageHeader
        title="Create a blood request"
        description="Tell us what’s needed. We’ll help connect your facility with compatible donors."
        eyebrow="Requests / New request"
        actions={<LinkBtn to="/hospital/requests">Back to requests</LinkBtn>}
      />
      {!hospitalId ? (
        <HospitalNotice tone="attention" title="A facility link is needed">
          Ask your administrator to link this account before posting.
        </HospitalNotice>
      ) : checked && !hospital ? (
        <HospitalNotice tone="error" title="Your facility couldn’t load">
          <p>Your entries stay here while you reconnect.</p>
          <Btn onClick={() => setAttempt((n) => n + 1)}>Try again</Btn>
        </HospitalNotice>
      ) : (
        <div className="hw-compose-grid">
          <form
            ref={formRef}
            className="card hw-compose"
            noValidate
            onSubmit={submit}
            aria-busy={busy}
          >
            {!checked && (
              <HospitalNotice title="Loading your facility…">
                You can review the form while we connect.
              </HospitalNotice>
            )}
            {!isMatchingConfigured() && (
              <HospitalNotice
                tone="attention"
                title="Immediate matching is unavailable"
              >
                You can still post. The scheduled matching run will pick up your
                request.
              </HospitalNotice>
            )}
            <fieldset disabled={busy || !ready} className="hw-form-section">
              <legend>
                <span>01</span> What’s needed?
              </legend>
              <p>Choose the required blood group and component.</p>
              <fieldset
                className="hw-group-choices"
                aria-describedby={
                  errors.bloodType ? "req-blood-error" : undefined
                }
              >
                <legend>Blood type</legend>
                <div>
                  {GROUPS.map((group) => (
                    <label key={group}>
                      <input
                        type="radio"
                        name="bloodType"
                        value={group}
                        checked={form.bloodType === group}
                        onChange={(e) => set("bloodType", e.target.value)}
                        aria-invalid={Boolean(errors.bloodType) || undefined}
                      />
                      <span>{group}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <FieldError id="req-blood-error">{errors.bloodType}</FieldError>
              <div className="hw-form-pair">
                <Field label="Component">
                  <Select
                    name="component"
                    options={[
                      { value: "", label: "Choose a component" },
                      ...COMPONENTS,
                    ]}
                    value={form.component}
                    onChange={(e) => set("component", e.target.value)}
                    aria-invalid={Boolean(errors.component) || undefined}
                    aria-describedby={
                      errors.component ? "req-component-error" : undefined
                    }
                  />
                  <FieldError id="req-component-error">
                    {errors.component}
                  </FieldError>
                </Field>
                <Field label="Units needed">
                  <Input
                    name="quantity"
                    type="number"
                    min="1"
                    max="99"
                    step="1"
                    inputMode="numeric"
                    placeholder="e.g. 4"
                    value={form.quantity}
                    onChange={(e) => set("quantity", e.target.value)}
                    aria-invalid={Boolean(errors.quantity) || undefined}
                    aria-describedby={
                      errors.quantity ? "req-quantity-error" : undefined
                    }
                  />
                  <FieldError id="req-quantity-error">
                    {errors.quantity}
                  </FieldError>
                </Field>
              </div>
            </fieldset>
            <fieldset disabled={busy || !ready} className="hw-form-section">
              <legend>
                <span>02</span> How soon is it needed?
              </legend>
              <p>Priority helps staff and donors understand the need.</p>
              <div
                className="hw-urgency-choices"
                role="radiogroup"
                aria-label="Urgency"
                aria-describedby={
                  errors.urgencyLevel ? "req-urgency-error" : undefined
                }
              >
                {PRIORITIES.map((item) => (
                  <label key={item.value} data-priority={item.value}>
                    <input
                      type="radio"
                      name="urgencyLevel"
                      value={item.value}
                      checked={form.urgencyLevel === item.value}
                      onChange={(e) => set("urgencyLevel", e.target.value)}
                      aria-invalid={Boolean(errors.urgencyLevel) || undefined}
                    />
                    <span>
                      <Icon name={item.icon} size={20} />
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </label>
                ))}
              </div>
              <FieldError id="req-urgency-error">
                {errors.urgencyLevel}
              </FieldError>
            </fieldset>
            {message && (
              <HospitalNotice tone="error" title="Request not posted">
                {message}
              </HospitalNotice>
            )}
            <div className="hw-form-footer">
              <span>
                <Icon name="shield" size={17} />
                Shared with compatible nearby donors
              </span>
              <Btn
                type="submit"
                variant="primary"
                icon="arrow-right"
                disabled={busy || !ready}
              >
                {busy ? "Posting request…" : "Post request"}
              </Btn>
            </div>
          </form>
          <aside className="hw-compose-aside">
            <section className="card hw-request-summary">
              <p className="hw-eyebrow">Before you post</p>
              <h2>Your request at a glance</h2>
              <div className="hw-summary-blood">
                <span>{form.bloodType || "—"}</span>
                <div>
                  <strong>
                    {form.component
                      ? componentLabel(form.component)
                      : "Choose a component"}
                  </strong>
                  <small>
                    {form.quantity
                      ? `${form.quantity} units requested`
                      : "Set the units needed"}
                  </small>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Priority</dt>
                  <dd>
                    {PRIORITIES.find((p) => p.value === form.urgencyLevel)
                      ?.label || "Not selected"}
                  </dd>
                </div>
                <div>
                  <dt>Facility</dt>
                  <dd>{hospital?.name || "Loading…"}</dd>
                </div>
                <div>
                  <dt>Collection location</dt>
                  <dd>{hospital?.address || "Saved facility location"}</dd>
                </div>
              </dl>
              <p className="hw-summary-note">
                <Icon name="lock" size={16} />
                Your administrator manages this location.
              </p>
            </section>
            <section className="hw-help-panel">
              <Icon name="target" size={24} />
              <h3>From request to connection</h3>
              <ol>
                <li>The request enters your facility’s queue.</li>
                <li>Compatible donors are notified as matching runs.</li>
                <li>Accepted donors visit for screening before donation.</li>
              </ol>
              <p>Matching depends on donor eligibility and availability.</p>
            </section>
          </aside>
        </div>
      )}
    </HospitalShell>
  );
}
