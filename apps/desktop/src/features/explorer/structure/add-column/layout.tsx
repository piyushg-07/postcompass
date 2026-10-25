import { Checkbox, Switch, Tooltip } from "@repo/ui";
import type { ReactNode } from "react";

/** Supabase's section layout: the title on the left third, fields on the right. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[1fr_2fr] gap-6 px-5 py-6">
      <h3 className="text-sm text-fg">{title}</h3>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  );
}

export function Labeled({
  label,
  optional,
  description,
  children,
}: {
  label: string;
  optional?: boolean;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-xs text-fg-muted">
        {label}
        {optional && <span className="text-fg-subtle">Optional</span>}
      </span>
      {children}
      {description && (
        <span className="text-xs text-fg-subtle">{description}</span>
      )}
    </div>
  );
}

export function CheckRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <Checkbox
        className="mt-0.5"
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-fg">{label}</span>
        <span className="text-xs text-fg-subtle">{description}</span>
      </span>
    </label>
  );
}

export function SwitchRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  /** Why it can't be changed. */
  disabled?: string;
  onChange: (v: boolean) => void;
}) {
  const control = (
    <span>
      <Switch
        className="mt-0.5"
        checked={checked}
        disabled={disabled !== undefined}
        onCheckedChange={onChange}
      />
    </span>
  );
  return (
    <label className="flex cursor-pointer items-start gap-3">
      {disabled ? <Tooltip content={disabled}>{control}</Tooltip> : control}
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-fg">{label}</span>
        <span className="text-xs text-fg-subtle">{description}</span>
      </span>
    </label>
  );
}
