import {
  Button,
  cn,
  IconButton,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
} from "@repo/ui";
import { ArrowDownUp, Filter, Plus, X } from "lucide-react";
import { useState } from "react";
import type { FilterOp, FilterSpec, SortSpec } from "../../../lib/bindings";

/** Filter conditions, with the SQL operator Supabase shows next to each one. */
export const FILTER_OPS: {
  op: FilterOp;
  symbol: string;
  label: string;
  needsValue: boolean;
}[] = [
  { op: "equals", symbol: "=", label: "equals", needsValue: true },
  { op: "not_equals", symbol: "<>", label: "not equal", needsValue: true },
  { op: "greater_than", symbol: ">", label: "greater than", needsValue: true },
  { op: "less_than", symbol: "<", label: "less than", needsValue: true },
  {
    op: "greater_or_equal",
    symbol: ">=",
    label: "greater than or equal",
    needsValue: true,
  },
  {
    op: "less_or_equal",
    symbol: "<=",
    label: "less than or equal",
    needsValue: true,
  },
  {
    op: "contains",
    symbol: "~~*",
    label: "contains (case-insensitive)",
    needsValue: true,
  },
  { op: "starts_with", symbol: "^", label: "starts with", needsValue: true },
  { op: "is_null", symbol: "is", label: "is null", needsValue: false },
  {
    op: "is_not_null",
    symbol: "is not",
    label: "is not null",
    needsValue: false,
  },
];

const needsValue = (op: FilterOp) =>
  FILTER_OPS.find((o) => o.op === op)?.needsValue ?? true;

/** Toolbar button that turns accent-coloured while rules are applied, like Supabase's. */
function ToolbarTrigger({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <PopoverTrigger asChild>
      <Button
        size="sm"
        variant={count ? "secondary" : "ghost"}
        iconLeft={icon}
        className={cn(count > 0 && "text-accent [&_svg]:text-accent")}
      >
        {count
          ? `${label === "Filter" ? "Filtered" : "Sorted"} by ${count} rule${count === 1 ? "" : "s"}`
          : label}
      </Button>
    </PopoverTrigger>
  );
}

function PanelFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
      {children}
    </div>
  );
}

function EmptyRules({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-4">
      <p className="text-xs text-fg">{title}</p>
      <p className="text-xs text-fg-subtle">{text}</p>
    </div>
  );
}

