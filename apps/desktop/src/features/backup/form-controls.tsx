import { Checkbox, cn } from "@repo/ui";
import type { ReactNode } from "react";

/** A labelled group of options in the form. */
export function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      {children}
      {hint && <p className="text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}

/** Two or three side-by-side choices, like a toggle group. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div
      className="grid gap-1 rounded-control border border-border-strong bg-bg p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 cursor-pointer truncate rounded px-2 text-sm transition-colors",
            value === o.value
              ? "bg-surface-hover text-fg shadow-sm"
              : "text-fg-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A checkbox with a title and a muted line under it. */
export function CheckOption({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <Checkbox
        className="mt-0.5"
        checked={checked}
        onCheckedChange={(c) => onChange(c === true)}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-fg">{title}</span>
        <span className="text-xs text-fg-subtle">{description}</span>
      </span>
    </label>
  );
}
