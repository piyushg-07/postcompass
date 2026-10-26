import { cn, Kbd, Tooltip } from "@repo/ui";
import type { ReactNode } from "react";

export function NavButton({
  active,
  icon,
  label,
  collapsed,
  shortcut,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  /** Keys shown on the right when expanded, e.g. ["Ctrl", "K"]. */
  shortcut?: string[];
  onClick: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-control text-sm transition-colors [&_svg]:size-4",
        collapsed ? "justify-center" : "px-2.5",
        active
          ? "bg-surface-hover text-fg"
          : "text-fg-muted hover:bg-surface-hover/60 hover:text-fg",
      )}
    >
      {active && (
        <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent" />
      )}
      <span className={cn("shrink-0", active && "text-accent")}>{icon}</span>
      {collapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="flex-1 truncate text-left whitespace-nowrap">
          {label}
        </span>
      )}
      {!collapsed && shortcut && (
        <span className="flex shrink-0 gap-0.5">
          {shortcut.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </span>
      )}
    </button>
  );
  // Collapsed: just the icon, with the label as a tooltip
  return collapsed ? (
    <Tooltip side="right" content={label}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}
