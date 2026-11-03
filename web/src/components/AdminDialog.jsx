import { lockDialogScroll } from "../utils/dialogScrollLock";
import { useEffect, useRef } from "react";
import { cx } from "../utils/cx";
import { Btn } from "./Btn";

/** Centered native dialog. `busy` prevents dismissal; `eyebrow` labels the workspace. `fallbackFocusRef` handles removed/disabled triggers. */
export function AdminDialog({
  name,
  open,
  busy = false,
  fallbackFocusRef,
  onClose,
  title,
  eyebrow = "Dugo+ administration",
  children,
  className,
  ...rest
}) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open) return;
    const trigger = document.activeElement;
    if (!dialog.open) dialog.showModal();
    const unlockScroll = lockDialogScroll();
    return () => {
      dialog.close();
      unlockScroll();
      requestAnimationFrame(() => {
        const target =
          trigger?.isConnected && !trigger.disabled
            ? trigger
            : fallbackFocusRef?.current;
        target?.focus();
      });
    };
  }, [open, fallbackFocusRef]);
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
          <p className="admin-care-eyebrow">{eyebrow}</p>
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
