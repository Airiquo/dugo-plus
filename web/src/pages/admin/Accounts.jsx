import { RecordFilters } from "../../components/RecordFilters";
import { filterRecords } from "../../utils/recordFilters";
import { TableExport } from "../../components/TableExport";
import {
  accountReportColumns,
  auditReportColumns,
} from "../../utils/reportColumns";
import { allAccountHistory } from "../../services/tableExports";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../layout/AppShell";
import { useAuth } from "../../hooks/useAuth";
import { BLOOD_TYPES, listUsers, removeUser, updateUserStatus } from "../../services/users";
import {
  accountServiceError,
  createHospitalAccount,
  deleteAuthAccount,
} from "../../services/accounts";
import { getAccountHistory } from "../../services/audit";
import {
  AdminDialog,
  SortableHeader,
  SortControls,
  AccountProfileEditor,
  HospitalLocationMap,
  Btn,
  Field,
  Icon,
  Input,
  PageHeader,
  Select,
} from "../../components";
import {
  accountActionReasons,
  accountProfileEditReason,
} from "../../utils/accountActions";
import { useTableSort } from "../../hooks/useTableSort";
import { sortRows } from "../../utils/sortRows";
import { asPoint } from "../../utils/geo";

/** Account directory, hospital provisioning and per-account history (FR-040/035). */
const EMPTY = {
  facilityName: "",
  address: "",
  contactNumber: "",
  city: "",
  latitude: "",
  longitude: "",
  email: "",
  password: "",
  fullName: "",
  hospitalId: "",
};
const ACTIONS = {
  suspend: {
    label: "Suspend",
    title: "Suspend account access?",
    description:
      "Protected access will be blocked until an administrator restores this account.",
  },
  remove: {
    label: "Remove access",
    title: "Remove account access?",
    description:
      "This closes access while retaining the profile and activity history. It does not erase personal data or delete the sign-in.",
  },
  restore: {
    label: "Restore",
    title: "Restore account access?",
    description:
      "This account will regain protected access. The server will first check that its sign-in still exists.",
  },
  delete: {
    label: "Delete sign-in",
    title: "Permanently delete this sign-in?",
    description:
      "The sign-in will be permanently deleted and cannot be restored. The closed profile and activity history remain. Personal-data erasure is handled through Data Requests.",
  },
};
const EVENTS = {
  "Account.HospitalCreated": "Hospital account created",
  "Account.Suspended": "Access suspended",
  "Account.Removed": "Access removed",
  "Account.Reactivated": "Access restored",
  "Account.LoginDeleted": "Sign-in permanently deleted",
  "Account.ProfileUpdated": "Profile details updated",
  "DataAccess.Erasure": "Personal data erased",
};
const label = (account) =>
  account.fullName || account.email || "Unnamed account";
const role = (value) =>
  ({
    donor: "Donor / recipient",
    hospital: "Hospital staff",
    admin: "Administrator",
  })[value] || "Unknown role";
const tone = (status) =>
  ({ Active: "active", Suspended: "inactive", Removed: "emergency" })[status] ||
  "inactive";
function date(value) {
  if (!value) return "Not recorded";
  const parsed = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed);
}
const auditNote = (result) =>
  result.auditRecorded === false
    ? " Its activity record is saved and awaiting audit delivery."
    : "";

const ACCOUNT_SORT = {
  account: (row) => row.fullName || row.email || "",
  type: (row) => `${role(row.role)} ${row.hospitalId || ""}`,
  status: (row) => row.status || "Active",
};

