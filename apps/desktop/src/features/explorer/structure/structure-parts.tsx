import { Button, cn, Tooltip } from "@repo/ui";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";

const FK_ACTIONS: Record<string, { label: string; hint: string }> = {
  CASCADE: { label: "Cascade", hint: "Rows here change or go with it" },
  "SET NULL": { label: "Set null", hint: "The column here is set to NULL" },
  "SET DEFAULT": {
    label: "Set default",
    hint: "The column here goes back to its default",
  },
  RESTRICT: { label: "Restrict", hint: "Blocked while rows here point to it" },
  "NO ACTION": {
    label: "No action",
    hint: "Blocked while rows here point to it",
  },
};

export function Section({
  title,
  count,
  hint,
  action,
  children,
}: {
  title: string;
  count: number;
  hint: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="flex items-center gap-2 text-sm font-medium text-fg">
            {title}
            <span className="rounded-full bg-surface-hover px-1.5 font-mono text-[10px] font-normal text-fg-muted">
              {count}
            </span>
          </h3>
          <p className="text-xs text-fg-subtle">{hint}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AddButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button size="sm" variant="ghost" iconLeft={<Plus />} onClick={onClick}>
      {children}
    </Button>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full text-xs">
        <thead className="bg-surface text-left text-fg-subtle">
          <tr className="border-b border-border">
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <tr className="group border-b border-border/60 last:border-b-0 hover:bg-surface-hover/40">
      {children}
    </tr>
  );
}

export function Cell({
  children,
  mono,
  className,
}: {
  children: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn("px-3 py-2 text-fg-muted", mono && "font-mono", className)}
    >
      {children}
    </td>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      {children}
    </div>
  );
}

export function Empty({
  action,
  children,
}: {
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-dashed border-border px-3 py-2 text-xs text-fg-subtle">
      <p className="py-1">{children}</p>
      {action}
    </div>
  );
}

export function None() {
  return <span className="text-fg-subtle/60">—</span>;
}

export function TableLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-fg hover:text-info hover:underline"
    >
      {children}
    </button>
  );
}

export function FkAction({ action }: { action: string }) {
  const known = FK_ACTIONS[action.toUpperCase()];
  if (!known) return <>{action}</>;
  return (
    <Tooltip content={known.hint}>
      <span className="cursor-default">{known.label}</span>
    </Tooltip>
  );
}
