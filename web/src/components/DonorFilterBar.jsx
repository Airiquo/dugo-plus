import { useEffect, useRef, useState } from "react";
import { cx } from "../utils/cx";
import { filterDateError } from "../utils/recordFilters";
import { Icon } from "./Icon";

/** Instant donor filters. Date edits apply once valid; `primary` and `advanced` hold {key,label,options,allLabel?} choices. */
export function DonorFilterBar({
  name,
  value,
  onChange,
  primary = [],
  advanced = [],
  order,
  onOrderChange,
  sortOptions,
  placeholder,
  sortLabel = "Sort results",
  dateLabel = "Date range",
  className,
  children,
  ...rest
}) {
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState({
    from: value.from || "",
    to: value.to || "",
  });
  const dialog = useRef(null);
  useEffect(
    () => setDates({ from: value.from || "", to: value.to || "" }),
    [value],
  );
  useEffect(() => {
    if (!open) return;
    const node = dialog.current;
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.showModal();
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);
  const dateError = filterDateError(dates);
  const set = (key, next) => onChange({ ...value, [key]: next });
  const setDate = (key, next) => {
    if (dates[key] === next) return;
    const range = { ...dates, [key]: next };
    setDates(range);
    if (!filterDateError(range)) onChange({ ...value, ...range });
  };
  const hasAdvanced =
    advanced.some((field) => value[field.key] && value[field.key] !== "all") ||
    value.from ||
    value.to;
  const choice = (field, more = false) => (
    <label
      key={field.key}
      className={cx(
        "donor-filter-choice",
        more && "donor-filter-advanced-choice",
      )}
    >
      <span className={more ? undefined : "care-sr-only"}>{field.label}</span>
      <span className="app-select">
        <select
          aria-label={field.label}
          value={value[field.key] || "all"}
          disabled={field.disabled}
          onChange={(event) => set(field.key, event.target.value)}
        >
          {field.allLabel && <option value="all">{field.allLabel}</option>}
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
  return (
    <div className={cx("donor-filter-bar", className)} {...rest}>
      <div className="donor-filter-main">
        <label className="donor-filter-search">
          <Icon name="search" size={18} />
          <span className="care-sr-only">{placeholder}</span>
          <input
            type="search"
            placeholder={placeholder}
            value={value.search || ""}
            onChange={(event) => set("search", event.target.value)}
          />
        </label>
        <div className="donor-filter-primary">
          {primary.map((field) => choice(field))}
        </div>
        <div className="donor-filter-secondary">
          <label className="donor-filter-choice donor-filter-sort">
            <span className="care-sr-only">{sortLabel}</span>
            <span className="app-select">
              <select
                aria-label={sortLabel}
                value={order}
                onChange={(event) => onOrderChange(event.target.value)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <button
            type="button"
            className="btn donor-more-filters"
            data-active={Boolean(hasAdvanced)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={`${name}-drawer`}
            onClick={() => setOpen(true)}
          >
            <Icon name="settings" size={16} />
            <span>More filters</span>
            {hasAdvanced && (
              <span
                className="donor-filter-indicator"
                aria-label="Additional filters active"
              />
            )}
          </button>
        </div>
        {children}
      </div>
      <dialog
        ref={dialog}
        id={`${name}-drawer`}
        className="donor-filter-drawer"
        aria-labelledby={`${name}-filter-title`}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            setOpen(false);
        }}
      >
        <header>
          <div>
            <p className="donation-eyebrow">Refine your view</p>
            <h2 id={`${name}-filter-title`}>More filters</h2>
          </div>
          <button
            type="button"
            className="btn donation-icon-button"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
          >
            <Icon name="x" />
          </button>
        </header>
        <div className="donor-filter-drawer-body">
          <p>Results update as you make changes.</p>
          {advanced.map((field) => choice(field, true))}
          <fieldset className="donor-filter-dates">
            <legend>{dateLabel}</legend>
            <div>
              <label>
                <span>From</span>
                <input
                  type="date"
                  aria-label={`${name} from date`}
                  aria-describedby={`${name}-date-help`}
                  aria-invalid={Boolean(dateError)}
                  value={dates.from}
                  onInput={(event) => setDate("from", event.target.value)}
                  onChange={(event) => setDate("from", event.target.value)}
                />
              </label>
              <label>
                <span>To</span>
                <input
                  type="date"
                  aria-label={`${name} to date`}
                  aria-describedby={`${name}-date-help`}
                  aria-invalid={Boolean(dateError)}
                  min={dates.from || undefined}
                  value={dates.to}
                  onInput={(event) => setDate("to", event.target.value)}
                  onChange={(event) => setDate("to", event.target.value)}
                />
              </label>
            </div>
            <p id={`${name}-date-help`}>
              Includes the full day in Philippine time.
            </p>
            {dateError && (
              <p className="donation-error" role="alert">
                {dateError} Results keep the last valid date range.
              </p>
            )}
          </fieldset>
        </div>
        <footer>
          <button className="btn" type="button" onClick={() => setOpen(false)}>
            View results
            <Icon name="arrow-right" size={16} />
          </button>
        </footer>
      </dialog>
    </div>
  );
}
