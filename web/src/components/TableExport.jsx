import { useEffect, useRef, useState } from "react";
import { cx } from "../utils/cx";
import { tableCsv, tablePrintHtml } from "../utils/tableExport";
import { Btn } from "./Btn";
import { ControlPopover } from "./ControlPopover";
import { TablePrintPreview } from "./TablePrintPreview";

/** Exports every matching row in current table order. `getRows` receives "filtered"; `filterSummary` describes the current view. */
export function TableExport({
  name,
  title,
  columns,
  getRows,
  disabled = false,
  filterSummary = "",
  className,
  children,
  ...rest
}) {
  const scope = "filtered";
  const menu = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState({ open: false, html: "" });
  const alive = useRef(true),
    generation = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, []);
  function closePreview() {
    generation.current++;
    setPreview({ open: false, html: "" });
    setBusy(false);
    setMessage("");
    setError("");
    requestAnimationFrame(() => menu.current?.querySelector("button")?.focus());
  }
  async function run(format) {
    if (busy || disabled) return;
    menu.current?.querySelector("[popover]")?.hidePopover();
    const version = ++generation.current;
    const current = () => alive.current && generation.current === version;
    setError("");
    setMessage("Preparing all matching records…");
    setBusy(true);
    if (format === "pdf") setPreview({ open: true, html: "" });
    try {
      const rows = await getRows(scope, (count) => {
        if (!current()) throw new Error("Export cancelled.");
        setMessage(`Preparing ${count} records…`);
      });
      if (!current()) return;
      if (!Array.isArray(rows))
        throw new Error("The export could not be prepared.");
      if (format === "csv") {
        const url = URL.createObjectURL(
          new Blob([tableCsv(columns, rows)], {
            type: "text/csv;charset=utf-8",
          }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `${name}-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else
        setPreview({
          open: true,
          html: tablePrintHtml(
            title,
            scope === "filtered"
              ? `Current table${filterSummary ? " · " + filterSummary : ""}`
              : "All table data",
            columns,
            rows,
            new Date(),
            { embedded: true },
          ),
        });
      setMessage(
        `${rows.length} records ${format === "csv" ? "exported to CSV" : "ready to print or save as PDF"}.`,
      );
    } catch (caught) {
      if (current()) {
        setError(caught?.message || "Export failed. Try again.");
        setMessage("");
      }
    } finally {
      if (current()) setBusy(false);
    }
  }
  return (
    <div
      className={cx("table-export", className)}
      aria-label={`${title} exports`}
      data-export-name={name}
      {...rest}
    >
      <ControlPopover ref={menu} name={`${name}-export`} label="Export" triggerLabel={`Export ${title}`} icon={null} disabled={disabled || busy} showDone={false} className="table-export-menu">
        <div className="table-export-formats" role="group" aria-label={`${title} export formats`}>
          {children || <p>All matching records · current filters</p>}
          <Btn disabled={disabled || busy} onClick={() => run("csv")}>Print CSV</Btn>
          <Btn disabled={disabled || busy} onClick={() => run("pdf")}>Print PDF</Btn>
        </div>
      </ControlPopover>
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="table-export-error" role="alert">
          {error}
        </p>
      )}
      <TablePrintPreview
        name={name}
        title={title}
        open={preview.open}
        html={preview.html}
        status={message}
        error={error}
        onClose={closePreview}
      />
    </div>
  );
}
