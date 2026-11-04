import { useEffect, useId, useRef, useState } from "react";
import { cx } from "../utils/cx";
import { filterDateError } from "../utils/recordFilters";
import { Icon } from "./Icon";
import { ControlPopover } from "./ControlPopover";

/** Screen-specific instant filters. Dates use inclusive Philippine days; invalid edits keep the last valid range. */
export function RecordFilters({
  name,
  value,
  onChange,
  fields = [],
  dates = true,
  search = true,
  onReset,
  disabled = false,
  searchPlaceholder = "Search these records…",
  className,
  children,
  ...rest
}) {
  const id = useId();
  const [range, setRange] = useState({
    from: value.from || "",
    to: value.to || "",
  });
  const disclosure = useRef(null);
  useEffect(
    () => setRange({ from: value.from || "", to: value.to || "" }),
    [value.from, value.to],
  );
  const error = filterDateError(range);
  const active = Object.entries(value).some(
    ([, next]) => next && next !== "all",
  );
  const set = (key, next) => onChange({ ...value, [key]: next });
  const changeDate = (key, next) => {
    if (range[key] === next) return;
    const draft = { ...range, [key]: next };
    setRange(draft);
    if (!filterDateError(draft)) onChange({ ...value, ...draft });
  };
  const reset = () => {
    setRange({ from: "", to: "" });
    disclosure.current?.querySelector("[popover]")?.hidePopover();
    onChange({
      search: "",
      from: "",
      to: "",
      ...Object.fromEntries(fields.map((field) => [field.key, "all"])),
    });
    onReset?.();
  };
  return (
    <div
      className={cx("screen-filter-bar", className)}
      aria-label={`${name} filters`}
      {...rest}
    >
      <fieldset disabled={disabled}>
        <legend className="care-sr-only">Filter {name}</legend>
        {search && (
          <label className="screen-filter-search">
            <Icon name="search" size={17} />
            <span className="care-sr-only">Search {name}</span>
            <input
              type="search"
              aria-label={`Search ${name}`}
              placeholder={searchPlaceholder}
              value={value.search || ""}
              onChange={(event) => set("search", event.target.value)}
            />
          </label>
        )}
        {fields.map((field) => (
          <label className="screen-filter-choice" key={field.key}>
            <span>{field.label}</span>
            <select
              aria-label={`Filter ${name} by ${field.label.toLowerCase()}`}
              value={value[field.key] || "all"}
              onChange={(event) => set(field.key, event.target.value)}
            >
              <option value="all">{field.allLabel || "All"}</option>
              {field.options.map((option) => (
                <option
                  key={typeof option === "string" ? option : option.value}
                  value={typeof option === "string" ? option : option.value}
                >
                  {typeof option === "string" ? option : option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {dates && (
          <ControlPopover ref={disclosure} name={`${id}-dates`} label="Date range" data-active={Boolean(value.from || value.to)} disabled={disabled}>
            <div className="screen-filter-date-panel">
              <div>
                <label>
                  <span>From</span>
                  <input
                    type="date"
                    aria-label={`${name} from date`}
                    aria-describedby={`${id}-date-help`}
                    aria-invalid={Boolean(error)}
                    value={range.from}
                    onInput={(event) => changeDate("from", event.target.value)}
                    onChange={(event) => changeDate("from", event.target.value)}
                  />
                </label>
                <label>
                  <span>To</span>
                  <input
                    type="date"
                    aria-label={`${name} to date`}
                    aria-describedby={`${id}-date-help`}
                    aria-invalid={Boolean(error)}
                    min={range.from || undefined}
                    value={range.to}
                    onInput={(event) => changeDate("to", event.target.value)}
                    onChange={(event) => changeDate("to", event.target.value)}
                  />
                </label>
              </div>
              <p id={`${id}-date-help`}>
                Includes the full day in Philippine time. Valid dates apply
                immediately.
              </p>
              {error && (
                <p className="record-filter-error" role="alert">
                  {error} Results keep the last valid range.
                </p>
              )}
            </div>
          </ControlPopover>
        )}
        {children}
        {active && (
          <button type="button" className="screen-filter-clear" onClick={reset}>
            Clear filters
          </button>
        )}
      </fieldset>
    </div>
  );
}
