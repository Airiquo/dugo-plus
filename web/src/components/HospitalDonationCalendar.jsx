import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../utils/cx";
import {
  dayStart,
  donationCalendar,
  donationDay,
} from "../utils/hospitalReports";
import { Btn } from "./Btn";

/** Daily donation counts with roving arrow-key focus and a precise date-picker alternative. */
export function HospitalDonationCalendar({
  year,
  month = "all",
  rows,
  selectedDay,
  onSelectDay,
  className,
  ...rest
}) {
  const cells = useMemo(() => donationCalendar(year, rows), [year, rows]);
  const today = donationDay(new Date()),
    firstDay = `${year}-01-01`;
  const [focusDay, setFocusDay] = useState(selectedDay || firstDay),
    [jumpDay, setJumpDay] = useState(selectedDay || firstDay),
    [error, setError] = useState("");
  const buttons = useRef(new Map());
  useEffect(() => {
    setFocusDay(selectedDay || firstDay);
    setJumpDay(selectedDay || firstDay);
    setError("");
  }, [selectedDay, firstDay]);
  const highest = Math.max(1, ...cells.map((day) => day?.count || 0));
  function navigate(event, day) {
    const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[
      event.key
    ];
    if (!step) return;
    event.preventDefault();
    let next = cells.findIndex((item) => item?.key === day.key) + step;
    while (
      next >= 0 &&
      next < cells.length &&
      (!cells[next] || cells[next].key > today)
    )
      next += Math.sign(step);
    if (cells[next]) buttons.current.get(cells[next].key)?.focus();
  }
  return (
    <div
      className={cx("hw-calendar", className)}
      style={{ "--calendar-weeks": cells.length / 7 }}
      {...rest}
    >
      <div
        className="hw-calendar-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${year} donation calendar; scroll horizontally for later months`}
      >
        <div className="hw-calendar-months" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <span
              key={index}
              style={{
                left: `${36 + Math.floor(cells.findIndex((day) => day?.key === `${year}-${String(index + 1).padStart(2, "0")}-01`) / 7) * 18}px`,
              }}
            >
              {new Date(Date.UTC(Number(year), index, 1)).toLocaleDateString(
                "en-PH",
                { month: "short", timeZone: "UTC" },
              )}
            </span>
          ))}
        </div>
        <div className="hw-calendar-body">
          <div className="hw-calendar-weekdays" aria-hidden="true">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div
            className="hw-calendar-grid"
            role="group"
            aria-label="Daily donations. Arrow keys move by day or week."
          >
            {cells.map((day, index) =>
              day ? (
                <button
                  type="button"
                  key={day.key}
                  className="hw-calendar-day"
                  ref={(element) => {
                    if (element) buttons.current.set(day.key, element);
                    else buttons.current.delete(day.key);
                  }}
                  tabIndex={focusDay === day.key ? 0 : -1}
                  onFocus={() => setFocusDay(day.key)}
                  onKeyDown={(event) => navigate(event, day)}
                  data-level={
                    day.count
                      ? Math.min(4, Math.ceil((day.count / highest) * 4))
                      : 0
                  }
                  data-outside={
                    month !== "all" &&
                    day.key.slice(5, 7) !== String(month).padStart(2, "0")
                  }
                  aria-pressed={selectedDay === day.key}
                  disabled={day.key > today}
                  aria-label={`${day.key}: ${day.count} donation${day.count === 1 ? "" : "s"}, ${day.units} units. Filter this day.`}
                  title={`${day.key} · ${day.count} donations · ${day.units} units`}
                  onClick={() => onSelectDay(day.key)}
                />
              ) : (
                <span key={`padding-${index}`} />
              ),
            )}
          </div>
        </div>
      </div>
      <div className="hw-calendar-footer">
        <span>
          Click a day to filter. Use arrow keys to move through the calendar.
        </span>
        <span className="hw-calendar-legend">
          Fewer
          {[0, 1, 2, 3, 4].map((level) => (
            <i key={level} data-level={level} />
          ))}
          More donations
        </span>
      </div>
      <form
        className="hw-calendar-jump"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !dayStart(jumpDay) ||
            Number(jumpDay.slice(0, 4)) !== Number(year) ||
            jumpDay > today
          ) {
            setError("Choose a recorded or past day in the selected year.");
            return;
          }
          setError("");
          onSelectDay(jumpDay);
        }}
      >
        <label>
          Jump to a day
          <input
            type="date"
            aria-label="Donation activity day"
            value={jumpDay}
            min={firstDay}
            max={`${year}-12-31` < today ? `${year}-12-31` : today}
            onChange={(event) => {
              setJumpDay(event.target.value);
              setError("");
            }}
          />
        </label>
        <Btn type="submit">View this day</Btn>
        <span>Philippine time · zero-donation days can be selected too.</span>
        {error && (
          <p className="record-filter-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
