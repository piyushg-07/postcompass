import { DropdownMenu as Menu } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * Non-modal by default: a modal menu that opens a dialog or side panel from one of its items
 * can leave `pointer-events: none` on <body> after both close, freezing the whole app.
 */
export function DropdownMenu({ modal = false, ...props }: ComponentProps<typeof Menu.Root>) {
  return <Menu.Root modal={modal} {...props} />;
}
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({
  className,
  align = "start",
  children,
  ...props
}: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={4}
        className={cn(
          "z-50 min-w-44 rounded-control border border-border-strong bg-surface-raised p-1 shadow-xl shadow-black/50 animate-fade-in",
          className,
        )}
        {...props}
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  icon,
  danger,
  shortcut,
  children,
  ...props
}: ComponentProps<typeof Menu.Item> & { icon?: ReactNode; danger?: boolean; shortcut?: string }) {
  return (
    <Menu.Item
      className={cn(
        "flex h-7 cursor-pointer items-center gap-2 rounded px-2 text-xs outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-3.5",
        danger ? "text-danger data-[highlighted]:bg-danger/10" : "text-fg-muted data-[highlighted]:bg-surface-hover data-[highlighted]:text-fg",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="font-mono text-[10px] text-fg-subtle">{shortcut}</span>}
    </Menu.Item>
  );
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <Menu.Label className="px-2 pt-1.5 pb-1 text-[10px] font-medium tracking-wide text-fg-subtle uppercase">{children}</Menu.Label>;
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-border" />;
}
