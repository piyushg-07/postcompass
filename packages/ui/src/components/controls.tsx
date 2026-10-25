import { Check } from "lucide-react";
import { Checkbox as CheckboxPrimitive, RadioGroup, Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-surface-hover p-0.5 transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-3.5 rounded-full bg-fg shadow transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-accent-fg" />
    </SwitchPrimitive.Root>
  );
}

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "flex size-4 shrink-0 cursor-pointer items-center justify-center rounded border border-border-strong bg-bg transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3 text-accent-fg" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function RadioCardGroup({ className, ...props }: ComponentProps<typeof RadioGroup.Root>) {
  return <RadioGroup.Root className={cn("grid gap-3", className)} {...props} />;
}

/** A large selectable card, used for onboarding choices. */
export function RadioCard({
  value,
  title,
  description,
  icon,
  className,
}: {
  value: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <RadioGroup.Item
      value={value}
      className={cn(
        "group flex w-full cursor-pointer items-start gap-3.5 rounded-card border border-border bg-surface px-4 py-3.5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover data-[state=checked]:border-accent/60 data-[state=checked]:bg-accent-muted",
        className,
      )}
    >
      {icon && (
        <span className="mt-0.5 text-fg-muted group-data-[state=checked]:text-accent [&_svg]:size-4">{icon}</span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-medium text-fg">{title}</span>
        {description && <span className="text-xs leading-relaxed text-fg-muted">{description}</span>}
      </span>
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong group-data-[state=checked]:border-accent">
        <RadioGroup.Indicator className="size-2 rounded-full bg-accent" />
      </span>
    </RadioGroup.Item>
  );
}
