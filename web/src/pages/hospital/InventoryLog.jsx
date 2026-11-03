import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../layout/AppShell";
import { HospitalShell } from "../../layout/HospitalShell";
import { useAuth } from "../../hooks/useAuth";
import { listHospitals, readHospital } from "../../services/hospitals";
import {
  allHospitalDonations,
  allStockMovements,
} from "../../services/tableExports";
import { COMPONENTS, componentLabel } from "../../services/requests";
import { BLOOD_TYPES } from "../../services/users";
import {
  donationReportColumns,
  movementReportColumns,
} from "../../utils/reportColumns";
import { collectedUnits } from "../../utils/hospitalReports";
import { filterRecords } from "../../utils/recordFilters";
import { sortDate, sortRows } from "../../utils/sortRows";
import { useTableSort } from "../../hooks/useTableSort";
import {
  Badge,
  Btn,
  Card,
  Field,
  HospitalMetric,
  HospitalPageHeader,
  PageHeader,
  RecordFilters,
  Select,
  SortControls,
  Table,
  TableExport,
  TablePager,
  Tabs,
} from "../../components";

const emptyFilters = {
  search: "",
  bloodType: "all",
  component: "all",
  changeType: "all",
  direction: "all",
  from: "",
  to: "",
};
const dateLabel = (value) => {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      })
    : "Not recorded";
};

