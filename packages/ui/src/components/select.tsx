import { Check, ChevronsUpDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface SelectOption {
  value: string;
  label: ReactNode;
  /** Muted text on the right of the option, e.g. "recommended" or a size. */
  hint?: ReactNode;
  disabled?: boolean;
}

/**
 * The app's dropdown picker: a styled trigger and menu, never the browser's native list.
 * Works inside `Field` (pass its control props through).
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Choose…",
  size = "md",
  mono = false,
  disabled,
  className,
  side,
  align = "start",
  defaultOpen,
  onOpenChange,
  ...controlProps
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** `sm` for toolbars and dense rows, `md` for forms. */
  size?: "sm" | "md";
  /** Monospace labels, for names like columns and databases. */
  mono?: boolean;
  disabled?: boolean;
  className?: string;
  side?: "top" | "bottom";
  align?: "start" | "end";
  /** Open the list as soon as it mounts (e.g. a grid cell editor). */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  return (
    <SelectPrimitive.Root
      // Stays controlled: "" means nothing selected and shows the placeholder
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      <SelectPrimitive.Trigger
        {...controlProps}
        className={cn(
          "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-control border border-border-strong bg-bg text-left text-fg transition-colors outline-none hover:border-fg-subtle focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger data-[placeholder]:text-fg-subtle data-[state=open]:border-fg-subtle",
          size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-sm",
          mono && "font-mono",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronsUpDown className="size-3.5 shrink-0 text-fg-subtle" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          side={side}
          align={align}
          sideOffset={4}
          className="z-50 max-h-[min(320px,var(--radix-select-content-available-height))] min-w-[max(var(--radix-select-trigger-width),8rem)] overflow-hidden rounded-control border border-border-strong bg-surface-raised shadow-xl shadow-black/50 animate-fade-in"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className={cn(
                  "relative flex h-7 cursor-pointer items-center gap-2 rounded pr-2 pl-7 text-xs text-fg-muted outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-hover data-[highlighted]:text-fg data-[state=checked]:text-fg",
                  mono && "font-mono",
                )}
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2 flex items-center">
                  <Check className="size-3.5 text-accent" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                {o.hint && <span className="ml-auto pl-3 font-sans text-[10px] text-fg-subtle">{o.hint}</span>}
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
