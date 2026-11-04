import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { readHospital } from "../../services/hospitals";
import {
  ACTIVE_STATUSES,
  COMPONENTS,
  componentLabel,
  listHospitalRequests,
} from "../../services/requests";
import { BLOOD_TYPES } from "../../services/users";
import { allHospitalDonations } from "../../services/tableExports";
import { donationReportColumns } from "../../utils/reportColumns";
import { sortRequestsByUrgency } from "../../utils/matching";
import { toDate } from "../../utils/eligibility";
import {
  collectedUnits,
  collectionTrend,
  dateRangeError,
  dayStart,
  donationDay,
  filterCollections,
  monthRange,
  shiftDay,
} from "../../utils/hospitalReports";
import { filterRecords } from "../../utils/recordFilters";
import { HospitalShell } from "../../layout/HospitalShell";
import {
  Badge,
  Btn,
  HospitalDonationCalendar,
  HospitalMetric,
  HospitalNotice,
  HospitalPageHeader,
  HospitalTrendChart,
  Icon,
  LinkBtn,
  RecordFilters,
  ControlPopover,
  Table,
  TableExport,
  TablePager,
} from "../../components";

const dateLabel = (value) =>
  toDate(value)?.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }) || "Not recorded";
const nowDay = () => donationDay(new Date());
const PRESETS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "year", label: "Selected year" },
  { value: "all", label: "All time" },
];
const recordOptions = {
  date: (row) => row.donationDate,
  search: (row) =>
    `${row.id} ${row.donorName} ${row.donorId} ${row.requestId} ${componentLabel(row.component)} ${row.bloodType}`,
  fields: { component: (row) => row.component || "unclassified" },
};