/** Complete facility histories with shared filters, sorting, pagination and matching report scopes. */
export default function InventoryLog() {
  const { profile, role } = useAuth(),
    isAdmin = role === "admin";
  const [facilities, setFacilities] = useState([]),
    [picked, setPicked] = useState(""),
    [facilityError, setFacilityError] = useState(false);
  const hospitalId = isAdmin ? picked : profile?.hospitalId || "";
  const [hospital, setHospital] = useState(null),
    [tab, setTab] = useState("donations");
  const [data, setData] = useState({ status: "loading", rows: [] }),
    [progress, setProgress] = useState(0);
  const [filters, setFilters] = useState(emptyFilters),
    [page, setPage] = useState(1),
    [attempt, setAttempt] = useState(0);
  const { sort, setSort, toggleSort } = useTableSort();
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setFacilityError(false);
    listHospitals()
      .then((rows) => {
        if (active) {
          setFacilities(rows);
          setPicked((previous) => previous || rows[0]?.id || "");
        }
      })
      .catch(() => {
        if (active) setFacilityError(true);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, attempt]);
  useEffect(() => {
    if (!hospitalId) return;
    let active = true;
    readHospital(hospitalId)
      .then((found) => {
        if (active) setHospital(found);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [hospitalId]);
  useEffect(() => {
    if (!hospitalId) {
      setData({ status: "ready", rows: [] });
      return;
    }
    let active = true;
    setData({ status: "loading", rows: [] });
    setProgress(0);
    const progress = (count) => {
      if (active) setProgress(count);
    };
    const load =
      tab === "donations"
        ? allHospitalDonations(hospitalId, {}, progress)
        : allStockMovements(hospitalId, {}, progress);
    load
      .then((rows) => {
        if (active) setData({ status: "ready", rows });
      })
      .catch(() => {
        if (active) setData({ status: "error", rows: [] });
      });
    return () => {
      active = false;
    };
  }, [hospitalId, tab, attempt]);
  const donations = tab === "donations";
  const filterOptions = {
    date: (row) => (donations ? row.donationDate : row.createdAt),
    search: (row) =>
      `${row.id} ${row.donorId || ""} ${row.requestId || ""} ${row.reason || ""} ${row.userId || ""} ${row.bloodType} ${componentLabel(row.component)}`,
    fields: {
      component: (row) => row.component?.toLowerCase() || "unclassified",
      direction: (row) =>
        row.unitsChanged > 0
          ? "added"
          : row.unitsChanged < 0
            ? "removed"
            : "unchanged",
    },
  };
  const accessors = {
    date: (row) => sortDate(donations ? row.donationDate : row.createdAt),
    bloodType: (row) => row.bloodType,
    component: (row) => componentLabel(row.component),
    units: (row) => (donations ? Number(row.units) : Number(row.unitsChanged)),
    type: (row) => row.changeType,
    reference: (row) => row.donorId || row.userId,
  };
  const visible = useMemo(
    () =>
      sortRows(
        filterRecords(data.rows, filters, filterOptions),
        sort.key ? accessors[sort.key] : accessors.date,
        sort.key ? sort.direction : "desc",
      ),
    [data.rows, filters, sort, tab],
  );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(visible.length / 10)),
  );
  const ready = Boolean(hospitalId) && data.status === "ready";
  const Shell = isAdmin ? AppShell : HospitalShell,
    Header = isAdmin ? PageHeader : HospitalPageHeader;
  const fields = [
    { key: "bloodType", label: "Blood group", options: BLOOD_TYPES },
    {
      key: "component",
      label: "Component",
      options: [
        ...COMPONENTS,
        { value: "unclassified", label: "Unclassified" },
      ],
    },
    ...(!donations
      ? [
          {
            key: "changeType",
            label: "Movement",
            options: ["DONATION", "TRANSFUSION", "ADJUSTMENT", "EXPIRED"],
          },
          {
            key: "direction",
            label: "Direction",
            options: [
              { value: "added", label: "Units added" },
              { value: "removed", label: "Units removed" },
            ],
          },
        ]
      : []),
  ];
  function apply(next) {
    setFilters(next);
    setPage(1);
  }
  function kpi(next = {}) {
    apply({ ...emptyFilters, ...next });
    document
      .getElementById("history-records")
      ?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  const columns = [
    {
      key: "date",
      header: donations ? "Collected" : "Recorded",
      render: (row) => dateLabel(donations ? row.donationDate : row.createdAt),
    },
    {
      key: "bloodType",
      header: "Blood group",
      render: (row) => <Badge>{row.bloodType || "—"}</Badge>,
    },
    {
      key: "component",
      header: "Component",
      render: (row) => componentLabel(row.component) || "Unclassified",
    },
    {
      key: "units",
      header: donations ? "Units collected" : "Unit change",
      render: (row) => (
        <strong>
          {donations
            ? row.units
            : row.unitsChanged > 0
              ? `+${row.unitsChanged}`
              : row.unitsChanged}
        </strong>
      ),
    },
    ...(donations
      ? [
          {
            key: "reference",
            header: "Donor reference",
            render: (row) => row.donorName || row.donorId || "Not recorded",
          },
          {
            key: "request",
            header: "Request reference",
            sortable: false,
            render: (row) => row.requestId || "Not recorded",
          },
        ]
      : [
          { key: "type", header: "Movement", render: (row) => row.changeType },
          {
            key: "reason",
            header: "Reason",
            sortable: false,
            render: (row) => row.reason || "Not recorded",
          },
          {
            key: "reference",
            header: "Recorded by",
            render: (row) => row.userId || "Not recorded",
          },
        ]),
  ];
  return (
    <Shell facility={hospital?.name}>
      <Header
        tag={isAdmin ? "Dugo+ admin" : undefined}
        title="Donation & stock history"
        eyebrow="Records / Your facility"
        description="Find the records behind each collection and every change to stock."
        actions={
          <Btn
            icon="refresh"
            disabled={data.status === "loading"}
            onClick={() => setAttempt((n) => n + 1)}
          >
            Refresh
          </Btn>
        }
      />
      {isAdmin && (
        <Card>
          <Field label="Facility">
            <Select
              aria-label="Facility"
              value={picked}
              options={facilities.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              onChange={(event) => {
                setPicked(event.target.value);
                apply(emptyFilters);
              }}
            />
          </Field>
          {facilityError && (
            <p role="alert">
              Facilities couldn’t load.{" "}
              <Btn onClick={() => setAttempt((n) => n + 1)}>Try again</Btn>
            </p>
          )}
        </Card>
      )}
      {!hospitalId ? (
        <p className="hospital-state" role="status">
          A linked facility is required to view these records.
        </p>
      ) : (
        <div className="hospital-inventory">
          <Tabs
            className="hospital-inventory-tabs"
            label="History views"
            value={tab}
            tabs={[
              { value: "donations", label: "Confirmed donations" },
              { value: "movements", label: "Stock movements" },
            ]}
            onChange={(value) => {
              setTab(value);
              apply(emptyFilters);
              setSort({ key: null, direction: "asc" });
            }}
          />
          <section
            className="hw-metrics hw-history-metrics"
            aria-label="History summaries"
          >
            {donations ? (
              <>
                <HospitalMetric
                  name="history-donations"
                  label="Confirmed donations"
                  value={ready ? data.rows.length : "—"}
                  detail="View all confirmed donation records"
                  icon="check"
                  onClick={() => kpi()}
                  disabled={!ready}
                />
                <HospitalMetric
                  name="history-collected"
                  label="Units collected"
                  value={ready ? collectedUnits(data.rows) : "—"}
                  detail="View all donation records"
                  icon="droplet"
                  tone="success"
                  onClick={() => kpi()}
                  disabled={!ready}
                />
              </>
            ) : (
              <>
                <HospitalMetric
                  name="history-added"
                  label="Units added"
                  value={
                    ready
                      ? data.rows.reduce(
                          (sum, row) => sum + Math.max(0, row.unitsChanged),
                          0,
                        )
                      : "—"
                  }
                  detail="Filter positive stock movements"
                  icon="plus"
                  tone="success"
                  onClick={() => kpi({ direction: "added" })}
                  disabled={!ready}
                />
                <HospitalMetric
                  name="history-removed"
                  label="Units removed"
                  value={
                    ready
                      ? data.rows.reduce(
                          (sum, row) => sum + Math.max(0, -row.unitsChanged),
                          0,
                        )
                      : "—"
                  }
                  detail="Filter negative stock movements"
                  icon="droplet"
                  tone="attention"
                  onClick={() => kpi({ direction: "removed" })}
                  disabled={!ready}
                />
                <HospitalMetric
                  name="history-adjustments"
                  label="Manual adjustments"
                  value={
                    ready
                      ? data.rows.filter(
                          (row) => row.changeType === "ADJUSTMENT",
                        ).length
                      : "—"
                  }
                  detail="Filter adjustment records"
                  icon="settings"
                  onClick={() => kpi({ changeType: "ADJUSTMENT" })}
                  disabled={!ready}
                />
              </>
            )}
          </section>
          <Card className="hospital-inventory-table" id="history-records">
            <header>
              <p className="hw-eyebrow">Complete facility records</p>
              <h2>{donations ? "Confirmed donations" : "Stock movements"}</h2>
              <p className="muted">
                {ready
                  ? `${visible.length} matching records. Filters and exports include all matching pages.`
                  : "Loading every page before showing totals or filtered results."}
              </p>
            </header>
            <RecordFilters
              name={donations ? "donation history" : "stock movements"}
              value={filters}
              fields={fields}
              disabled={!ready}
              onChange={apply}
              searchPlaceholder={
                donations
                  ? "Search donor, request or donation reference…"
                  : "Search reason, reference or recorded-by ID…"
              }
            />
            <SortControls
              name="hospital-history"
              sort={sort}
              onChange={(next) => {
                setSort(next);
                setPage(1);
              }}
              defaultLabel="Newest records first"
              fields={columns
                .filter((column) => column.sortable !== false)
                .map((column) => ({ key: column.key, label: column.header }))}
            />
            <TableExport
              name={donations ? "donation-history" : "stock-movements"}
              title={`${hospital?.name || "Facility"} ${donations ? "confirmed donations" : "stock movements"}`}
              columns={
                donations ? donationReportColumns : movementReportColumns
              }
              disabled={!ready}
              getRows={(scope) => (scope === "filtered" ? visible : data.rows)}
              filterSummary={Object.entries(filters)
                .filter(([, value]) => value && value !== "all")
                .map(([key, value]) => `${key}: ${value}`)
                .join(" · ")}
            />
            {data.status === "loading" && (
              <p className="hospital-state" role="status">
                Loading complete history
                {progress ? ` · ${progress} records read` : ""}…
              </p>
            )}
            {data.status === "error" && (
              <div role="alert">
                <p className="hospital-state" data-kind="error">
                  The complete history couldn’t load. Partial totals and reports
                  are unavailable.
                </p>
                <Btn onClick={() => setAttempt((n) => n + 1)}>Try again</Btn>
              </div>
            )}
            {ready &&
              (visible.length ? (
                <>
                  <Table
                    mobileCards
                    className="hospital-table"
                    columns={columns}
                    rows={visible.slice(
                      (currentPage - 1) * 10,
                      currentPage * 10,
                    )}
                    rowKey={(row) => row.id}
                    scroll={false}
                    sort={sort}
                    mobileSort={false}
                    onSort={(key) => {
                      toggleSort(key);
                      setPage(1);
                    }}
                  />
                  <TablePager
                    page={currentPage}
                    pageCount={Math.max(1, Math.ceil(visible.length / 10))}
                    onPage={setPage}
                    total={visible.length}
                    rangeStart={(currentPage - 1) * 10 + 1}
                    rangeEnd={Math.min(currentPage * 10, visible.length)}
                  />
                </>
              ) : (
                <div className="hw-empty">
                  <h3>No records match these filters</h3>
                  <p>
                    Try a broader date range, another component, or clear your
                    filters.
                  </p>
                  <Btn onClick={() => apply(emptyFilters)}>Reset filters</Btn>
                </div>
              ))}
          </Card>
        </div>
      )}
    </Shell>
  );
}
