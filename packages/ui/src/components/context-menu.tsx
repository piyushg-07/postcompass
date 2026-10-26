import { ContextMenu as Menu } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

/** Right-click menu, styled like DropdownMenu. Wrap the target in `ContextMenuTrigger asChild`. */
export const ContextMenu = Menu.Root;
export const ContextMenuTrigger = Menu.Trigger;

export function ContextMenuContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        className={cn(
          "z-50 min-w-48 rounded-control border border-border-strong bg-surface-raised p-1 shadow-xl shadow-black/50 animate-fade-in",
          className,
        )}
        {...props}
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

export function ContextMenuItem({
  className,
  icon,
  danger,
  shortcut,
  children,
  ...props
}: ComponentProps<typeof Menu.Item> & {
  icon?: ReactNode;
  danger?: boolean;
  shortcut?: string;
}) {
  return (
    <Menu.Item
      className={cn(
        "flex h-7 cursor-pointer items-center gap-2 rounded px-2 text-xs outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-3.5",
        danger
          ? "text-danger data-[highlighted]:bg-danger/10"
          : "text-fg-muted data-[highlighted]:bg-surface-hover data-[highlighted]:text-fg",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut && (
        <span className="font-mono text-[10px] text-fg-subtle">{shortcut}</span>
      )}
    </Menu.Item>
  );
}

export function ContextMenuLabel({ children }: { children: ReactNode }) {
  return (
    <Menu.Label className="truncate px-2 pt-1.5 pb-1 text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
      {children}
    </Menu.Label>
  );
}

export function ContextMenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-border" />;
}
