import { ChevronDown, Eye, EyeOff, RefreshCw } from "lucide-react";
import { type ComponentProps, type ReactNode, useId, useState } from "react";
import { cn } from "../lib/cn";

const inputClasses =
  "h-8 w-full min-w-0 rounded-control border border-border-strong bg-bg px-2.5 text-sm text-fg placeholder:text-fg-subtle transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-danger/25";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClasses, className)} {...props} />;
}

export interface PasswordInputProps extends Omit<ComponentProps<"input">, "type"> {
  /** When set, shows a "generate" button. */
  onGenerate?: () => void;
}

export function PasswordInput({ className, onGenerate, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        spellCheck={false}
        className={cn(inputClasses, "font-mono", onGenerate ? "pr-16" : "pr-9", className)}
        {...props}
      />
      <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            aria-label="Generate password"
            className="cursor-pointer rounded p-1 text-fg-subtle hover:text-fg"
          >
            <RefreshCw className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="cursor-pointer rounded p-1 text-fg-subtle hover:text-fg"
        >
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(inputClasses, "cursor-pointer appearance-none pr-8", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-fg-subtle" />
    </div>
  );
}

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/** Label + control + hint/error. Wires `id`, `aria-describedby` and `aria-invalid` automatically. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (props: FieldControlProps) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium text-fg-muted">
        {label}
      </label>
      {children({
        id,
        "aria-describedby": message ? messageId : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {message && (
        <p id={messageId} className={cn("text-xs", error ? "text-danger" : "text-fg-subtle")}>
          {message}
        </p>
      )}
    </div>
  );
}
