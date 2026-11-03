import { useEffect, useRef, useState } from "react";
import { AdminDialog } from "./AdminDialog";
import { Btn } from "./Btn";
import { cx } from "../utils/cx";

/** Print report overlay. The sandboxed document has no scripts; Back returns to the same table. */
export function TablePrintPreview({
  name,
  open,
  title,
  html,
  status,
  error,
  onClose,
  className,
  ...rest
}) {
  const frame = useRef(null);
  const [printError, setPrintError] = useState("");
  const [loadedHtml, setLoadedHtml] = useState("");
  const ready = Boolean(html) && loadedHtml === html;
  useEffect(() => {
    setPrintError("");
  }, [html, open]);
  return (
    <AdminDialog
      name={`${name}-print-preview`}
      open={open}
      title={title}
      eyebrow="Dugo+ / Report preview"
      onClose={onClose}
      className={cx("table-print-dialog", className)}
      {...rest}
    >
      <div className="table-print-toolbar">
        <Btn onClick={onClose}>Back to table</Btn>
        <span role="status">
          {error ||
            status ||
            "Review your report, then print or save it as a PDF."}
        </span>
        <Btn
          variant="primary"
          disabled={!ready || Boolean(error)}
          onClick={() => {
            try {
              setPrintError("");
              frame.current?.contentWindow?.focus();
              frame.current?.contentWindow?.print();
            } catch {
              setPrintError(
                "Printing could not open. Try your browser’s print command while the report is focused, or return to the table and try again.",
              );
            }
          }}
        >
          Print / Save PDF
        </Btn>
      </div>
      {printError && (
        <p role="alert" className="table-export-error">
          {printError}
        </p>
      )}
      {error ? (
        <p role="alert" className="table-export-error">
          {error}
        </p>
      ) : html ? (
        <iframe
          key={html}
          ref={frame}
          title={`${title} print document`}
          className="table-print-frame"
          sandbox="allow-same-origin allow-modals"
          srcDoc={html}
          onLoad={() => setLoadedHtml(html)}
        />
      ) : (
        <p className="table-print-loading" role="status">
          {status || "Preparing all matching records…"}
        </p>
      )}
    </AdminDialog>
  );
}
