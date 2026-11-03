import { donationDay, dayStart } from "./hospitalReports.js";

export const EMPTY_FILTERS = { search: "", from: "", to: "" };
const text = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function filterDateError(filters) {
  if (
    (filters.from && !dayStart(filters.from)) ||
    (filters.to && !dayStart(filters.to))
  )
    return "Choose valid dates.";
  if (filters.from && filters.to && filters.from > filters.to)
    return "The end date must be on or after the start date.";
  return "";
}
/** Apply exact field choices, PHT-inclusive dates and an accent-insensitive text search. */
export function filterRecords(
  rows,
  filters = EMPTY_FILTERS,
  {
    date = (row) => row.createdAt,
    search = (row) =>
      Object.values(row)
        .filter((value) => typeof value === "string")
        .join(" "),
    fields = {},
  } = {},
) {
  if (filterDateError(filters)) return [];
  const query = text(filters.search).trim();
  return rows.filter((row) => {
    const key = donationDay(date(row));
    if (
      (filters.from && (!key || key < filters.from)) ||
      (filters.to && (!key || key > filters.to))
    )
      return false;
    if (query && !text(search(row)).includes(query)) return false;
    return Object.entries(filters).every(
      ([key, value]) =>
        ["search", "from", "to"].includes(key) ||
        !value ||
        value === "all" ||
        String((fields[key] || ((item) => item[key]))(row) ?? "") === value,
    );
  });
}
