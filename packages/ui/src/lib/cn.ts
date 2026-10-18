import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our custom tokens so `cn("text-fg", "text-fg-muted")` resolves correctly.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "bg",
        "surface",
        "surface-raised",
        "surface-hover",
        "border",
        "border-strong",
        "fg",
        "fg-muted",
        "fg-subtle",
        "accent",
        "accent-hover",
        "accent-muted",
        "accent-fg",
        "danger",
        "warning",
        "info",
      ],
      radius: ["control", "card"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
