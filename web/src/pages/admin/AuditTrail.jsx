import { dayStart, donationDay, shiftDay } from "../../utils/hospitalReports";
import { TableExport } from "../../components/TableExport";
import { auditReportColumns } from "../../utils/reportColumns";
import { allAuditActivity } from "../../services/tableExports";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "../../layout/AppShell";
import { AdminDialog, Btn, Icon, PageHeader, Table } from "../../components";
import { getAuditActivity, verifyAuditChain } from "../../services/audit";
import { listUsers } from "../../services/users";
import { useTableSort } from "../../hooks/useTableSort";
import { sortRows, sortDate } from "../../utils/sortRows";

const EVENTS = {
  "Donation.Confirmed": "Donation confirmed",
  "Donation.Screened": "Donor screening recorded",
  "Inventory.DonationReceived": "Donation added to stock",
  "Inventory.Transfused": "Stock issued for transfusion",
  "Inventory.Adjusted": "Stock adjusted",
  "Account.HospitalCreated": "Hospital account created",
  "Account.Suspended": "Access suspended",
  "Account.Removed": "Access removed",
  "Account.Reactivated": "Access restored",
  "Account.LoginDeleted": "Sign-in deleted",
  "Account.ProfileUpdated": "Profile details updated",
  "DataAccess.Erasure": "Personal data erased",
};
const STATES = {
  verified: "Reason verified",
  redacted: "Private details erased",
  mismatch: "Details could not be verified",
  "not-recorded": "No reason recorded",
  unavailable: "Details unavailable",
};
const KEYS = ["account", "actor", "event", "from", "to"];
const EMPTY = Object.fromEntries(KEYS.map((key) => [key, ""]));
const name = (person) =>
  person?.fullName || person?.email || "Identity unavailable";
const title = (event) => EVENTS[event] || event || "Activity";
function date(value) {
  const parsed = new Date(value);
  return value && Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed)
    : "Time unavailable";
}
function readFilters(params) {
  return Object.fromEntries(KEYS.map((key) => [key, params.get(key) || ""]));
}
function dateInput(value) {
  return value ? donationDay(value) : "";
}
function inputDraft(filters) {
  return {
    ...filters,
    from: dateInput(filters.from),
    to: dateInput(filters.to),
  };
}
function boundary(value, end) {
  if (!value) return "";
  const start = dayStart(value);
  if (!start) throw new Error("Choose valid calendar dates.");
  return (
    end ? new Date(dayStart(shiftDay(value, 1)).getTime() - 1) : start
  ).toISOString();
}
function Person({ person, fallback = "Identity unavailable" }) {
  return (
    <span className="audit-person">
      <strong>{person ? name(person) : fallback}</strong>
      {person?.email && person.fullName && <small>{person.email}</small>}
    </span>
  );
}

