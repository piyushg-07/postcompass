import { cn } from "@repo/ui";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { type ReactNode, useEffect, useState } from "react";
import { Logo } from "./logo";

/** macOS keeps its own traffic lights (tauri.macos.conf.json); everywhere else we draw the controls. */
const IS_MAC = navigator.userAgent.includes("Mac");

/**
 * The window frame: our own title bar on top (the native one is turned off in tauri.conf.json)
 * and the page below it.
 */
export function WindowFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * Dragging the bar moves the window and double-clicking it maximizes. Tauri only drags when the
 * pressed element itself has `data-tauri-drag-region`, so buttons inside the bar still click.
 */
function TitleBar() {
  return (
    <header
      data-tauri-drag-region
      className="relative flex h-9 shrink-0 items-center border-b border-border bg-surface select-none"
    >
      {/* macOS centers the title (the traffic lights sit on the left); Windows and Linux keep it left */}
      <div
        data-tauri-drag-region
        className={cn(
          "flex min-w-0 items-center gap-2",
          IS_MAC ? "absolute inset-0 justify-center" : "pl-3",
        )}
      >
        <Logo size={18} />
        <Wordmark />
      </div>

      <div data-tauri-drag-region className="h-full flex-1" />
      {!IS_MAC && <WindowControls />}
    </header>
  );
}

function Wordmark() {
  return (
    <span
      data-tauri-drag-region
      className="flex items-baseline gap-px text-[13px] whitespace-nowrap text-fg"
    >
      <span
        data-tauri-drag-region
        className="font-brand font-bold tracking-tighter"
      >
        Post
      </span>
      <span
        data-tauri-drag-region
        className="bg-linear-to-r from-accent to-[color-mix(in_srgb,var(--color-accent),white_45%)] bg-clip-text pr-0.5 font-serif text-[15px] leading-none text-transparent italic"
      >
        Compass
      </span>
    </span>
  );
}

/** Minimize, maximize / restore and close, drawn like the Windows ones at the size of our bar. */
function WindowControls() {
  const maximized = useMaximized();
  const appWindow = getCurrentWindow();

  return (
    <div className="flex h-full shrink-0">
      <ControlButton label="Minimize" onClick={() => void appWindow.minimize()}>
        <path d="M0 5.5h10" />
      </ControlButton>
      <ControlButton
        label={maximized ? "Restore" : "Maximize"}
        onClick={() => void appWindow.toggleMaximize()}
      >
        {maximized ? (
          <>
            <rect x="0.5" y="2.5" width="7" height="7" rx="1" />
            <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" />
          </>
        ) : (
          <rect x="0.5" y="0.5" width="9" height="9" rx="1" />
        )}
      </ControlButton>
      <ControlButton
        label="Close"
        danger
        onClick={() => void appWindow.close()}
      >
        <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
      </ControlButton>
    </div>
  );
}

function ControlButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-full w-11 cursor-default items-center justify-center text-fg-muted transition-colors focus-visible:outline-none",
        danger
          ? "hover:bg-[#c42b1c] hover:text-white active:bg-[#b22a1c]"
          : "hover:bg-surface-hover hover:text-fg active:bg-border",
      )}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  );
}

/** Follows the window's maximized state, including Win+Up, snapping and double-clicking the bar. */
function useMaximized() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const appWindow = getCurrentWindow();
    let cancelled = false;
    const sync = () =>
      void appWindow.isMaximized().then((m) => {
        if (!cancelled) setMaximized(m);
      });
    sync();
    const unlisten = appWindow.onResized(sync);
    return () => {
      cancelled = true;
      void unlisten.then((stop) => stop());
    };
  }, []);
  return maximized;
}
