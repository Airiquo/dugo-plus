import { TableExport } from "../../components/TableExport";
import {
  stockReportColumns,
  pendingReportColumns,
  movementReportColumns,
} from "../../utils/reportColumns";
import {
  allHospitalDonations,
  allInventory,
  allStockMovements,
} from "../../services/tableExports";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  getFacilityMatches,
  getInventoryLogs,
  listHospitals,
  readHospital,
  screenDonorMatch,
  watchInventory,
} from "../../services/hospitals";
import {
  ADJUSTMENT_TYPES,
  confirmDonation,
  adjustInventory,
  recordTransfusion,
} from "../../services/inventory";
import { BLOOD_TYPES } from "../../services/users";
import { COMPONENTS, componentLabel } from "../../services/requests";
import { toDate } from "../../utils/eligibility";
import { AppShell } from "../../layout/AppShell";
import { HospitalShell } from "../../layout/HospitalShell";
import {
  Badge,
  Btn,
  Card,
  Field,
  Input,
  AdminDialog as Modal,
  PageHeader,
  HospitalPageHeader,
  HospitalNotice,
  Icon,
  Select,
  Table,
  TablePager,
  Tabs,
  Textarea,
} from "../../components";

const BLOOD_TYPE_OPTIONS = BLOOD_TYPES.map((value) => ({
  value,
  label: value,
}));

const SCREENING_OPTIONS = [
  { value: "Cleared", label: "Cleared (Ready to donate)" },
  { value: "Deferred", label: "Deferred (Temporarily ineligible)" },
  { value: "Rejected", label: "Rejected (Not eligible for this donation)" },
];

const ADJUST_OPTIONS = ADJUSTMENT_TYPES.map((value) => ({
  value,
  label: value === "EXPIRED" ? "Expired stock" : "Manual adjustment",
}));

/** Rows per page in the donation log table. */
const LOG_PAGE_SIZE = 10;

/** A readable timestamp, or an em dash when the row has never moved. */
function formatDate(value) {
  const date = toDate(value);
  return date
    ? date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
}

/** The empty form for each dialog, and its title. */
const FORMS = {
  transfusion: { kind: "transfusion", bloodType: "", units: "", requestId: "" },
  adjust: {
    kind: "adjust",
    bloodType: "",
    delta: "",
    changeType: "ADJUSTMENT",
    reason: "",
  },
};

const TITLES = {
  transfusion: "Record transfusion",
  adjust: "Adjust stock",
};

/** A match can be confirmed only when screening and guidelines are complete. */
function isConfirmable(row) {
  return (
    row.screeningStatus === "Cleared" &&
    row.guidelinesAcknowledged &&
    row.responseStatus === "Accepted"
  );
}

/** The log's status tone for a match that has no donation record yet. */
function pendingStatus(row) {
  if (row.responseStatus === "Declined")
    return { label: "Declined", tone: "rejected" };
  if (row.responseStatus === "Expired")
    return { label: "Expired", tone: "deferred" };
  if (row.responseStatus !== "Accepted")
    return { label: "Awaiting donor", tone: "pending" };
  if (row.screeningStatus === "Rejected")
    return { label: "Rejected", tone: "rejected" };
  if (row.screeningStatus === "Deferred")
    return { label: "Deferred", tone: "deferred" };
  if (row.screeningStatus !== "Cleared")
    return { label: "Not screened", tone: "pending" };
  if (!row.guidelinesAcknowledged)
    return { label: "Guidelines pending", tone: "pending" };
  return { label: "Ready", tone: "ok" };
}

