import { DonorFilterBar } from "../../components/DonorFilterBar";
import { filterRecords } from "../../utils/recordFilters";
import { COMPONENTS } from "../../services/requests";
import {
  PRIORITY_OPTIONS,
  REQUEST_STATUS_OPTIONS,
} from "../../utils/recordOptions";
import { SupportContact } from "../../components/SupportContact";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { useDonorRequests } from "../../hooks/useDonorRequests";
import { useDonorLocation } from "../../hooks/useDonorLocation";
import { DonorNav } from "../../layout/DonorNav";
import { Icon, DonorRequestMap, DonorRequestDetails } from "../../components";
import { sortRows, sortDate } from "../../utils/sortRows";
import { respondToMatch } from "../../services/matches";
import { isMatchingConfigured } from "../../services/matching";
import { listDonationTypes } from "../../services/donationTypes";
import { DEFAULT_INTERVALS, eligibilityFor } from "../../utils/eligibility";
import { donationTypeForComponent, urgencyRank } from "../../utils/matching";
import { missingDonorProfileFields } from "../../utils/profileCompletion";
import {
  componentName,
  enrichRequest,
  isActiveCommitment,
  isAvailableRequest,
  canReacceptRequest,
  requestDonorProfile,
  requestDistance,
  directionsUrl,
} from "../../utils/donorRequests";

