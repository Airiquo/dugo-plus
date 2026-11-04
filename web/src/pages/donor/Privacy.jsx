import { RecordFilters } from "../../components/RecordFilters";
import { filterRecords } from "../../utils/recordFilters";
import { SupportContact } from "../../components/SupportContact";
import { TableExport } from "../../components/TableExport";
import { privacyReportColumns } from "../../utils/reportColumns";
import { rejectionReasonLabel } from "../../utils/dataRequestReview";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import {
  REQUEST_TYPES,
  DETAILS_LIMIT,
  createDataRequest,
  listMyDataRequests,
  requestStatusLabel,
  requestTypeLabel,
} from "../../services/dataRequests";
import { AdminDialog, Badge, Btn, FieldError, CarePageHeader } from "../../components";
import { DonorNav } from "../../layout/DonorNav";

/** Donor data-request submission, history and read-only responses (FR-039/NFR-19). */

const TYPE_HINTS = {
  Access: "A copy of what Dugo+ holds about you, sent by the support team.",
  Rectification:
    "Correct a name, phone number or city that is wrong or out of date.",
  Erasure: "Have your identifying details removed and your account closed.",
  Export: "A machine-readable copy of your records you can take elsewhere.",
  Other: "Describe another request about how Dugo+ handles your personal data.",
};

const STATUS_TONE = {
  Pending: "pending",
  InProgress: "info",
  Completed: "active",
  Rejected: "rejected",
};