/** A donor ID shortened for the table, with the full value in the tooltip. */
function shortId(value) {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

/**
 * Blood inventory — `/hospital/inventory` for staff (FR-020, FR-034) and
 * `/admin/inventory` for an admin, who picks the facility first.
 *
 * Two tabs. Stock: live counts per blood type, with Issue and Adjust on each
 * row. Donation log: matches waiting for confirmation (multi-select) above the
 * facility's confirmed donations. The one header action is Record transfusion.
 *
 * Reads: live stock, the facility's matches and its donation history, all from
 * `services/hospitals.js`. Writes: authenticated Worker transactions through
 * `services/inventory.js` — a confirmed match, an issued transfusion, or a
 * reasoned adjustment — each moving the count and its log in one transaction.
 * Staff address their own facility through the claim; an admin sends the
 * picked `hospitalId`, which the server accepts for its claim only.
 */
export default function Inventory() {
  const workspaceRef = useRef(null);
  const [stockComponent, setStockComponent] = useState("whole-blood");
  const { profile, role } = useAuth();
  const isAdmin = role === "admin";
  const staffHospitalId = profile?.hospitalId ?? "";

  const [facilities, setFacilities] = useState([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilitiesFailed, setFacilitiesFailed] = useState(false);
  const [picked, setPicked] = useState("");

  const hospitalId = isAdmin ? picked : staffHospitalId;

  const [hospital, setHospital] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("view") === "screening" ? "log" : "stock";
  const setTab = (value) =>
    setSearchParams(value === "log" ? { view: "screening" } : {}, {
      replace: true,
    });

  const [queueFacility, setQueueFacility] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFailed, setHistoryFailed] = useState(false);

  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesFailed, setMatchesFailed] = useState(false);
  const [selected, setSelected] = useState([]);
  const [unitsById, setUnitsById] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [logError, setLogError] = useState("");

  const [note, setNote] = useState("");
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [historyKey, setHistoryKey] = useState(0);

  const bumpHistory = () => setHistoryKey((key) => key + 1);

  const [screeningRow, setScreeningRow] = useState(null);
  const [screeningStatus, setScreeningStatus] = useState("");
  const [screeningSaving, setScreeningSaving] = useState(false);
  const [screeningError, setScreeningError] = useState("");

  const [logBloodType, setLogBloodType] = useState(null);
  const [stockLogs, setStockLogs] = useState([]);
  const [stockLogsLoading, setStockLogsLoading] = useState(false);
  const [stockLogsError, setStockLogsError] = useState("");

  // Donation log table controls: blood-type filter, date sort, pagination.
  const [logType, setLogType] = useState("");
  const [logSort, setLogSort] = useState("new");
  const [logPage, setLogPage] = useState(1);

  const openScreening = (row) => {
    setScreeningRow(row);
    setScreeningStatus(row.screeningStatus || "");
    setScreeningError("");
  };

  const submitScreening = async (event) => {
    event.preventDefault();
    if (!screeningRow || screeningSaving) return;
    if (!screeningStatus) {
      setScreeningError("Choose a screening result before saving.");
      return;
    }
    setScreeningSaving(true);
    setScreeningError("");
    try {
      await screenDonorMatch(screeningRow.id, screeningStatus);
      setNote(
        `Screening for donor ${shortId(screeningRow.donorId)} marked as ${screeningStatus}.`,
      );
      setScreeningRow(null);
      bumpHistory();
    } catch (error) {
      setScreeningError(
        error instanceof Error && error.message
          ? error.message
          : "Could not save screening. Check your connection.",
      );
    } finally {
      setScreeningSaving(false);
    }
  };

  const openLogs = async (bt) => {
    setLogBloodType(bt);
    setStockLogs([]);
    setStockLogsLoading(true);
    setStockLogsError("");
    try {
      const list = await getInventoryLogs(hospitalId, bt, {
        component: stockComponent,
      });
      setStockLogs(list);
    } catch (error) {
      setStockLogsError(
        error instanceof Error && error.message
          ? error.message
          : "Could not load inventory movement history.",
      );
    } finally {
      setStockLogsLoading(false);
    }
  };

  // Facility name for the sidebar, once.
  useEffect(() => {
    if (!hospitalId) return undefined;
    let current = true;
    readHospital(hospitalId)
      .then((found) => current && setHospital(found))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [hospitalId]);

  // Admin only: the picker's facility list, first entry preselected. Reloads
  // with the page's "Try again" so a failed list can be retried.
  useEffect(() => {
    if (!isAdmin) return undefined;
    let current = true;
    setFacilitiesLoading(true);
    setFacilitiesFailed(false);
    listHospitals()
      .then((list) => {
        if (!current) return;
        setFacilities(list);
        setPicked((prev) => prev || list[0]?.id || "");
      })
      .catch(() => current && setFacilitiesFailed(true))
      .finally(() => current && setFacilitiesLoading(false));
    return () => {
      current = false;
    };
  }, [isAdmin, reloadKey]);

  // Live stock: one subscription per facility, dropped on change or unmount.
  useEffect(() => {
    if (!hospitalId) {
      setLoading(false);
      setRows([]);
      return undefined;
    }
    let current = true;
    setLoading(true);
    setLoadFailed(false);
    let unsubscribe;
    try {
      unsubscribe = watchInventory(
        hospitalId,
        (next) => {
          if (!current) return;
          setRows(next);
          setLoading(false);
        },
        () => {
          if (!current) return;
          setLoadFailed(true);
          setLoading(false);
        },
        stockComponent,
      );
    } catch {
      setLoadFailed(true);
      setLoading(false);
    }
    return () => {
      current = false;
      if (unsubscribe) unsubscribe();
    };
  }, [hospitalId, stockComponent, reloadKey]);

  // Donation log: pending matches and confirmed donations load together so a
  // confirmed match drops out of the pending table in the same paint. The
  // error line is not cleared here: a partial failure sets it in the same
  // tick that reloads the log, and it has to survive the reload.
  useEffect(() => {
    if (!hospitalId || tab !== "log") return undefined;
    let current = true;
    setQueueFacility("");
    setHistoryLoading(true);
    setHistoryFailed(false);
    setMatchesLoading(true);
    setMatchesFailed(false);
    setHistory([]);
    setMatches([]);
    setSelected([]);
    setUnitsById({});

    Promise.allSettled([
      getFacilityMatches(hospitalId),
      allHospitalDonations(hospitalId).then((rows) => ({ rows })),
    ])
      .then(([matchResult, donationResult]) => {
        if (!current) return;
        if (matchResult.status === "fulfilled") setMatches(matchResult.value);
        else setMatchesFailed(true);

        if (donationResult.status === "fulfilled") {
          setHistory(donationResult.value.rows);
        } else {
          setHistoryFailed(true);
        }
      })
      .finally(() => {
        if (!current) return;
        setHistoryLoading(false);
        setMatchesLoading(false);
        setQueueFacility(hospitalId);
      });

    return () => {
      current = false;
    };
  }, [hospitalId, historyKey, tab]);

  const totals = useMemo(() => {
    const units = rows.reduce((sum, row) => sum + row.unitsAvailable, 0);
    const stocked = rows.filter((row) => row.unitsAvailable > 0).length;
    const latest = rows.reduce((last, row) => {
      const date = toDate(row.lastUpdated);
      return date && (!last || date > last) ? date : last;
    }, null);
    return { units, stocked, latest };
  }, [rows]);

  const selectedStock = form?.bloodType
    ? rows.find((row) => row.bloodType === form.bloodType)
    : null;
  const currentUnits = selectedStock?.unitsAvailable ?? 0;

  // The preview only knows the stock of the type chosen in the dialog.
  const projected = useMemo(() => {
    if (!form) return null;
    if (form.kind === "transfusion") {
      const units = Number(form.units);
      if (!Number.isInteger(units) || units < 1) return null;
      return currentUnits - units;
    }
    if (form.kind === "adjust") {
      const delta = Number(form.delta);
      if (!Number.isInteger(delta) || delta === 0) return null;
      return currentUnits + delta;
    }
    return null;
  }, [form, currentUnits]);

  // Pending rows are matches with no donation record yet; a match's ID is the
  // donation's ID (schema §2.9), so the confirmed set is a direct lookup.
  const donationIds = useMemo(
    () => new Set(history.map((row) => row.id)),
    [history],
  );
  const pending = useMemo(
    () => matches.filter((row) => !donationIds.has(row.id)),
    [matches, donationIds],
  );
  const logRows = useMemo(() => {
    const filtered = logType
      ? pending.filter((row) => row.bloodType === logType)
      : pending;
    const dir = logSort === "new" ? -1 : 1;
    return [...filtered].sort(
      (a, b) =>
        ((a.matchedAt?.getTime?.() ?? 0) - (b.matchedAt?.getTime?.() ?? 0)) *
        dir,
    );
  }, [pending, logType, logSort]);
  const logPageCount = Math.max(1, Math.ceil(logRows.length / LOG_PAGE_SIZE));
  const logCurrentPage = Math.min(logPage, logPageCount);
  const logPaged = logRows.slice(
    (logCurrentPage - 1) * LOG_PAGE_SIZE,
    logCurrentPage * LOG_PAGE_SIZE,
  );
  const ready = useMemo(() => pending.filter(isConfirmable), [pending]);
  const selectedReady = selected.filter((id) =>
    ready.some((row) => row.id === id),
  );
  const allSelected = ready.length > 0 && selectedReady.length === ready.length;

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
    setLogError("");
  };

  const toggleAll = () => {
    setSelected((prev) =>
      ready.every((row) => prev.includes(row.id))
        ? []
        : ready.map((row) => row.id),
    );
    setLogError("");
  };

  const unitsFor = (id) => unitsById[id] ?? "1";

  const updateUnits = (id, value) => {
    setUnitsById((prev) => ({ ...prev, [id]: value }));
    setLogError("");
  };

  const open = (kind, bloodType) => {
    const base = FORMS[kind];
    setForm(bloodType ? { ...base, bloodType } : base);
    setFormError("");
    setNote("");
  };

  const closeForm = () => {
    if (!saving) setForm(null);
  };

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError("");
  };

  // Confirm every selected match in turn. Sequential transactions avoid
  // retries when several donations land on the same blood type's stock row.
  const confirmSelected = async () => {
    if (!hospitalId || confirming) return;
    const chosen = pending.filter(
      (row) => selected.includes(row.id) && isConfirmable(row),
    );
    if (!chosen.length) {
      setLogError("Select at least one cleared donation to confirm.");
      return;
    }

    setConfirming(true);
    setLogError("");
    setNote("");
    let confirmed = 0;
    const failures = [];

    for (const row of chosen) {
      const units = Number(unitsFor(row.id));
      if (!Number.isInteger(units) || units < 1) {
        failures.push(
          `${shortId(row.donorId)}: units must be a whole number above zero`,
        );
        continue;
      }
      try {
        await confirmDonation({ matchId: row.id, units });
        confirmed += 1;
      } catch (error) {
        failures.push(`${shortId(row.donorId)}: ${error.message}`);
      }
    }

    setConfirming(false);
    setReviewOpen(false);
    setSelected([]);
    if (confirmed) {
      setNote(
        `Confirmed ${confirmed} donation${confirmed === 1 ? "" : "s"}. Stock and donor history updated.`,
      );
      bumpHistory();
    }
    if (failures.length) {
      setLogError(
        `${failures.length} donation${failures.length === 1 ? "" : "s"} could not be confirmed — ${failures.join("; ")}`,
      );
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form || !hospitalId || saving) return;

    setSaving(true);
    setFormError("");
    try {
      if (form.kind === "transfusion") {
        const units = Number(form.units);
        if (!Number.isInteger(units) || units < 1) {
          throw new Error("Enter a whole number of units greater than zero.");
        }
        const result = await recordTransfusion({
          bloodType: form.bloodType,
          component: stockComponent,
          units,
          requestId: form.requestId,
          hospitalId,
        });
        setNote(
          `Issued ${units} unit${units === 1 ? "" : "s"} of ${result.bloodType}. ${result.bloodType} now has ${result.unitsAvailable} unit${result.unitsAvailable === 1 ? "" : "s"}.`,
        );
      } else {
        const delta = Number(form.delta);
        if (!Number.isInteger(delta) || delta === 0) {
          throw new Error("Enter a whole number of units to add or remove.");
        }
        const result = await adjustInventory({
          bloodType: form.bloodType,
          component: stockComponent,
          delta,
          reason: form.reason,
          changeType: form.changeType,
          hospitalId,
        });
        setNote(
          `${form.changeType === "EXPIRED" ? "Removed" : "Adjusted"} ${Math.abs(delta)} unit${Math.abs(delta) === 1 ? "" : "s"} of ${result.bloodType}. ${result.bloodType} now has ${result.unitsAvailable} unit${result.unitsAvailable === 1 ? "" : "s"}.`,
        );
      }
      setForm(null);
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : "The stock change could not be saved. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || loading;
  const Shell = isAdmin ? AppShell : HospitalShell;
  const Header = isAdmin ? PageHeader : HospitalPageHeader;

  return (
    <Shell facility={hospital?.name}>
      <Header
        tag={isAdmin ? "Dugo+ admin" : undefined}
        eyebrow="Inventory / Blood bank"
        description="A clear view of your blood bank. Check stock, welcome donors, and record every movement."
        title="Blood inventory"
        actions={
          tab === "log" ? (
            <Btn
              icon="refresh"
              onClick={bumpHistory}
              disabled={matchesLoading || historyLoading || confirming}
            >
              Refresh queue
            </Btn>
          ) : (
            <Btn
              variant="primary"
              icon="droplet"
              onClick={() => open("transfusion")}
              disabled={busy || loadFailed || !hospitalId}
            >
              Record transfusion
            </Btn>
          )
        }
      />
      <div id="page-body" ref={workspaceRef} tabIndex={-1}>
        <div className="hospital-inventory">
          <Tabs
            className="hospital-inventory-tabs"
            label="Inventory views"
            tabs={[
              { value: "stock", label: "Available stock" },
              {
                value: "log",
                label: "Screening & donations",
                count:
                  queueFacility !== hospitalId ||
                  matchesLoading ||
                  historyLoading ||
                  matchesFailed ||
                  historyFailed
                    ? undefined
                    : pending.length,
              },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === "stock" && (
            <Card className="hw-stock-component">
              <div>
                <p className="hw-eyebrow">Choose your stock view</p>
                <h2>One component. Every blood group.</h2>
                <p className="hospital-note">
                  Each component has its own stock count and movement history.
                </p>
              </div>
              <Field label="Stock component">
                <Select
                  aria-label="Stock component"
                  value={stockComponent}
                  disabled={
                    Boolean(form) ||
                    confirming ||
                    screeningSaving ||
                    Boolean(logBloodType)
                  }
                  options={COMPONENTS}
                  onChange={(event) => setStockComponent(event.target.value)}
                />
              </Field>
              {rows.some((row) => row.unclassifiedUnits > 0) && (
                <p className="hospital-state" data-kind="warn" role="status">
                  {rows.reduce(
                    (sum, row) => sum + (row.unclassifiedUnits || 0),
                    0,
                  )}{" "}
                  legacy units have no recorded component. They are preserved
                  and excluded from usable stock; contact an administrator
                  before classifying them.
                </p>
              )}
            </Card>
          )}

          {isAdmin && (
            <Card>
              <Field label="Facility">
                <Select
                  options={facilities.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  value={picked}
                  onChange={(event) => {
                    setPicked(event.target.value);
                    setNote("");
                    setLogError("");
                  }}
                  disabled={facilitiesLoading || facilitiesFailed || saving}
                  aria-label="Facility"
                />
              </Field>
              {facilitiesLoading && (
                <p className="hospital-state">Loading facilities…</p>
              )}
              {!facilitiesLoading && facilitiesFailed && (
                <div role="alert">
                  <p className="hospital-state" data-kind="error">
                    The facility list could not be loaded.
                  </p>
                  <Btn onClick={() => setReloadKey((key) => key + 1)}>
                    Try again
                  </Btn>
                </div>
              )}
              {!facilitiesLoading &&
                !facilitiesFailed &&
                facilities.length === 0 && (
                  <p className="hospital-state" data-kind="warn" role="status">
                    No facilities are registered yet, so there is no inventory
                    to show.
                  </p>
                )}
            </Card>
          )}

          {loading && tab === "stock" && (
            <Card>
              <p className="hospital-state">Loading blood inventory…</p>
            </Card>
          )}

          {!loading && !hospitalId && !isAdmin && (
            <Card>
              <p className="hospital-state" data-kind="warn" role="status">
                This account is not linked to a facility yet. Ask an
                administrator to set your hospital, then reload.
              </p>
            </Card>
          )}

          {!loading && hospitalId && loadFailed && tab === "stock" && (
            <Card>
              <p className="hospital-state" data-kind="error" role="alert">
                Blood inventory could not be loaded. Check your connection and
                try again.
              </p>
              <Btn onClick={() => setReloadKey((key) => key + 1)}>
                Try again
              </Btn>
            </Card>
          )}

          {hospitalId && (tab === "log" || (!loading && !loadFailed)) && (
            <>
              {note && (
                <p className="hospital-state" data-kind="ok" role="status">
                  {note}
                </p>
              )}

              {tab === "stock" && (
                <>
                  <section
                    className="hospital-inventory-summary"
                    aria-label="Inventory summary"
                  >
                    <Card>
                      <span>Units on hand</span>
                      <strong>{totals.units}</strong>
                      <small>
                        {componentLabel(stockComponent)} · all blood groups
                      </small>
                    </Card>
                    <Card>
                      <span>Types stocked</span>
                      <strong>
                        {totals.stocked}
                        <small> / {BLOOD_TYPES.length}</small>
                      </strong>
                      <small>With at least one unit</small>
                    </Card>
                    <Card>
                      <span>Last change</span>
                      <strong className="hospital-inventory-last">
                        {formatDate(totals.latest)}
                      </strong>
                      <small>Most recent stock movement</small>
                    </Card>
                  </section>

                  <Card className="hospital-inventory-table">
                    <header>
                      <h2>Stock by blood type</h2>
                      <p className="muted">
                        Current {componentLabel(stockComponent).toLowerCase()}{" "}
                        units at your facility. Issue collected units or record
                        a correction.
                      </p>
                    </header>
                    <TableExport
                      name="inventory"
                      title={`${hospital?.name || "Facility"} blood inventory`}
                      columns={stockReportColumns}
                      disabled={loading || loadFailed || !hospitalId}
                      getRows={(scope) =>
                        scope === "filtered"
                          ? rows.map((row) => ({
                              ...row,
                              component: stockComponent,
                            }))
                          : allInventory(hospitalId)
                      }
                    />
                    {!isAdmin ? (
                      <div className="hw-stock-grid">
                        {rows.map((row) => (
                          <article
                            className="hw-stock-card"
                            key={row.bloodType}
                            data-empty={row.unitsAvailable === 0}
                            aria-label={`${row.bloodType} ${componentLabel(stockComponent)} stock`}
                          >
                            <div className="hw-stock-top">
                              <span className="hw-blood-group">
                                {row.bloodType}
                              </span>
                              <span
                                className="hw-stock-status"
                                data-empty={row.unitsAvailable === 0}
                              >
                                {row.unitsAvailable === 0
                                  ? "No stock"
                                  : "In stock"}
                              </span>
                            </div>
                            <div className="hw-stock-amount">
                              <strong>{row.unitsAvailable}</strong>
                              <span>units available</span>
                            </div>
                            <p className="hw-stock-updated">
                              {row.lastUpdated
                                ? `Updated ${formatDate(row.lastUpdated)}`
                                : "No movements recorded"}
                            </p>
                            <div className="hw-stock-actions">
                              <Btn
                                onClick={() =>
                                  open("transfusion", row.bloodType)
                                }
                                disabled={row.unitsAvailable === 0}
                                aria-label={`Issue ${row.bloodType} units`}
                              >
                                <Icon name="droplet" size={15} />
                                Issue
                              </Btn>
                              <Btn
                                onClick={() => open("adjust", row.bloodType)}
                                aria-label={`Adjust ${row.bloodType} stock`}
                              >
                                Adjust
                              </Btn>
                              <Btn
                                onClick={() => openLogs(row.bloodType)}
                                aria-label={`${row.bloodType} movement history`}
                                title="Movement history"
                              >
                                <Icon name="clock" size={17} />
                              </Btn>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Table
                        mobileCards
                        className="hospital-table"
                        columns={[
                          {
                            key: "bloodType",
                            header: "Blood type",
                            render: (row) => (
                              <Badge data-blood-type={row.bloodType}>
                                {row.bloodType}
                              </Badge>
                            ),
                          },
                          {
                            key: "unitsAvailable",
                            header: "Units on hand",
                            render: (row) => (
                              <strong className="hospital-inventory-units">
                                {row.unitsAvailable}
                              </strong>
                            ),
                          },
                          {
                            key: "lastUpdated",
                            header: "Last updated",
                            render: (row) => formatDate(row.lastUpdated),
                          },
                          {
                            key: "actions",
                            header: "Actions",
                            render: (row) => (
                              <div className="hospital-inventory-actions">
                                <Btn
                                  icon="droplet"
                                  onClick={() =>
                                    open("transfusion", row.bloodType)
                                  }
                                  disabled={row.unitsAvailable === 0}
                                >
                                  Issue
                                </Btn>
                                <Btn
                                  icon="settings"
                                  onClick={() => open("adjust", row.bloodType)}
                                >
                                  Adjust
                                </Btn>
                                <Btn
                                  variant="subtle"
                                  onClick={() => openLogs(row.bloodType)}
                                >
                                  History
                                </Btn>
                              </div>
                            ),
                          },
                        ]}
                        rows={rows}
                        rowKey={(row) => row.bloodType}
                        scroll={false}
                        rowProps={(row) => ({
                          "data-empty":
                            row.unitsAvailable === 0 ? "true" : undefined,
                        })}
                      />
                    )}
                  </Card>
                </>
              )}

              {tab === "log" && (
                <>
                  <div
                    className="hw-screening-steps"
                    aria-label="Donation workflow"
                  >
                    <div>
                      <span>1</span>
                      <strong>Donor accepts</strong>
                      <small>Guidelines and consent</small>
                    </div>
                    <div>
                      <span>2</span>
                      <strong>Screen at your facility</strong>
                      <small>Record the eligibility result</small>
                    </div>
                    <div>
                      <span>3</span>
                      <strong>Confirm collection</strong>
                      <small>Actual units enter stock</small>
                    </div>
                  </div>
                  <HospitalNotice title="Screening comes before confirmation">
                    Only accepted donors with completed guidelines and a Cleared
                    screening result can be selected. The service rechecks
                    consent and eligibility when you confirm.
                  </HospitalNotice>
                  <Card className="hospital-inventory-table hospital-inventory-log">
                    <header className="hospital-inventory-head">
                      <div>
                        <p className="hw-eyebrow">From arrival to collection</p>
                        <h2>Screening & donation queue</h2>
                        <p className="muted">
                          Review accepted donors, record screening, then confirm
                          the units actually collected. Confirmation updates
                          stock and donor history together.
                        </p>
                      </div>
                      {pending.length > 0 && (
                        <Btn
                          variant="primary"
                          onClick={() => setReviewOpen(true)}
                          disabled={!selectedReady.length || confirming}
                        >
                          {confirming
                            ? "Confirming…"
                            : `Confirm selected${selectedReady.length ? ` (${selectedReady.length})` : ""}`}
                        </Btn>
                      )}
                    </header>

                    <TableExport
                      name="pending-donations"
                      title="Awaiting donation confirmation"
                      columns={pendingReportColumns}
                      disabled={
                        matchesLoading ||
                        matchesFailed ||
                        historyFailed ||
                        !hospitalId
                      }
                      getRows={async (scope, progress) => {
                        const [found, confirmed] = await Promise.all([
                          getFacilityMatches(hospitalId),
                          allHospitalDonations(hospitalId, {}, progress),
                        ]);
                        const done = new Set(confirmed.map((row) => row.id));
                        return found
                          .filter(
                            (row) =>
                              !done.has(row.id) &&
                              (scope !== "filtered" ||
                                !logType ||
                                row.bloodType === logType),
                          )
                          .sort(
                            (a, b) =>
                              ((a.matchedAt?.getTime() || 0) -
                                (b.matchedAt?.getTime() || 0)) *
                              (logSort === "new" ? -1 : 1),
                          );
                      }}
                    />
                    {matchesLoading && (
                      <p className="hospital-state">Loading donation log…</p>
                    )}

                    {!matchesLoading && historyFailed && (
                      <div role="alert">
                        <p className="hospital-state" data-kind="error">
                          Confirmed donations could not be loaded, so the
                          pending list is unavailable.
                        </p>
                        <Btn onClick={bumpHistory}>Try again</Btn>
                      </div>
                    )}

                    {!matchesLoading && !historyFailed && matchesFailed && (
                      <div role="alert">
                        <p className="hospital-state" data-kind="error">
                          The donation log could not be loaded.
                        </p>
                        <Btn onClick={bumpHistory}>Try again</Btn>
                      </div>
                    )}

                    {!matchesLoading &&
                      !historyFailed &&
                      !matchesFailed &&
                      pending.length === 0 && (
                        <p className="hospital-note">
                          No donors are waiting here yet. Matches appear as
                          donors are connected to your facility’s requests.
                        </p>
                      )}

                    {!matchesLoading &&
                      !historyFailed &&
                      !matchesFailed &&
                      pending.length > 0 && (
                        <>
                          {logError && (
                            <p
                              className="hospital-state"
                              data-kind="error"
                              role="alert"
                            >
                              {logError}
                            </p>
                          )}

                          <div className="hospital-table-tools">
                            <label className="hospital-table-tool">
                              <span className="care-sr-only">
                                Filter pending donations by blood type
                              </span>
                              <select
                                aria-label="Filter pending donations by blood type"
                                value={logType}
                                onChange={(event) => {
                                  setLogType(event.target.value);
                                  setLogPage(1);
                                }}
                              >
                                <option value="">All blood types</option>
                                {BLOOD_TYPES.map((bt) => (
                                  <option key={bt} value={bt}>
                                    {bt}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="hospital-table-tool">
                              <span className="care-sr-only">
                                Sort pending donations by date
                              </span>
                              <select
                                aria-label="Sort pending donations by date"
                                value={logSort}
                                onChange={(event) => {
                                  setLogSort(event.target.value);
                                  setLogPage(1);
                                }}
                              >
                                <option value="new">Newest first</option>
                                <option value="old">Oldest first</option>
                              </select>
                            </label>
                          </div>

                          {logRows.length === 0 ? (
                            <p className="hospital-note">
                              No pending donations match this filter.
                            </p>
                          ) : (
                            <>
                              <Table
                                mobileCards
                                className="hospital-table"
                                columns={[
                                  {
                                    key: "select",
                                    mobileLabel: "Select donation",
                                    header: (
                                      <input
                                        type="checkbox"
                                        className="hospital-inventory-check"
                                        aria-label="Select every ready donation"
                                        checked={allSelected}
                                        disabled={!ready.length || confirming}
                                        onChange={toggleAll}
                                      />
                                    ),
                                    cellProps: {
                                      className:
                                        "hospital-inventory-check-cell",
                                    },
                                    render: (row) => (
                                      <input
                                        type="checkbox"
                                        className="hospital-inventory-check"
                                        aria-label={`Select donation by ${row.donorId || row.id}`}
                                        checked={selected.includes(row.id)}
                                        disabled={
                                          !isConfirmable(row) || confirming
                                        }
                                        onChange={() => toggle(row.id)}
                                      />
                                    ),
                                  },
                                  {
                                    key: "matchedAt",
                                    header: "Matched",
                                    render: (row) => formatDate(row.matchedAt),
                                  },
                                  {
                                    key: "donorId",
                                    header: "Donor",
                                    render: (row) =>
                                      row.donorId ? (
                                        <code title={row.donorId}>
                                          {shortId(row.donorId)}
                                        </code>
                                      ) : (
                                        "—"
                                      ),
                                  },
                                  {
                                    key: "bloodType",
                                    header: "Blood type",
                                    render: (row) =>
                                      row.bloodType ? (
                                        <Badge data-blood-type={row.bloodType}>
                                          {row.bloodType}
                                        </Badge>
                                      ) : (
                                        "—"
                                      ),
                                  },
                                  {
                                    key: "units",
                                    header: "Units",
                                    render: (row) =>
                                      isConfirmable(row) ? (
                                        <Input
                                          className="hospital-inventory-unit-input"
                                          type="number"
                                          inputMode="numeric"
                                          min="1"
                                          step="1"
                                          value={unitsFor(row.id)}
                                          onChange={(event) =>
                                            updateUnits(
                                              row.id,
                                              event.target.value,
                                            )
                                          }
                                          disabled={confirming}
                                          aria-label={`Units collected from ${row.donorId || row.id}`}
                                        />
                                      ) : (
                                        "—"
                                      ),
                                  },
                                  {
                                    key: "requestId",
                                    header: "Request",
                                    render: (row) =>
                                      row.requestId ? (
                                        <code>{row.requestId}</code>
                                      ) : (
                                        "—"
                                      ),
                                  },
                                  {
                                    key: "status",
                                    header: "Status",
                                    render: (row) => {
                                      const status = pendingStatus(row);
                                      return (
                                        <Badge data-status={status.tone}>
                                          {status.label}
                                        </Badge>
                                      );
                                    },
                                  },
                                  {
                                    key: "actions",
                                    header: "Actions",
                                    render: (row) => (
                                      <Btn
                                        variant="subtle"
                                        onClick={() => openScreening(row)}
                                        disabled={
                                          confirming ||
                                          saving ||
                                          row.responseStatus !== "Accepted" ||
                                          !row.guidelinesAcknowledged
                                        }
                                      >
                                        {row.screeningStatus
                                          ? "Re-screen"
                                          : "Screen"}
                                      </Btn>
                                    ),
                                  },
                                ]}
                                rows={logPaged}
                                rowKey={(row) => row.id}
                                scroll={false}
                              />
                              <TablePager
                                page={logCurrentPage}
                                pageCount={logPageCount}
                                onPage={setLogPage}
                                rangeStart={
                                  (logCurrentPage - 1) * LOG_PAGE_SIZE + 1
                                }
                                rangeEnd={Math.min(
                                  logCurrentPage * LOG_PAGE_SIZE,
                                  logRows.length,
                                )}
                                total={logRows.length}
                              />
                            </>
                          )}
                        </>
                      )}
                  </Card>

                  <Card className="hospital-inventory-table">
                    <header
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "var(--space-md)",
                      }}
                    >
                      <div>
                        <h2>Confirmed donations & stock audit</h2>
                        <p className="muted">
                          {history.length > 0
                            ? `${history.length} confirmed donation${history.length === 1 ? "" : "s"} recorded at this facility.`
                            : "No donations confirmed here yet."}{" "}
                          Review confirmed donations and stock movements in the
                          full history.
                        </p>
                      </div>
                      <Link
                        className="btn"
                        to={
                          isAdmin
                            ? "/admin/inventory-log"
                            : "/hospital/inventory-log"
                        }
                      >
                        <Icon name="list" />
                        View donation & stock history
                      </Link>
                    </header>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Modal
        fallbackFocusRef={workspaceRef}
        eyebrow={isAdmin ? "Dugo+ administration" : "Hospital / Stock movement"}
        className="hw-operation-dialog"
        busy={saving}
        name="hospital-inventory"
        open={Boolean(form)}
        onClose={closeForm}
        title={
          form ? `${TITLES[form.kind]} · ${componentLabel(stockComponent)}` : ""
        }
      >
        {form && (
          <form
            className="hospital-inventory-form"
            noValidate
            onSubmit={submit}
            aria-busy={saving || undefined}
          >
            {form.kind === "transfusion" && (
              <>
                <p className="hospital-note">
                  Record the units issued from this component’s stock. Linking a
                  request adds to its issued total; it closes only when the
                  requested quantity is fully served.
                </p>
                <div className="hospital-inventory-form-grid">
                  <Field label="Blood type">
                    <Select
                      options={[
                        { value: "", label: "Choose a blood type" },
                        ...BLOOD_TYPE_OPTIONS,
                      ]}
                      value={form.bloodType}
                      onChange={(event) =>
                        update("bloodType", event.target.value)
                      }
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Units">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={form.units}
                      onChange={(event) => update("units", event.target.value)}
                      disabled={saving}
                      autoFocus
                    />
                  </Field>
                  <Field label="Request ID (optional)">
                    <Input
                      type="text"
                      value={form.requestId}
                      onChange={(event) =>
                        update("requestId", event.target.value)
                      }
                      disabled={saving}
                    />
                  </Field>
                </div>
              </>
            )}

            {form.kind === "adjust" && (
              <>
                <p className="hospital-note">
                  Corrections and expired units keep a written reason in the
                  inventory log. The count may not go below zero.
                </p>
                <div className="hospital-inventory-form-grid">
                  <Field label="Blood type">
                    <Select
                      options={[
                        { value: "", label: "Choose a blood type" },
                        ...BLOOD_TYPE_OPTIONS,
                      ]}
                      value={form.bloodType}
                      onChange={(event) =>
                        update("bloodType", event.target.value)
                      }
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Change in units">
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      placeholder="-1"
                      value={form.delta}
                      onChange={(event) => update("delta", event.target.value)}
                      disabled={saving}
                      autoFocus
                    />
                  </Field>
                  <Field label="Type">
                    <Select
                      options={ADJUST_OPTIONS}
                      value={form.changeType}
                      onChange={(event) =>
                        update("changeType", event.target.value)
                      }
                      disabled={saving}
                    />
                  </Field>
                </div>
                <Field label="Reason">
                  <Textarea
                    rows={2}
                    value={form.reason}
                    onChange={(event) => update("reason", event.target.value)}
                    disabled={saving}
                  />
                </Field>
              </>
            )}

            {rows.length > 0 && (
              <dl className="hospital-inventory-preview">
                <div>
                  <dt>Current</dt>
                  <dd>
                    {currentUnits} unit{currentUnits === 1 ? "" : "s"}
                  </dd>
                </div>
                <div>
                  <dt>After</dt>
                  <dd
                    data-over={
                      projected != null && projected < 0 ? "true" : undefined
                    }
                  >
                    {projected == null
                      ? "—"
                      : `${projected} unit${projected === 1 ? "" : "s"}`}
                  </dd>
                </div>
              </dl>
            )}

            {formError && (
              <p className="hospital-state" data-kind="error" role="alert">
                {formError}
              </p>
            )}

            <div className="hospital-dialog-actions">
              <Btn onClick={closeForm} disabled={saving}>
                Cancel
              </Btn>
              <Btn
                type="submit"
                variant="primary"
                disabled={saving || (projected != null && projected < 0)}
              >
                {saving
                  ? "Saving…"
                  : form.kind === "transfusion"
                    ? "Record transfusion"
                    : "Apply adjustment"}
              </Btn>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        fallbackFocusRef={workspaceRef}
        name="hospital-confirm-donations"
        open={reviewOpen}
        busy={confirming}
        onClose={() => !confirming && setReviewOpen(false)}
        title="Confirm collected donations"
        eyebrow={
          isAdmin ? "Dugo+ administration" : "Hospital / Review collection"
        }
        className="hw-operation-dialog"
      >
        <p className="hw-panel-description">
          Confirm only the blood actually collected. Each successful
          confirmation updates stock, donation history and the donor’s donation
          clock.
        </p>
        <ul className="hw-confirm-list">
          {ready
            .filter((row) => selectedReady.includes(row.id))
            .map((row) => (
              <li key={row.id}>
                <span>
                  <strong>
                    {row.bloodType || "Group verified on confirmation"} ·{" "}
                    {componentLabel(row.component)}
                  </strong>
                  <small>Donor {shortId(row.donorId)}</small>
                </span>
                <strong>{unitsFor(row.id)} units</strong>
              </li>
            ))}
        </ul>
        <div className="hospital-dialog-actions">
          <Btn onClick={() => setReviewOpen(false)} disabled={confirming}>
            Keep reviewing
          </Btn>
          <Btn
            variant="primary"
            onClick={confirmSelected}
            disabled={confirming || !selectedReady.length}
          >
            {confirming
              ? "Confirming…"
              : `Confirm ${selectedReady.length} donation${selectedReady.length === 1 ? "" : "s"}`}
          </Btn>
        </div>
      </Modal>

      <Modal
        fallbackFocusRef={workspaceRef}
        eyebrow={
          isAdmin ? "Dugo+ administration" : "Hospital / Donor screening"
        }
        className="hw-operation-dialog"
        busy={screeningSaving}
        name="hospital-screening"
        open={Boolean(screeningRow)}
        onClose={() => !screeningSaving && setScreeningRow(null)}
        title="Screen donor"
      >
        {screeningRow && (
          <form
            className="hospital-inventory-form"
            onSubmit={submitScreening}
            aria-busy={screeningSaving || undefined}
          >
            <p className="hospital-note">
              Record health screening for donor{" "}
              <code>{shortId(screeningRow.donorId)}</code>. Cleared donors
              become eligible for donation confirmation.
            </p>
            <div className="hospital-inventory-form-grid">
              <Field label="Donor">
                <Input value={screeningRow.donorId} disabled readOnly />
              </Field>
              <Field label="Blood type">
                <Input
                  value={
                    screeningRow.bloodType ||
                    "Verified by the service on confirmation"
                  }
                  disabled
                  readOnly
                />
              </Field>
              <Field label="Request ID">
                <Input
                  value={screeningRow.requestId || "—"}
                  disabled
                  readOnly
                />
              </Field>
            </div>
            <Field label="Screening result">
              <Select
                aria-label="Screening result"
                options={[
                  { value: "", label: "Choose a screening result" },
                  ...SCREENING_OPTIONS,
                ]}
                value={screeningStatus}
                onChange={(e) => setScreeningStatus(e.target.value)}
                disabled={screeningSaving}
              />
            </Field>

            {screeningError && (
              <p className="hospital-state" data-kind="error" role="alert">
                {screeningError}
              </p>
            )}

            <div className="hospital-dialog-actions">
              <Btn
                onClick={() => setScreeningRow(null)}
                disabled={screeningSaving}
              >
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={screeningSaving}>
                {screeningSaving ? "Saving…" : "Save result"}
              </Btn>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        fallbackFocusRef={workspaceRef}
        eyebrow={
          isAdmin ? "Dugo+ administration" : "Hospital / Movement history"
        }
        className="hw-operation-dialog"
        name="hospital-stock-logs"
        open={Boolean(logBloodType)}
        onClose={() => setLogBloodType(null)}
        title={`${logBloodType || ""} ${componentLabel(stockComponent)} movement history`}
      >
        <div className="hospital-inventory-form">
          <p className="hospital-note">
            Every {componentLabel(stockComponent).toLowerCase()} movement
            recorded for {logBloodType} at this facility.
          </p>

          <TableExport
            name="stock-history"
            title={`${logBloodType || ""} ${componentLabel(stockComponent)} movements`}
            columns={movementReportColumns}
            disabled={
              !logBloodType || stockLogsLoading || Boolean(stockLogsError)
            }
            getRows={(_, progress) =>
              allStockMovements(
                hospitalId,
                { component: stockComponent, bloodType: logBloodType },
                progress,
              )
            }
          />
          {stockLogsLoading && (
            <p className="hospital-state">Loading movements…</p>
          )}

          {!stockLogsLoading && stockLogsError && (
            <p className="hospital-state" data-kind="error" role="alert">
              {stockLogsError}
            </p>
          )}

          {!stockLogsLoading && !stockLogsError && stockLogs.length === 0 && (
            <p className="hospital-note">
              No movements recorded for {logBloodType} yet.
            </p>
          )}

          {!stockLogsLoading && !stockLogsError && stockLogs.length > 0 && (
            <Table
              mobileCards
              columns={[
                {
                  key: "createdAt",
                  header: "Date",
                  render: (row) => formatDate(row.createdAt),
                },
                {
                  key: "changeType",
                  header: "Type",
                  render: (row) => (
                    <Badge
                      data-status={
                        row.changeType === "DONATION"
                          ? "ok"
                          : row.changeType === "EXPIRED"
                            ? "rejected"
                            : "pending"
                      }
                    >
                      {row.changeType}
                    </Badge>
                  ),
                },
                {
                  key: "unitsChanged",
                  header: "Change",
                  render: (row) => (
                    <strong>
                      {row.unitsChanged > 0
                        ? `+${row.unitsChanged}`
                        : row.unitsChanged}
                    </strong>
                  ),
                },
                {
                  key: "reason",
                  header: "Reason",
                  render: (row) => row.reason || "—",
                },
                {
                  key: "userId",
                  header: "Actor",
                  render: (row) =>
                    row.userId ? <code>{shortId(row.userId)}</code> : "—",
                },
              ]}
              rows={stockLogs}
              rowKey={(row) => row.id}
            />
          )}

          <div className="hospital-dialog-actions">
            <Btn onClick={() => setLogBloodType(null)}>Close</Btn>
          </div>
        </div>
      </Modal>
    </Shell>
  );
}
