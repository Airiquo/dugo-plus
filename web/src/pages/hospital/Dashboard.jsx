import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getHospitalDonations, readHospital } from "../../services/hospitals";
import {
  ACTIVE_STATUSES,
  componentLabel,
  listHospitalRequests,
} from "../../services/requests";
import { BLOOD_TYPES } from "../../services/users";
import { allHospitalDonations } from "../../services/tableExports";
import { donationReportColumns } from "../../utils/reportColumns";
import { sortRequestsByUrgency } from "../../utils/matching";
import { toDate } from "../../utils/eligibility";
import { HospitalShell } from "../../layout/HospitalShell";
import {
  Badge,
  Btn,
  Icon,
  HospitalMetric,
  HospitalNotice,
  HospitalPageHeader,
  LinkBtn,
  Table,
  TableExport,
  TablePager,
} from "../../components";

const PERIODS = [
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "1y", label: "1 year", days: 365 },
  { value: "all", label: "All time", days: null },
];
const dateLabel = (value) =>
  toDate(value)?.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }) || "Not recorded";

/** Facility overview, current request priorities and complete period collection reporting. */
export default function Dashboard() {
  const { profile } = useAuth();
  const hospitalId = profile?.hospitalId || "";
  const [hospital, setHospital] = useState(null);
  const [facilityError, setFacilityError] = useState(false);
  const [requests, setRequests] = useState({ status: "loading", rows: [] });
  const [collections, setCollections] = useState({
    status: "loading",
    rows: [],
  });
  const [period, setPeriod] = useState("30d");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const activePeriod = PERIODS.find((item) => item.value === period);
  useEffect(() => {
    if (!hospitalId) return;
    let active = true;
    setFacilityError(false);
    readHospital(hospitalId)
      .then((found) => {
        if (active) {
          setHospital(found);
          setFacilityError(!found);
        }
      })
      .catch(() => {
        if (active) setFacilityError(true);
      });
    setRequests({ status: "loading", rows: [] });
    listHospitalRequests(hospitalId, ACTIVE_STATUSES)
      .then((rows) => {
        if (active)
          setRequests({ status: "ready", rows: sortRequestsByUrgency(rows) });
      })
      .catch(() => {
        if (active) setRequests({ status: "error", rows: [] });
      });
    return () => {
      active = false;
    };
  }, [hospitalId, attempt]);
  useEffect(() => {
    if (!hospitalId) return;
    let active = true;
    setCollections({ status: "loading", rows: [] });
    const since = activePeriod.days
      ? new Date(Date.now() - activePeriod.days * 86400000)
      : null;
    async function load() {
      let cursor = null;
      const rows = [];
      do {
        const result = await getHospitalDonations(hospitalId, {
          since,
          cursor,
          limit: 100,
        });
        if (!active) return;
        rows.push(...result.rows);
        cursor = result.cursor;
      } while (cursor);
      if (active) setCollections({ status: "ready", rows });
    }
    load().catch(() => {
      if (active) setCollections({ status: "error", rows: [] });
    });
    return () => {
      active = false;
    };
  }, [hospitalId, period, attempt]);
  const totals = useMemo(() => {
    const groups = Object.fromEntries(BLOOD_TYPES.map((type) => [type, 0]));
    for (const row of collections.rows)
      if (row.bloodType in groups)
        groups[row.bloodType] += Number(row.units) || 0;
    return {
      units: collections.rows.reduce(
        (sum, row) => sum + (Number(row.units) || 0),
        0,
      ),
      groups,
    };
  }, [collections.rows]);
  const ready = hospitalId && collections.status === "ready";
  const requestsReady = hospitalId && requests.status === "ready";
  const urgent = requests.rows.filter((row) =>
    ["urgent", "stat"].includes(row.urgencyLevel),
  ).length;
  const maxGroup = Math.max(1, ...Object.values(totals.groups));
  return (
    <HospitalShell facility={hospital?.name}>
      <HospitalPageHeader
        title="Overview"
        description="The next step in care, all in one place."
        actions={
          <Btn
            icon="refresh"
            onClick={() => setAttempt((n) => n + 1)}
            disabled={
              Boolean(hospitalId) &&
              (collections.status === "loading" ||
                requests.status === "loading")
            }
          >
            Refresh
          </Btn>
        }
      />
      {!hospitalId ? (
        <HospitalNotice title="Connect your facility" tone="attention">
          Ask your administrator to link this account to a hospital to get
          started.
        </HospitalNotice>
      ) : (
        <>
          <section className="hw-overview-hero">
            <div>
              <p className="hw-eyebrow">Connected by care</p>
              <h2>
                A clearer day.
                <br />
                <em>A closer connection.</em>
              </h2>
              <p>
                Keep requests moving, welcome your donors, and make every
                collected unit count.
              </p>
              <LinkBtn
                to="/hospital/requests/new"
                variant="primary"
                icon="plus"
              >
                Create a blood request
              </LinkBtn>
            </div>
            <div className="hw-facility-preview">
              <span className="hw-facility-symbol">
                <Icon name="grid" size={27} />
              </span>
              <p className="hw-eyebrow">Your facility</p>
              <h3>
                {hospital?.name ||
                  (facilityError
                    ? "Facility unavailable"
                    : "Loading facility…")}
              </h3>
              <p>{hospital?.address || "Your hospital workspace"}</p>
              <Link to="/hospital/facility">
                View facility details <Icon name="arrow-right" size={16} />
              </Link>
              <span className="hw-hero-cross" aria-hidden="true">
                +
              </span>
            </div>
          </section>
          {facilityError && (
            <HospitalNotice
              tone="attention"
              title="Facility details unavailable"
            >
              Refresh to try again. Other summaries load independently.
            </HospitalNotice>
          )}
          <div className="hw-section-line">
            <div>
              <p className="hw-eyebrow">At a glance</p>
              <h2>What’s happening at your facility</h2>
            </div>
            <label className="hw-period">
              Collection period
              <select
                aria-label="Collection period"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setPage(1);
                }}
              >
                {PERIODS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <section className="hw-metrics" aria-label="Facility summaries">
            <HospitalMetric
              name="overview-requests"
              label="Active requests"
              value={requestsReady ? requests.rows.length : "—"}
              detail="Open, collecting or matched"
              icon="droplet"
              to="/hospital/requests"
            />
            <HospitalMetric
              name="overview-urgent"
              label="Time-sensitive requests"
              value={requestsReady ? urgent : "—"}
              detail="Urgent or stat · active only"
              icon="clock"
              tone={urgent ? "urgent" : undefined}
              to="/hospital/requests"
            />
            <HospitalMetric
              name="overview-units"
              label="Units collected"
              value={ready ? totals.units : "—"}
              detail={`Confirmed · ${activePeriod.label.toLowerCase()}`}
              icon="box"
              tone="success"
            />
            <HospitalMetric
              name="overview-donations"
              label="Confirmed donations"
              value={ready ? collections.rows.length : "—"}
              detail={
                activePeriod.label === "All time"
                  ? "Entire collection history"
                  : `Over the last ${activePeriod.label}`
              }
              icon="check"
            />
          </section>
          <div className="hw-overview-grid">
            <section
              className="card hw-panel"
              aria-labelledby="overview-priorities"
            >
              <div className="hw-panel-heading">
                <div>
                  <p className="hw-eyebrow">Keep care moving</p>
                  <h2 id="overview-priorities">Request priorities</h2>
                </div>
                <Link to="/hospital/requests" className="hw-text-link">
                  View all <Icon name="arrow-right" size={16} />
                </Link>
              </div>
              {requests.status === "loading" && (
                <p className="hw-loading" role="status">
                  Loading active requests…
                </p>
              )}
              {requests.status === "error" && (
                <HospitalNotice tone="error" title="Requests couldn’t load">
                  <Btn onClick={() => setAttempt((n) => n + 1)}>Try again</Btn>
                </HospitalNotice>
              )}
              {requestsReady && !requests.rows.length && (
                <div className="hw-empty">
                  <Icon name="check" size={28} />
                  <h3>No active requests</h3>
                  <p>
                    New requests will appear here, with the most urgent first.
                  </p>
                  <LinkBtn to="/hospital/requests/new">
                    Create a request
                  </LinkBtn>
                </div>
              )}
              {requestsReady && (
                <div className="hw-priority-list">
                  {requests.rows.slice(0, 4).map((row) => (
                    <Link
                      to="/hospital/requests"
                      key={row.id}
                      className="hw-priority-row"
                    >
                      <span className="hw-blood-group">{row.bloodType}</span>
                      <span>
                        <strong>{componentLabel(row.component)}</strong>
                        <small>
                          {row.quantity} units · #
                          {row.id.slice(-6).toUpperCase()}
                        </small>
                      </span>
                      <span
                        className="hreq-priority"
                        data-priority={row.urgencyLevel}
                      >
                        <i aria-hidden="true" />
                        {row.urgencyLevel === "stat"
                          ? "Stat"
                          : row.urgencyLevel === "urgent"
                            ? "Urgent"
                            : "Routine"}
                      </span>
                      <Icon name="chevron-right" size={17} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <section
              className="card hw-panel"
              aria-labelledby="overview-groups"
            >
              <div className="hw-panel-heading">
                <div>
                  <p className="hw-eyebrow">Collected, with care</p>
                  <h2 id="overview-groups">Units by blood group</h2>
                </div>
                <span className="hw-period-label">{activePeriod.label}</span>
              </div>
              <p className="hw-panel-description">
                Confirmed collections in this period. Current stock is in
                Inventory.
              </p>
              {collections.status === "loading" && (
                <p className="hw-loading" role="status">
                  Loading collection totals…
                </p>
              )}
              {collections.status === "error" && (
                <HospitalNotice tone="error" title="Collections couldn’t load">
                  <Btn onClick={() => setAttempt((n) => n + 1)}>Try again</Btn>
                </HospitalNotice>
              )}
              {ready && (
                <div className="hw-group-chart">
                  {BLOOD_TYPES.map((type) => (
                    <div key={type}>
                      <strong>{type}</strong>
                      <span className="hw-group-track" aria-hidden="true">
                        <i
                          style={{
                            width: `${(totals.groups[type] / maxGroup) * 100}%`,
                          }}
                        />
                      </span>
                      <span>
                        {totals.groups[type]} <small>units</small>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
          <section
            className="card hw-panel hw-collections"
            aria-labelledby="overview-collections"
          >
            <div className="hw-panel-heading">
              <div>
                <p className="hw-eyebrow">Every donation matters</p>
                <h2 id="overview-collections">Recent collections</h2>
                <p className="hw-panel-description">
                  Confirmed donations · {activePeriod.label.toLowerCase()}
                </p>
              </div>
              <Link to="/hospital/inventory-log" className="hw-text-link">
                Full history <Icon name="arrow-right" size={16} />
              </Link>
            </div>
            <TableExport
              name="collections"
              title={`${hospital?.name || "Facility"} blood collections`}
              columns={donationReportColumns}
              disabled={!ready}
              getRows={(scope, progress) =>
                scope === "filtered"
                  ? collections.rows
                  : allHospitalDonations(hospitalId, {}, progress)
              }
            />
            {ready &&
              (collections.rows.length ? (
                <>
                  <Table
                    mobileCards
                    className="hospital-table"
                    columns={[
                      {
                        key: "donationDate",
                        header: "Collected",
                        render: (row) => dateLabel(row.donationDate),
                      },
                      {
                        key: "bloodType",
                        header: "Blood group",
                        render: (row) => <Badge>{row.bloodType || "—"}</Badge>,
                      },
                      {
                        key: "component",
                        header: "Component",
                        render: (row) =>
                          row.component
                            ? componentLabel(row.component)
                            : "Unclassified",
                      },
                      {
                        key: "units",
                        header: "Units",
                        render: (row) => <strong>{row.units}</strong>,
                      },
                      {
                        key: "donor",
                        header: "Donor reference",
                        render: (row) =>
                          row.donorName || row.donorId || "Not recorded",
                      },
                    ]}
                    rows={collections.rows.slice((page - 1) * 10, page * 10)}
                    rowKey={(row) => row.id}
                    scroll={false}
                  />
                  <TablePager
                    page={page}
                    pageCount={Math.max(
                      1,
                      Math.ceil(collections.rows.length / 10),
                    )}
                    onPage={setPage}
                    total={collections.rows.length}
                    rangeStart={(page - 1) * 10 + 1}
                    rangeEnd={Math.min(page * 10, collections.rows.length)}
                  />
                </>
              ) : (
                <div className="hw-empty">
                  <Icon name="droplet" size={28} />
                  <h3>No collections in this period</h3>
                  <p>
                    Try a longer period, or confirm a completed donation from
                    Inventory.
                  </p>
                  <LinkBtn to="/hospital/inventory?view=screening">
                    Open screening & donations
                  </LinkBtn>
                </div>
              ))}
          </section>
          <section
            className="hw-workflow-links"
            aria-label="Hospital shortcuts"
          >
            <Link to="/hospital/inventory?view=screening">
              <Icon name="user" />
              <span>
                <strong>Welcome a donor</strong>
                <small>Screen and confirm a donation</small>
              </span>
              <Icon name="arrow-right" />
            </Link>
            <Link to="/hospital/inventory">
              <Icon name="box" />
              <span>
                <strong>Manage your stock</strong>
                <small>View, issue and adjust blood units</small>
              </span>
              <Icon name="arrow-right" />
            </Link>
          </section>
        </>
      )}
    </HospitalShell>
  );
}
