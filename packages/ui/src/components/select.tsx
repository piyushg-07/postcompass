import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover as PopoverPrimitive, Select as SelectPrimitive } from "radix-ui";
import { type ReactNode, useRef, useState } from "react";
import { cn } from "../lib/cn";

export interface SelectOption {
  value: string;
  label: ReactNode;
  /** Muted text on the right of the option, e.g. "recommended" or a size. */
  hint?: ReactNode;
  disabled?: boolean;
}

/** Lists longer than this get a search box. */
const SEARCH_FROM = 10;

const triggerClasses =
  "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-control border border-border-strong bg-bg text-left text-fg transition-colors outline-none hover:border-fg-subtle focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger data-[placeholder]:text-fg-subtle data-[state=open]:border-fg-subtle";

/**
 * The app's dropdown picker: a styled trigger and menu, never the browser's native list.
 * Long lists get a search box at the top. Works inside `Field` (pass its control props through).
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
  if (options.length > SEARCH_FROM)
    return (
      <SearchSelect
        value={value}
        onValueChange={onValueChange}
        options={options}
        placeholder={placeholder}
        size={size}
        mono={mono}
        disabled={disabled}
        className={className}
        side={side}
        align={align}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
        controlProps={controlProps}
      />
    );
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
          triggerClasses,
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

/** Text an option is matched on: its label when that's plain text, else its value. */
function searchText(o: SelectOption) {
  return (typeof o.label === "string" ? o.label : o.value).toLowerCase();
}

/** The same picker with a filter box, for long lists (tables, columns, roles...). */
function SearchSelect({
  value,
  onValueChange,
  options,
  placeholder,
  size,
  mono,
  disabled,
  className,
  side,
  align,
  defaultOpen,
  onOpenChange,
  controlProps,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  size: "sm" | "md";
  mono: boolean;
  disabled?: boolean;
  className?: string;
  side?: "top" | "bottom";
  align: "start" | "end";
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  controlProps: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const shown = options.filter((o) => !q || searchText(o).includes(q));
  const selected = options.find((o) => o.value === value);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    }
    onOpenChange?.(next);
  };
  const choose = (o: SelectOption | undefined) => {
    if (!o || o.disabled) return;
    onValueChange(o.value);
    changeOpen(false);
  };
  const move = (to: number) => {
    const next = Math.min(Math.max(to, 0), shown.length - 1);
    setActive(next);
    list.current?.children[next]?.scrollIntoView({ block: "nearest" });
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={changeOpen}>
      <PopoverPrimitive.Trigger
        {...controlProps}
        disabled={disabled}
        data-placeholder={selected ? undefined : ""}
        className={cn(triggerClasses, size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-sm", mono && "font-mono", className)}
      >
        <span className="min-w-0 flex-1 truncate">{selected ? selected.label : placeholder}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-fg-subtle" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side ?? "bottom"}
          align={align}
          sideOffset={4}
          className="z-50 flex max-h-[min(340px,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] min-w-[12rem] flex-col overflow-hidden rounded-control border border-border-strong bg-surface-raised shadow-xl shadow-black/50 animate-fade-in"
        >
          <div className="relative shrink-0 border-b border-border p-1">
            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  move(active + 1);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  move(active - 1);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  choose(shown[active]);
                }
              }}
              placeholder="Search"
              className="h-7 w-full bg-transparent pr-2 pl-7 text-xs text-fg outline-none placeholder:text-fg-subtle"
            />
          </div>
          <div ref={list} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1">
            {shown.length === 0 && <p className="px-2 py-1.5 text-xs text-fg-subtle">No matches</p>}
            {shown.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                disabled={o.disabled}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={cn(
                  "relative flex h-7 w-full shrink-0 cursor-pointer items-center gap-2 rounded pr-2 pl-7 text-left text-xs text-fg-muted outline-none select-none disabled:pointer-events-none disabled:opacity-40",
                  i === active && "bg-surface-hover text-fg",
                  o.value === value && "text-fg",
                  mono && "font-mono",
                )}
              >
                {o.value === value && <Check className="absolute left-2 size-3.5 text-accent" />}
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="ml-auto pl-3 font-sans text-[10px] text-fg-subtle">{o.hint}</span>}
              </button>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
