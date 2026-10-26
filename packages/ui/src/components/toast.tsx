import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import { type ReactNode, useSyncExternalStore } from "react";
import { cn } from "../lib/cn";
import { Spinner } from "./spinner";

type ToastVariant = "success" | "error" | "info" | "warning" | "loading";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  description?: ReactNode;
  action?: ToastAction;
  /** Milliseconds. Errors and loading toasts stay until dismissed by default. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  variant: ToastVariant;
  title: ReactNode;
  open: boolean;
}

const MAX_VISIBLE = 3;
let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function upsert(item: ToastItem) {
  const exists = items.some((t) => t.id === item.id);
  items = exists ? items.map((t) => (t.id === item.id ? item : t)) : [...items, item].slice(-MAX_VISIBLE);
  emit();
}

function show(variant: ToastVariant, title: ReactNode, options: ToastOptions = {}, id = nextId++) {
  upsert({ id, variant, title, open: true, ...options });
  return id;
}

function dismiss(id: number) {
  items = items.map((t) => (t.id === id ? { ...t, open: false } : t));
  emit();
  // Remove after the exit animation
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 200);
}

/**
 * Imperative toast API, callable from anywhere (no hook needed).
 *
 * toast.success("Saved")
 * toast.promise(save(), { loading: "Saving…", success: "Saved", error: (e) => String(e) })
 */
export const toast = Object.assign((title: ReactNode, options?: ToastOptions) => show("info", title, options), {
  success: (title: ReactNode, options?: ToastOptions) => show("success", title, options),
  error: (title: ReactNode, options?: ToastOptions) => show("error", title, options),
  info: (title: ReactNode, options?: ToastOptions) => show("info", title, options),
  warning: (title: ReactNode, options?: ToastOptions) => show("warning", title, options),
  loading: (title: ReactNode, options?: ToastOptions) => show("loading", title, options),
  dismiss,
  promise<T>(
    promise: Promise<T>,
    messages: {
      loading: ReactNode;
      success: ReactNode | ((value: T) => ReactNode);
      error: ReactNode | ((error: unknown) => ReactNode);
    },
  ): Promise<T> {
    const id = show("loading", messages.loading);
    promise.then(
      (value) =>
        show("success", typeof messages.success === "function" ? messages.success(value) : messages.success, {}, id),
      (error: unknown) =>
        show("error", typeof messages.error === "function" ? messages.error(error) : messages.error, {}, id),
    );
    return promise;
  },
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const icons: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 className="size-4 text-success" />,
  error: <XCircle className="size-4 text-danger" />,
  warning: <AlertTriangle className="size-4 text-warning" />,
  info: <Info className="size-4 text-info" />,
  loading: <Spinner className="text-fg-muted" />,
};

function defaultDuration(variant: ToastVariant) {
  return variant === "error" || variant === "loading" ? Infinity : 4000;
}

/** Mount once at the app root. */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribe, () => items);

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          open={t.open}
          onOpenChange={(open) => !open && dismiss(t.id)}
          duration={t.duration ?? defaultDuration(t.variant)}
          type={t.variant === "error" ? "foreground" : "background"}
          className={cn(
            "group pointer-events-auto relative flex w-full items-start gap-3 rounded-card border border-border-strong bg-surface-raised p-3 pr-8 shadow-2xl shadow-black/60",
            "data-[state=open]:animate-toast-in data-[state=closed]:animate-toast-out",
            "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=end]:animate-toast-out",
          )}
        >
          <span className="mt-0.5 shrink-0">{icons[t.variant]}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <ToastPrimitive.Title className="text-sm font-medium text-fg">{t.title}</ToastPrimitive.Title>
            {t.description && (
              <ToastPrimitive.Description className="text-xs break-words text-fg-muted">
                {t.description}
              </ToastPrimitive.Description>
            )}
            {t.action && (
              <ToastPrimitive.Action
                altText={t.action.label}
                onClick={t.action.onClick}
                className="mt-1.5 w-fit cursor-pointer text-xs font-medium text-accent hover:underline"
              >
                {t.action.label}
              </ToastPrimitive.Action>
            )}
          </div>
          <ToastPrimitive.Close
            aria-label="Dismiss"
            className="absolute top-2.5 right-2.5 cursor-pointer rounded p-0.5 text-fg-subtle hover:text-fg"
          >
            <X className="size-3.5" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-[100] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  );
}
