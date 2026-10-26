import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/**
 * A function with a stable identity that always calls the latest `fn`, so memoized rows don't
 * re-render just because a parent handed down a fresh closure.
 */
export function useStableCallback<A extends unknown[], R>(
  fn: (...args: A) => R,
) {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}

/**
 * Follows the mouse across the window (resizing, dragging headers). The listeners go away on
 * mouseup, or if the grid unmounts mid-drag, so nothing leaks and `end` always runs.
 */
export function useWindowDrag() {
  const cancel = useRef<(() => void) | null>(null);
  useEffect(() => () => cancel.current?.(), []);
  return useCallback(
    ({
      move,
      end,
    }: {
      move: (e: MouseEvent) => void;
      /** `dropped` is false when the drag was cut short by unmounting. */
      end?: (dropped: boolean) => void;
    }) => {
      cancel.current?.();
      const stop = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        cancel.current = null;
      };
      const up = () => {
        stop();
        end?.(true);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      cancel.current = () => {
        stop();
        end?.(false);
      };
    },
    [],
  );
}
