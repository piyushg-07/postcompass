import type { ReactNode } from "react";

/** The table tab's bottom bar. `children` go on the left. */
export function TableFooter({
  children,
  right,
}: {
  children?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-t border-border bg-surface px-2">
      {children}
      <div className="ml-auto flex items-center gap-1">{right}</div>
    </div>
  );
}
