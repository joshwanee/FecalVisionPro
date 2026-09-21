import { useEffect, useRef } from 'react';

/**
 * A confirmation step for destructive actions (HCI: error prevention).
 * Uses the browser's built-in <dialog>, which traps keyboard focus, closes on
 * Escape and returns focus to the button that opened it, all for free.
 * The safe choice (Cancel) is first in the tab order and the safest to hit.
 */
export default function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel }) {
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
        <button type="button" className="button button--danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
