import {
  Button,
  Dialog,
  DialogClose,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Kbd,
  Popover,
  PopoverAnchor,
  PopoverContent,
  Select,
  SheetContent,
  toast,
  Tooltip,
} from "@repo/ui";
import { ChevronDown, Maximize2 } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import {
  dateFormat,
  nowFor,
  parseDate,
  type TypeKind,
} from "../../../lib/pg-types";

/** What an editor reports: a new value, NULL, or `false` for "cancelled". */
export type Commit = (value: string | null | false) => void;

export interface EditorColumn {
  name: string;
  kind: TypeKind;
  nullable: boolean;
  enumValues?: string[];
}

/**
 * The editor for one grid cell, chosen by type like Supabase's: numbers and times inline, text
 * and JSON in a popover over the cell, booleans and enums in a list, dates in a small popover.
 */
export function CellEditor({
  column,
  value,
  initial,
  width,
  rowHeight,
  onCommit,
  onExpand,
}: {
  column: EditorColumn;
  value: string | null | undefined;
  /** A key typed to start editing; replaces the value. */
  initial?: string;
  width: number;
  rowHeight: number;
  onCommit: Commit;
  /** Opens the full-size editor with the current text. */
  onExpand: (text: string) => void;
}) {
  const start = initial ?? value ?? "";
  switch (column.kind) {
    case "number":
    case "time":
      return (
        <ValueEditor
          kind={column.kind}
          initial={start}
          nullable={column.nullable}
          width={width}
          rowHeight={rowHeight}
          onCommit={onCommit}
        />
      );
    case "bool":
      return (
        <ListEditor
          value={value ?? null}
          options={[
            { value: "true", label: "TRUE" },
            { value: "false", label: "FALSE" },
          ]}
          nullable={column.nullable}
          onCommit={onCommit}
        />
      );
    case "enum":
      return (
        <ListEditor
          value={value ?? null}
          options={(column.enumValues ?? []).map((v) => ({
            value: v,
            label: v,
          }))}
          nullable={column.nullable}
          onCommit={onCommit}
        />
      );
    case "date":
    case "timestamp":
    case "timestamptz":
      return (
        <DateEditor
          kind={column.kind}
          initial={start}
          nullable={column.nullable}
          rowHeight={rowHeight}
          onCommit={onCommit}
        />
      );
    default:
      return (
        <TextEditor
          initial={start}
          json={column.kind === "json"}
          // JSON and arrays are cleared to NULL instead
          nullable={
            column.nullable && column.kind !== "json" && column.kind !== "array"
          }
          width={width}
          rowHeight={rowHeight}
          onCommit={onCommit}
          onExpand={onExpand}
        />
      );
  }
}

/** Calls `commit` once, whatever closes the editor first (Enter, blur, outside click…). */
function useOnce(commit: Commit) {
  const done = useRef(false);
  return (v: string | null | false) => {
    if (done.current) return;
    done.current = true;
    commit(v);
  };
}

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$|^[-+]?(nan|infinity)$/i;

/** Numbers and times: one line in the same popover box as text, checked before saving. */
function ValueEditor({
  kind,
  initial,
  nullable,
  width,
  rowHeight,
  onCommit,
}: {
  kind: "number" | "time";
  initial: string;
  nullable: boolean;
  width: number;
  rowHeight: number;
  onCommit: Commit;
}) {
  const [text, setText] = useState(initial);
  const finish = useOnce(onCommit);
  const trimmed = text.trim();
  const invalid = kind === "number" && trimmed !== "" && !NUMBER.test(trimmed);

  const save = () => {
    // "Not a number" already shows under the input; stay open until it's fixed or cancelled
    if (invalid) return false;
    // An empty number or time is saved as NULL
    finish(trimmed === "" ? null : trimmed);
    return true;
  };

  return (
    <CellPopover
      width={Math.max(width, 300)}
      rowHeight={rowHeight}
      onOutside={() => !save()}
      onEscape={() => finish(false)}
    >
      <input
        autoFocus
        spellCheck={false}
        inputMode={kind === "number" ? "decimal" : undefined}
        value={text}
        placeholder={kind === "time" ? "HH:mm:ss" : "0"}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => {
          // A typed first key stays; an existing value is selected so typing replaces it
          if (initial.length > 1) e.currentTarget.select();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") finish(false);
        }}
        className="block h-10 w-full bg-bg px-2.5 font-mono text-sm text-fg outline-none select-text placeholder:text-fg-subtle"
      />
      {invalid && (
        <p className="border-t border-border bg-danger/5 px-2.5 py-1.5 text-[11px] text-danger">
          Not a number
        </p>
      )}
      <div className="flex items-center gap-2 border-t border-border bg-surface px-2.5 py-1.5">
        <KeyHints />
        {nullable && (
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            onClick={() => finish(null)}
          >
            Set to NULL
          </Button>
        )}
      </div>
    </CellPopover>
  );
}

