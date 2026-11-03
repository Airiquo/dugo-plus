import { toDate } from "./eligibility.js";

const DAY = 86400000;
const PHT = 8 * 3600000;
const safeUnits = (value) =>
  Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const validKey = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar keys and inclusive date ranges use Philippine time. */
export function donationDay(value) {
  const date = toDate(value);
  return date && Number.isFinite(date.getTime())
    ? new Date(date.getTime() + PHT).toISOString().slice(0, 10)
    : "";
}
export function dayStart(key) {
  if (!validKey.test(key || "")) return null;
  const date = new Date(`${key}T00:00:00+08:00`);
  return Number.isFinite(date.getTime()) && donationDay(date) === key
    ? date
    : null;
}
export function shiftDay(key, days) {
  const start = dayStart(key);
  return start ? donationDay(new Date(start.getTime() + days * DAY)) : "";
}
export function dateRangeError(from, to) {
  if (!dayStart(from) || !dayStart(to))
    return "Choose a valid start and end date.";
  if (from > to) return "The end date must be on or after the start date.";
  return "";
}
export function monthRange(
  year,
  month = "all",
  today = donationDay(new Date()),
) {
  const start = `${year}-${month === "all" ? "01" : String(month).padStart(2, "0")}-01`;
  const next =
    month === "all"
      ? `${Number(year) + 1}-01-01`
      : month === "12" || month === 12
        ? `${Number(year) + 1}-01-01`
        : `${year}-${String(Number(month) + 1).padStart(2, "0")}-01`;
  return {
    from: start,
    to:
      shiftDay(next, -1) > today && start <= today ? today : shiftDay(next, -1),
  };
}
export function filterCollections(
  rows,
  { from, to, bloodType = "all", component = "all" },
) {
  return rows.filter((row) => {
    const key = donationDay(row.donationDate);
    return (
      key &&
      (!from || key >= from) &&
      (!to || key <= to) &&
      (bloodType === "all" || row.bloodType === bloodType) &&
      (component === "all" || (row.component || "unclassified") === component)
    );
  });
}
export const collectedUnits = (rows) =>
  rows.reduce((sum, row) => sum + safeUnits(row.units), 0);
export const stockBand = (units) =>
  safeUnits(units) === 0
    ? "empty"
    : safeUnits(units) < 5
      ? "one-to-four"
      : "five-plus";
export const STOCK_BANDS = [
  { value: "empty", label: "0 units", tone: "urgent" },
  { value: "one-to-four", label: "1–4 units", tone: "attention" },
  { value: "five-plus", label: "5+ units", tone: "success" },
];
export function filterStock(rows, band = "all", bloodType = "all") {
  return rows.filter(
    (row) =>
      (bloodType === "all" || row.bloodType === bloodType) &&
      (band === "all" ||
        (band === "stocked"
          ? row.unitsAvailable > 0
          : stockBand(row.unitsAvailable) === band)),
  );
}

/** Donation counts by PHT day; quantity and visit count are separate measures. */
export function dailyCollections(rows) {
  const days = new Map();
  for (const row of rows) {
    const key = donationDay(row.donationDate);
    if (!key) continue;
    const day = days.get(key) || { key, count: 0, units: 0 };
    day.count++;
    day.units += safeUnits(row.units);
    days.set(key, day);
  }
  return days;
}

/** Complete calendar cells with explicit zero days and leading weekday padding. */
export function donationCalendar(year, rows) {
  const days = dailyCollections(rows);
  const start = `${year}-01-01`,
    end = `${year}-12-31`;
  const padding = new Date(`${start}T12:00:00Z`).getUTCDay();
  const cells = Array.from({ length: padding }, () => null);
  for (let key = start; key && key <= end; key = shiftDay(key, 1))
    cells.push(days.get(key) || { key, count: 0, units: 0 });
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** Zero-filled day/week/month/year buckets for a selected inclusive range. */
export function collectionTrend(rows, from, to) {
  if (dateRangeError(from, to)) return [];
  const length = Math.round((dayStart(to) - dayStart(from)) / DAY) + 1;
  const step =
    length <= 14
      ? "day"
      : length <= 100
        ? "week"
        : length <= 740
          ? "month"
          : "year";
  const days = dailyCollections(rows);
  const buckets = [];
  let key = from;
  while (key && key <= to) {
    let next;
    if (step === "day" || step === "week")
      next = shiftDay(key, step === "day" ? 1 : 7);
    else next = `${Number(key.slice(0, 4)) + 1}-01-01`;
    // Month boundaries are constructed in calendar space to retain PHT midnight.
    if (step === "month") {
      const year = Number(key.slice(0, 4)),
        month = Number(key.slice(5, 7));
      next =
        month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    }
    const end = shiftDay(next, -1) < to ? shiftDay(next, -1) : to;
    let count = 0,
      units = 0;
    for (let day = key; day && day <= end; day = shiftDay(day, 1)) {
      count += days.get(day)?.count || 0;
      units += days.get(day)?.units || 0;
    }
    const label =
      step === "month"
        ? new Date(`${key}T12:00:00Z`).toLocaleDateString("en-PH", {
            month: "short",
            year: "2-digit",
            timeZone: "UTC",
          })
        : step === "year"
          ? key.slice(0, 4)
          : new Date(`${key}T12:00:00Z`).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            });
    buckets.push({ key, from: key, to: end, label, count, units });
    key = next;
  }
  return buckets;
}
