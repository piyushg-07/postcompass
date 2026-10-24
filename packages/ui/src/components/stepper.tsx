import { Check } from "lucide-react";
import { cn } from "../lib/cn";

/** Horizontal step indicator, e.g. for onboarding. `current` is 0-based. */
export function Stepper({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol className={cn("flex items-center gap-2", className)} aria-label={`Step ${current + 1} of ${steps.length}`}>
      {steps.map((label, index) => {
        const state = index < current ? "done" : index === current ? "current" : "upcoming";
        return (
          <li key={label} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors",
                state === "done" && "border-accent bg-accent text-accent-fg",
                state === "current" && "border-accent text-accent",
                state === "upcoming" && "border-border-strong text-fg-subtle",
              )}
            >
              {state === "done" ? <Check className="size-3" strokeWidth={3} /> : index + 1}
            </span>
            <span className={cn("text-xs", state === "upcoming" ? "text-fg-subtle" : "text-fg-muted")}>{label}</span>
            {index < steps.length - 1 && (
              <span className={cn("h-px w-6", index < current ? "bg-accent/50" : "bg-border-strong")} aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export type TaskStepState = "pending" | "active" | "done" | "error" | "skipped";

/** Vertical checklist of steps with live state, e.g. installer progress. */
export function TaskSteps({
  steps,
  className,
}: {
  steps: { id: string; label: string; detail?: string; state: TaskStepState }[];
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col gap-2.5", className)}>
      {steps.map((step) => (
        <li key={step.id} className="flex items-start gap-3">
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
            {step.state === "done" && <Check className="size-4 text-accent" strokeWidth={2.5} />}
            {step.state === "active" && (
              <span className="size-3.5 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
            )}
            {step.state === "error" && <span className="size-2 rounded-full bg-danger" />}
            {(step.state === "pending" || step.state === "skipped") && (
              <span className="size-2 rounded-full border border-border-strong" />
            )}
          </span>
          <div className="flex min-w-0 flex-col">
            <span
              className={cn(
                "text-sm",
                step.state === "pending" || step.state === "skipped" ? "text-fg-subtle" : "text-fg",
                step.state === "error" && "text-danger",
              )}
            >
              {step.label}
            </span>
            {step.detail && <span className="font-mono text-xs text-fg-muted">{step.detail}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