const NULL_OPTION = "__null__";

function ListEditor({
  value,
  options,
  nullable,
  onCommit,
}: {
  value: string | null;
  options: { value: string; label: string }[];
  nullable: boolean;
  onCommit: Commit;
}) {
  const finish = useOnce(onCommit);
  return (
    <div
      className="absolute inset-0 z-10"
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Select
        defaultOpen
        value={value ?? NULL_OPTION}
        onValueChange={(v) => finish(v === NULL_OPTION ? null : v)}
        onOpenChange={(open) => !open && setTimeout(() => finish(false))}
        className="h-full rounded-[3px] border-0 bg-surface-raised text-[13px] ring-[1.5px] ring-accent ring-inset"
        options={[
          ...(nullable ? [{ value: NULL_OPTION, label: "NULL" }] : []),
          ...options,
        ]}
      />
    </div>
  );
}

/** Key hints at the bottom of the popover editors. */
function KeyHints() {
  return (
    <span className="flex items-center gap-3 text-[11px] text-fg-subtle">
      <span className="flex items-center gap-1.5">
        <Kbd>⏎</Kbd> Save changes
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>Esc</Kbd> Cancel changes
      </span>
    </span>
  );
}

function CellPopover({
  width,
  rowHeight,
  onOutside,
  onEscape,
  children,
}: {
  width: number;
  rowHeight: number;
  /** Return true to keep the popover open. */
  onOutside: () => boolean | void;
  onEscape: () => void;
  children: ReactNode;
}) {
  return (
    <Popover open>
      <PopoverAnchor asChild>
        <div className="absolute inset-px rounded-[3px] ring-[1.5px] ring-accent" />
      </PopoverAnchor>
      <PopoverContent
        side="bottom"
        align="start"
        // Opens over the cell itself, like Supabase's
        sideOffset={-rowHeight}
        avoidCollisions
        style={{ width }}
        className="overflow-hidden rounded-control p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (onOutside()) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          onEscape();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        // Portaled, but React still bubbles events to the grid cell; keep them here
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

function TextEditor({
  initial,
  json,
  nullable,
  width,
  rowHeight,
  onCommit,
  onExpand,
}: {
  initial: string;
  json: boolean;
  nullable: boolean;
  width: number;
  rowHeight: number;
  onCommit: Commit;
  onExpand: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  const finish = useOnce(onCommit);

  const save = () => {
    if (json && text.trim()) {
      try {
        JSON.parse(text);
      } catch {
        toast.error("Please enter a valid JSON");
        return false;
      }
    }
    // Clearing a JSON value saves NULL
    finish(json && !text.trim() ? null : text);
    return true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      save();
    }
  };

  return (
    <CellPopover
      width={Math.max(width, 360)}
      rowHeight={rowHeight}
      onOutside={() => !save()}
      onEscape={() => finish(false)}
    >
      <textarea
        autoFocus
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          const end = e.currentTarget.value.length;
          e.currentTarget.setSelectionRange(end, end);
        }}
        className="block h-[200px] w-full resize-none bg-bg p-2.5 font-mono text-xs leading-relaxed text-fg outline-none select-text"
      />
      <div className="flex items-center gap-2 border-t border-border bg-surface px-2.5 py-1.5">
        <KeyHints />
        <span className="ml-auto flex items-center gap-1">
          <Tooltip content="Expand editor">
            <button
              type="button"
              aria-label="Expand editor"
              onClick={() => {
                finish(false);
                onExpand(text);
              }}
              className="flex size-6 cursor-pointer items-center justify-center rounded text-fg-subtle hover:bg-surface-hover hover:text-fg"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </Tooltip>
          {nullable && (
            <Button size="sm" variant="secondary" onClick={() => finish(null)}>
              Set to NULL
            </Button>
          )}
        </span>
      </div>
    </CellPopover>
  );
}