/** Donor request discovery, one active commitment, and informed responses. */
export default function Requests() {
  const [startAcceptance, setStartAcceptance] = useState(false);
  const [order, setOrder] = useState("nearest");
  const { user, profile } = useAuth(),
    { theme } = useTheme();
  const position = useDonorLocation(profile);
  const [params, setParams] = useSearchParams(),
    [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    from: "",
    to: "",
    priority: "all",
    status: "all",
    response: "all",
    component: "all",
    radius: "25",
  });
  const [mobileView, setMobileView] = useState("list");
  const [tab, setTab] = useState("available");
  const { search, component, radius, ...recordFilters } = filters;
  const feed = useDonorRequests(user?.uid, radius);
  const clearFilters = () =>
    setFilters({
      search: "",
      from: "",
      to: "",
      priority: "all",
      status: "all",
      response: "all",
      component: "all",
      radius: "25",
    });
  const hasRefinements = Boolean(
    search.trim() ||
      component !== "all" ||
      recordFilters.priority !== "all" ||
      recordFilters.status !== "all" ||
      recordFilters.response !== "all" ||
      recordFilters.from ||
      recordFilters.to,
  );
  const hasFilters = hasRefinements || radius !== "25";
  const [types, setTypes] = useState(new Map()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [profilePrompt, setProfilePrompt] = useState(false);
  const profileDialog = useRef(null);
  const missingProfileFields = missingDonorProfileFields(profile);
  useEffect(() => {
    const dialog = profileDialog.current;
    if (!dialog) return;
    if (profilePrompt && !dialog.open) dialog.showModal();
    if (!profilePrompt && dialog.open) dialog.close();
  }, [profilePrompt]);
  useEffect(() => {
    let current = true;
    listDonationTypes()
      .then((rows) => {
        if (current)
          setTypes(new Map(rows.map((row) => [row.id, row.intervalDays])));
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);
  const currentProfile = requestDonorProfile(profile, feed.items);
  const items = useMemo(
    () =>
      feed.items
        .map((item) => enrichRequest(item, position, profile?.bloodType))
        .sort(
          (a, b) =>
            urgencyRank(a.request.urgencyLevel) -
              urgencyRank(b.request.urgencyLevel) ||
            (a.distance ?? Infinity) - (b.distance ?? Infinity),
        ),
    [feed.items, position, profile?.bloodType],
  );
  const commitments = items.filter(isActiveCommitment),
    active = commitments[0];
  const available = items.filter(
    (item) => isAvailableRequest(item) && item.compatible,
  );
  const past = items.filter(
    (item) => !isAvailableRequest(item) && !isActiveCommitment(item),
  );
  const source = tab === "available" ? available : past;
  const filteredRequests = filterRecords(source, recordFilters, {
    date: (item) => item.request.createdAt,
    search: (item) =>
      `${item.request.id} ${item.hospital?.name || item.request.hospitalName} ${componentName(item.request.component)}`,
    fields: {
      priority: (item) => item.request.urgencyLevel,
      status: (item) => item.request.status,
      response: (item) => item.match.responseStatus,
    },
  }).filter(
    (item) =>
      (component === "all" || item.request.component === component) &&
      (!Number.isFinite(item.distance) ||
        radius === "all" ||
        item.distance <= Number(radius)) &&
      `${item.hospital?.name || item.request.hospitalName} ${componentName(item.request.component)} ${item.request.bloodType} ${item.hospital?.address || ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const visible = sortRows(
    filteredRequests,
    {
      nearest: (item) => item.distance,
      urgent: (item) =>
        ({ stat: 0, urgent: 1, routine: 2 })[item.request.urgencyLevel] ?? 3,
      newest: (item) => sortDate(item.request.createdAt),
    }[order],
    order === "newest" ? "desc" : "asc",
  );
  const selected = items.find((item) => item.match.id === selectedId);
  useEffect(() => {
    const id = params.get("request");
    if (id && feed.status === "ready") {
      const item = items.find(
        (item) => item.request.id === id || item.match.id === id,
      );
      if (item) { setSelectedId(item.match.id); setStartAcceptance(params.get("accept") === "1" && canReacceptRequest(item)); }
    }
  }, [params, feed.status, items]);
  const selectedEligibility = selected
    ? eligibilityFor({
        ...currentProfile,
        intervalDays:
          types.get(donationTypeForComponent(selected.request.component)) ||
          DEFAULT_INTERVALS[
            donationTypeForComponent(selected.request.component)
          ] ||
          null,
      })
    : null;
  const canAcceptAgain = item => canReacceptRequest(item) && !active && item.compatible && !missingProfileFields.length
    && (currentProfile.status || 'Active') === 'Active' && eligibilityFor({ ...currentProfile, intervalDays: types.get(donationTypeForComponent(item.request.component)) || DEFAULT_INTERVALS[donationTypeForComponent(item.request.component)] || null }).eligible;
  const select = (item, accepting = false) => {
    setStartAcceptance(accepting);
    setSelectedId(item.match.id);
    setError("");
  };
  const close = () => {
    if (busy) return;
    setSelectedId(null);
    setError("");
    if (params.has("request")) {
      const next = new URLSearchParams(params);
      next.delete("request");
      next.delete("accept");
      setParams(next, { replace: true });
    }
  };
  const respond = async (response, consent = {}) => {
    if (!selected || busy || feed.status !== "ready") return;
    if (response === "Accepted" && missingProfileFields.length) {
      setProfilePrompt(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await respondToMatch(
        selected.match.id,
        response,
        response === "Accepted" && position
          ? { latitude: position.lat, longitude: position.lng }
          : null,
        consent,
      );
      setSelectedId(null);
      const next = new URLSearchParams(params);
      next.delete("request");
      next.delete("accept");
      setParams(next, { replace: true });
      setNotice(
        response === "Accepted"
          ? "Your donation is planned. Contact the hospital to arrange your visit."
          : "Response saved. You can explore other requests when you’re ready.",
      );
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };
  const activeUrl = active && directionsUrl(position, active.facility);
  return (
    <div className="pub donor-surface" data-theme={theme}>
      <DonorNav />
      <main
        id="top"
        className="donation-hub donor-main donor-browse donor-request-browse"
      >
        <header className="donor-browse-header">
          <p className="donation-eyebrow">A connection worth making</p>
          <h1>Find where you can help.</h1>
          <span className="pill donor-header-count">{available.length} matched</span>
          <p>
            Requests matched to your blood type. Choose a donation that works
            for you.
          </p>
        </header>
        {notice && (
          <div className="donation-success" role="status">
            <Icon name="check" size={20} />
            <p>{notice}</p>
            <button
              className="btn donation-icon-button"
              type="button"
              aria-label="Dismiss confirmation"
              onClick={() => setNotice("")}
            >
              <Icon name="x" />
            </button>
          </div>
        )}
        {feed.status === "ready" &&
          feed.items.length === 0 &&
          !isMatchingConfigured() && (
            <div className="donation-state" role="status">
              <Icon name="alert" size={24} />
              <h2>Matching is offline</h2>
              <p>
                The matching service is not configured, so new hospital requests
                may not reach you yet. A request appears here once the matching
                run pairs it with your profile.
              </p>
            </div>
          )}
        {feed.status === "loading" && (
          <div className="donation-state" role="status">
            <span className="donation-loading-mark" />
            <h2>Finding your connections</h2>
            <p>Loading your matched requests and donation plans…</p>
          </div>
        )}
        {feed.status === "error" && (
          <div className="donation-state" role="alert">
            <Icon name="alert" size={28} />
            <h2>We couldn’t load your requests.</h2>
            <p>{feed.error}</p>
            <button className="btn" type="button" onClick={feed.retry}>
              <Icon name="refresh" />
              Try again
            </button>
          </div>
        )}
        {feed.status === "ready" && (
          <>
            {active && (
              <section
                className="donation-commitment"
                aria-label="Your active donation"
              >
                <div className="donation-commitment-mark">
                  <Icon name="check" size={28} />
                </div>
                <div className="donation-commitment-copy">
                  <p className="donation-eyebrow">
                    You’re showing up for someone
                  </p>
                  <h2>Your donation is planned.</h2>
                  <p>
                    <strong>
                      {active.hospital?.name || active.request.hospitalName}
                    </strong>{" "}
                    · {componentName(active.request.component)} ·{" "}
                    {active.request.bloodType}
                  </p>
                  <p className="donation-subtle">
                    {active.match.screeningStatus === "Cleared"
                      ? "You’re cleared. Go to the hospital to complete your donation."
                      : "Final eligibility verification happens at the hospital before you donate — physical screening, blood tests and your medical history. Contact them to arrange the visit."}{" "}
                    You can accept another request after this donation is
                    completed, closed, or you withdraw.
                  </p>
                  {commitments.length > 1 && (
                    <p className="donation-error">
                      You have {commitments.length} earlier commitments. Review
                      your donation plans before making a new one.
                    </p>
                  )}
                </div>
                <div className="donation-commitment-actions">
                  <button
                    className="btn"
                    data-primary
                    type="button"
                    onClick={() => select(active)}
                  >
                    View my donation
                    <Icon name="arrow-right" />
                  </button>
                  {activeUrl && (
                    <a
                      className="donation-text-link"
                      href={activeUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Icon name="compass" />
                      Get directions
                    </a>
                  )}
                </div>
              </section>
            )}
            <div className="donor-browse-controls">
              <div
                className="donation-tabs"
                role="group"
                aria-label="Request view"
              >
                <button
                  type="button"
                  aria-pressed={tab === "available"}
                  onClick={() => setTab("available")}
                >
                  Available requests<span>{available.length}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={tab === "past"}
                  onClick={() => setTab("past")}
                >
                  Past responses<span>{past.length}</span>
                </button>
              </div>
              <DonorFilterBar
                name="donor-requests"
                moreLabel="Filters"
                sortLabel="Sort requests"
                value={filters}
                onChange={setFilters}
                placeholder="Search hospitals or blood components"
                order={order}
                onOrderChange={setOrder}
                sortOptions={[
                  { value: "nearest", label: "Nearest first" },
                  { value: "urgent", label: "Most urgent" },
                  { value: "newest", label: "Newest first" },
                ]}
                primary={[
                  {
                    key: "radius",
                    label: "Distance",
                    disabled: !position,
                    options: [
                      ...[5, 10, 15, 20, 25, 50].map((km) => ({
                        value: String(km),
                        label: `Within ${km} km`,
                      })),
                      { value: "all", label: "Any matched distance" },
                    ],
                  },
                  {
                    key: "component",
                    label: "Donation type",
                    allLabel: "All types",
                    options: Array.from(
                      new Set([
                        ...COMPONENTS.map((option) => option.value),
                        ...items
                          .map((item) => item.request.component)
                          .filter(Boolean),
                      ]),
                    ).map((value) => ({ value, label: componentName(value) })),
                  },

                ]}
                advanced={[
                  {
                    key: "priority",
                    label: "Urgency",
                    allLabel: "Any need",
                    options: PRIORITY_OPTIONS.map((option) => ({
                      ...option,
                      label:
                        option.value === "stat"
                          ? "Immediate need"
                          : option.label,
                    })),
                  },
                  {
                    key: "status",
                    label: "Request status",
                    allLabel: "All statuses",
                    options: REQUEST_STATUS_OPTIONS,
                  },
                  {
                    key: "response",
                    label: "Your response",
                    allLabel: "All responses",
                    options: ["Pending", "Accepted", "Declined", "Expired"].map(
                      (value) => ({ value, label: value }),
                    ),
                  },
                ]}
                dateLabel="Request posted"
              />
            </div>
            <div className="donor-browse-result-bar">
              <p aria-live="polite" aria-atomic="true">
                {visible.length}{" "}
                {tab === "past"
                  ? visible.length === 1
                    ? "past response"
                    : "past responses"
                  : visible.length === 1
                    ? "request"
                    : "requests"}
                {tab === "available" &&
                  (position &&
                  !visible.some((item) => !Number.isFinite(item.distance))
                    ? radius === "all"
                      ? " at any distance"
                      : ` within ${radius} km`
                    : " · distance unavailable")}
              </p>
              <div>
                {hasFilters && (
                  <button
                    type="button"
                    className="donor-clear-filters"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                )}
                <div
                  className="donor-browse-mobile-view"
                  role="group"
                  aria-label="Request display"
                >
                  <button
                    type="button"
                    aria-pressed={mobileView === "list"}
                    onClick={() => setMobileView("list")}
                  >
                    <Icon name="list" size={16} />
                    List
                  </button>
                  <button
                    type="button"
                    aria-pressed={mobileView === "map"}
                    onClick={() => setMobileView("map")}
                  >
                    <Icon name="compass" size={16} />
                    Map
                  </button>
                </div>
              </div>
            </div>
            {!position && (
              <p className="donor-browse-location-note">
                <Icon name="pin" size={14} />
                <Link to="/home">Add a location</Link> to see how far away each
                hospital is.
              </p>
            )}
            <div className="donation-workspace" data-mobile-view={mobileView}>
              <section
                className="donation-discovery"
                aria-label="Browse requests"
              >
                {visible.length ? (
                  <div className="donation-request-list">
                    {visible.map((item) => (
                      <article
                        key={item.match.id}
                        className="donation-request-card"
                        data-urgent={["urgent", "stat"].includes(
                          item.request.urgencyLevel,
                        )}
                      >
                        <div className="donation-card-top">
                          <span className="donation-blood">
                            {item.request.bloodType}
                          </span>
                          <div>
                            <span className="donation-component">
                              {componentName(item.request.component)}
                            </span>
                            <h3>
                              {item.hospital?.name ||
                                item.request.hospitalName ||
                                "Requesting hospital"}
                            </h3>
                          </div>
                          <span
                            className="donation-priority"
                            data-priority={item.request.urgencyLevel}
                          >
                            {item.request.urgencyLevel === "stat"
                              ? "Immediate need"
                              : item.request.urgencyLevel === "urgent"
                                ? "Urgent"
                                : "Routine"}
                          </span>
                        </div>
                        <div className="donation-card-meta">
                          <span>
                            <Icon name="pin" size={15} />
                            {requestDistance(item.distance)}
                          </span>
                          <span>
                            <Icon name="droplet" size={15} />
                            {item.request.quantity}{" "}
                            {item.request.quantity === 1
                              ? "unit needed"
                              : "units needed"}
                          </span>
                        </div>
                        <p className="donation-card-address">
                          {item.hospital?.address ||
                            "Contact the hospital for its address."}
                        </p>
                        <div className={`donation-card-footer${tab === "past" ? " donation-response-actions" : ""}`}>
                          <span>
                            {tab === "past" ? (
                              item.donated ? (
                                "Donation completed"
                              ) : item.request.status === "cancelled" ? (
                                "Request closed"
                              ) : item.match.screeningStatus === "Cleared" ? (
                                "Cleared to donate"
                              ) : item.match.screeningStatus ? (
                                `Screening ${item.match.screeningStatus.toLowerCase()}`
                              ) : (
                                item.match.responseStatus
                              )
                            ) : (
                              <>
                                <span className="donation-compatible-dot" />
                                Matched to your blood type
                              </>
                            )}
                          </span>
                          {tab === "past" && <button className="btn" type="button"
                            aria-label={`${canAcceptAgain(item) ? 'Accept again' : 'Unavailable'} at ${item.hospital?.name || item.request.hospitalName}`}
                            disabled={busy || !canAcceptAgain(item)} title={canAcceptAgain(item) ? "Review fresh guidelines and consent" : "View details for availability and eligibility"}
                            onClick={() => select(item, true)}>{canAcceptAgain(item) ? 'Accept again' : 'Unavailable'}</button>}
                          <button
                            className="btn"
                            type="button"
                            onClick={() => select(item)}
                          >
                            View details
                            <Icon name="arrow-right" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="donation-state donation-empty donor-browse-empty">
                    <span className="donor-empty-mark" aria-hidden="true">
                      <Icon
                        name={tab === "past" ? "clock" : "compass"}
                        size={28}
                      />
                    </span>
                    <h2>
                      {tab === "past"
                        ? hasFilters
                          ? "No responses match your filters."
                          : "No past responses yet."
                        : hasRefinements
                          ? "No requests match your filters."
                          : position && radius !== "all"
                            ? "No requests nearby right now"
                            : "No matched requests right now."}
                    </h2>
                    <p>
                      {tab === "past"
                        ? "Your earlier responses and completed donations will appear here."
                        : "New matches appear here automatically. Widen your view or check your alerts."}
                    </p>
                    <div className="donor-empty-actions">
                      {hasRefinements ? (
                        <button
                          className="btn"
                          data-primary
                          type="button"
                          onClick={clearFilters}
                        >
                          Clear filters
                        </button>
                      ) : tab === "available" &&
                        position &&
                        radius !== "all" &&
                        Number(radius) < 50 ? (
                        <button
                          className="btn"
                          data-primary
                          type="button"
                          onClick={() =>
                            setFilters((previous) => ({
                              ...previous,
                              radius: "50",
                            }))
                          }
                        >
                          Widen to 50 km
                          <Icon name="arrow-right" size={16} />
                        </button>
                      ) : tab === "past" ? (
                        <button
                          className="btn"
                          data-primary
                          type="button"
                          onClick={() => setTab("available")}
                        >
                          Explore requests
                          <Icon name="arrow-right" size={16} />
                        </button>
                      ) : (
                        <button
                          className="btn"
                          data-primary
                          type="button"
                          onClick={feed.retry}
                        >
                          <Icon name="refresh" size={16} />
                          Check again
                        </button>
                      )}
                      {/* TODO(design): no alert opt-in setting exists; preserve the existing inbox destination. */}
                      {tab === "available" && (
                        <Link className="btn" to="/donor/alerts">
                          View alerts
                        </Link>
                      )}
                    </div>
                    {tab === "available" && position && (
                      <small>
                        Widening to 50 km finds additional compatible requests near
                        your saved location. Automatic alerts stay within 25 km.
                      </small>
                    )}
                  </div>
                )}
              </section>
              <aside className="donation-map-aside">
                <DonorRequestMap
                  items={[...(active ? [active] : []), ...visible]}
                  position={position}
                  activeItem={active}
                  radiusKm={
                    position && radius !== "all" ? Number(radius) : null
                  }
                  onSelect={select}
                />
                <section className="donation-help-card">
                  <Icon name="shield" size={22} />
                  <h3>Your choice. Your pace.</h3>
                  <p>
                    Browse freely. Your contact details are shared with a
                    hospital only when you accept its request and give consent.
                  </p>
                  <Link to="/donor/privacy">
                    Manage my privacy
                    <Icon name="arrow-right" size={15} />
                  </Link>
                </section>
              </aside>
            </div>
          </>
        )}
        <DonorRequestDetails
          item={selected}
          startAcceptance={startAcceptance}
          profileReady={!missingProfileFields.length}
          position={position}
          activeCommitment={active}
          eligibility={selectedEligibility}
          busy={busy}
          error={error}
          onClose={close}
          onRespond={respond}
        />
        <dialog
          ref={profileDialog}
          className="donation-profile-dialog"
          aria-labelledby="donation-profile-dialog-title"
          onCancel={(event) => {
            event.preventDefault();
            setProfilePrompt(false);
          }}
        >
          <div className="donation-profile-dialog-icon">
            <Icon name="user" size={22} />
          </div>
          <p className="donation-eyebrow">One quick step first</p>
          <h2 id="donation-profile-dialog-title">Finish your donor profile</h2>
          <p>
            We need a few details to confirm a safe match before you accept this
            request.
          </p>
          <ul>
            {missingProfileFields.map((field) => (
              <li key={field}>{field[0].toUpperCase() + field.slice(1)}</li>
            ))}
          </ul>
          <p className="donation-profile-dialog-note">
            Phone number and GPS location are optional. Your city is enough.
          </p>
          <div className="donation-profile-dialog-actions">
            <button
              className="btn"
              type="button"
              onClick={() => setProfilePrompt(false)}
            >
              Maybe later
            </button>
            <Link
              className="btn"
              data-primary
              to="/home"
              onClick={() => setProfilePrompt(false)}
            >
              Complete profile <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </dialog>
        <SupportContact as="footer" />
      </main>
    </div>
  );
}