export default function Accounts() {
  const { sort, toggleSort, setSort } = useTableSort();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bloodFilter, setBloodFilter] = useState("all");
  const [joinedRange, setJoinedRange] = useState({from: "", to: ""});
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({
    search: "",
    from: "",
    to: "",
    eventType: "all",
  });
  const [history, setHistory] = useState({
    events: [],
    nextBefore: null,
    loading: false,
    error: "",
  });
  const generation = useRef(0);
  const form = useRef(null);
  const noticeRef = useRef(null);

  useEffect(() => {
    if (!busy && notice) noticeRef.current?.focus();
  }, [busy, notice]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await listUsers();
      setAccounts(rows.sort((a, b) => label(a).localeCompare(label(b))));
    } catch {
      setError(
        "Accounts could not be refreshed. Check your connection and administrator access, then try again.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    setPage(1);
  }, [query, roleFilter, statusFilter, bloodFilter, joinedRange]);
  const filtered = useMemo(
    () =>
      filterRecords(accounts, { bloodType: bloodFilter, ...joinedRange }).filter((account) => {
        const term = query.trim().toLowerCase();
        return (
          (roleFilter === "all" || account.role === roleFilter) &&
          (statusFilter === "all" ||
            (account.status || "Active") === statusFilter) &&
          (!term ||
            [
              account.fullName,
              account.email,
              account.id,
              account.hospitalId,
            ].some((value) => value?.toLowerCase().includes(term)))
        );
      }),
    [accounts, query, roleFilter, statusFilter, bloodFilter, joinedRange],
  );
  const sorted = useMemo(
    () => sortRows(filtered, ACCOUNT_SORT[sort.key], sort.direction),
    [filtered, sort],
  );
  const pages = Math.max(1, Math.ceil(sorted.length / 10));
  const current = Math.min(page, pages);
  const visible = sorted.slice((current - 1) * 10, current * 10);
  const selected = dialog?.account;
  const action = ACTIONS[dialog?.kind];

  function open(kind, account) {
    setDialogError("");
    setErrors({});
    setReason("");
    setDialog({ kind, account });
  }
  function close() {
    if (busy) return;
    generation.current += 1;
    if (dialog?.kind === "create")
      setDraft((previous) => ({ ...previous, password: "" }));
    setDialog(null);
    setDialogError("");
    setReason("");
    setShowPassword(false);
  }
  async function loadHistory(
    accountId,
    before = null,
    append = false,
    complete = Object.values(historyFilters).some(
      (value) => value && value !== "all",
    ),
  ) {
    const request = ++generation.current;
    setHistory((previous) => ({
      events: append ? previous.events : [],
      nextBefore: append ? previous.nextBefore : null,
      loading: true,
      error: "",
    }));
    try {
      const result = complete
        ? { events: await allAccountHistory(accountId), nextBefore: null }
        : await getAccountHistory(accountId, before);
      if (request !== generation.current) return;
      setHistory((previous) => ({
        ...result,
        events: append ? [...previous.events, ...result.events] : result.events,
        loading: false,
        error: "",
      }));
    } catch (failure) {
      if (request === generation.current)
        setHistory((previous) => ({
          ...previous,
          loading: false,
          error: failure.message || "Account history could not be loaded.",
        }));
    }
  }
  function view(account) {
    open("history", account);
    setHistoryFilters({ search: "", from: "", to: "", eventType: "all" });
    loadHistory(account.id, null, false, false);
  }
  async function submitAction(event) {
    event.preventDefault();
    if (busy || !selected) return;
    const unavailable = accountActionReasons(selected, user?.uid)[dialog.kind];
    if (unavailable) {
      setDialogError(unavailable);
      return;
    }
    if (dialog.kind !== "restore" && !reason.trim()) {
      setDialogError("Add a reason for this change.");
      form.current?.querySelector("textarea")?.focus();
      return;
    }
    setBusy(true);
    setDialogError("");
    setNotice("");
    try {
      let result;
      if (dialog.kind === "delete")
        result = await deleteAuthAccount(selected.id, reason.trim());
      else if (dialog.kind === "remove")
        result = await removeUser(selected.id, reason.trim());
      else
        result = await updateUserStatus(selected.id, {
          status: dialog.kind === "restore" ? "Active" : "Suspended",
          statusReason: reason.trim(),
        });
      const completed =
        dialog.kind === "delete"
          ? "Sign-in permanently deleted"
          : dialog.kind === "restore"
            ? "Access restored"
            : dialog.kind === "remove"
              ? "Access removed"
              : "Access suspended";
      setNotice(`${completed} for ${label(selected)}.${auditNote(result)}`);
      setDialog(null);
      setReason("");
      await load();
    } catch (failure) {
      setDialogError(accountServiceError(failure));
    } finally {
      setBusy(false);
    }
  }
  function change(key, value) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({
      ...previous,
      [key]: "",
      ...(key === "latitude" || key === "longitude"
        ? { latitude: "", longitude: "" }
        : {}),
    }));
    setDialogError("");
  }
  async function submitHospital(event) {
    event.preventDefault();
    if (busy) return;
    const found = {};
    for (const [key, message] of Object.entries({
      facilityName: "Enter the facility name.",
      address: "Enter the facility address.",
      contactNumber: "Enter a contact number.",
      fullName: "Enter the contact person’s name.",
    }))
      if (!draft[key].trim()) found[key] = message;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))
      found.email = "Enter a valid sign-in email.";
    if (draft.password.length < 8 || draft.password.length > 128)
      found.password = "Use 8–128 characters.";
    const latitude =
      draft.latitude.trim() === "" ? null : Number(draft.latitude);
    const longitude =
      draft.longitude.trim() === "" ? null : Number(draft.longitude);
    if ((latitude === null) !== (longitude === null))
      found.latitude = found.longitude =
        "Enter both coordinates or leave both empty.";
    else if (
      latitude !== null &&
      (!Number.isFinite(latitude) || Math.abs(latitude) > 90)
    )
      found.latitude = "Latitude must be between −90 and 90.";
    else if (
      longitude !== null &&
      (!Number.isFinite(longitude) || Math.abs(longitude) > 180)
    )
      found.longitude = "Longitude must be between −180 and 180.";
    if (
      draft.hospitalId.trim() &&
      !/^[a-z0-9][a-z0-9-]{2,59}$/.test(draft.hospitalId.trim())
    )
      found.hospitalId = "Use 3–60 lowercase letters, numbers or dashes.";
    setErrors(found);
    if (Object.keys(found).length) {
      setDialogError("Check the highlighted fields.");
      requestAnimationFrame(() => {
        const invalid = form.current?.querySelector('[aria-invalid="true"]');
        const disclosure = invalid?.closest("details");
        if (disclosure) disclosure.open = true;
        invalid?.focus();
      });
      return;
    }
    setBusy(true);
    setDialogError("");
    setNotice("");
    try {
      const result = await createHospitalAccount({
        ...Object.fromEntries(
          Object.entries(draft).map(([key, value]) => [
            key,
            key === "password" ? value : value.trim(),
          ]),
        ),
        latitude,
        longitude,
      });
      setNotice(
        `Hospital account created for ${draft.facilityName.trim()}. Facility ID: ${result.hospitalId}.${auditNote(result)}`,
      );
      setDraft(EMPTY);
      setShowPassword(false);
      setDialog(null);
      await load();
    } catch (failure) {
      setDialogError(accountServiceError(failure));
    } finally {
      setBusy(false);
    }
  }
  function field(key, title, options = {}) {
    return (
      <Field
        key={key}
        label={`${title}${options.required ? " *" : ""}`}
        className={options.wide ? "aa-span" : ""}
      >
        <Input
          id={`hospital-${key}`}
          value={draft[key]}
          onChange={(event) => change(key, event.target.value)}
          type={options.type || "text"}
          autoComplete={key === "password" ? "new-password" : "off"}
          required={options.required}
          maxLength={options.maxLength || 240}
          step={options.type === "number" ? "any" : undefined}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? `hospital-${key}-error` : undefined}
          disabled={busy}
        />
        {errors[key] && (
          <small id={`hospital-${key}-error`} data-state="error">
            {errors[key]}
          </small>
        )}
      </Field>
    );
  }

  return (
    <AppShell>
      <section
        className="admin-accounts-workspace"
        aria-label="Account management"
      >
        <PageHeader
          tag="People & permissions"
          title="Accounts"
          actions={
            <Btn
              variant="primary"
              icon="plus"
              onClick={() => open("create")}
              disabled={busy}
            >
              New hospital account
            </Btn>
          }
        />
        <p className="aa-intro">
          Manage the people and facilities behind every connection.
        </p>
        <div className="aa-feedback" aria-live="polite">
          {notice && (
            <p
              ref={noticeRef}
              tabIndex={-1}
              className="aa-notice"
              role="status"
            >
              <Icon name="check" />
              {notice}
            </p>
          )}
        </div>
        {error && (
          <p className="aa-notice" role="alert">
            {error}
            <Btn onClick={load} disabled={loading}>
              Retry
            </Btn>
          </p>
        )}
        <div className="card aa-directory">
          <div className="aa-directory-heading">
            <div>
              <h2>
                Account directory <span>{filtered.length}</span>
              </h2>
              <p>All roles · {accounts.length} {accounts.length === 1 ? "account" : "accounts"} loaded</p>
            </div>
            <div className="aa-directory-actions">
              <Btn icon="refresh" onClick={load} disabled={loading}>
                {loading ? "Refreshing…" : "Refresh"}
              </Btn>

            </div>
          </div>
          <div className="record-toolbar account-directory-toolbar">
            <RecordFilters name="account directory" value={{search:query,role:roleFilter,status:statusFilter,bloodType:bloodFilter,...joinedRange}}
              onChange={next => {setQuery(next.search || "");setRoleFilter(next.role || "all");setStatusFilter(next.status || "all");setBloodFilter(next.bloodType || "all");setJoinedRange({from:next.from || "",to:next.to || ""});}}
              disabled={loading || Boolean(error)} searchPlaceholder="Name, email, account or facility ID"
              fields={[
                {key:"role",label:"Account type",options:[{value:"hospital",label:"Hospital staff"},{value:"donor",label:"Donor / recipient"},{value:"admin",label:"Administrator"}]},
                {key:"status",label:"Access status",options:["Active","Suspended","Removed"]},
                {key:"bloodType",label:"Blood group",options:BLOOD_TYPES},
              ]} />
            <TableExport
                name="accounts"
              getPageRows={() => visible}
                title="Accounts"
                columns={accountReportColumns}
                disabled={loading || Boolean(error)}
                getRows={(scope) =>
                  scope === "filtered"
                    ? sorted
                    : sortRows(accounts, ACCOUNT_SORT[sort.key], sort.direction)
                }
              />
          </div>
          <p className="account-directory-meta">Showing {filtered.length} of {accounts.length} · Dates use Philippine time</p>
          <SortControls
            className="table-sort-mobile"
            name="accounts"
            sort={sort}
            onChange={(next) => {
              setSort(next);
              setPage(1);
            }}
            defaultLabel="Account name (A–Z)"
            fields={[
              { key: "account", label: "Account" },
              { key: "type", label: "Type / facility" },
              { key: "status", label: "Access" },
            ]}
          />
          <div aria-busy={loading}>
            {loading && !accounts.length ? (
              <div className="aa-empty" role="status">
                Loading the account directory…
              </div>
            ) : !visible.length ? (
              <div className="aa-empty">
                <Icon name="search" size={32} />
                <h3>
                  {accounts.length
                    ? "No matching accounts"
                    : "No accounts available"}
                </h3>
                <p>
                  {accounts.length
                    ? "Try a different name, role or access status."
                    : "Refresh the directory or create a hospital account."}
                </p>
                {accounts.length > 0 && (
                  <Btn
                    onClick={() => {
                      setQuery("");
                      setRoleFilter("all");
                      setStatusFilter("all");
                      setBloodFilter("all");setJoinedRange({from:"",to:""});
                    }}
                  >
                    Clear filters
                  </Btn>
                )}
              </div>
            ) : (
              <table className="table aa-table">
                <caption className="aa-sr-only">
                  Accounts and available access actions
                </caption>
                <thead>
                  <tr>
                    <SortableHeader
                      sortKey="account"
                      sort={sort}
                      onSort={(key) => {
                        toggleSort(key);
                        setPage(1);
                      }}
                    >
                      Account
                    </SortableHeader>
                    <SortableHeader
                      sortKey="type"
                      sort={sort}
                      onSort={(key) => {
                        toggleSort(key);
                        setPage(1);
                      }}
                    >
                      Type / facility
                    </SortableHeader>
                    <SortableHeader
                      sortKey="status"
                      sort={sort}
                      onSort={(key) => {
                        toggleSort(key);
                        setPage(1);
                      }}
                    >
                      Access
                    </SortableHeader>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((account) => {
                    const unavailable = accountActionReasons(
                      account,
                      user?.uid,
                      busy,
                    );
                    const status = account.status || "Active";
                    const explanation = accountActionReasons(
                      account,
                      user?.uid,
                    ).suspend;
                    return (
                      <tr key={account.id}>
                        <td data-label="Account">
                          <div className="aa-person">
                            <span className="aa-avatar" aria-hidden="true">
                              {label(account).slice(0, 1).toUpperCase()}
                            </span>
                            <div>
                              <strong>{label(account)}</strong>
                              <span>
                                {account.email || "Email unavailable"}
                              </span>
                              <small>
                                {account.id === user?.uid
                                  ? "Your account"
                                  : `ID · ${account.id}`}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td data-label="Type / facility">
                          <strong>{role(account.role)}</strong>
                          <small>{account.hospitalId || "—"}</small>
                        </td>
                        <td data-label="Access">
                          <span className="badge" data-status={tone(status)}>
                            {status}
                          </span>
                          <small>
                            {account.personalDataErased
                              ? "Personal data erased"
                              : account.loginState === "Deleted" ||
                                  account.loginDeletedAt
                                ? "Sign-in permanently deleted"
                                : ["Deleting", "Provisioning"].includes(
                                      account.loginState,
                                    )
                                  ? `Sign-in ${account.loginState.toLowerCase()}`
                                  : `Updated ${date(account.statusUpdatedAt)}`}
                          </small>
                        </td>
                        <td data-label="Actions">
                          <div className="aa-row-actions">
                            <Btn
                              disabled={Boolean(
                                accountProfileEditReason(
                                  account,
                                  user?.uid,
                                  busy,
                                ),
                              )}
                              title={
                                accountProfileEditReason(
                                  account,
                                  user?.uid,
                                  busy,
                                ) || "Edit profile and facility details"
                              }
                              onClick={() => open("edit", account)}
                              aria-label={`Edit details for ${label(account)}`}
                            >
                              Edit details
                            </Btn>
                            <Btn
                              onClick={() => view(account)}
                              aria-label={`View history for ${label(account)}`}
                            >
                              View history
                            </Btn>
                            {Object.entries(ACTIONS).map(([key, value]) => (
                              <Btn
                                key={key}
                                variant={key === "delete" ? "alert" : "default"}
                                disabled={Boolean(unavailable[key])}
                                aria-describedby={`access-help-${account.id}`}
                                title={unavailable[key] || value.description}
                                onClick={() => open(key, account)}
                              >
                                {value.label}
                              </Btn>
                            ))}
                          </div>
                          <details
                            className="aa-action-help"
                            id={`access-help-${account.id}`}
                          >
                            <summary>Action availability</summary>
                            <ul>
                              {Object.entries(ACTIONS)
                                .filter(([key]) => unavailable[key])
                                .map(([key, value]) => (
                                  <li key={key}>
                                    <strong>{value.label}:</strong>{" "}
                                    {unavailable[key]}
                                  </li>
                                ))}
                            </ul>
                          </details>
                          {account.id === user?.uid ||
                          account.role === "admin" ||
                          account.personalDataErased ? (
                            <small>{explanation}</small>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <footer className="aa-pagination">
            <span>
              {filtered.length
                ? `${(current - 1) * 10 + 1}–${Math.min(current * 10, filtered.length)} of ${filtered.length} accounts`
                : "0 accounts"}
            </span>
            <div>
              <Btn
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
                aria-label="Previous account page"
              >
                Previous
              </Btn>
              <span>
                Page {current} of {pages}
              </span>
              <Btn
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
                aria-label="Next account page"
              >
                Next
              </Btn>
            </div>
          </footer>
        </div>

        <AccountProfileEditor
          account={selected}
          open={dialog?.kind === "edit"}
          onClose={close}
          onSaved={(result) => {
            setNotice(
              `Profile details saved for ${label(selected)}.${auditNote(result)}`,
            );
            setDialog(null);
            load();
          }}
        />

        <AdminDialog
          name="hospital-create"
          open={dialog?.kind === "create"}
          title="Create a hospital account"
          busy={busy}
          onClose={close}
        >
          <p className="aa-dialog-intro">
            Create a hospital staff sign-in linked to its facility. Setup and
            account activity are recorded together.
          </p>
          <form ref={form} noValidate onSubmit={submitHospital}>
            <fieldset disabled={busy}>
              <legend>
                <span>01</span> Facility details
              </legend>
              <div className="aa-form-grid">
                {field("facilityName", "Facility name", {
                  required: true,
                  maxLength: 160,
                })}
                {field("hospitalId", "Facility ID (optional)", {
                  maxLength: 60,
                })}
                {field("address", "Facility address", {
                  required: true,
                  wide: true,
                })}
                {field("city", "City (optional)", { maxLength: 120 })}
                {field("contactNumber", "Contact number", {
                  type: "tel",
                  required: true,
                  maxLength: 40,
                })}
              </div>
              <div className="aa-location-fields">
                <h3>Facility location</h3>
                <HospitalLocationMap
                  editable
                  disabled={busy}
                  position={asPoint(draft.latitude, draft.longitude)}
                  label="Pin the new hospital location"
                  onChange={({ lat, lng }) => {
                    change("latitude", String(lat));
                    change("longitude", String(lng));
                  }}
                />
                <div className="aa-form-grid">
                  {field("latitude", "Latitude", { type: "number" })}
                  {field("longitude", "Longitude", { type: "number" })}
                </div>
                <p>
                  Place a pin or enter both coordinates. Leave both empty if the
                  location is not known yet.
                </p>
              </div>
            </fieldset>
            <fieldset disabled={busy}>
              <legend>
                <span>02</span> Person & sign-in
              </legend>
              <div className="aa-form-grid">
                {field("fullName", "Contact person", {
                  required: true,
                  maxLength: 120,
                })}
                {field("email", "Sign-in email", {
                  type: "email",
                  required: true,
                  maxLength: 254,
                })}
                {field("password", "Temporary password", {
                  type: showPassword ? "text" : "password",
                  required: true,
                  maxLength: 128,
                })}
                <div className="aa-password-help">
                  <label>
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(event) =>
                        setShowPassword(event.target.checked)
                      }
                      disabled={busy}
                    />{" "}
                    Show password
                  </label>
                  <small>
                    8–128 characters. Share the credentials through your
                    approved channel.
                  </small>
                </div>
              </div>
            </fieldset>
            {dialogError && (
              <p className="aa-inline-error" role="alert">
                {dialogError}
              </p>
            )}
            <footer className="aa-dialog-actions">
              <span>
                {busy
                  ? "Setting up the hospital. Please keep this window open."
                  : "Required fields are marked *. Passwords are cleared when this dialog is closed."}
              </span>
              <Btn onClick={close} disabled={busy}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={busy}>
                {busy ? "Creating account…" : "Create hospital account"}
              </Btn>
            </footer>
          </form>
        </AdminDialog>

        <AdminDialog
          name="account-change"
          open={Boolean(action)}
          title={action?.title || "Account access"}
          busy={busy}
          onClose={close}
          className="aa-confirm-dialog"
        >
          {action && selected && (
            <form ref={form} noValidate onSubmit={submitAction}>
              <div className="aa-confirm-account">
                <Icon name="user" />
                <div>
                  <strong>{label(selected)}</strong>
                  <span>{selected.email || selected.id}</span>
                </div>
                <span
                  className="badge"
                  data-status={tone(selected.status || "Active")}
                >
                  {selected.status || "Active"}
                </span>
              </div>
              <p className="aa-dialog-intro">{action.description}</p>
              <Field
                label={
                  dialog.kind === "restore"
                    ? "Administrator note (optional)"
                    : "Reason for this change"
                }
              >
                <textarea
                  id="account-change-reason"
                  rows={3}
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setDialogError("");
                  }}
                  maxLength={2000}
                  required={dialog.kind !== "restore"}
                  disabled={busy}
                  aria-invalid={Boolean(dialogError && !reason.trim())}
                  aria-describedby={
                    dialogError ? "account-change-error" : undefined
                  }
                />
              </Field>
              {dialogError && (
                <p
                  id="account-change-error"
                  className="aa-inline-error"
                  role="alert"
                >
                  {dialogError}
                </p>
              )}
              <footer className="aa-dialog-actions">
                <Btn disabled={busy} onClick={close}>
                  Cancel
                </Btn>
                <Btn
                  type="submit"
                  variant={dialog.kind === "restore" ? "primary" : "alert"}
                  disabled={busy}
                >
                  {busy ? "Updating account…" : action.label}
                </Btn>
              </footer>
            </form>
          )}
        </AdminDialog>

        <AdminDialog
          name="account-history"
          open={dialog?.kind === "history"}
          title={selected ? label(selected) : "Account history"}
          onClose={close}
        >
          {selected && (
            <>
              <dl className="aa-account-facts">
                {[
                  ["Account type", role(selected.role)],
                  ["Email", selected.email || "Unavailable"],
                  ["Access", selected.status || "Active"],
                  ["Facility", selected.hospitalId || "Not linked"],
                  ["Account ID", selected.id],
                  ["Last access change", date(selected.statusUpdatedAt)],
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="aa-history-heading">
                <div>
                  <h3>Account activity</h3>
                  <p>
                    Events affecting this account. Names reflect current
                    profiles.
                  </p>
                </div>
                <Btn
                  icon="refresh"
                  disabled={history.loading}
                  onClick={() => loadHistory(selected.id)}
                >
                  Refresh
                </Btn>
              </div>
              <div className="record-toolbar">
                <RecordFilters
                name="account activity"
                value={historyFilters}
                disabled={history.loading}
                onChange={(next) => {
                  setHistoryFilters(next);
                  if (
                    history.nextBefore &&
                    Object.values(next).some(
                      (value) => value && value !== "all",
                    )
                  ) {
                    loadHistory(selected.id, null, false, true);
                  }
                }}
                fields={[
                  {
                    key: "eventType",
                    label: "Event",
                    options: [
                      "Account.HospitalCreated",
                      "Account.ProfileUpdated",
                      "Account.Suspended",
                      "Account.Reactivated",
                      "Account.Removed",
                      "Account.LoginDeleted",
                      "Donation.Confirmed",
                      "Donation.Screened",
                      "Inventory.Adjusted",
                      "Inventory.Transfused",
                      "DataAccess.Erasure",
                    ],
                  },
                ]}
              />
              <TableExport
                name="account-history"
                getPageRows={() => filterRecords(history.events, historyFilters, { search: row => `${row.eventType || ""} ${row.actor?.fullName || ""} ${row.context?.reason || ""}` })}
                title={`${label(selected)} account activity`}
                columns={auditReportColumns}
                disabled={history.loading || Boolean(history.error)}
                getRows={async (scope, progress) =>
                  filterRecords(
                    await allAccountHistory(selected.id, progress),
                    scope === "filtered" ? historyFilters : {},
                    {
                      search: (row) =>
                        `${row.eventType || ""} ${row.actor?.fullName || ""} ${row.context?.reason || ""}`,
                    },
                  )
                }
              />
              </div>
              {history.error && (
                <p className="aa-inline-error" role="alert">
                  {history.error}
                  <Btn
                    disabled={history.loading}
                    onClick={() =>
                      loadHistory(
                        selected.id,
                        history.nextBefore,
                        history.events.length > 0,
                      )
                    }
                  >
                    Retry
                  </Btn>
                </p>
              )}
              {!history.events.length && !history.loading && !history.error && (
                <p className="aa-empty">
                  No recorded activity for this account.
                </p>
              )}
              {!history.loading &&
                !history.error &&
                history.events.length > 0 &&
                !filterRecords(history.events, historyFilters, {
                  search: (row) =>
                    `${row.eventType || ""} ${row.actor?.fullName || ""} ${row.context?.reason || ""}`,
                }).length && (
                  <p className="aa-empty" role="status">
                    No account activity matches these filters.
                  </p>
                )}
              <ol className="aa-history-list">
                {filterRecords(history.events, historyFilters, {
                  search: (row) =>
                    `${row.eventType || ""} ${row.actor?.fullName || ""} ${row.context?.reason || ""}`,
                }).map((item) => (
                  <li key={item.id}>
                    <span className="aa-history-dot" aria-hidden="true" />
                    <div>
                      <div className="aa-event-heading">
                        <strong>
                          {EVENTS[item.eventType] || item.eventType}
                        </strong>
                        <time>{date(item.createdAt)}</time>
                      </div>
                      <p>
                        By{" "}
                        {item.actor?.fullName ||
                          item.actor?.email ||
                          "Administrator identity unavailable"}
                      </p>
                      <blockquote>
                        {item.context?.reason ||
                          (item.contextState === "redacted"
                            ? "Personal context has been erased."
                            : item.contextState === "mismatch"
                              ? "Context integrity could not be verified."
                              : "Reason not recorded or unavailable.")}
                      </blockquote>
                      {item.context && (
                        <p className="aa-state-change">
                          {item.context.beforeStatus || "New account"}{" "}
                          <span aria-label="changed to">→</span>{" "}
                          {item.context.afterStatus || "Not recorded"}
                        </p>
                      )}
                      <small>
                        Record #{item.sequence} ·{" "}
                        {item.contextState === "verified"
                          ? "Context digest verified"
                          : item.contextState === "mismatch"
                            ? "Context digest mismatch"
                            : "Context unavailable"}{" "}
                        ·{" "}
                        <Link to="/admin/audit-trail">
                          Verify the full chain
                        </Link>
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
              {history.loading && (
                <p role="status">Loading account activity…</p>
              )}
              {history.nextBefore && (
                <Btn
                  disabled={history.loading}
                  onClick={() =>
                    loadHistory(selected.id, history.nextBefore, true)
                  }
                >
                  Load earlier activity
                </Btn>
              )}
            </>
          )}
        </AdminDialog>
      </section>
    </AppShell>
  );
}
