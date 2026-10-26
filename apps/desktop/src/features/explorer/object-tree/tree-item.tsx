import { cn, ContextMenu, ContextMenuTrigger } from "@repo/ui";
import type { CSSProperties, ReactNode } from "react";

/** Sidebar row height (h-7 plus the 1px gap), for the virtual list. */
export const ROW_HEIGHT = 29;
/** Above this many tables the list only renders the visible rows. */
export const VIRTUAL_FROM = 200;

export function Item({
  icon,
  label,
  meta,
  active,
  plain,
  onClick,
  menu,
  highlight,
  actions,
  style,
}: {
  icon: ReactNode;
  label: string;
  meta?: string;
  active?: boolean;
  /** Regular text instead of monospace, for page names rather than object names. */
  plain?: boolean;
  onClick?: () => void;
  /** Right-click menu. */
  menu?: ReactNode;
  /** Search text to mark in the label. */
  highlight?: string;
  /** Shown in place of `meta` while the row is hovered (a ⋯ menu). */
  actions?: ReactNode;
  /** Position in a virtual list. */
  style?: CSSProperties;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "mx-2 flex h-7 w-[calc(100%-16px)] cursor-pointer items-center gap-2 rounded-control px-2 text-left text-xs text-fg-muted transition-colors hover:bg-surface-hover/70 hover:text-fg disabled:cursor-default disabled:hover:bg-transparent [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-subtle",
        active &&
          "relative bg-surface-hover text-fg before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent [&_svg]:text-accent",
      )}
    >
      {icon}
      <span className={cn("min-w-0 flex-1 truncate", !plain && "font-mono")}>
        <Highlighted text={label} query={highlight} />
      </span>
      {meta && (
        <span
          className={cn(
            "shrink-0 font-mono text-[10px] text-fg-subtle",
            actions && "group-focus-within/row:invisible group-hover/row:invisible",
          )}
        >
          {meta}
        </span>
      )}
    </button>
  );
  return (
    <li className="group/row relative" style={style}>
      {menu ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>{button}</ContextMenuTrigger>
          {menu}
        </ContextMenu>
      ) : (
        button
      )}
      {actions && (
        <div className="absolute top-1/2 right-3 flex -translate-y-1/2 opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 has-[[data-state=open]]:opacity-100">
          {actions}
        </div>
      )}
    </li>
  );
}

/** `text` with the first case-insensitive match of `query` marked. */
function Highlighted({ text, query }: { text: string; query?: string }) {
  const at = query ? text.toLowerCase().indexOf(query) : -1;
  if (!query || at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-accent/20 text-accent">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}
