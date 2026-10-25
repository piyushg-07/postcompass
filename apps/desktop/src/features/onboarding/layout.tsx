import { Button } from "@repo/ui";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import postgresLogo from "../../assets/providers/postgresql.svg";

export function StepLayout({
  title,
  description,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  nextLoading,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextLoading?: boolean;
  /** Replaces the Continue button on the right of the footer. */
  actions?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-12">
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-[15px] leading-relaxed text-fg-muted">{description}</p>}
      </div>
      <div className="flex flex-col gap-11">{children}</div>
      {(onBack || onNext || actions) && (
        <div className="flex items-center justify-between border-t border-border pt-8">
          {onBack ? (
            <Button variant="ghost" iconLeft={<ArrowLeft />} onClick={onBack}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {actions ? (
            <div className="flex items-center gap-3">{actions}</div>
          ) : (
            onNext && (
              <Button variant="primary" iconRight={<ArrowRight />} onClick={onNext} loading={nextLoading}>
                {nextLabel}
              </Button>
            )
          )}
        </div>
      )}
    </section>
  );
}

export function Group({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-sm font-medium text-fg">
        {label}
        {hint && <span className="text-xs font-normal text-fg-subtle">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function ServerCard({ title, detail, aside }: { title: string; detail: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-5 rounded-card border border-border bg-surface p-5">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-bg">
        <img src={postgresLogo} alt="" width={32} height={32} draggable={false} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-base font-medium text-fg">{title}</span>
        <span className="truncate text-sm text-fg-muted">{detail}</span>
      </span>
      {aside}
    </div>
  );
}

export function RecapTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
      <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-bg text-accent [&_svg]:size-4">
        {icon}
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-xs text-fg-subtle">{label}</span>
        <span className="truncate text-sm font-medium text-fg">{value}</span>
      </span>
    </div>
  );
}
