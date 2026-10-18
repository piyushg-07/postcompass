import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium select-none transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent-hover",
        secondary: "border border-border-strong bg-surface text-fg hover:bg-surface-hover",
        ghost: "text-fg-muted hover:bg-surface-hover hover:text-fg",
        danger: "bg-danger/90 text-white hover:bg-danger",
        link: "h-auto px-0 text-accent underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3 text-sm",
        lg: "h-10 px-4 text-sm",
        icon: "size-8",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a link) with button styles. */
  asChild?: boolean;
  /** Shows a spinner, disables the button and keeps its width. */
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  className,
  variant,
  size,
  asChild,
  loading = false,
  iconLeft,
  iconRight,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <span className={cn("inline-flex items-center gap-1.5", loading && "invisible")}>
        {iconLeft}
        {children}
        {iconRight}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </button>
  );
}
