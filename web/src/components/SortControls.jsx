import { cx } from "../utils/cx";

function optionLabel(field, direction) {
  if (/date|received|collected|requested|occurred|matched/i.test(field.label))
    return direction === "desc" ? "Newest first" : "Oldest first";
  if (/distance/i.test(field.label))
    return direction === "asc" ? "Nearest first" : "Farthest first";
  if (/units|quantity/i.test(field.label))
    return `${field.label} (${direction === "asc" ? "low to high" : "high to low"})`;
  return `${field.label} (${direction === "asc" ? "A–Z" : "Z–A"})`;
}

/** One dropdown includes both the sort field and direction. Null key preserves the screen's default order. */
export function SortControls({
  name,
  sort,
  onChange,
  fields,
  defaultLabel = "Recommended order",
  className,
  ...rest
}) {
  return (
    <div className={cx("record-sort-controls", className)} {...rest}>
      <label className="care-sr-only" htmlFor={`${name}-sort-key`}>Sort by</label>
      <select
        id={`${name}-sort-key`}
        value={sort.key ? `${sort.key}:${sort.direction}` : ""}
        onChange={(event) => {
          const [key, direction] = event.target.value.split(":");
          onChange({ key: key || null, direction: direction || "asc" });
        }}
      >
        <option value="">{defaultLabel}</option>
        {fields.flatMap((field) =>
          ["asc", "desc"].map((direction) => (
            <option
              key={`${field.key}:${direction}`}
              value={`${field.key}:${direction}`}
            >
              {optionLabel(field, direction)}
            </option>
          )),
        )}
      </select>
    </div>
  );
}
