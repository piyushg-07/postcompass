import { GripVertical } from "lucide-react";
import { type PointerEvent, type ReactNode, useRef } from "react";
import { useUiPrefs } from "../../app/ui-prefs";

export const PANEL_MIN = 200;
export const PANEL_MAX = 480;
export const PANEL_DEFAULT = 256;

/**
 * The explorer's left panel, like Supabase's table list: drag the grip on the right edge to resize
 * (double-click it to reset). The width is remembered.
 */
export function SidePanel({ children }: { children: ReactNode }) {
  const width = useUiPrefs((s) => s.explorerWidth);
  const { setExplorerWidth } = useUiPrefs.getState();
  const panel = useRef<HTMLDivElement>(null);

  const startResize = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    // Resize the element directly while dragging; save the width once at the end
    let next = startWidth;
    const move = (ev: globalThis.PointerEvent) => {
      next = Math.min(
        PANEL_MAX,
        Math.max(PANEL_MIN, startWidth + ev.clientX - startX),
      );
      if (panel.current) panel.current.style.width = `${next}px`;
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      setExplorerWidth(next);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  };

  return (
    <div ref={panel} className="relative flex shrink-0" style={{ width }}>
      <div className="min-w-0 flex-1">{children}</div>
      {/* Drag handle on the right edge, with a grip in the middle like Supabase's */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize table list"
        onPointerDown={startResize}
        onDoubleClick={() => setExplorerWidth(PANEL_DEFAULT)}
        className="group absolute top-0 -right-1.5 z-10 flex h-full w-3 cursor-col-resize items-center justify-center"
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors group-hover:bg-accent group-active:bg-accent" />
        <span className="relative flex h-6 w-3 items-center justify-center rounded-sm border border-border-strong bg-surface text-fg-subtle transition-colors group-hover:border-accent group-hover:text-accent [&_svg]:size-3">
          <GripVertical />
        </span>
      </div>
    </div>
  );
}