export function FilterPopover({
  columns,
  applied,
  disabled,
  onApply,
}: {
  columns: string[];
  applied: FilterSpec[];
  disabled: boolean;
  onApply: (filters: FilterSpec[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterSpec[]>(applied);
  const update = (index: number, patch: Partial<FilterSpec>) =>
    setDraft((d) => d.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  const add = () =>
    setDraft((d) => [
      ...d,
      { column: columns[0] ?? "", op: "equals", value: "" },
    ]);
  const complete = draft.filter(
    (f) => f.column && (!needsValue(f.op) || f.value),
  );
  const apply = () => {
    onApply(complete);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        // Start from what's applied each time it opens
        if (o) setDraft(applied.length ? applied : []);
        setOpen(o);
      }}
    >
      <ToolbarTrigger icon={<Filter />} label="Filter" count={applied.length} />
      <PopoverContent className="w-[540px]">
        {draft.length === 0 ? (
          <EmptyRules
            title="No filters applied to this view"
            text="Add a column below to show only the rows that match."
          />
        ) : (
          <div className="flex flex-col gap-1.5 p-3">
            {draft.map((filter, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <span className="w-12 shrink-0 text-right text-[11px] text-fg-subtle">
                  {index === 0 ? "where" : "and"}
                </span>
                <Select
                  aria-label="Column"
                  size="sm"
                  mono
                  className="w-40"
                  value={filter.column}
                  onValueChange={(column) => update(index, { column })}
                  options={columns.map((c) => ({ value: c, label: c }))}
                />
                <Select
                  aria-label="Condition"
                  size="sm"
                  className="w-36"
                  value={filter.op}
                  onValueChange={(op) => update(index, { op: op as FilterOp })}
                  options={FILTER_OPS.map((o) => ({
                    value: o.op,
                    label: o.label,
                  }))}
                />
                {needsValue(filter.op) ? (
                  <Input
                    aria-label="Value"
                    autoFocus={index === draft.length - 1}
                    className="h-7 min-w-0 flex-1 font-mono text-xs"
                    placeholder="Enter a value"
                    value={filter.value ?? ""}
                    onChange={(e) => update(index, { value: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && !disabled && apply()}
                  />
                ) : (
                  <span className="flex-1" />
                )}
                <IconButton
                  size="sm"
                  label="Remove filter"
                  icon={<X />}
                  onClick={() =>
                    setDraft((d) => d.filter((_, i) => i !== index))
                  }
                />
              </div>
            ))}
          </div>
        )}
        <PanelFooter>
          <Button
            size="sm"
            variant="ghost"
            iconLeft={<Plus />}
            onClick={add}
            disabled={!columns.length}
          >
            Add filter
          </Button>
          <div className="flex items-center gap-2">
            {applied.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={() => {
                  onApply([]);
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              disabled={disabled}
              onClick={apply}
            >
              Apply filter
            </Button>
          </div>
        </PanelFooter>
      </PopoverContent>
    </Popover>
  );
}

export function SortPopover({
  columns,
  applied,
  disabled,
  onApply,
}: {
  columns: string[];
  applied: SortSpec[];
  disabled: boolean;
  onApply: (sort: SortSpec[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SortSpec[]>(applied);
  const unused = columns.filter((c) => !draft.some((s) => s.column === c));
  const apply = () => {
    onApply(draft);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(applied);
        setOpen(o);
      }}
    >
      <ToolbarTrigger
        icon={<ArrowDownUp />}
        label="Sort"
        count={applied.length}
      />
      <PopoverContent className="w-[420px]">
        {draft.length === 0 ? (
          <EmptyRules
            title="No sorting applied to this view"
            text="Pick a column below to sort by it."
          />
        ) : (
          <div className="flex flex-col gap-1.5 p-3">
            {draft.map((s, index) => (
              <div key={s.column} className="flex items-center gap-1.5">
                <span className="w-12 shrink-0 text-right text-[11px] text-fg-subtle">
                  {index === 0 ? "sort by" : "then by"}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg">
                  {s.column}
                </span>
                <div className="flex rounded-control border border-border p-0.5">
                  {[false, true].map((descending) => (
                    <button
                      key={String(descending)}
                      type="button"
                      onClick={() =>
                        setDraft((d) =>
                          d.map((x, i) =>
                            i === index ? { ...x, descending } : x,
                          ),
                        )
                      }
                      className={cn(
                        "h-6 cursor-pointer rounded px-2 text-xs",
                        s.descending === descending
                          ? "bg-surface-hover text-fg"
                          : "text-fg-muted hover:text-fg",
                      )}
                    >
                      {descending ? "Descending" : "Ascending"}
                    </button>
                  ))}
                </div>
                <IconButton
                  size="sm"
                  label="Remove sort"
                  icon={<X />}
                  onClick={() =>
                    setDraft((d) => d.filter((_, i) => i !== index))
                  }
                />
              </div>
            ))}
          </div>
        )}
        <PanelFooter>
          <Select
            aria-label="Add a column to sort by"
            size="sm"
            mono
            className="w-52"
            placeholder="Pick a column to sort by"
            value=""
            disabled={!unused.length}
            onValueChange={(column) =>
              setDraft((d) => [...d, { column, descending: false }])
            }
            options={unused.map((c) => ({ value: c, label: c }))}
          />
          <Button
            size="sm"
            variant="primary"
            disabled={disabled}
            onClick={apply}
          >
            Apply sorting
          </Button>
        </PanelFooter>
      </PopoverContent>
    </Popover>
  );
}
