import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";
import { buttonVariants } from "./button";
import { Tooltip } from "./tooltip";

export interface IconButtonProps extends Omit<ComponentProps<"button">, "children"> {
  /** Required: used as the accessible name and the tooltip. */
  label: string;
  icon: ReactNode;
  size?: "sm" | "md";
}

export function IconButton({ label, icon, size = "md", className, type = "button", ...props }: IconButtonProps) {
  return (
    <Tooltip content={label}>
      <button
        type={type}
        aria-label={label}
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), size === "sm" && "size-7", className)}
        {...props}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
