import { cn } from "@repo/ui";
import { CornerDownLeft, Search, X } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import type { FilterOp, FilterSpec } from "../../../lib/bindings";
import { FILTER_OPS } from "./filter-sort";

type Step = "column" | "op" | "value";

const opSymbol = (op: FilterOp) =>
  FILTER_OPS.find((o) => o.op === op)?.symbol ?? op;
const opLabel = (op: FilterOp) =>
  FILTER_OPS.find((o) => o.op === op)?.label ?? op;
const needsValue = (op: FilterOp) =>
  FILTER_OPS.find((o) => o.op === op)?.needsValue ?? true;

/**
 * Supabase-style filter bar: click the empty space, pick a column, then a condition, then type a
 * value and press Enter. Each filter becomes a chip; Backspace steps back, Escape cancels.
 */
export function FilterBar({
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
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("column");
  const [column, setColumn] = useState<string | null>(null);
  const [op, setOp] = useState<FilterOp | null>(null);
  const [text, setText] = useState("");
  const [highlight, setHighlight] = useState(0);

  const reset = () => {
    setStep("column");
    setColumn(null);
    setOp(null);
    setText("");
    setHighlight(0);
  };

  const commit = (filter: FilterSpec) => {
    onApply([...applied, filter]);
    reset();
  };

  const q = text.trim().toLowerCase();
  const options: {
    key: string;
    label: string;
    symbol?: string;
    hint?: string;
    pick: () => void;
  }[] =
    step === "column"
      ? columns
          .filter((c) => c.toLowerCase().includes(q))
          .map((c) => ({
            key: c,
            label: c,
            pick: () => {
              setColumn(c);
              setStep("op");
              setText("");
              setHighlight(0);
            },
          }))
      : step === "op"
        ? FILTER_OPS.filter(
            (o) => o.label.includes(q) || o.symbol.includes(q),
          ).map((o) => ({
            key: o.op,
            label: o.label,
            symbol: o.symbol,
            pick: () => {
              if (!o.needsValue)
                return commit({ column: column!, op: o.op, value: null });
              setOp(o.op);
              setStep("value");
              setText("");
              setHighlight(0);
            },
          }))
        : [];

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, options.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (step === "value" && column && op && text !== "")
        commit({ column, op, value: text });
      else options[highlight]?.pick();
    } else if (e.key === "Backspace" && text === "") {
      if (step === "value") setStep("op");
      else if (step === "op") {
        setStep("column");
        setColumn(null);
      } else if (applied.length) onApply(applied.slice(0, -1));
    } else if (e.key === "Escape") {
      reset();
      setOpen(false);
      input.current?.blur();
    }
  };

  /** Clicking a chip takes it out and puts it back in the editor. */
  const editChip = (index: number) => {
    const f = applied[index]!;
    onApply(applied.filter((_, i) => i !== index));
    setColumn(f.column);
    if (needsValue(f.op)) {
      setOp(f.op);
      setStep("value");
      setText(f.value ?? "");
    } else {
      setStep("op");
      setText("");
    }
    setOpen(true);
    input.current?.focus();
  };

  const placeholder =
    step === "column"
      ? applied.length
        ? "Add filter…"
        : "Search or filter rows…"
      : step === "op"
        ? "Choose a condition…"
        : "Type a value and press Enter";

  return (
    <div
      className={cn(
        "relative flex h-8 min-w-0 flex-1 cursor-text items-center gap-1.5 pr-1 pl-1.5",
        disabled && "pointer-events-none opacity-60",
      )}
      onMouseDown={(e) => {
        // Clicking the empty space focuses the input instead of blurring it
        if (e.target !== input.current) e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }}
    >
      <Search className="size-3.5 shrink-0 text-fg-subtle" />
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {applied.map((f, i) => (
          <span
            key={`${f.column}-${i}`}
            className="flex h-5 shrink-0 items-center gap-1 rounded border border-border-strong bg-surface-raised pl-1.5 text-[11px]"
          >
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                editChip(i);
              }}
            >
              <span className="font-mono text-fg">{f.column}</span>
              <span className="font-mono text-fg-muted">{opSymbol(f.op)}</span>
              {f.value !== null && needsValue(f.op) && (
                <span className="font-mono text-accent">{f.value}</span>
              )}
            </button>
            <button
              type="button"
              aria-label="Remove filter"
              className="flex size-4 cursor-pointer items-center justify-center rounded text-fg-subtle hover:text-fg"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onApply(applied.filter((_, j) => j !== i));
              }}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {column && (
          <span className="flex h-5 shrink-0 items-center gap-1 rounded bg-surface-hover px-1.5 text-[11px]">
            <span className="font-mono text-fg">{column}</span>
            {op && (
              <span className="font-mono text-fg-muted">{opSymbol(op)}</span>
            )}
          </span>
        )}
        <input
          ref={input}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={cn(
            "h-full min-w-24 flex-1 bg-transparent text-xs text-fg outline-none placeholder:text-fg-subtle",
            step === "value" && "font-mono",
          )}
        />
      </div>
      {(applied.length > 0 || column) && (
        <button
          type="button"
          aria-label="Clear all filters"
          className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-fg-subtle hover:bg-surface-hover hover:text-fg"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            reset();
            if (applied.length) onApply([]);
          }}
        >
          <X className="size-3.5" />
        </button>
      )}

      {open && (step !== "value" || column) && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 overflow-hidden rounded-control border border-border-strong bg-surface-raised shadow-xl shadow-black/50 animate-fade-in">
          <div className="px-2.5 pt-2 pb-1 text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
            {step === "column"
              ? "Filter by column"
              : step === "op"
                ? `Condition for ${column}`
                : `${column} ${opLabel(op!)}`}
          </div>
          {step === "value" ? (
            <div className="flex items-center gap-2 px-2.5 pt-0.5 pb-2.5 text-xs text-fg-muted">
              <CornerDownLeft className="size-3.5 text-fg-subtle" />
              {text ? (
                <span>
                  Press Enter to filter by{" "}
                  <span className="font-mono text-accent">{text}</span>
                </span>
              ) : (
                "Type a value, then press Enter"
              )}
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto p-1">
              {options.length === 0 && (
                <li className="px-2 py-1.5 text-xs text-fg-subtle">
                  No matches
                </li>
              )}
              {options.map((o, i) => (
                <li key={o.key}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      o.pick();
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    className={cn(
                      "flex h-7 w-full cursor-pointer items-center rounded px-2 text-left text-xs",
                      step === "column" && "font-mono",
                      i === highlight
                        ? "bg-surface-hover text-fg"
                        : "text-fg-muted",
                    )}
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
