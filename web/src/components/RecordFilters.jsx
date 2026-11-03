import { useEffect, useState } from "react";
import { cx } from "../utils/cx";
import { filterDateError } from "../utils/recordFilters";
import { Btn } from "./Btn";

/** Applied record filters. `fields` is {key,label,options}[]; date bounds are inclusive PHT dates. */
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
  ...rest
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  const key = JSON.stringify(value);
  const active = Object.entries(value).filter(
    ([, value]) => value && value !== "all",
  );
  const hasDraftChanges = JSON.stringify(draft) !== key;
  useEffect(() => {
    setDraft(JSON.parse(key));
    setError("");
  }, [key]);
  const set = (key, value) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setError("");
  };
  const reset = () => {
    const empty = {
      search: "",
      from: "",
      to: "",
      ...Object.fromEntries(fields.map((field) => [field.key, "all"])),
    };
    setDraft(empty);
    setError("");
    onChange(empty);
    onReset?.();
  };
  return (
    <form
      className={cx("record-filters", className)}
      aria-label={`${name} filters`}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const found = filterDateError(draft);
        setError(found);
        if (!found) onChange(draft);
      }}
      {...rest}
    >
      <fieldset disabled={disabled}>
        <legend className="care-sr-only">Filter {name}</legend>
        {search && (
          <label className="record-search">
            <span>Search</span>
            <input
              type="search"
              aria-label={`Search ${name}`}
              placeholder={searchPlaceholder}
              value={draft.search || ""}
              onChange={(event) => set("search", event.target.value)}
            />
          </label>
        )}
        {fields.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <select
              aria-label={`Filter ${name} by ${field.label.toLowerCase()}`}
              value={draft[field.key] || "all"}
              onChange={(event) => set(field.key, event.target.value)}
            >
              <option value="all">All {field.label.toLowerCase()}</option>
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
          <>
            <label>
              <span>From</span>
              <input
                type="date"
                aria-label={`${name} from date`}
                value={draft.from || ""}
                onChange={(event) => set("from", event.target.value)}
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                aria-label={`${name} to date`}
                min={draft.from || undefined}
                value={draft.to || ""}
                onChange={(event) => set("to", event.target.value)}
              />
            </label>
          </>
        )}
        <div className="record-filter-actions">
          <Btn type="submit" variant="primary">
            Apply filters
          </Btn>
          <Btn onClick={reset}>Reset</Btn>
        </div>
      </fieldset>
      <div className="record-filter-summary" role="status">
        <span>
          {active.length
            ? `${active.length} filters applied`
            : "No additional filters applied"}
        </span>
        {hasDraftChanges && <strong>Changes ready to apply</strong>}
      </div>
      {error && (
        <p className="record-filter-error" role="alert">
          {error}
        </p>
      )}
      {dates && (
        <p className="record-filter-help">
          Dates include the whole day in Philippine time.
        </p>
      )}
    </form>
  );
}
