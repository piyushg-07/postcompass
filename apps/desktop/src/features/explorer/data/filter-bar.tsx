import { cn, Popover, PopoverAnchor, PopoverContent } from "@repo/ui";
import { Search, X } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import type { FilterSpec } from "../../../lib/bindings";
import type { TypeKind } from "../../../lib/pg-types";

/** A column as the filter bar needs it. */
export interface FilterColumn {
  name: string;
  /** Short type, shown next to the name in the list. */
  format?: string;
  kind?: TypeKind;
  enumValues?: string[];
}

type Op = "=" | "<>" | ">" | "<" | ">=" | "<=" | "~~" | "~~*" | "in" | "is";
type OpGroup = "comparison" | "pattern" | "setNull";

/** Supabase's operators, grouped as in its menu. */
const OPERATORS: { value: Op; label: string; group: OpGroup }[] = [
  { value: "=", label: "Equals", group: "comparison" },
  { value: "<>", label: "Not equal", group: "comparison" },
  { value: ">", label: "Greater than", group: "comparison" },
  { value: "<", label: "Less than", group: "comparison" },
  { value: ">=", label: "Greater or equal", group: "comparison" },
  { value: "<=", label: "Less or equal", group: "comparison" },
  { value: "~~", label: "Like", group: "pattern" },
  { value: "~~*", label: "iLike", group: "pattern" },
  { value: "in", label: "In list", group: "setNull" },
  { value: "is", label: "Is", group: "setNull" },
];

const DATE_KINDS = new Set<TypeKind>([
  "date",
  "time",
  "timestamp",
  "timestamptz",
]);

function operatorsFor(kind?: TypeKind) {
  if (kind === "bool")
    return OPERATORS.filter((o) => ["=", "<>", "is"].includes(o.value));
  if (kind && DATE_KINDS.has(kind))
    return OPERATORS.filter(
      (o) => o.group === "comparison" || o.value === "is",
    );
  return OPERATORS;
}

