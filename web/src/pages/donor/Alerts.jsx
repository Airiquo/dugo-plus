import { SupportContact } from "../../components/SupportContact";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { useDonorRequests } from "../../hooks/useDonorRequests";
import { DonorNav } from "../../layout/DonorNav";
import { sortRows, sortDate } from "../../utils/sortRows";
import { Icon } from "../../components";
import { listenDonorAlerts, markAlertsRead } from "../../services/alerts";
import {
  componentName,
  isActiveCommitment,
  isAvailableRequest,
} from "../../utils/donorRequests";
import { toDate } from "../../utils/eligibility";

function alertTime(value) {
  const date = toDate(value);
  if (!date) return "Just matched";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  return days === 0
    ? "Today"
    : days === 1
      ? "Yesterday"
      : date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}
/** Actionable donor inbox with request context, unread state, and request deep links. */
export default function Alerts() {
  const [order, setOrder] = useState("newest");
  const { user } = useAuth(),
    { theme } = useTheme(),
    navigate = useNavigate();
  const feed = useDonorRequests(user?.uid);
  const [recordFilters, setRecordFilters] = useState({
    search: "",
    from: "",
    to: "",
    readStatus: "all",
  });
  const [state, setState] = useState({ status: "loading", items: [] }),
    [attempt, setAttempt] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!user?.uid) return;
    setState({ status: "loading", items: [] });
    return listenDonorAlerts(
      user.uid,
      (items) => setState({ status: "ready", items }),
      () => setState((previous) => ({ ...previous, status: "error" })),
    );
  }, [user?.uid, attempt]);
  const unread = state.items.filter((item) => !item.readAt);
  const newest = sortRows(
    state.items,
    (row) => sortDate(row.createdAt || row.sentAt),
    "desc",
  );
  const visible = sortRows(
    newest,
    order === "unread"
      ? (row) => (row.readAt ? 1 : 0)
      : (row) => sortDate(row.createdAt || row.sentAt),
    order === "newest" ? "desc" : "asc",
  );
  const active = feed.items.find(isActiveCommitment);
  const readAll = async () => {
    setBusy(true);
    setError("");
    try {
      for (let i = 0; i < unread.length; i += 100)
        await markAlertsRead(unread.slice(i, i + 100).map((item) => item.id));
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };
  const open = async (alert, item) => {
    if (!item) return;
    if (!alert.readAt) markAlertsRead([alert.id]).catch(() => {});
    navigate(`/donor/requests?request=${encodeURIComponent(alert.requestId)}`);
  };
  return (
    <div className="pub donor-surface" data-theme={theme}>
      <DonorNav />
      <main
        id="top"
        className="donation-hub donation-inbox donor-main donor-browse donor-alert-browse"
      >
        <header className="donor-browse-header">
          <p className="donation-eyebrow">Every connection matters</p>
          <h1>Your alerts.</h1>
          <p>Your matches and donation updates, all in one place.</p>
        </header>
        <div className="donation-inbox-layout">
          <section
            className="donation-inbox-panel"
            aria-label="Donation updates"
          >
            <div className="donor-alert-toolbar">
              <label className="donor-filter-choice">
                <span className="care-sr-only">Sort alerts</span>
                <span className="app-select">
                  <select
                    aria-label="Sort alerts"
                    value={order}
                    onChange={(event) => setOrder(event.target.value)}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="unread">Unread first</option>
                  </select>
                </span>
              </label>
              <button
                className="donation-text-link"
                type="button"
                onClick={readAll}
                disabled={
                  busy ||
                  !unread.length ||
                  state.status !== "ready" ||
                  feed.status !== "ready"
                }
              >
                {busy ? "Marking as read…" : "Mark all as read"}
                <Icon name="check" size={16} />
              </button>
            </div>
            {error && (
              <p className="donation-error" role="alert">
                {error}
              </p>
            )}
            {(state.status === "loading" || feed.status === "loading") && (
              <div className="donation-state" role="status">
                <span className="donation-loading-mark" />
                <p>Gathering your updates…</p>
              </div>
            )}
            {(state.status === "error" || feed.status === "error") && (
              <div className="donation-state" role="alert">
                <Icon name="alert" size={28} />
                <h3>Your updates couldn’t be loaded.</h3>
                <p>Check your connection, then give it another try.</p>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setAttempt((value) => value + 1);
                    feed.retry();
                  }}
                >
                  Try again
                </button>
              </div>
            )}
            {state.status === "ready" &&
              feed.status === "ready" &&
              (visible.length ? (
                <div className="donation-alert-list">
                  {visible.map((alert) => {
                    const item = feed.items.find(
                      (item) => item.request.id === alert.requestId,
                    );
                    const planned = item && isActiveCommitment(item),
                      available = item && isAvailableRequest(item),
                      closed = item && !available && !planned;
                    return (
                      <article
                        className="donation-alert"
                        data-unread={!alert.readAt}
                        key={alert.id}
                      >
                        <span className="donation-alert-icon">
                          <Icon
                            name={
                              planned ? "check" : closed ? "file" : "droplet"
                            }
                            size={23}
                          />
                        </span>
                        <div className="donation-alert-content">
                          <div className="donation-alert-top">
                            <p className="donation-eyebrow">
                              {planned
                                ? "Your donation"
                                : closed
                                  ? "Request update"
                                  : "A new connection"}
                            </p>
                            <span>{alertTime(alert.sentAt)}</span>
                            {!alert.readAt && (
                              <span
                                className="donation-unread-dot"
                                aria-label="Unread"
                              />
                            )}
                          </div>
                          <h3>
                            {planned
                              ? "Your next step is a visit."
                              : closed
                                ? "An update on an earlier match."
                                : item
                                  ? `${item.hospital?.name || item.request.hospitalName} could use your help.`
                                  : "A hospital matched with you."}
                          </h3>
                          <p>
                            {item
                              ? `${item.request.bloodType} · ${componentName(item.request.component)} · ${item.request.quantity} ${item.request.quantity === 1 ? "unit" : "units"} requested`
                              : "This request is no longer available. You can explore your other matches."}
                          </p>
                          <div className="donation-alert-bottom">
                            <span>
                              {planned
                                ? "Contact the hospital to arrange your visit"
                                : closed
                                  ? item.donated
                                    ? "Donation completed"
                                    : item.match.responseStatus === "Declined"
                                      ? "You declined this request"
                                      : "This request has closed"
                                  : active
                                    ? "Browse now · one donation at a time"
                                    : "A match is an invitation. The choice is yours."}
                            </span>
                            {item && (
                              <button
                                className="btn"
                                type="button"
                                onClick={() => open(alert, item)}
                              >
                                {planned ? "View my donation" : "View request"}
                                <Icon name="arrow-right" />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="donation-state donation-empty donor-browse-empty">
                  <Icon name="bell" size={30} />
                  <h2>No alerts yet.</h2>
                  <p>
                    New matches and donation updates will appear here. You can
                    explore your requests while you wait.
                  </p>
                  <Link className="btn" to="/donor/requests">
                    Explore requests
                    <Icon name="arrow-right" />
                  </Link>
                </div>
              ))}
          </section>
          <aside className="donation-inbox-aside">
            <section className="donation-help-card">
              <Icon name="shield" size={26} />
              <h3>
                {active
                  ? "One donation. Your full attention."
                  : "You’re always in control."}
              </h3>
              <p>
                {active
                  ? `You have a donation planned at ${active.hospital?.name || active.request.hospitalName}. Your other matches will be here when you’re ready.`
                  : "A notification is an invitation, never an obligation. Review the request, ask questions, and decide what works for you."}
              </p>
              <Link
                to={
                  active
                    ? `/donor/requests?request=${active.request.id}`
                    : "/donor/requests"
                }
              >
                {active ? "View my donation" : "Find a request"}
                <Icon name="arrow-right" size={16} />
              </Link>
            </section>
            <div className="donation-quiet-note">
              <Icon name="bell" size={18} />
              <p>
                Important details stay here, so you can come back to them in
                your own time.
              </p>
            </div>
          </aside>
        </div>
        <SupportContact as="footer" />
      </main>
    </div>
  );
}
