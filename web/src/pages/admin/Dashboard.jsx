import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../layout/AppShell";
import { useAuth } from "../../hooks/useAuth";
import { listUsers } from "../../services/users";
import {
  listAllDataRequests,
  requestTypeLabel,
} from "../../services/dataRequests";
import { sortDate } from "../../utils/sortRows";
import { Btn, Icon, PageHeader } from "../../components";

/** Administration overview of current profiles and privacy work. */
export default function Dashboard() {
  const { user, profile } = useAuth();
  const [data, setData] = useState({
    accounts: null,
    requests: null,
  });
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const generation = useRef(0);
  async function load() {
    const version = ++generation.current;
    setLoading(true);
    const results = await Promise.allSettled([
      listUsers(),
      listAllDataRequests(),
    ]);
    if (version !== generation.current) return;
    const labels = ["Accounts", "Privacy requests"];
    setErrors(
      results.flatMap((result, i) =>
        result.status === "rejected" ? [labels[i]] : [],
      ),
    );
    setData(
      Object.fromEntries(
        ["accounts", "requests"].map((key, i) => [
          key,
          results[i].status === "fulfilled" ? results[i].value : null,
        ]),
      ),
    );
    setUpdatedAt(new Date());
    setLoading(false);
  }
  useEffect(() => {
    load();
    return () => {
      generation.current++;
    };
  }, []);
  const accounts = data.accounts || [];
  const people = new Map(accounts.map((person) => [person.id, person]));
  const pending =
    data.requests?.filter((row) =>
      ["Pending", "InProgress"].includes(row.status),
    ) || [];
  const oldest = [...pending]
    .sort(
      (a, b) =>
        (sortDate(a.createdAt) ?? Infinity) -
        (sortDate(b.createdAt) ?? Infinity),
    )
    .slice(0, 3);
  const count = (value) => (loading || value == null ? "—" : value);
  const displayName = profile?.fullName || user?.displayName || "Administrator";
  return (
    <AppShell>
      <div className="admin-workspace">
        <PageHeader
          title="Dashboard"
          actions={
            <Btn icon="refresh" disabled={loading} onClick={load}>
              Refresh overview
            </Btn>
          }
        />
        <section className="admin-overview-hero">
          <div>
            <p className="admin-care-eyebrow">
              The work behind every connection
            </p>
            <h2>
              Welcome back,
              <br />
              <em>{displayName.split(" ")[0]}.</em>
            </h2>
            <p>
              A clear view of the people, privacy requests and safeguards that
              need your attention.
            </p>
            <Link to="/admin/data-requests" className="btn" data-primary="true">
              Review privacy queue <Icon name="arrow-right" />
            </Link>
          </div>
          <div className="admin-overview-orbit" aria-hidden="true">
            <span className="overview-orbit-line" />
            <span className="overview-orbit-core">
              <span className="app-mark" />
            </span>
            <span className="overview-orbit-label">Connected by care.</span>
          </div>
        </section>
        <div className="overview-sync">
          <span>
            {loading
              ? "Updating overview…"
              : updatedAt
                ? `Snapshot refreshed ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : ""}
          </span>
          <span>Accounts · Privacy</span>
        </div>
        {!!errors.length && (
          <div className="aw-notice aw-error" role="alert">
            Could not load: {errors.join(", ")}. Affected summaries are
            unavailable.{" "}
            <Btn onClick={load} disabled={loading}>
              Try again
            </Btn>
          </div>
        )}
        <section
          className="aw-metrics overview-metrics"
          aria-label="Current summaries"
        >
          {[
            {
              label: "Privacy requests open",
              value: data.requests ? pending.length : null,
              detail: "Pending or in progress",
              icon: "file",
              to: "/admin/data-requests",
            },
            {
              label: "Active profiles",
              value: data.accounts
                ? accounts.filter((a) => (a.status || "Active") === "Active")
                    .length
                : null,
              detail: "Profiles marked Active",
              icon: "user",
              to: "/admin/accounts",
            },
            {
              label: "Hospital staff profiles",
              value: data.accounts
                ? accounts.filter((a) => a.role === "hospital").length
                : null,
              detail: "Across all account statuses",
              icon: "grid",
              to: "/admin/accounts",
            },
          ].map((item) => (
            <Link className="card aw-metric" key={item.label} to={item.to}>
              <span className="aw-metric-top">
                {item.label}
                <Icon name={item.icon} />
              </span>
              <strong>{count(item.value)}</strong>
              <small>
                {item.detail}
                <span aria-hidden="true">↗</span>
              </small>
            </Link>
          ))}
        </section>
        <div className="overview-main-grid">
          <section className="card aw-panel">
            <div className="aw-panel-heading">
              <div>
                <h2>Next in the privacy queue</h2>
                <p>Oldest open requests, ready for a considered review.</p>
              </div>
              <Icon name="clock" />
            </div>
            {loading ? (
              <div className="aw-empty" role="status">
                Loading requests…
              </div>
            ) : !data.requests ? (
              <div className="aw-empty">
                <h3>Queue unavailable</h3>
                <p>Refresh the overview to try again.</p>
              </div>
            ) : oldest.length ? (
              <ol className="overview-queue">
                {oldest.map((row, index) => (
                  <li key={row.id}>
                    <span className="overview-queue-number">0{index + 1}</span>
                    <div>
                      <strong>{requestTypeLabel(row.requestType)}</strong>
                      <p>
                        {people.get(row.userId)?.fullName ||
                          (data.accounts
                            ? "Account unavailable"
                            : "Account details unavailable")}
                      </p>
                      <small>
                        {sortDate(row.createdAt) !== null
                          ? new Date(
                              sortDate(row.createdAt),
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Submission time unavailable"}
                      </small>
                    </div>
                    <span
                      className="chip"
                      data-status={
                        row.status === "Pending" ? "inactive" : "collecting"
                      }
                    >
                      {row.status === "Pending" ? "Pending" : "In progress"}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="aw-empty">
                <Icon name="check" />
                <h3>No open privacy requests</h3>
                <p>The queue is clear. New requests will appear here.</p>
              </div>
            )}
            <div className="overview-panel-link">
              <Link to="/admin/data-requests">
                Open the full queue <Icon name="arrow-right" />
              </Link>
            </div>
          </section>

        </div>
        <section
          className="overview-tools"
          aria-label="Administration workspaces"
        >
          <div>
            <p className="admin-care-eyebrow">Keep trust in the loop</p>
            <h2>
              The right workspace,
              <br />
              one step away.
            </h2>
          </div>
          <Link to="/admin/accounts">
            <Icon name="user" />
            <span>
              <strong>People & facilities</strong>
              <small>Manage access and hospital accounts.</small>
            </span>
            <Icon name="arrow-right" />
          </Link>
          <Link to="/admin/audit-trail">
            <Icon name="shield" />
            <span>
              <strong>Activity & accountability</strong>
              <small>Inspect actions and verify the audit chain.</small>
            </span>
            <Icon name="arrow-right" />
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