/** Filtered global activity and protected event details at `/admin/audit-trail`. */
export default function AuditTrail() {
  const [params, setParams] = useSearchParams();
  const filterKey = KEYS.map((key) => params.get(key) || "").join("|");
  const filters = useMemo(() => readFilters(params), [filterKey]);
  const [draft, setDraft] = useState(() => inputDraft(filters));
  const [accounts, setAccounts] = useState([]);
  const [directoryError, setDirectoryError] = useState("");
  const [page, setPage] = useState({ events: [], nextCursor: null });
  const [cursors, setCursors] = useState([null]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [reload, setReload] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState(null);
  const [verifyError, setVerifyError] = useState("");
  const { sort, toggleSort } = useTableSort();

  useEffect(() => {
    let active = true;
    listUsers()
      .then((rows) => {
        if (active) setAccounts(rows);
      })
      .catch(() => {
        if (active)
          setDirectoryError(
            "Account names could not be loaded. You can still filter with an account ID.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setDraft(inputDraft(filters));
    setFilterError("");
    setCursors([null]);
    setCursor(null);
  }, [filterKey]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setSelected(null);
    getAuditActivity(filters, cursor)
      .then((result) => {
        if (active) {
          setPage(result);
          setUpdatedAt(new Date());
        }
      })
      .catch((err) => {
        if (active) setError(err.message || "Activity could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filterKey, cursor, reload]);

  function apply(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setDraft(values);
    try {
      const next = {
        ...values,
        from: boundary(values.from, false),
        to: boundary(values.to, true),
      };
      if (next.from && next.to && next.from > next.to)
        throw new Error("The start date must be before the end date.");
      setFilterError("");
      setCursors([null]);
      setCursor(null);
      setQuery("");
      setParams(
        Object.fromEntries(Object.entries(next).filter(([, value]) => value)),
      );
    } catch (err) {
      setFilterError(err.message);
    }
  }
  function clear() {
    setDraft(EMPTY);
    setFilterError("");
    setParams({});
    setCursors([null]);
    setCursor(null);
    setQuery("");
  }
  async function verify() {
    setVerifying(true);
    setVerifyError("");
    setVerification(null);
    try {
      setVerification(await verifyAuditChain());
    } catch (err) {
      setVerifyError(err.message || "Verification failed. Try again.");
    } finally {
      setVerifying(false);
    }
  }
  const matchesQuery = (row) =>
    [
      title(row.eventType),
      name(row.actor),
      row.actor?.email,
      name(row.affectedAccount),
      row.affectedAccount?.email,
      row.context?.reason,
      row.sequence,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase());
  const visible = page.events.filter(matchesQuery);
  const sorted = sortRows(
    visible,
    sort.key
      ? (row) =>
          ({
            event: title(row.eventType),
            account: row.affectedAccount ? name(row.affectedAccount) : null,
            actor: row.actor ? name(row.actor) : null,
            createdAt: sortDate(row.createdAt),
          })[sort.key]
      : null,
    sort.direction,
  );
  const eventOptions = [
    ...new Set(
      [
        ...Object.keys(EVENTS),
        ...page.events.map((row) => row.eventType),
        draft.event,
      ].filter(Boolean),
    ),
  ];
  function identityField(key, label, rows) {
    return (
      <label className="audit-field">
        {label}
        {directoryError ? (
          <input
            name={key}
            value={draft[key]}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            placeholder="Account ID"
          />
        ) : (
          <select
            name={key}
            value={draft[key]}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          >
            <option value="">
              All {key === "actor" ? "administrators" : "accounts"}
            </option>
            {draft[key] && !rows.some((row) => row.id === draft[key]) && (
              <option value={draft[key]}>{draft[key]}</option>
            )}
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {name(row)}
                {row.email && row.fullName ? ` · ${row.email}` : ""}
              </option>
            ))}
          </select>
        )}
      </label>
    );
  }
  const columns = [
    {
      key: "event",
      mobileWide: true,
      header: "Activity",
      render: (row) => (
        <div className="audit-event">
          <span className="audit-event-mark" aria-hidden="true">
            <Icon name="list" />
          </span>
          <div>
            <strong>{title(row.eventType)}</strong>
            <small>
              Record #{row.sequence} ·{" "}
              {STATES[row.contextState] || "Details unavailable"}
            </small>
          </div>
        </div>
      ),
    },
    {
      key: "account",
      header: "Affected account",
      render: (row) => (
        <Person
          person={row.affectedAccount}
          fallback={
            row.entityType === "user"
              ? "Identity unavailable"
              : row.entityType
                ? `${row.entityType} record`
                : "System event"
          }
        />
      ),
    },
    {
      key: "actor",
      header: "Performed by",
      render: (row) => <Person person={row.actor} />,
    },
    {
      key: "createdAt",
      header: "Occurred",
      render: (row) => (
        <time dateTime={row.createdAt}>{date(row.createdAt)}</time>
      ),
    },
    {
      key: "details",
      mobileWide: true,
      header: "Details",
      sortable: false,
      render: (row) => (
        <Btn
          onClick={() => setSelected(row)}
          aria-label={`View ${title(row.eventType)}, record ${row.sequence}`}
        >
          View <span aria-hidden="true">↗</span>
        </Btn>
      ),
    },
  ];
  return (
    <AppShell>
      <div className="admin-audit-workspace">
        <PageHeader
          title="Audit Trail"
          actions={
            <>
              <Btn
                disabled={loading}
                onClick={() => setReload(reload + 1)}
                icon="refresh"
              >
                Refresh
              </Btn>
              <Btn disabled={verifying} onClick={verify} icon="shield">
                {verifying ? "Verifying…" : "Verify chain"}
              </Btn>
            </>
          }
        />
        <section className="audit-intro" aria-labelledby="audit-intro-title">
          <div>
            <p className="admin-care-eyebrow">Accountability, made clear</p>
            <h2 id="audit-intro-title">Every action has a story.</h2>
            <p>Understand what changed, who made the change, and why.</p>
          </div>
          <div className="audit-integrity">
            <Icon name="shield" />
            <div>
              <strong>Tamper-evident records</strong>
              <span>Check the full chain on demand.</span>
            </div>
          </div>
        </section>
        {(verification || verifyError) && (
          <div className="audit-notice" role="status">
            <strong>
              {verifyError
                ? "Verification unavailable"
                : verification.valid
                  ? "Chain verification passed"
                  : "Chain needs attention"}
            </strong>
            <p>
              {verifyError ||
                `${verification.count} records checked. ${verification.reason || verification.message || ""}${verification.brokenAt ? ` Issue at record ${verification.brokenAt}.` : ""}`}
            </p>
            {verifyError && (
              <Btn onClick={verify} disabled={verifying}>
                Retry verification
              </Btn>
            )}
          </div>
        )}
        <section className="card audit-records" aria-label="Activity records">
          <div className="audit-panel-heading">
            <div>
              <h2>Activity history</h2>
              <p>Filter across the entire history, then inspect the details.</p>
            </div>
            <span className="pill">Admin access</span>
          </div>
          <form className="audit-filters" onSubmit={apply}>
            {identityField("account", "Affected account", accounts)}
            {identityField(
              "actor",
              "Administrator",
              accounts.filter((row) => row.role === "admin"),
            )}
            <label className="audit-field">
              Event
              <select
                name="event"
                value={draft.event}
                onChange={(e) => setDraft({ ...draft, event: e.target.value })}
              >
                <option value="">All events</option>
                {eventOptions.map((value) => (
                  <option key={value} value={value}>
                    {title(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="audit-field">
              From
              <input
                type="date"
                name="from"
                value={draft.from}
                onInput={(e) =>
                  setDraft((current) => ({ ...current, from: e.target.value }))
                }
                onChange={(e) =>
                  setDraft((current) => ({ ...current, from: e.target.value }))
                }
              />
            </label>
            <label className="audit-field">
              Through
              <input
                type="date"
                name="to"
                value={draft.to}
                onInput={(e) =>
                  setDraft((current) => ({ ...current, to: e.target.value }))
                }
                onChange={(e) =>
                  setDraft((current) => ({ ...current, to: e.target.value }))
                }
              />
            </label>
            <div className="audit-filter-actions">
              <Btn type="submit" variant="primary">
                Apply filters
              </Btn>
              <Btn onClick={clear}>Clear</Btn>
            </div>
            {(filterError || directoryError) && (
              <p
                className="audit-filter-message"
                role={filterError ? "alert" : "status"}
              >
                {filterError || directoryError}
              </p>
            )}
          </form>
          <div className="audit-results-toolbar">
            <label className="audit-search">
              <Icon name="search" />
              <input
                aria-label="Search this page"
                type="search"
                placeholder="Search this page…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <p>
              Search and column sorting apply to this page of up to 25 records.
            </p>
          </div>
          <TableExport
            name="audit-activity"
            title="Audit activity"
            columns={auditReportColumns}
            disabled={loading || Boolean(error)}
            getRows={async (scope, progress) => {
              const records = await allAuditActivity(
                scope === "filtered" ? filters : {},
                progress,
              );
              const matching =
                scope === "filtered" ? records.filter(matchesQuery) : records;
              return sortRows(
                matching,
                sort.key
                  ? (row) =>
                      ({
                        event: title(row.eventType),
                        account: row.affectedAccount
                          ? name(row.affectedAccount)
                          : null,
                        actor: row.actor ? name(row.actor) : null,
                        createdAt: sortDate(row.createdAt),
                      })[sort.key]
                  : null,
                sort.direction,
              );
            }}
          />
          {loading ? (
            <div className="audit-state" role="status">
              Loading activity…
            </div>
          ) : error ? (
            <div className="audit-state" role="alert">
              <h3>Activity could not be loaded</h3>
              <p>{error}</p>
              <Btn onClick={() => setReload(reload + 1)}>Try again</Btn>
            </div>
          ) : sorted.length ? (
            <Table
              mobileCards
              className="audit-table"
              columns={columns}
              rows={sorted}
              rowKey={(row) => row.id}
              sort={sort}
              onSort={toggleSort}
            />
          ) : (
            <div className="audit-state">
              <Icon name="search" />
              <h3>{query ? "No matches on this page" : "No activity found"}</h3>
              <p>
                {query
                  ? "Try another name, event, or reason."
                  : "Adjust the filters, or return here after an account action."}
              </p>
              <Btn onClick={query ? () => setQuery("") : clear}>
                {query ? "Clear search" : "Clear filters"}
              </Btn>
            </div>
          )}
          <footer className="audit-pagination">
            <div>
              <strong>Page {cursors.length}</strong>
              <span>
                {!loading &&
                  !error &&
                  `${page.events.length} records on this page`}
                {updatedAt &&
                  ` · Refreshed ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              </span>
            </div>
            <div>
              <Btn
                disabled={loading || cursors.length < 2}
                onClick={() => {
                  const next = cursors.slice(0, -1);
                  setCursors(next);
                  setCursor(next.at(-1));
                  setQuery("");
                }}
              >
                ← Newer
              </Btn>
              <Btn
                disabled={loading || !!error || !page.nextCursor}
                onClick={() => {
                  setCursors([...cursors, page.nextCursor]);
                  setCursor(page.nextCursor);
                  setQuery("");
                }}
              >
                Earlier →
              </Btn>
            </div>
          </footer>
        </section>
        <p className="audit-privacy-note">
          Names reflect current profiles. Erased identities and private details
          stay unavailable; older records may not include a reason.
        </p>
        <AdminDialog
          name="audit-event"
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected ? title(selected.eventType) : "Activity details"}
        >
          {selected && (
            <>
              <div className="audit-detail-kicker">
                <span className="pill">Record #{selected.sequence}</span>
                <time>{date(selected.createdAt)}</time>
              </div>
              <dl className="audit-detail-people">
                <div>
                  <dt>Affected account</dt>
                  <dd>
                    <Person
                      person={selected.affectedAccount}
                      fallback={
                        selected.entityType === "user"
                          ? "Identity unavailable"
                          : `${selected.entityType || "System"} event`
                      }
                    />
                  </dd>
                </div>
                <div>
                  <dt>Performed by</dt>
                  <dd>
                    <Person person={selected.actor} />
                  </dd>
                </div>
              </dl>
              <section className="audit-reason">
                <p className="admin-care-eyebrow">Reason & outcome</p>
                <h3>
                  {STATES[selected.contextState] || "Details unavailable"}
                </h3>
                {selected.context ? (
                  <>
                    <blockquote>
                      {selected.context.reason ||
                        "No additional reason supplied."}
                    </blockquote>
                    {(selected.context.beforeStatus ||
                      selected.context.afterStatus) && (
                      <div className="audit-status-change">
                        <span>
                          {selected.context.beforeStatus || "Not recorded"}
                        </span>
                        <span aria-hidden="true">→</span>
                        <strong>
                          {selected.context.afterStatus || "Not recorded"}
                        </strong>
                      </div>
                    )}
                  </>
                ) : (
                  <p>
                    {selected.contextState === "redacted"
                      ? "Private details were removed through the erasure process."
                      : selected.contextState === "mismatch"
                        ? "The stored details do not match their digest and have been withheld."
                        : "This record has no verified reason available. No details have been inferred."}
                  </p>
                )}
                <small>
                  Reason verification checks this record’s private context. Use
                  Verify chain to check the full chain.
                </small>
              </section>
              <details className="audit-technical">
                <summary>Technical record</summary>
                <dl>
                  {[
                    ["Event type", selected.eventType],
                    ["Record ID", selected.id],
                    ["Record hash", selected.recordHash],
                    ["Previous hash", selected.prevHash],
                    ["Hashed account reference", selected.hashedEntityRef],
                    ["Hashed actor reference", selected.hashedActorRef],
                    ["Correction reference", selected.correctsBlockId],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || "Not recorded"}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </>
          )}
        </AdminDialog>
      </div>
    </AppShell>
  );
}