const pad = (n: number) => String(n).padStart(2, "0");
const day = (offset: number) => {
  const d = new Date(Date.now() - offset * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Ready-made values for a condition, like Supabase's value menu. */
function valueOptions(column: FilterColumn | undefined, op: Op) {
  if (op === "is")
    return [
      { value: "null", label: "NULL" },
      { value: "not null", label: "NOT NULL" },
      ...(column?.kind === "bool"
        ? [
            { value: "true", label: "TRUE" },
            { value: "false", label: "FALSE" },
          ]
        : []),
    ];
  if (op === "~~" || op === "~~*" || op === "in") return [];
  if (column?.kind === "bool")
    return [
      { value: "true", label: "true" },
      { value: "false", label: "false" },
    ];
  if (column?.kind === "enum")
    return (column.enumValues ?? []).map((v) => ({ value: v, label: v }));
  if (column?.kind && DATE_KINDS.has(column.kind) && column.kind !== "time")
    return [
      { value: day(0), label: "Today" },
      { value: day(1), label: "Yesterday" },
      { value: day(7), label: "Last 7 days" },
      { value: day(30), label: "Last 30 days" },
    ];
  return [];
}

interface Draft {
  column: string;
  op: Op;
  value: string;
}

const SIMPLE: Partial<Record<Op, FilterSpec["op"]>> = {
  "=": "equals",
  "<>": "not_equals",
  ">": "greater_than",
  "<": "less_than",
  ">=": "greater_or_equal",
  "<=": "less_or_equal",
  "~~": "like",
  "~~*": "i_like",
  in: "in_list",
};
const IS_VALUES: Record<string, FilterSpec["op"]> = {
  null: "is_null",
  "not null": "is_not_null",
  true: "is_true",
  false: "is_false",
};

/** A finished condition as the backend takes it; `null` while it's incomplete. */
function toSpec(d: Draft, column?: FilterColumn): FilterSpec | null {
  if (d.op === "is") {
    const op = IS_VALUES[d.value.trim().toLowerCase()];
    return op ? { column: d.column, op, value: null } : null;
  }
  // Spaces only matter in text; uuids and numbers are often pasted with stray ones
  const text = column?.kind === "text" && column.format !== "uuid";
  const value = text ? d.value : d.value.trim();
  if (value === "") return null;
  return { column: d.column, op: SIMPLE[d.op]!, value };
}

function fromSpec(f: FilterSpec): Draft {
  const is = Object.entries(IS_VALUES).find(([, op]) => op === f.op);
  if (is) return { column: f.column, op: "is", value: is[0] };
  if (f.op === "contains")
    return { column: f.column, op: "~~*", value: `%${f.value ?? ""}%` };
  if (f.op === "starts_with")
    return { column: f.column, op: "~~*", value: `${f.value ?? ""}%` };
  const op = (Object.entries(SIMPLE).find(([, o]) => o === f.op)?.[0] ??
    "=") as Op;
  return { column: f.column, op, value: f.value ?? "" };
}

type Part = "column" | "op" | "value";
type Active = { index: number; part: Part } | "freeform" | null;

interface Item {
  value: string;
  label: string;
  hint?: string;
  symbol?: string;
  group?: string;
}

/**
 * Supabase's filter bar: each filter is a pill of column, operator and value you can click to
 * change; typing in the bar picks a column for a new one. Changes apply as soon as a value is
 * complete.
 */
export function FilterBar({
  columns,
  applied,
  disabled,
  onApply,
}: {
  columns: FilterColumn[];
  applied: FilterSpec[];
  disabled: boolean;
  onApply: (filters: FilterSpec[]) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() => applied.map(fromSpec));
  const [active, setActive] = useState<Active>(null);
  const [text, setText] = useState("");
  const [highlight, setHighlight] = useState(0);
  /** A pill selected with Backspace, removed by the next Backspace. */
  const [marked, setMarked] = useState<number | null>(null);
  const freeform = useRef<HTMLInputElement>(null);
  const valueRefs = useRef(new Map<number, HTMLInputElement>());
  const opRefs = useRef(new Map<number, HTMLButtonElement>());
  const appliedKey = JSON.stringify(applied);
  const lastApplied = useRef(appliedKey);

  // Filters set from elsewhere (e.g. "Filter by value") replace the pills
  useEffect(() => {
    if (appliedKey !== lastApplied.current) {
      lastApplied.current = appliedKey;
      setDrafts(applied.map(fromSpec));
    }
  }, [appliedKey, applied]);

  const columnOf = (name: string) => columns.find((c) => c.name === name);

  const apply = (next: Draft[]) => {
    setDrafts(next);
    const specs = next
      .map((d) => toSpec(d, columnOf(d.column)))
      .filter((f): f is FilterSpec => f !== null);
    const key = JSON.stringify(specs);
    if (key !== lastApplied.current) {
      lastApplied.current = key;
      onApply(specs);
    }
  };

  const patch = (index: number, p: Partial<Draft>, commit = true) => {
    const next = drafts.map((d, i) => (i === index ? { ...d, ...p } : d));
    if (commit) apply(next);
    else setDrafts(next);
  };

  const remove = (index: number) => {
    apply(drafts.filter((_, i) => i !== index));
    setMarked(null);
    setActive("freeform");
    setTimeout(() => freeform.current?.focus());
  };

  const focusValue = (index: number) =>
    setTimeout(() => valueRefs.current.get(index)?.focus());

  const open = (a: Active) => {
    setActive(a);
    setHighlight(0);
    setMarked(null);
  };

  /** Items for whatever is open right now. */
  const q = text.trim().toLowerCase();
  let items: Item[] = [];
  if (active === "freeform")
    items = columns
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .map((c) => ({ value: c.name, label: c.name, hint: c.format }));
  else if (active && active.part === "column")
    items = columns.map((c) => ({
      value: c.name,
      label: c.name,
      hint: c.format,
    }));
  else if (active && active.part === "op")
    items = operatorsFor(columnOf(drafts[active.index]!.column)?.kind).map(
      (o) => ({
        value: o.value,
        label: o.label,
        symbol: o.value,
        group: o.group,
      }),
    );
  else if (active && active.part === "value") {
    const d = drafts[active.index]!;
    const v = d.value.trim().toLowerCase();
    items = valueOptions(columnOf(d.column), d.op).filter(
      (o) =>
        !v ||
        d.op === "is" ||
        o.label.toLowerCase().includes(v) ||
        o.value.includes(v),
    );
  }

  const select = (item: Item) => {
    if (active === "freeform") {
      const column = columnOf(item.value);
      const op = operatorsFor(column?.kind)[0]!.value;
      const next = [...drafts, { column: item.value, op, value: "" }];
      setDrafts(next);
      setText("");
      // Like Supabase: after the column, pick the operator, then the value
      open({ index: next.length - 1, part: "op" });
      setTimeout(() => opRefs.current.get(next.length - 1)?.focus());
    } else if (active && active.part === "column") {
      const column = columnOf(item.value);
      const ops = operatorsFor(column?.kind);
      const d = drafts[active.index]!;
      patch(active.index, {
        column: item.value,
        op: ops.some((o) => o.value === d.op) ? d.op : ops[0]!.value,
      });
      open({ index: active.index, part: "value" });
      focusValue(active.index);
    } else if (active && active.part === "op") {
      const op = item.value as Op;
      const d = drafts[active.index]!;
      // "is" takes NULL/TRUE/…; anything else starts from a fresh value
      const value = op === "is" || d.op === "is" ? "" : d.value;
      patch(active.index, { op, value });
      open({ index: active.index, part: "value" });
      focusValue(active.index);
    } else if (active && active.part === "value") {
      patch(active.index, { value: item.value });
      setActive("freeform");
      setTimeout(() => freeform.current?.focus());
    }
  };

  /** Arrow keys and Enter in any open list. Returns true when it handled the key. */
  const listKeys = (e: KeyboardEvent) => {
    if (items.length === 0) return false;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(items.length - 1, h + 1));
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
      return true;
    }
    if (e.key === "Enter" && items[highlight]) {
      e.preventDefault();
      select(items[highlight]);
      return true;
    }
    return false;
  };

  const onFreeformKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (listKeys(e)) return;
    if (e.key === "Backspace" && text === "" && drafts.length) {
      e.preventDefault();
      if (marked !== null) remove(marked);
      else setMarked(drafts.length - 1);
    } else if (e.key === "Escape") {
      setActive(null);
      freeform.current?.blur();
    } else setMarked(null);
  };

  const onValueKeyDown = (
    index: number,
    e: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (listKeys(e)) return;
    if (e.key === "Enter") {
      e.preventDefault();
      apply(drafts);
      setActive("freeform");
      freeform.current?.focus();
    } else if (e.key === "Escape") {
      setActive(null);
      e.currentTarget.blur();
    } else if (e.key === "Backspace" && drafts[index]!.value === "") {
      e.preventDefault();
      remove(index);
    }
  };

  /** Leaving a value: apply it, or drop the pill if it was never filled in. */
  const onValueBlur = (index: number) => {
    const d = drafts[index];
    setActive((a) =>
      a !== null && a !== "freeform" && a.index === index && a.part === "value"
        ? null
        : a,
    );
    if (!d) return;
    if (toSpec(d, columnOf(d.column)) === null && d.value === "")
      apply(drafts.filter((_, i) => i !== index));
    else apply(drafts);
  };

  const list = (
    <OptionList
      items={items}
      highlight={highlight}
      onHover={setHighlight}
      onSelect={select}
    />
  );

  return (
    <div
      className={cn(
        "flex h-full min-w-0 flex-1 cursor-text items-center gap-1 overflow-x-auto pl-2 [scrollbar-width:none]",
        disabled && "pointer-events-none opacity-60",
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          freeform.current?.focus();
        }
      }}
    >
      <Search className="mr-0.5 size-4 shrink-0 text-fg-subtle" />
      {drafts.map((d, index) => {
        const column = columnOf(d.column);
        const isPart = (part: Part) =>
          active !== null &&
          active !== "freeform" &&
          active.index === index &&
          active.part === part;
        return (
          <div
            key={index}
            className={cn(
              "group flex h-[26px] shrink-0 items-stretch rounded-sm border border-border-strong bg-surface-raised",
              marked === index && "ring-2 ring-accent/60",
            )}
          >
            <Popover open={isPart("column") && items.length > 0}>
              <PopoverAnchor asChild>
                <button
                  type="button"
                  onClick={() => open({ index, part: "column" })}
                  onKeyDown={(e) => listKeys(e)}
                  onBlur={() => isPart("column") && setActive(null)}
                  className="flex cursor-pointer items-center pr-1 pl-2 text-xs whitespace-nowrap text-fg-muted outline-none transition-colors hover:text-fg focus-visible:text-fg"
                >
                  {column?.name ?? d.column}
                </button>
              </PopoverAnchor>
              <ListContent>{list}</ListContent>
            </Popover>
            <Popover open={isPart("op") && items.length > 0}>
              <PopoverAnchor asChild>
                <button
                  ref={(el) => {
                    if (el) opRefs.current.set(index, el);
                    else opRefs.current.delete(index);
                  }}
                  type="button"
                  onClick={() => open({ index, part: "op" })}
                  onKeyDown={(e) => listKeys(e)}
                  onBlur={() => isPart("op") && setActive(null)}
                  className="flex cursor-pointer items-center px-1 font-mono text-xs text-fg outline-none hover:text-accent focus-visible:text-accent"
                >
                  {d.op}
                </button>
              </PopoverAnchor>
              <ListContent>{list}</ListContent>
            </Popover>
            <Popover open={isPart("value") && items.length > 0}>
              <PopoverAnchor asChild>
                <span className="relative inline-flex max-w-[180px] items-center">
                  <input
                    ref={(el) => {
                      if (el) valueRefs.current.set(index, el);
                      else valueRefs.current.delete(index);
                    }}
                    aria-label={`Value for ${d.column}`}
                    spellCheck={false}
                    value={d.value}
                    onChange={(e) => {
                      patch(index, { value: e.target.value }, false);
                      setHighlight(0);
                    }}
                    onFocus={() => open({ index, part: "value" })}
                    onBlur={() => onValueBlur(index)}
                    onKeyDown={(e) => onValueKeyDown(index, e)}
                    className="absolute inset-0 w-full bg-transparent px-1 text-xs text-fg outline-none select-text"
                  />
                  <span className="invisible px-1 text-xs whitespace-pre">
                    {d.value || "  "}
                  </span>
                </span>
              </PopoverAnchor>
              <ListContent>{list}</ListContent>
            </Popover>
            <button
              type="button"
              aria-label={`Remove ${d.column} filter`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => remove(index)}
              className="m-[3px] flex size-[18px] shrink-0 cursor-pointer items-center justify-center self-center rounded-sm text-fg-subtle hover:bg-surface-hover hover:text-fg"
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
      <Popover open={active === "freeform" && items.length > 0}>
        <PopoverAnchor asChild>
          <input
            ref={freeform}
            value={text}
            spellCheck={false}
            placeholder={
              drafts.length ? "Add more filters..." : "Search or filter..."
            }
            onChange={(e) => {
              setText(e.target.value);
              setHighlight(0);
              setMarked(null);
              setActive("freeform");
            }}
            onFocus={() => open("freeform")}
            onBlur={() => {
              setActive((a) => (a === "freeform" ? null : a));
              setMarked(null);
            }}
            onKeyDown={onFreeformKeyDown}
            className="h-full min-w-[140px] flex-1 bg-transparent px-1 text-xs text-fg outline-none placeholder:text-fg-subtle"
          />
        </PopoverAnchor>
        <ListContent>{list}</ListContent>
      </Popover>
    </div>
  );
}

function ListContent({ children }: { children: ReactNode }) {
  return (
    <PopoverContent
      align="start"
      sideOffset={6}
      className="max-w-[360px] min-w-[220px] p-0"
      onOpenAutoFocus={(e) => e.preventDefault()}
      onCloseAutoFocus={(e) => e.preventDefault()}
    >
      {children}
    </PopoverContent>
  );
}

const GROUP_LABELS: Record<string, string> = {
  comparison: "Comparison",
  pattern: "Pattern",
  setNull: "Set & null",
};

/** The menu under a pill or the bar: mouse or arrow keys to pick. */
function OptionList({
  items,
  highlight,
  onHover,
  onSelect,
}: {
  items: Item[];
  highlight: number;
  onHover: (index: number) => void;
  onSelect: (item: Item) => void;
}) {
  return (
    <div className="max-h-[300px] overflow-y-auto p-1">
      {items.map((item, i) => (
        <div key={`${item.group ?? ""}:${item.value}`}>
          {item.group && item.group !== items[i - 1]?.group && (
            <p
              className={cn(
                "px-2 pt-1.5 pb-1 text-[11px] text-fg-subtle",
                i > 0 && "mt-1 border-t border-border pt-2",
              )}
            >
              {GROUP_LABELS[item.group]}
            </p>
          )}
          <button
            type="button"
            // Keep focus in the input so blur doesn't close the menu first
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item);
            }}
            onMouseEnter={() => onHover(i)}
            className={cn(
              "flex h-7 w-full cursor-pointer items-center justify-between gap-2 rounded px-2 text-left text-xs text-fg",
              i === highlight ? "bg-surface-hover" : undefined,
            )}
          >
            <span className="truncate">{item.label}</span>
            {item.hint && (
              <span className="shrink-0 text-fg-subtle">{item.hint}</span>
            )}
            {item.symbol && (
              <span className="ml-auto shrink-0 rounded-sm bg-surface-hover px-1.5 py-0.5 font-mono text-fg-muted">
                {item.symbol}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
