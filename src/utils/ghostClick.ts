/**
 * Ghost-click prevention utility.
 *
 * On touch devices, browsers synthesise a `click` event ~300 ms after a
 * `touchend`. When the element that received the touch is removed from the DOM
 * before the synthetic click arrives (e.g. a close button that dismisses a
 * card), the click lands on whatever is now at those coordinates — a "ghost
 * click". We track the last touchend time globally so any handler can opt out.
 */

let _lastTouchEndAt = 0;

if (typeof window !== 'undefined') {
  document.addEventListener(
    'touchend',
    () => { _lastTouchEndAt = Date.now(); },
    { passive: true }
  );
}

/** Returns true if a touch ended within the last `thresholdMs` milliseconds. */
export const wasRecentTouch = (thresholdMs = 380): boolean =>
  Date.now() - _lastTouchEndAt < thresholdMs;
