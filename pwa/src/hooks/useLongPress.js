import { useEffect, useRef } from 'react';

const HOLD_MS = 500; // press and hold this long to trigger
const HOLD_SLOP = 10; // px a finger may drift before it counts as a scroll, not a hold

/**
 * Press-and-hold on an element. Returns pointer handlers, plus
 * `consumeClick()`, which says whether the click that ends a hold should be
 * ignored (the hold already did something) - call it at the start of the
 * element's own onClick and skip the normal tap action when it returns true.
 *
 * handlers() takes an optional id, passed through to onHold - useful when the
 * same hook drives several elements (e.g. one per list row).
 */
export function useLongPress(onHold) {
  const timer = useRef(null);
  const start = useRef(null);
  const held = useRef(false);

  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };

  const handlers = (id) => ({
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      held.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        held.current = true;
        navigator.vibrate?.(30);
        onHold(id);
      }, HOLD_MS);
    },
    onPointerMove: (e) => {
      if (!timer.current || !start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > HOLD_SLOP) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    // Phones open a context menu on a long press; the hold replaces it.
    onContextMenu: (e) => e.preventDefault(),
  });

  const consumeClick = () => {
    const wasHeld = held.current;
    held.current = false;
    return wasHeld;
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  return { handlers, consumeClick };
}
