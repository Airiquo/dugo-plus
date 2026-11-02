import { useEffect, useRef } from "react";
import { cx } from "../utils/cx";
import { Btn } from "./Btn";

/** Centered native dialog. `busy` prevents dismissal during a mutation. */
export function AdminDialog({
  name,
  open,
  busy = false,
  onClose,
  title,
  children,
  className,
  ...rest
}) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open) return;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      id={`${name}-modal`}
      className={cx("admin-care-dialog", className)}
      aria-labelledby={`${name}-title`}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      {...rest}
    >
      <header className="admin-care-dialog-head">
        <div>
          <p className="admin-care-eyebrow">Dugo+ administration</p>
          <h2 id={`${name}-title`}>{title}</h2>
        </div>
        <Btn
          aria-label="Close dialog"
          icon="x"
          disabled={busy}
          onClick={onClose}
        />
      </header>
      <div className="admin-care-dialog-body">{open && children}</div>
    </dialog>
  );
}