function DateEditor({
  kind,
  initial,
  nullable,
  rowHeight,
  onCommit,
}: {
  kind: TypeKind;
  initial: string;
  nullable: boolean;
  rowHeight: number;
  onCommit: Commit;
}) {
  const [text, setText] = useState(initial);
  const finish = useOnce(onCommit);
  const parsed = parseDate(text, kind);

  const save = () => {
    if (!text.trim()) {
      if (nullable) finish(null);
      return;
    }
    if (parsed) finish(text.trim());
  };

  return (
    <CellPopover
      width={256}
      rowHeight={rowHeight}
      // Outside clicks don't close it; Enter saves, Esc cancels
      onOutside={() => true}
      onEscape={() => finish(false)}
    >
      <div className="flex flex-col gap-2 p-2.5">
        <input
          autoFocus
          value={text}
          placeholder={dateFormat(kind)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") save();
            if (e.key === "Escape") finish(false);
          }}
          className="h-8 w-full rounded-control border border-border-strong bg-bg px-2 font-mono text-xs text-fg outline-none select-text placeholder:text-fg-subtle focus:border-accent"
        />
        <p className="text-[11px] text-fg-subtle">
          Formatted value:{" "}
          <span className={parsed ? "text-fg" : undefined}>
            {!text.trim()
              ? "Enter a valid date format"
              : parsed
                ? kind === "date"
                  ? parsed.toLocaleDateString()
                  : parsed.toLocaleString()
                : "Invalid date format"}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2 border-t border-border bg-surface px-2.5 py-1.5">
        <span className="flex flex-col gap-1 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-1.5">
            <Kbd>⏎</Kbd> Save
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Esc</Kbd> Cancel
          </span>
        </span>
        <span className="ml-auto flex items-center">
          {nullable ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-r-none"
                onClick={() => finish(null)}
              >
                Set NULL
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label="More options"
                    className="rounded-l-none border-l-0 px-1.5"
                  >
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => finish(nowFor(kind))}>
                    Set to NOW
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => finish(nowFor(kind))}
            >
              Set to NOW
            </Button>
          )}
        </span>
      </div>
    </CellPopover>
  );
}

/** Full-size editor for long text and JSON, opened from "Expand editor". */
export function ExpandEditor({
  target,
  onClose,
  onSave,
}: {
  target: { column: string; json: boolean; text: string } | null;
  onClose: () => void;
  onSave: (value: string | null) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      {target && (
        <ExpandBody
          key={target.column}
          target={target}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function ExpandBody({
  target,
  onSave,
  onClose,
}: {
  target: { column: string; json: boolean; text: string };
  onSave: (value: string | null) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(target.text);
  const save = () => {
    if (target.json && text.trim()) {
      try {
        JSON.parse(text);
      } catch {
        toast.error("Please enter a valid JSON");
        return;
      }
    }
    onSave(target.json && !text.trim() ? null : text);
    onClose();
  };
  return (
    <SheetContent
      title={
        <>
          Editing value of: <span className="font-mono">{target.column}</span>
        </>
      }
      className="w-[720px]"
      footer={
        <>
          {target.json && (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => {
                try {
                  setText(JSON.stringify(JSON.parse(text), null, 2));
                } catch {
                  toast.error("Please enter a valid JSON");
                }
              }}
            >
              Prettify JSON
            </Button>
          )}
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="primary" onClick={save}>
            Save value
          </Button>
        </>
      }
    >
      <textarea
        autoFocus
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
        }}
        className="h-full min-h-[420px] w-full resize-none rounded-card border border-border-strong bg-bg p-3 font-mono text-xs leading-relaxed text-fg outline-none select-text focus:border-accent"
      />
    </SheetContent>
  );
}
