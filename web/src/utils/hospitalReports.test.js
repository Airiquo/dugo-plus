import test from "node:test";
import assert from "node:assert/strict";
import {
  donationDay,
  dayStart,
  shiftDay,
  dateRangeError,
  monthRange,
  filterCollections,
  collectedUnits,
  stockBand,
  filterStock,
  dailyCollections,
  donationCalendar,
  collectionTrend,
} from "./hospitalReports.js";
import { filterRecords, filterDateError } from "./recordFilters.js";
import { lockDialogScroll } from "./dialogScrollLock.js";
import { tableCsv, tablePrintHtml } from "./tableExport.js";

const donation = (date, units = 1, extra = {}) => ({
  donationDate: new Date(date),
  units,
  bloodType: "O-",
  component: "rbc",
  ...extra,
});
test("PHT boundaries round-trip independently of the machine timezone", () => {
  assert.equal(donationDay("2026-11-02T15:59:59.999Z"), "2026-11-02");
  assert.equal(donationDay("2026-11-02T16:00:00Z"), "2026-11-03");
  assert.equal(
    dayStart("2026-11-03").toISOString(),
    "2026-11-02T16:00:00.000Z",
  );
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
  assert.equal(dayStart("2026-02-29"), null);
  assert.equal(shiftDay("2024-02-28", 1), "2024-02-29");
});
test("month and year scopes include leap days and cap the current year at today", () => {
  assert.deepEqual(monthRange(2024, "02", "2026-11-03"), {
    from: "2024-02-01",
    to: "2024-02-29",
  });
  assert.deepEqual(monthRange(2026, "all", "2026-11-03"), {
    from: "2026-01-01",
    to: "2026-11-03",
  });
  assert.deepEqual(monthRange(2025, "12", "2026-11-03"), {
    from: "2025-12-01",
    to: "2025-12-31",
  });
  assert.ok(dateRangeError("2026-11-04", "2026-11-03"));
  assert.ok(dateRangeError("2026-02-29", "2026-03-01"));
});
test("selecting a day includes its final PHT millisecond and excludes adjacent days", () => {
  const rows = [
    donation("2026-11-02T15:59:59.999Z", 10),
    donation("2026-11-02T16:00:00Z", 2),
    donation("2026-11-03T15:59:59.999Z", 3),
    donation("2026-11-03T16:00:00Z", 20),
  ];
  const filtered = filterCollections(rows, {
    from: "2026-11-03",
    to: "2026-11-03",
  });
  assert.equal(filtered.length, 2);
  assert.equal(collectedUnits(filtered), 5);
  assert.equal(
    filterCollections(rows, {
      from: "2026-11-03",
      to: "2026-11-03",
      bloodType: "A+",
    }).length,
    0,
  );
});
test("calendar counts donations separately from units, keeps zero days and handles leap years", () => {
  const rows = [
    donation("2024-02-29T01:00:00Z", 3),
    donation("2024-02-29T02:00:00Z", 2),
    donation("2025-01-01T00:00:00Z", 50),
  ];
  const cells = donationCalendar(2024, rows);
  assert.equal(cells.filter(Boolean).length, 366);
  assert.equal(cells.length % 7, 0);
  assert.deepEqual(
    cells.find((day) => day?.key === "2024-02-29"),
    { key: "2024-02-29", count: 2, units: 5 },
  );
  assert.equal(cells.find((day) => day?.key === "2024-03-01").count, 0);
  assert.equal(new Set(cells.filter(Boolean).map((day) => day.key)).size, 366);
  assert.equal(dailyCollections([donation("invalid")]).size, 0);
});
test("daily and weekly trends retain holes and include the final partial interval exactly once", () => {
  const rows = [
    donation("2026-11-01T00:00:00Z", 2),
    donation("2026-11-03T00:00:00Z", 3),
  ];
  const days = collectionTrend(rows, "2026-11-01", "2026-11-07");
  assert.deepEqual(
    days.map((day) => day.units),
    [2, 0, 3, 0, 0, 0, 0],
  );
  const weeks = collectionTrend(rows, "2026-10-05", "2026-11-03");
  assert.equal(weeks.length, 5);
  assert.equal(weeks.at(-1).to, "2026-11-03");
  assert.equal(
    weeks.reduce((sum, row) => sum + row.units, 0),
    5,
  );
});
test("monthly and yearly buckets cross calendar boundaries without losing or double-counting units", () => {
  const rows = [
    donation("2023-12-31T15:00:00Z", 2),
    donation("2023-12-31T16:00:00Z", 4),
    donation("2024-02-29T00:00:00Z", 5),
    donation("2024-04-01T00:00:00Z", 7),
  ];
  const months = collectionTrend(rows, "2023-12-15", "2024-04-01");
  assert.deepEqual(
    months.map((month) => month.units),
    [2, 4, 5, 0, 7],
  );
  assert.equal(months[2].to, "2024-02-29");
  const years = collectionTrend(rows, "2022-01-01", "2026-11-03");
  assert.deepEqual(
    years.map((year) => year.units),
    [0, 2, 16, 0, 0],
  );
});
test("quantity colors have explicit boundaries and stock filters never combine components", () => {
  assert.deepEqual([0, 1, 4, 5, 100, -1, "0"].map(stockBand), [
    "empty",
    "one-to-four",
    "one-to-four",
    "five-plus",
    "five-plus",
    "empty",
    "empty",
  ]);
  const rows = [
    { bloodType: "O-", unitsAvailable: 0, component: "rbc" },
    { bloodType: "A+", unitsAvailable: 4, component: "rbc" },
    { bloodType: "B+", unitsAvailable: 5, component: "rbc" },
  ];
  assert.deepEqual(
    filterStock(rows, "stocked").map((row) => row.bloodType),
    ["A+", "B+"],
  );
  assert.deepEqual(
    filterStock(rows, "one-to-four").map((row) => row.bloodType),
    ["A+"],
  );
  assert.equal(filterStock(rows, "all", "O-")[0].unitsAvailable, 0);
});
test("applied record filters combine search, exact fields and inclusive PHT dates across all loaded pages", () => {
  const rows = Array.from({ length: 137 }, (_, id) => ({
    id: String(id),
    name: id === 136 ? "José Cruz" : "Other",
    createdAt: new Date("2026-11-03T15:59:59.999Z"),
    status: "Accepted",
    component: "plasma",
  }));
  const filters = {
    search: "jose",
    status: "Accepted",
    component: "plasma",
    from: "2026-11-03",
    to: "2026-11-03",
  };
  const visible = filterRecords(rows, filters, { search: (row) => row.name });
  assert.deepEqual(
    visible.map((row) => row.id),
    ["136"],
  );
  assert.equal(
    filterRecords(
      rows,
      { ...filters, status: "Declined" },
      { search: (row) => row.name },
    ).length,
    0,
  );
  assert.equal(
    filterRecords(rows, { from: "2026-11-04", to: "2026-11-03" }).length,
    0,
  );
  assert.equal(filterDateError({ from: "2026-11-03", to: "" }), "");
  assert.equal(
    filterRecords([{ createdAt: null }], { from: "2026-11-03" }).length,
    0,
  );
});
test("filtered CSV and embedded print documents contain the same complete record set and no extra toolbar", () => {
  const rows = Array.from({ length: 137 }, (_, id) => ({
    id: String(id),
    createdAt: new Date("2026-11-03"),
    kind: id % 2 ? "keep" : "other",
  }));
  const filtered = filterRecords(rows, { kind: "keep" });
  const columns = [{ label: "Reference", value: (row) => row.id }];
  const csv = tableCsv(columns, filtered);
  const html = tablePrintHtml(
    "Donations",
    "Filtered results",
    columns,
    filtered,
    new Date("2026-11-03"),
    { embedded: true },
  );
  assert.equal(filtered.length, 68);
  assert.equal(csv.trim().split("\r\n").length, 69);
  assert.equal((html.match(/<tr>/g) || []).length, 69);
  assert.ok(!html.includes('<div class="controls">'));
  assert.ok(html.includes("68 records"));
});
test("nested report dialogs keep body scrolling locked regardless of cleanup order", () => {
  const body = { style: { overflow: "auto" } };
  const closeParent = lockDialogScroll(body),
    closePreview = lockDialogScroll(body);
  assert.equal(body.style.overflow, "hidden");
  closeParent();
  assert.equal(body.style.overflow, "hidden");
  closeParent();
  assert.equal(body.style.overflow, "hidden");
  closePreview();
  assert.equal(body.style.overflow, "auto");
  const again = lockDialogScroll(body);
  again();
  assert.equal(body.style.overflow, "auto");
});
