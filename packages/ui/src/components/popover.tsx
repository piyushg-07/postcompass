import { Popover as PopoverPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;
/** Positions the popover against an element other than its trigger (e.g. a grid cell). */
export const PopoverAnchor = PopoverPrimitive.Anchor;

/** Floating panel anchored to its trigger (filter and sort editors, small forms). */
export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  children,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-card border border-border-strong bg-surface-raised shadow-2xl shadow-black/60 outline-none animate-fade-in",
          className,
        )}
        {...props}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}
