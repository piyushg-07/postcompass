import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

/* ── Card ─────────────────────────────────────────────────────────────── */

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-card border border-border bg-surface", className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-4 pb-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("text-sm font-semibold text-fg", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-xs text-fg-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2 border-t border-border px-4 py-3", className)} {...props} />;
}

/* ── Badge & StatusDot ────────────────────────────────────────────────── */

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "border-border-strong bg-surface-hover text-fg-muted",
        accent: "border-accent/30 bg-accent-muted text-accent",
        danger: "border-danger/30 bg-danger/10 text-danger",
        warning: "border-warning/30 bg-warning/10 text-warning",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export type Status = "running" | "stopped" | "starting" | "error";

const statusStyles: Record<Status, string> = {
  running: "bg-success shadow-[0_0_0_3px] shadow-success/15",
  stopped: "bg-fg-subtle",
  starting: "bg-warning animate-pulse",
  error: "bg-danger",
};

const statusLabels: Record<Status, string> = {
  running: "Running",
  stopped: "Stopped",
  starting: "Starting",
  error: "Error",
};

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      role="img"
      aria-label={statusLabels[status]}
      className={cn("inline-block size-2 shrink-0 rounded-full", statusStyles[status], className)}
    />
  );
}

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-fg-muted">
      <StatusDot status={status} />
      {label ?? statusLabels[status]}
    </span>
  );
}

/* ── Small primitives ─────────────────────────────────────────────────── */

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border-strong bg-surface-hover px-1 font-mono text-[10px] text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Separator({ className, vertical = false }: { className?: string; vertical?: boolean }) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      className={cn("shrink-0 bg-border", vertical ? "h-full w-px" : "h-px w-full", className)}
    />
  );
}

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-control bg-surface-hover", className)} {...props} />;
}

/* ── Progress ─────────────────────────────────────────────────────────── */

/** Pass `value` (0–100) for determinate progress, omit it for indeterminate. */
export function Progress({ value, className, label }: { value?: number; className?: string; label?: string }) {
  const clamped = value === undefined ? undefined : Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-surface-hover", className)}
    >
      {clamped === undefined ? (
        <div className="absolute inset-y-0 w-1/3 rounded-full bg-accent animate-indeterminate" />
      ) : (
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  );
}

/* ── EmptyState ───────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      {icon && (
        <div className="flex size-11 items-center justify-center rounded-card border border-border bg-surface text-fg-muted [&_svg]:size-5">
          {icon}
        </div>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {description && <p className="text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
