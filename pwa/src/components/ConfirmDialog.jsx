import { useEffect, useRef } from 'react';

/**
 * A confirmation step before a consequential action (HCI: error prevention) -
 * destructive ones (delete, clear), but also disruptive-but-safe ones like
 * reloading the app to switch models. Uses the browser's built-in <dialog>,
 * which traps keyboard focus, closes on Escape and returns focus to the
 * button that opened it, all for free. The safe choice (Cancel) is first in
 * the tab order and the safest to hit.
 *
 * tone: 'danger' (default, red button - cannot be undone) or 'primary'
 * (green button - safe, just disruptive, like a reload).
 */
export default function ConfirmDialog({ open, title, children, confirmLabel, tone = 'danger', onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" onCancel={onCancel} aria-labelledby="dialog-title">
      <h2 id="dialog-title">{title}</h2>
      <div className="dialog__body">{children}</div>
      <div className="dialog__actions">
        <button type="button" className="button button--secondary" onClick={onCancel} autoFocus>
          Cancel
        </button>
        <button type="button" className={`button button--${tone}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
