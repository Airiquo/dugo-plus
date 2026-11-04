import { TableExport } from "../../components/TableExport";
import { privacyReportColumns } from "../../utils/reportColumns";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../layout/AppShell";
import { useAuth } from "../../hooks/useAuth";
import {
  listUsers,
  anonymiseUser,
  correctUserProfile,
} from "../../services/users";
import { collectUserData, downloadUserData } from "../../services/dataExport";
import {
  listAllDataRequests,
  REQUEST_TYPES,
  requestStatusLabel,
  requestTypeLabel,
  updateDataRequest,
} from "../../services/dataRequests";
import { useTableSort } from "../../hooks/useTableSort";
import { sortRows, sortDate } from "../../utils/sortRows";
import { matchesRequestStatus, REJECTION_REASONS, rejectionReasonLabel } from "../../utils/dataRequestReview";
import {
  AdminDialog,
  Btn,
  Field,
  Icon,
  Input,
  PageHeader,
  Select,
  Table,
  Textarea,
} from "../../components";

/**
 * Admin data-subject request queue (FR-039/NFR-19).
 *
 * Each request opens into the work it needs: an access/export copy assembled
 * from the subject's own records, a correction applied to the profile, or an
 * erasure that scrubs the profile and closes the account. The administrator
 * records the action and a note, and the request closes with a server time.
 */

