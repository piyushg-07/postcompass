import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { type ReactNode, useState } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { Input } from "./input";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  hideClose = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  hideClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-card border border-border-strong bg-surface-raised p-5 shadow-2xl shadow-black/60 data-[state=open]:animate-dialog-in",
          className,
        )}
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <div className="flex flex-col gap-1 pr-6">
          <DialogPrimitive.Title className="text-base font-semibold text-fg">{title}</DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="text-sm text-fg-muted">{description}</DialogPrimitive.Description>
          )}
        </div>
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute top-4 right-4 cursor-pointer rounded p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** A panel that slides in from the right edge, for forms that need more room than a dialog. */
export function SheetContent({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Pinned to the bottom, below the scrolling body. */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[720px] max-w-[calc(100vw-48px)] flex-col border-l border-border-strong bg-surface-raised shadow-2xl shadow-black/60 data-[state=open]:animate-sheet-in",
          className,
        )}
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="text-base font-semibold text-fg">{title}</DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-sm text-fg-muted">{description}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            className="cursor-pointer rounded p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex justify-end gap-2 pt-1", className)}>{children}</div>;
}

/**
 * Confirmation for destructive actions. When `confirmText` is set the user must type it to enable the button.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  confirmText,
  destructive = false,
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  confirmText?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const canConfirm = !confirmText || typed === confirmText;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <DialogContent title={title} description={description}>
        {confirmText && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-fg-muted">
              Type <span className="font-mono text-fg">{confirmText}</span> to confirm
            </label>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus spellCheck={false} />
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant={destructive ? "danger" : "primary"}
            disabled={!canConfirm}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