function dateLabel(value) {
  if (!value) return "—";
  const date = typeof value.toDate === "function" ? value.toDate() : value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function Privacy() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [recordFilters, setRecordFilters] = useState({
    search: "",
    from: "",
    to: "",
    requestType: "all",
    status: "all",
  });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState("Access");
  const [details, setDetails] = useState("");
  const [formError, setFormError] = useState("");
  const [active, setActive] = useState(null);
  const generation = useRef(0);

  const load = () => {
    if (!user?.uid) return;
    const current = ++generation.current;
    setLoading(true);
    setError("");
    listMyDataRequests(user.uid)
      .then((rows) => { if (current === generation.current) setRequests(rows); })
      .catch(() => {
        if (current === generation.current) setError(
          "Could not load your requests. Check your connection and try again.",
        );
      })
      .finally(() => { if (current === generation.current) setLoading(false); });
  };

  useEffect(() => {
    setRequests([]);
    setActive(null);
    load();
    return () => { generation.current++; };
  }, [user?.uid]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    setError("");
    setNote("");
    if (!details.trim()) {
      setFormError("Describe what you need so the team can act on it.");
      return;
    }
    if (details.trim().length > DETAILS_LIMIT) {
      setFormError(`Keep the description under ${DETAILS_LIMIT} characters.`);
      return;
    }
    if (!user?.uid) {
      setFormError("Sign in again to submit a request.");
      return;
    }

    setBusy(true);
    try {
      await createDataRequest(user.uid, type, details);
      setDetails("");
      setNote("Request submitted. Its status appears below.");
      load();
    } catch (err) {
      setFormError(err?.message || "Could not submit the request.");
    } finally {
      setBusy(false);
    }
  };

  const visible = filterRecords(requests, recordFilters, {
    search: (row) => `${row.id} ${row.details || ""} ${row.adminNote || ""}`,
  });
  return (
    <div
      className="pub donor-surface"
      data-theme={theme}
      style={{ display: "grid", gridTemplateRows: "auto 1fr" }}
    >
      <DonorNav />

      <main id="top" className="profile-main donor-main">
        <CarePageHeader
          kicker="Built on trust"
          title={
            <>
              Your data.
              <br />
              <em>Your say.</em>
            </>
          }
          description="See, correct, export or request the removal of your information. You stay in control of your connection."
        />
        <div className="privacy-stack">
          <form
            className="pub-card pub-form profile-card privacy-card"
            noValidate
            onSubmit={submit}
          >
            <p className="pub-kicker">Your data</p>
            <h3>Privacy &amp; data requests</h3>
            <p className="pub-muted">
              Ask to see what we hold, correct it, export it, have it erased, or make another data request.
              The <Link to="/privacy">privacy notice</Link> says what is kept
              and why.
            </p>

            <div className="profile-section">
              <label>
                <span>What are you asking for?</span>
                <span className="app-select">
                  <select
                    value={type}
                    disabled={busy}
                    onChange={(event) => {
                      setType(event.target.value);
                      setFormError("");
                      setNote("");
                    }}
                  >
                    {REQUEST_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {requestTypeLabel(value)}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <p className="pub-fine">{TYPE_HINTS[type]}</p>
            </div>

            <div className="profile-section">
              <label>
                <span>Details (required)</span>
                <textarea
                  rows={4}
                  value={details}
                  maxLength={DETAILS_LIMIT}
                  disabled={busy}
                  required
                  aria-invalid={Boolean(formError) || undefined}
                  aria-describedby={
                    formError
                      ? "privacy-details-error"
                      : "privacy-details-count"
                  }
                  placeholder="Which fields to correct, what to erase, or where to send the copy."
                  onChange={(event) => {
                    setDetails(event.target.value);
                    setFormError("");
                    setNote("");
                  }}
                />
              </label>
              <FieldError id="privacy-details-error">{formError}</FieldError>
              <p className="pub-fine" id="privacy-details-count">
                {details.length}/{DETAILS_LIMIT} characters
              </p>
            </div>

            {error && (
              <p className="pub-msg" data-kind="error" role="alert">
                {error}
              </p>
            )}
            {note && (
              <p className="pub-msg" data-kind="info" role="status">
                {note}
              </p>
            )}

            <div className="profile-actions">
              <button
                className="pub-btn pub-btn-wide"
                type="submit"
                disabled={busy}
              >
                {busy ? "Submitting…" : "Submit request"}
              </button>
              <Link
                className="pub-btn pub-btn-ghost pub-btn-wide"
                to="/donor/profile"
              >
                Back to your profile
              </Link>
            </div>
          </form>

          <section
            className="pub-card pub-form profile-card privacy-card"
            aria-labelledby="privacy-history-h"
          >
            <p className="pub-kicker">History</p>
            <h3 id="privacy-history-h">Your requests</h3>
            <p className="pub-muted">
              Only you and the Dugo+ team can see these.
            </p>

            <RecordFilters
              name="privacy requests"
              value={recordFilters}
              onChange={setRecordFilters}
              fields={[
                {
                  key: "requestType",
                  label: "Request type",
                  options: REQUEST_TYPES.map((value) => ({
                    value,
                    label: requestTypeLabel(value),
                  })),
                },
                {
                  key: "status",
                  label: "Status",
                  options: [
                    "Pending",
                    "InProgress",
                    "Completed",
                    "Rejected",
                  ].map((value) => ({
                    value,
                    label: requestStatusLabel(value),
                  })),
                },
              ]}
              disabled={loading || Boolean(error)}
            />
            <TableExport
              name="your-data-requests"
              title="Your privacy requests"
              columns={privacyReportColumns}
              disabled={loading || Boolean(error)}
              getRows={(scope) => (scope === "filtered" ? visible : requests)}
            />
            {loading && <p className="pub-msg">Loading your requests…</p>}
            {!loading && error && requests.length === 0 && (
              <p className="pub-msg" data-kind="error" role="alert">
                {error}
              </p>
            )}
            {!loading && error && <Btn onClick={load}>Try again</Btn>}
            {!loading && !error && requests.length === 0 && (
              <p className="pub-muted">You have not submitted a request yet.</p>
            )}

            {!loading && !error && requests.length > 0 && !visible.length && (
              <p className="pub-muted" role="status">
                No requests match these filters. Reset filters to see all your
                requests.
              </p>
            )}
            {visible.length > 0 && (
              <ul className="privacy-requests">
                {visible.map((request) => (
                  <li key={request.id}>
                    <div className="privacy-request-head">
                      <div className="privacy-request-title">
                        <span className="privacy-request-type">
                          {requestTypeLabel(request.requestType)}
                        </span>
                        <Btn
                          onClick={() => setActive(request)}
                          aria-label={`View ${requestTypeLabel(request.requestType)}, request ${request.id}`}
                        >
                          View
                        </Btn>
                      </div>
                      <Badge
                        data-status={STATUS_TONE[request.status] ?? "pending"}
                      >
                        {requestStatusLabel(request.status)}
                      </Badge>
                    </div>
                    {request.details && (
                      <p className="privacy-request-details">
                        {request.details}
                      </p>
                    )}
                    <p className="privacy-request-meta">
                      <span>Sent {dateLabel(request.createdAt)}</span>
                      <span>
                        {request.resolvedAt
                          ? `Answered ${dateLabel(request.resolvedAt)}`
                          : "Awaiting an answer"}
                      </span>
                    </p>
                    {request.adminNote && (
                      <p className="privacy-request-note">
                        <strong>Dugo+</strong> {request.adminNote}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <AdminDialog
          name="privacy-request"
          open={!!active}
          onClose={() => setActive(null)}
          title={active ? requestTypeLabel(active.requestType) : "Your request"}
          eyebrow="Your privacy request"
        >
          {active && (
            <>
              <div className="privacy-review-top">
                <Badge data-status={STATUS_TONE[active.status] ?? "pending"}>
                  {requestStatusLabel(active.status)}
                </Badge>
                <span>Sent {dateLabel(active.createdAt)}</span>
              </div>
              <dl className="aw-facts">
                <div>
                  <dt>Request ID</dt>
                  <dd className="aw-record-id">{active.id}</dd>
                </div>
                <div>
                  <dt>Answered</dt>
                  <dd>{active.resolvedAt ? dateLabel(active.resolvedAt) : "Not answered yet"}</dd>
                </div>
              </dl>
              <section className="privacy-subject-note">
                <h3>Your original request</h3>
                <p>{active.details || "No additional details were recorded."}</p>
              </section>
              <section className="privacy-response">
                <h3>Dugo+ response</h3>
                {active.status === "Rejected" && (
                  <p><strong>Rejection reason:</strong> {rejectionReasonLabel(active.rejectionReason)}</p>
                )}
                <p>
                  {active.adminNote || (["Pending", "InProgress"].includes(active.status)
                    ? "The team has not added a response yet. Your request is awaiting review."
                    : "No written response was recorded for this request.")}
                </p>
                {active.resolutionAction && (
                  <p><strong>Action recorded:</strong> {active.resolutionAction}</p>
                )}
              </section>
              <Btn onClick={() => setActive(null)}>Close request</Btn>
            </>
          )}
        </AdminDialog>
        <SupportContact as="footer" />
      </main>
    </div>
  );
}