function dateLabel(value) {
  if (!value) return "—";
  const date = typeof value.toDate === "function" ? value.toDate() : value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const STATUS_OPTIONS = ["Pending", "InProgress", "Completed", "Rejected"];

export default function DataRequests() {
  const { sort, toggleSort, setSort } = useTableSort();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [activeId, setActiveId] = useState("");
  const [working, setWorking] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [correction, setCorrection] = useState({
    fullName: "",
    phoneNumber: "",
    city: "",
  });
  const [confirmErase, setConfirmErase] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [directoryError, setDirectoryError] = useState("");
  const generation = useRef(0);
  const notice = useRef(null);
  const noteInput = useRef(null);
  const reasonInput = useRef(null);
  useEffect(() => {
    if (!activeId && note) notice.current?.focus();
  }, [activeId, note]);

  const load = async () => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const [list, people] = await Promise.all([
        listAllDataRequests(),
        listUsers().catch(() => null),
      ]);
      if (current !== generation.current) return;
      setRequests(list);
      setAccounts(people || []);
      setDirectoryError(
        people
          ? ""
          : "Account details are unavailable. Requests can still be reviewed; profile changes are disabled until details load.",
      );
    } catch {
      if (current === generation.current)
        setError(
          "Requests could not be loaded. Check your connection and try again.",
        );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };
  useEffect(() => {
    load();
    return () => {
      generation.current++;
    };
  }, []);
  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, typeFilter, sort.key, sort.direction]);

  const byId = useMemo(() => {
    const map = new Map();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const filtered = requests.filter((row) => {
    const person = byId.get(row.userId);
    return (
      matchesRequestStatus(row.status, statusFilter) &&
      (typeFilter === "all" || row.requestType === typeFilter) &&
      [person?.fullName, person?.email, row.userId, row.id, row.details]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  });
  const orderedRequests = sortRows(
    filtered,
    {
      createdAt: (row) => sortDate(row.createdAt),
      subject: (row) =>
        byId.get(row.userId)?.fullName || byId.get(row.userId)?.email || null,
      type: (row) => requestTypeLabel(row.requestType),
      status: (row) => requestStatusLabel(row.status),
    }[sort.key],
    sort.direction,
  );
  const pages = Math.max(1, Math.ceil(orderedRequests.length / 10));
  const currentPage = Math.min(page, pages);
  const rows = orderedRequests.slice((currentPage - 1) * 10, currentPage * 10);
  const active = requests.find((r) => r.id === activeId) || null;
  const subject = active ? byId.get(active.userId) : null;
  const closed = active && ["Completed", "Rejected"].includes(active.status);

  const open = (request) => {
    setActiveId(request.id);
    setAdminNote(request.adminNote || "");
    setResolution(request.resolutionAction || "");
    setRejectionReason(request.rejectionReason || "");
    setCorrection({
      fullName: byId.get(request.userId)?.fullName || "",
      phoneNumber: byId.get(request.userId)?.phoneNumber || "",
      city: byId.get(request.userId)?.city || "",
    });
    setConfirmErase(false);
    setError("");
    setNote("");
  };

  const close = () => {
    if (working) return;
    setActiveId("");
    setConfirmErase(false);
  };

  const move = async (status, action = resolution, extraNote = "") => {
    if (!active || closed || working) return;
    if (["Completed", "Rejected"].includes(status) && !adminNote.trim()) {
      setError(
        "Add a resolution note before completing or rejecting this request.",
      );
      noteInput.current?.focus();
      return;
    }
    if (status === "Completed" && !action) {
      setError("Record the action taken before completing this request.");
      return;
    }
    if (status === "Rejected" && !rejectionReason) {
      setError("Choose a rejection reason and explain it in the resolution note.");
      reasonInput.current?.focus();
      return;
    }
    setWorking(status);
    setError("");
    setNote("");
    try {
      const joined = [adminNote.trim(), extraNote.trim()]
        .filter(Boolean)
        .join(" ");
      await updateDataRequest(active.id, {
        status,
        processedBy: user?.uid,
        adminNote: joined,
        resolutionAction: action,
        rejectionReason,
      });
      setAdminNote(joined);
      setResolution(action);
      setNote(`Request marked ${requestStatusLabel(status)}.`);
      await load();
      if (status === "Completed" || status === "Rejected") setActiveId("");
    } catch (err) {
      setError(err?.message || "Could not update the request.");
    } finally {
      setWorking("");
    }
  };

  const generateExport = async () => {
    if (!active || closed || working) return;
    setWorking("export");
    setError("");
    setNote("");
    try {
      const bundle = await collectUserData(active.userId);
      const filename = downloadUserData(bundle, active.userId);
      setResolution("Export");
      setNote(
        `Data copy generated (${filename}). Send it over a channel the subject controls.`,
      );
    } catch (err) {
      setError(err?.message || "Could not assemble the data copy.");
    } finally {
      setWorking("");
    }
  };

  const applyCorrection = async () => {
    if (!active || closed || working || !subject || subject.personalDataErased)
      return;
    if (!correction.fullName.trim()) {
      setError("A corrected name is required.");
      return;
    }
    setWorking("correction");
    setError("");
    setNote("");
    try {
      await correctUserProfile(active.userId, {
        fullName: correction.fullName,
        phoneNumber: correction.phoneNumber,
        city: correction.city,
      });
      setResolution("Correction");
      setNote(
        "Profile corrected. Complete the request once the subject confirms.",
      );
      await load();
    } catch (err) {
      setError(err?.message || "Could not save the correction.");
    } finally {
      setWorking("");
    }
  };

  const erasePersonalData = async () => {
    if (!active || closed || working || !subject || subject.personalDataErased)
      return;
    if (!adminNote.trim()) {
      setError(
        "Record the reason for erasure in the note before deleting anything.",
      );
      return;
    }
    setWorking("erasure");
    setError("");
    setNote("");
    try {
      await anonymiseUser(active.userId, adminNote.trim());
      setResolution("Deletion");
      setNote(
        "Profile personal data erased and the account closed. Donation history is retained. Delete the sign-in record from Accounts to remove the stored email.",
      );
      await load();
      setConfirmErase(false);
    } catch (err) {
      setError(err?.message || "Could not erase the personal data.");
    } finally {
      setWorking("");
    }
  };

  const statusTone = (value) =>
    ({
      Pending: "inactive",
      InProgress: "collecting",
      Completed: "active",
      Rejected: "emergency",
    })[value];
  const columns = [
    {
      key: "subject",
      mobileWide: true,
      header: "Requested by",
      render: (req) => (
        <div className="aw-person">
          <strong>
            {byId.get(req.userId)?.fullName || "Account unavailable"}
          </strong>
          <small>{byId.get(req.userId)?.email || req.userId}</small>
        </div>
      ),
    },
    {
      key: "type",
      mobileWide: true,
      header: "Request",
      render: (req) => (
        <div className="aw-person">
          <strong>{requestTypeLabel(req.requestType)}</strong>
          <small className="privacy-request-snippet">
            {req.details || "No additional details"}
          </small>
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Submitted",
      render: (req) => <time>{dateLabel(req.createdAt)}</time>,
    },
    {
      key: "status",
      header: "Status",
      render: (req) => (
        <span className="chip" data-status={statusTone(req.status)}>
          {requestStatusLabel(req.status)}
        </span>
      ),
    },
    {
      key: "actions",
      mobileWide: true,
      header: "Review",
      sortable: false,
      render: (req) => (
        <Btn onClick={() => open(req)} aria-label={`${matchesRequestStatus(req.status, "closed") ? "View" : "Review"} request ${req.id}`}>
          {matchesRequestStatus(req.status, "closed") ? "View" : "Review"} <span aria-hidden="true">↗</span>
        </Btn>
      ),
    },
  ];
  return (
    <AppShell>
      <div className="admin-workspace">
        <PageHeader
          title="Data Requests"
          actions={
            <Btn icon="refresh" onClick={load} disabled={loading || !!working}>
              Refresh
            </Btn>
          }
        />
        <section className="aw-intro">
          <div>
            <p className="admin-care-eyebrow">Privacy, put into practice</p>
            <h2>
              Handle every request
              <br />
              <em>with care.</em>
            </h2>
            <p>
              Review what people need, take the right action, and keep a clear
              record.
            </p>
          </div>
          <div className="aw-intro-note">
            <Icon name="shield" />
            <p>
              Personal information.
              <br />
              <strong>Considered decisions.</strong>
            </p>
          </div>
        </section>
        <div className="aw-metrics" aria-label="Queue overview">
          {[
            [
              "open",
              "Needs attention",
              requests.filter((r) =>
                ["Pending", "InProgress"].includes(r.status),
              ).length,
              "clock",
            ],
            [
              "InProgress",
              "In progress",
              requests.filter((r) => r.status === "InProgress").length,
              "file",
            ],
            [
              "closed",
              "Closed requests",
              requests.filter((r) => matchesRequestStatus(r.status, "closed")).length,
              "check",
            ],
          ].map(([key, label, count, icon]) => (
            <button
              key={key}
              className="card aw-metric"
              type="button"
              aria-pressed={statusFilter === key}
              onClick={() => {
                setStatusFilter(key);
                setQuery("");
                setTypeFilter("all");
                setPage(1);
              }}
            >
              <span className="aw-metric-top">
                {label}
                <Icon name={icon} />
              </span>
              <strong>{loading || error ? "—" : count}</strong>
              <small>
                {key === "open"
                  ? "Pending + in progress"
                  : key === "closed" ? "Completed + rejected" : "View these requests"}{" "}
                <span aria-hidden="true">↗</span>
              </small>
            </button>
          ))}
        </div>
        <section className="card aw-panel" aria-label="Request queue">
          <div className="aw-panel-heading">
            <div>
              <h2>Request queue</h2>
              <p>
                Open requests first. Review the details before taking action.
              </p>
            </div>
            <span className="pill">
              {loading ? "Loading…" : error ? "Unavailable" : `${filtered.length} results`}
            </span>
          </div>
          <div className="aw-inline-actions privacy-queue-views" aria-label="Request views">
            <Btn aria-pressed={statusFilter === "open"} onClick={() => setStatusFilter("open")}>Open requests</Btn>
            <Btn aria-pressed={statusFilter === "closed"} onClick={() => setStatusFilter("closed")}>Closed requests</Btn>
          </div>
          <div className="aw-filters">
            <label className="aw-label">
              Find a request
              <input
                type="search"
                placeholder="Name, email, request ID or details"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="aw-label">
              Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="open">Needs attention</option>
                <option value="closed">Closed · completed + rejected</option>
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {requestStatusLabel(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="aw-label">
              Request type
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All types</option>
                {REQUEST_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {requestTypeLabel(v)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {note && !active && (
            <p className="aw-notice" role="status" ref={notice} tabIndex={-1}>
              {note}
            </p>
          )}
          {directoryError && (
            <p className="aw-notice" role="status">
              {directoryError}
            </p>
          )}
          <TableExport
            name="data-requests"
            title="Privacy requests"
            columns={privacyReportColumns}
            disabled={loading || Boolean(error)}
            getRows={(scope) =>
              scope === "filtered" ? orderedRequests : requests
            }
          />
          {loading ? (
            <div className="aw-empty" role="status">
              Loading requests…
            </div>
          ) : error && !active ? (
            <div className="aw-empty" role="alert">
              <h3>Requests could not be loaded</h3>
              <p>{error}</p>
              <Btn onClick={load}>Try again</Btn>
            </div>
          ) : rows.length ? (
            <Table
              mobileCards
              className="aw-table privacy-table"
              columns={columns}
              rows={rows}
              sort={sort}
              onSort={toggleSort}
              onSortChange={setSort}
              rowKey={(row) => row.id}
            />
          ) : (
            <div className="aw-empty">
              <Icon name="check" />
              <h3>
                {requests.length
                  ? "No requests match this view"
                  : "No requests yet"}
              </h3>
              <p>
                {requests.length
                  ? "Change the filters or search to see other requests."
                  : "New privacy requests will appear here for review."}
              </p>
              {!!requests.length && (
                <Btn
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("all");
                    setTypeFilter("all");
                  }}
                >
                  Clear filters
                </Btn>
              )}
            </div>
          )}
          <footer className="aw-pagination">
            <span>
              {error ? "Request counts unavailable" : `Page ${currentPage} of ${pages} · ${filtered.length} matching requests`}
            </span>
            <div>
              <Btn
                disabled={currentPage <= 1 || loading}
                onClick={() => setPage(currentPage - 1)}
              >
                ← Previous
              </Btn>
              <Btn
                disabled={currentPage >= pages || loading}
                onClick={() => setPage(currentPage + 1)}
              >
                Next →
              </Btn>
            </div>
          </footer>
        </section>
        <p className="aw-footnote">
          Actions are recorded under your administrator account. A data copy is
          downloaded to your device; share it only through a verified channel.
        </p>
        <AdminDialog
          name="data-request"
          open={!!active}
          busy={!!working}
          onClose={close}
          title={
            active ? requestTypeLabel(active.requestType) : "Review request"
          }
        >
          {active && (
            <>
              <div className="privacy-review-top">
                <span className="chip" data-status={statusTone(active.status)}>
                  {requestStatusLabel(active.status)}
                </span>
                <span>{dateLabel(active.createdAt)}</span>
              </div>
              <dl className="aw-facts">
                <div>
                  <dt>Requested by</dt>
                  <dd>
                    {subject?.fullName || "Account unavailable"}
                    <small>{subject?.email || active.userId}</small>
                  </dd>
                </div>
                <div>
                  <dt>Request ID</dt>
                  <dd className="aw-record-id">{active.id}</dd>
                </div>
                {active.processedBy && (
                  <div>
                    <dt>Processed by</dt>
                    <dd>
                      {byId.get(active.processedBy)?.fullName ||
                        active.processedBy}
                    </dd>
                  </div>
                )}
                {active.resolvedAt && (
                  <div>
                    <dt>Resolved</dt>
                    <dd>{dateLabel(active.resolvedAt)}</dd>
                  </div>
                )}
              </dl>
              <section className="privacy-subject-note">
                <p className="admin-care-eyebrow">In their words</p>
                <p>{active.details || "No further details were provided."}</p>
              </section>
              {closed && (
                <p className="aw-notice" role="status">
                  This request is closed. Its resolution is available below;
                  processing actions are disabled.
                </p>
              )}
              <section className="privacy-work">
                <div className="aw-step-heading">
                  <span>01</span>
                  <div>
                    <h3>Take action</h3>
                    <p>Review the request and perform the work it needs.</p>
                  </div>
                </div>
                {active.requestType === "Other" && <p>Read the request and provide a written response below. Select “Written response provided” once the response is ready.</p>}
                {(active.requestType === "Access" ||
                  active.requestType === "Export") && (
                  <>
                    <p>
                      Download this account’s data as a JSON file, then deliver
                      it through a channel the person controls.
                    </p>
                    <Btn
                      icon="download"
                      onClick={generateExport}
                      disabled={!!working || closed}
                    >
                      {working === "export"
                        ? "Assembling…"
                        : "Download data copy"}
                    </Btn>
                  </>
                )}
                {active.requestType === "Rectification" && (
                  <>
                    <p>
                      Update only the fields the person asked you to correct.
                    </p>
                    <fieldset
                      disabled={
                        !!working ||
                        closed ||
                        !subject ||
                        subject?.personalDataErased
                      }
                      className="aw-form"
                    >
                      <Field label="Full name">
                        <Input
                          value={correction.fullName}
                          onChange={(e) =>
                            setCorrection((p) => ({
                              ...p,
                              fullName: e.target.value,
                            }))
                          }
                        />
                      </Field>
                      <div className="aw-form-grid">
                        <Field label="Phone">
                          <Input
                            type="tel"
                            value={correction.phoneNumber}
                            onChange={(e) =>
                              setCorrection((p) => ({
                                ...p,
                                phoneNumber: e.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label="City">
                          <Input
                            value={correction.city}
                            onChange={(e) =>
                              setCorrection((p) => ({
                                ...p,
                                city: e.target.value,
                              }))
                            }
                          />
                        </Field>
                      </div>
                      <Btn onClick={applyCorrection}>
                        {working === "correction"
                          ? "Saving…"
                          : "Apply correction"}
                      </Btn>
                    </fieldset>
                  </>
                )}
                {active.requestType === "Erasure" && (
                  <>
                    <p>
                      Erase identifying profile information and close account
                      access. Donation history and retained audit records
                      remain. The sign-in must be deleted separately in{" "}
                      <Link to="/admin/accounts">Accounts</Link>.
                    </p>
                    {!confirmErase ? (
                      <Btn
                        variant="alert"
                        onClick={() => setConfirmErase(true)}
                        disabled={
                          !!working ||
                          closed ||
                          !subject ||
                          subject?.personalDataErased
                        }
                      >
                        Erase personal data
                      </Btn>
                    ) : (
                      <div className="privacy-erase-confirm" role="alert">
                        <strong>This erasure cannot be undone.</strong>
                        <p>Enter the reason in the note below, then confirm.</p>
                        <div className="aw-inline-actions">
                          <Btn
                            variant="alert"
                            onClick={erasePersonalData}
                            disabled={!!working || !adminNote.trim()}
                          >
                            {working === "erasure"
                              ? "Erasing…"
                              : "Confirm erasure"}
                          </Btn>
                          <Btn
                            onClick={() => setConfirmErase(false)}
                            disabled={!!working}
                          >
                            Cancel erasure
                          </Btn>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>
              <section className="privacy-resolution aw-form">
                <div className="aw-step-heading">
                  <span>02</span>
                  <div>
                    <h3>Record the resolution</h3>
                    <p>
                      Explain the outcome so the next reviewer has the full
                      picture.
                    </p>
                  </div>
                </div>
                <Field label="Resolution note">
                  <Textarea
                    ref={noteInput}
                    maxLength={2000}
                    rows={4}
                    value={adminNote}
                    disabled={!!working || closed}
                    onChange={(e) => {
                      setAdminNote(e.target.value);
                      setError("");
                    }}
                    placeholder="What was done, how the person was informed, and any follow-up."
                  />
                </Field>
                <small className="aw-field-help">
                  Visible to the requester. Required to complete or reject · {adminNote.length}/2000
                </small>
                {closed && active.status === "Rejected" ? (
                  <p><strong>Rejection reason:</strong> {rejectionReasonLabel(active.rejectionReason)}</p>
                ) : !closed && (
                  <Field label="Reason if rejecting">
                    <Select ref={reasonInput} value={rejectionReason} disabled={!!working}
                      onChange={(e) => { setRejectionReason(e.target.value); setError(""); }}
                      options={[{ value: "", label: "Choose a reason to reject" }, ...REJECTION_REASONS]} />
                    <small className="aw-field-help">Explain the reason in the resolution note, including when choosing Other.</small>
                  </Field>
                )}
                <Field label="Action taken">
                  <Select
                    value={resolution}
                    disabled={!!working || closed}
                    onChange={(e) => setResolution(e.target.value)}
                    options={[
                      { value: "", label: "No action recorded" },
                      { value: "Export", label: "Data copy exported" },
                      { value: "Correction", label: "Profile corrected" },
                      { value: "Deletion", label: "Personal data erased" },
                      ...(active.requestType === "Other" ? [{ value: "Response", label: "Written response provided" }] : []),
                    ]}
                  />
                </Field>
              </section>
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
              <div className="privacy-review-actions">
                <Btn onClick={close} disabled={!!working}>Back to requests</Btn>
                <Btn
                  onClick={() => move("InProgress")}
                  disabled={
                    !!working || closed || active.status === "InProgress"
                  }
                >
                  {working === "InProgress" ? "Saving…" : "Start review"}
                </Btn>
                <Btn
                  onClick={() => move("Rejected")}
                  disabled={!!working || closed}
                >
                  {working === "Rejected" ? "Saving…" : "Reject"}
                </Btn>
                <Btn
                  variant="primary"
                  onClick={() => move("Completed")}
                  disabled={!!working || closed}
                >
                  {working === "Completed" ? "Saving…" : "Complete request"}
                </Btn>
              </div>
            </>
          )}
        </AdminDialog>
      </div>
    </AppShell>
  );
}
