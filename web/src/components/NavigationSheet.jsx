import { useEffect, useRef } from "react";
import { cx } from "../utils/cx";
import { Icon } from "./Icon";
import { WorkspaceNav } from "./WorkspaceNav";

/** Native, focus-trapped workspace picker; `name` derives modal and heading IDs. */
export function NavigationSheet({
  name,
  open,
  onClose,
  items,
  title = "Your workspaces",
  className,
  ...rest
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      id={`${name}-modal`}
      className={cx("navigation-sheet", className)}
      aria-labelledby={`${name}-heading`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      {...rest}
    >
      <header>
        <div>
          <p className="admin-care-eyebrow">Dugo+ workspace</p>
          <h2 id={`${name}-heading`}>{title}</h2>
        </div>
        <button
          type="button"
          className="btn"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <Icon name="x" />
        </button>
      </header>
      <WorkspaceNav
        items={items}
        onNavigate={onClose}
        aria-label="More workspaces"
      />
    </dialog>
  );
}
