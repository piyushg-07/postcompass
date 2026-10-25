import { cn } from "@repo/ui";
import type { ReactNode } from "react";

export function Block({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 px-5 py-5">{children}</section>
  );
}

export function Horizontal({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_2fr] items-center gap-4">
      <span className="text-sm text-fg-muted">{label}</span>
      {children}
    </div>
  );
}

export function Note({
  icon,
  warning = false,
  children,
}: {
  icon: ReactNode;
  warning?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-control border p-3 text-xs text-fg-muted [&>svg]:mt-0.5 [&>svg]:size-3.5 [&>svg]:shrink-0",
        warning
          ? "border-warning/30 bg-warning/5 [&>svg]:text-warning"
          : "border-border bg-surface [&>svg]:text-fg-subtle",
      )}
    >
      {icon}
      <span className="flex flex-col gap-0.5">{children}</span>
    </div>
  );
}