/** Facility request priorities and complete, date-filtered donation analytics and records. */
export default function Dashboard() {
  const { profile } = useAuth();
  const hospitalId = profile?.hospitalId || "";
  const [hospital, setHospital] = useState(null),
    [facilityError, setFacilityError] = useState(false);
  const [requests, setRequests] = useState({ status: "loading", rows: [] });
  const [collections, setCollections] = useState({
    status: "loading",
    rows: [],
  });
  const [year, setYear] = useState(Number(nowDay().slice(0, 4))),
    [month, setMonth] = useState("all"),
    [period, setPeriod] = useState("30");
  const [range, setRange] = useState(() => ({
    from: shiftDay(nowDay(), -29),
    to: nowDay(),
  }));
  const [draftRange, setDraftRange] = useState(range),
    [rangeError, setRangeError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    bloodType: "all",
    component: "all",
  });
  const [page, setPage] = useState(1),
    [attempt, setAttempt] = useState(0),
    [progress, setProgress] = useState(0);
  const tableRef = useRef(null);
  const queryFrom =
    period === "all" ? "" : [range.from, `${year}-01-01`].sort()[0];
  const queryTo =
    period === "all" ? "" : [range.to, `${year}-12-31`].sort().at(-1);
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
    setProgress(0);
    allHospitalDonations(
      hospitalId,
      {
        since: queryFrom ? dayStart(queryFrom) : null,
        until: queryTo ? dayStart(shiftDay(queryTo, 1)) : null,
      },
      (count) => {
        if (active) setProgress(count);
      },
    )
      .then((rows) => {
        if (active) setCollections({ status: "ready", rows });
      })
      .catch(() => {
        if (active) setCollections({ status: "error", rows: [] });
      });
    return () => {
      active = false;
    };
  }, [hospitalId, queryFrom, queryTo, attempt]);
  const ready = Boolean(hospitalId) && collections.status === "ready",
    requestsReady = Boolean(hospitalId) && requests.status === "ready";
  const rangeRows = useMemo(
    () => filterCollections(collections.rows, period === "all" ? {} : range),
    [collections.rows, period, range],
  );
  const visible = useMemo(
    () => filterRecords(rangeRows, filters, recordOptions),
    [rangeRows, filters],
  );
  const groups = Object.fromEntries(
    BLOOD_TYPES.map((type) => [
      type,
      collectedUnits(rangeRows.filter((row) => row.bloodType === type)),
    ]),
  );
  const totalUnits = collectedUnits(rangeRows),
    maxGroup = Math.max(1, ...Object.values(groups));
  const urgent = requests.rows.filter((row) =>
    ["urgent", "stat"].includes(row.urgencyLevel),
  ).length;
  const actualRange =
    period === "all"
      ? {
          from:
            collections.rows
              .map((row) => donationDay(row.donationDate))
              .filter(Boolean)
              .sort()[0] || `${year}-01-01`,
          to: nowDay(),
        }
      : range;
  const buckets = useMemo(
    () => collectionTrend(rangeRows, actualRange.from, actualRange.to),
    [rangeRows, actualRange.from, actualRange.to],
  );
  const scopeLabel =
    period === "all" ? "All time" : `${range.from} to ${range.to}`;
  const years = [
    ...new Set([
      ...Array.from(
        { length: 21 },
        (_, index) => Number(nowDay().slice(0, 4)) - index,
      ),
      year,
      ...collections.rows
        .map((row) => Number(donationDay(row.donationDate).slice(0, 4)))
        .filter(Boolean),
    ]),
  ].sort((a, b) => b - a);
  function applyRange(next, preset = "custom") {
    setRange(next);
    setDraftRange(next);
    setRangeError("");
    setPeriod(preset);
    setPage(1);
  }
  function chooseYear(value) {
    const next = Number(value);
    setYear(next);
    setMonth("all");
    applyRange(monthRange(next), "year");
  }
  function chooseMonth(value) {
    setMonth(value);
    applyRange(monthRange(year, value), value === "all" ? "year" : "month");
  }
  function choosePreset(value) {
    setMonth("all");
    if (value === "all") {
      setPeriod("all");
      setPage(1);
      return;
    }
    if (value === "year") {
      applyRange(monthRange(year), value);
      return;
    }
    setYear(Number(nowDay().slice(0, 4)));
    applyRange(
      { from: shiftDay(nowDay(), 1 - Number(value)), to: nowDay() },
      value,
    );
  }
  function showCollections(clear = false) {
    if (clear) setFilters({ search: "", bloodType: "all", component: "all" });
    setPage(1);
    requestAnimationFrame(() =>
      tableRef.current?.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  }
  function selectDay(day) {
    setMonth(day.slice(5, 7));
    applyRange({ from: day, to: day }, "day");
    showCollections();
  }
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
                value={
                  PRESETS.some((item) => item.value === period)
                    ? period
                    : "custom"
                }
                onChange={(event) => choosePreset(event.target.value)}
              >
                {PRESETS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
                <option value="custom" disabled>
                  Custom dates
                </option>
              </select>
            </label>
          </div>
          <section className="hw-metrics" aria-label="Facility summaries">
            <HospitalMetric
              name="overview-requests"
              label="Active requests"
              value={requestsReady ? requests.rows.length : "—"}
              detail="View all active requests"
              icon="request"
              to="/hospital/requests?status=active"
            />
            <HospitalMetric
              name="overview-urgent"
              label="Time-sensitive requests"
              value={requestsReady ? urgent : "—"}
              detail="Filter urgent & stat requests"
              icon="clock"
              tone={urgent ? "urgent" : undefined}
              to="/hospital/requests?status=active&priority=time-sensitive"
            />
            <HospitalMetric
              name="overview-units"
              label="Units collected"
              value={ready ? totalUnits : "—"}
              detail="View collections in the selected dates"
              icon="box"
              tone="success"
              onClick={() => showCollections(true)}
              disabled={!ready}
              aria-controls="overview-collections"
            />
            <HospitalMetric
              name="overview-donations"
              label="Completed donations"
              value={ready ? rangeRows.length : "—"}
              detail="View donations in the selected dates"
              icon="check"
              onClick={() => showCollections(true)}
              disabled={!ready}
              aria-controls="overview-collections"
            />
          </section>
          <section
            className="card hw-panel hw-donation-activity"
            aria-labelledby="donation-activity-title"
          >
            <div className="hw-panel-heading">
              <div>
                <p className="hw-eyebrow">Every day of care</p>
                <h2 id="donation-activity-title">Donation activity</h2>
                <p className="hw-panel-description">
                  Each square is a day. Color shows completed donation activity,
                  not units of stock.
                </p>
              </div>
              <div className="hw-calendar-selectors">
                <label>
                  Year
                  <select
                    aria-label="Donation calendar year"
                    value={year}
                    onChange={(event) => chooseYear(event.target.value)}
                  >
                    {years.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Month
                  <select
                    aria-label="Donation calendar month"
                    value={month}
                    onChange={(event) => chooseMonth(event.target.value)}
                  >
                    <option value="all">All months</option>
                    {Array.from({ length: 12 }, (_, index) => (
                      <option
                        key={index}
                        value={String(index + 1).padStart(2, "0")}
                      >
                        {new Date(Date.UTC(2026, index, 1)).toLocaleDateString(
                          "en-PH",
                          { month: "long", timeZone: "UTC" },
                        )}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <ControlPopover name="overview-custom-dates" label="Date range" className="hw-range-popover">
            <form
              className="hw-date-range"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                const error = dateRangeError(draftRange.from, draftRange.to);
                setRangeError(error);
                if (!error) {
                  setYear(Number(draftRange.from.slice(0, 4)));
                  setMonth("all");
                  applyRange(draftRange);
                }
              }}
            >
              <label>
                From
                <input
                  type="date"
                  aria-label="Collections start date"
                  value={draftRange.from}
                  onChange={(event) => {
                    setDraftRange((previous) => ({
                      ...previous,
                      from: event.target.value,
                    }));
                    setRangeError("");
                  }}
                />
              </label>
              <label>
                Through
                <input
                  type="date"
                  aria-label="Collections end date"
                  min={draftRange.from || undefined}
                  value={draftRange.to}
                  onChange={(event) => {
                    setDraftRange((previous) => ({
                      ...previous,
                      to: event.target.value,
                    }));
                    setRangeError("");
                  }}
                />
              </label>
              <Btn type="submit" variant="primary">
                Apply dates
              </Btn>
              <Btn onClick={() => choosePreset("30")}>Reset to 30 days</Btn>
              <p>Inclusive dates · Philippine time</p>
            </form>
            </ControlPopover>
            {rangeError && (
              <p className="record-filter-error" role="alert">
                {rangeError}
              </p>
            )}
            {collections.status === "loading" && (
              <p className="hw-loading" role="status">
                Loading complete donation activity
                {progress ? ` · ${progress} records read` : ""}…
              </p>
            )}
            {collections.status === "error" && (
              <HospitalNotice
                tone="error"
                title="Donation activity couldn’t load"
              >
                <Btn onClick={() => setAttempt((n) => n + 1)}>Try again</Btn>
              </HospitalNotice>
            )}
            {ready && (
              <HospitalDonationCalendar
                year={year}
                month={month}
                rows={collections.rows}
                selectedDay={range.from === range.to ? range.from : null}
                onSelectDay={selectDay}
              />
            )}
            <div className="hw-scope-line" role="status">
              <span>
                Showing <strong>{scopeLabel}</strong>
                {ready
                  ? ` · ${rangeRows.length} donations · ${totalUnits} units`
                  : ""}
              </span>
              {period === "day" && (
                <Btn onClick={() => chooseMonth("all")}>Clear selected day</Btn>
              )}
            </div>
          </section>
          <div className="hw-analytics-grid">
            <section className="card hw-panel">
              <div className="hw-panel-heading">
                <div>
                  <p className="hw-eyebrow">Collection rhythm</p>
                  <h2>Units collected over time</h2>
                  <p className="hw-panel-description">
                    {scopeLabel}. Select an interval below to filter its
                    donations.
                  </p>
                </div>
                <Icon name="chart" size={24} />
              </div>
              {ready ? (
                <HospitalTrendChart
                  buckets={buckets}
                  onSelect={(bucket) => {
                    applyRange({ from: bucket.from, to: bucket.to });
                    showCollections();
                  }}
                />
              ) : (
                <p className="hw-loading">
                  Collection chart unavailable while records load.
                </p>
              )}
            </section>
            <section className="card hw-panel">
              <div className="hw-panel-heading">
                <div>
                  <p className="hw-eyebrow">Collected, with care</p>
                  <h2>Units by blood group</h2>
                  <p className="hw-panel-description">
                    Click a blood group to filter the collection table.
                  </p>
                </div>
              </div>
              {ready && (
                <div className="hw-group-chart">
                  {BLOOD_TYPES.map((type) => (
                    <button
                      type="button"
                      key={type}
                      aria-pressed={filters.bloodType === type}
                      aria-label={`${type}: ${groups[type]} units. Filter collections.`}
                      onClick={() => {
                        setFilters((previous) => ({
                          ...previous,
                          bloodType: previous.bloodType === type ? "all" : type,
                        }));
                        showCollections();
                      }}
                    >
                      <strong>{type}</strong>
                      <span className="hw-group-track" aria-hidden="true">
                        <i
                          style={{
                            width: `${(groups[type] / maxGroup) * 100}%`,
                          }}
                        />
                      </span>
                      <span>
                        {groups[type]} <small>units</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
          <section className="card hw-panel hw-priorities-panel">
            <div className="hw-panel-heading">
              <div>
                <p className="hw-eyebrow">Keep care moving</p>
                <h2>Request priorities</h2>
              </div>
              <Link to="/hospital/requests" className="hw-text-link">
                View all <Icon name="arrow-right" size={16} />
              </Link>
            </div>
            {requests.status === "error" && (
              <HospitalNotice tone="error" title="Requests couldn’t load">
                <Btn onClick={() => setAttempt((n) => n + 1)}>Try again</Btn>
              </HospitalNotice>
            )}
            {requests.status === "loading" && (
              <p className="hw-loading" role="status">
                Loading active requests…
              </p>
            )}
            {requestsReady && !requests.rows.length && (
              <div className="hw-empty">
                <Icon name="check" size={28} />
                <h3>No active requests</h3>
                <p>New requests appear here with the most urgent first.</p>
                <LinkBtn to="/hospital/requests/new">Create a request</LinkBtn>
              </div>
            )}
            {requestsReady && (
              <div className="hw-priority-list">
                {requests.rows.slice(0, 4).map((row) => (
                  <Link
                    to={`/hospital/requests?status=active&search=${encodeURIComponent(row.id)}`}
                    key={row.id}
                    className="hw-priority-row"
                  >
                    <span className="hw-blood-group">{row.bloodType}</span>
                    <span>
                      <strong>{componentLabel(row.component)}</strong>
                      <small>
                        {row.quantity} units · #{row.id.slice(-6).toUpperCase()}
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
            ref={tableRef}
            className="card hw-panel hw-collections"
            id="overview-collections"
            aria-labelledby="overview-collections-title"
          >
            <div className="hw-panel-heading">
              <div>
                <p className="hw-eyebrow">The records behind the numbers</p>
                <h2 id="overview-collections-title">Collections</h2>
                <p className="hw-panel-description">
                  {scopeLabel} · {ready ? visible.length : "—"} matching
                  donations
                </p>
              </div>
              <Link to="/hospital/inventory-log" className="hw-text-link">
                Full history <Icon name="arrow-right" size={16} />
              </Link>
            </div>
            <div className="record-toolbar">
              <RecordFilters
              name="collections"
              onReset={() => choosePreset("30")}
              value={filters}
              dates={false}
              disabled={!ready}
              onChange={(next) => {
                setFilters(next);
                setPage(1);
              }}
              fields={[
                {
                  key: "bloodType",
                  label: "Blood group",
                  options: BLOOD_TYPES,
                },
                {
                  key: "component",
                  label: "Component",
                  options: [
                    ...COMPONENTS,
                    { value: "unclassified", label: "Unclassified" },
                  ],
                },
              ]}
              searchPlaceholder="Search donor or request reference…"
            />
            <TableExport
              name="collections"
              getPageRows={() => visible.slice((page - 1) * 10, page * 10)}
              title={`${hospital?.name || "Facility"} blood collections`}
              columns={donationReportColumns}
              filterSummary={`${scopeLabel}${filters.bloodType !== "all" ? " · " + filters.bloodType : ""}${filters.component !== "all" ? " · " + componentLabel(filters.component) : ""}${filters.search ? " · Search: " + filters.search : ""}`}
              disabled={!ready}
              getRows={(scope, progress) =>
                scope === "filtered"
                  ? visible
                  : allHospitalDonations(hospitalId, {}, progress)
              }
            />
            </div>
            {ready &&
              (visible.length ? (
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
                    rows={visible.slice((page - 1) * 10, page * 10)}
                    rowKey={(row) => row.id}
                    scroll={false}
                  />
                  <TablePager
                    page={page}
                    pageCount={Math.max(1, Math.ceil(visible.length / 10))}
                    onPage={setPage}
                    total={visible.length}
                    rangeStart={(page - 1) * 10 + 1}
                    rangeEnd={Math.min(page * 10, visible.length)}
                  />
                </>
              ) : (
                <div className="hw-empty">
                  <Icon name="search" size={28} />
                  <h3>No donations match these filters</h3>
                  <p>
                    Try a different date, blood group or component.
                    Zero-donation days are included in the calendar.
                  </p>
                  <Btn
                    onClick={() => {
                      setFilters({
                        search: "",
                        bloodType: "all",
                        component: "all",
                      });
                      choosePreset("30");
                    }}
                  >
                    Reset collection filters
                  </Btn>
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
