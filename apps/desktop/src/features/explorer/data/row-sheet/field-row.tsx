import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
} from "@repo/ui";
import {
  ArrowRight,
  Key,
  Maximize2,
  MoreHorizontal,
  Search,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ColumnInfo } from "../../../../lib/bindings";
import {
  baseTypeName,
  dateFormat,
  nowFor,
  shortType,
  type TypeKind,
} from "../../../../lib/pg-types";
import type { Reference } from "../reference";
import type { Value } from "./row-change";

const LONG_TEXT = new Set([
  "text",
  "varchar",
  "bpchar",
  "char",
  "citext",
  "xml",
]);

function placeholderFor(
  c: ColumnInfo,
  kind: TypeKind,
  value: Value,
  editing: boolean,
) {
  if (value === null) return "NULL";
  if (value === "" && (kind === "text" || kind === "array")) return "EMPTY";
  if (!editing) {
    if (c.identity) return "Automatically generated as identity";
    if (c.default) return `Default: ${c.default}`;
  }
  if (
    kind === "date" ||
    kind === "timestamp" ||
    kind === "timestamptz" ||
    kind === "time"
  )
    return dateFormat(kind);
  return c.nullable ? "NULL" : "";
}

/** One column of the row panel: name and type on the left, the input on the right. */
export function FieldRow({
  column: c,
  kind,
  value,
  editing,
  reference,
  enumValues,
  onChange,
  onPick,
  onExpand,
}: {
  column: ColumnInfo;
  kind: TypeKind;
  value: Value;
  editing: boolean;
  reference?: Reference;
  enumValues?: string[];
  onChange: (v: Value) => void;
  onPick: () => void;
  onExpand: () => void;
}) {
  const id = `row-${c.name}`;
  const readOnly = c.identity === "always";
  const placeholder = placeholderFor(c, kind, value, editing);
  const canDefault = !editing && (c.default !== null || c.identity !== null);
  const isDate =
    kind === "date" ||
    kind === "timestamp" ||
    kind === "timestamptz" ||
    kind === "time";

  const menu = (items: ReactNode) => <FieldMenu>{items}</FieldMenu>;
  const nullItem = c.nullable && (
    <DropdownMenuItem onSelect={() => onChange(null)}>
      Set to NULL
    </DropdownMenuItem>
  );
  const defaultItem = canDefault && (
    <DropdownMenuItem onSelect={() => onChange(undefined)}>
      Set to Default
    </DropdownMenuItem>
  );

  let control: ReactNode;
  let actions: ReactNode = null;
  if (readOnly) {
    control = (
      <Input
        id={id}
        disabled
        className="text-xs"
        placeholder={editing ? (value ?? "NULL") : placeholder}
      />
    );
  } else if (reference) {
    control = (
      <div className="relative">
        <Input
          id={id}
          className="pr-24 font-mono text-xs"
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={onPick}
          className="absolute top-1/2 right-1 flex h-6 -translate-y-1/2 cursor-pointer items-center gap-1 rounded-md border border-border-strong bg-surface px-2 text-[11px] text-fg-muted transition-colors hover:border-accent/50 hover:text-accent"
        >
          <Search className="size-3" />
          Select
        </button>
      </div>
    );
    if (nullItem) actions = menu(nullItem);
  } else if (kind === "bool") {
    control = (
      <Select
        id={id}
        value={value ?? ""}
        placeholder={
          value === null ? "NULL" : canDefault ? placeholder : "Select a value"
        }
        onValueChange={(v) => onChange(v === "__null__" ? null : v)}
        options={[
          { value: "true", label: "TRUE" },
          { value: "false", label: "FALSE" },
          ...(c.nullable ? [{ value: "__null__", label: "NULL" }] : []),
        ]}
      />
    );
  } else if (kind === "enum") {
    control = (
      <Select
        id={id}
        mono
        value={value ?? ""}
        placeholder={canDefault && value === undefined ? placeholder : "---"}
        onValueChange={(v) => onChange(v === "__null__" ? null : v)}
        options={[
          ...(c.nullable ? [{ value: "__null__", label: "---" }] : []),
          ...(enumValues ?? []).map((v) => ({ value: v, label: v })),
        ]}
      />
    );
  } else if (
    (kind === "text" && LONG_TEXT.has(baseTypeName(c.dataType))) ||
    kind === "array"
  ) {
    control = (
      <textarea
        id={id}
        rows={5}
        spellCheck={false}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-control border border-border-strong bg-bg px-2.5 py-1.5 font-mono text-xs text-fg outline-none placeholder:text-fg-subtle focus-visible:border-accent"
      />
    );
    actions = menu(
      <>
        {nullItem}
        {defaultItem}
        {(nullItem || defaultItem) && <DropdownMenuSeparator />}
        <DropdownMenuItem icon={<Maximize2 />} onSelect={onExpand}>
          Expand editor
        </DropdownMenuItem>
      </>,
    );
  } else if (kind === "json") {
    control = (
      <Input
        id={id}
        className="font-mono text-xs"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
    actions = menu(
      <>
        {nullItem}
        {defaultItem}
        {(nullItem || defaultItem) && <DropdownMenuSeparator />}
        <DropdownMenuItem icon={<Maximize2 />} onSelect={onExpand}>
          Expand editor
        </DropdownMenuItem>
      </>,
    );
  } else {
    control = (
      <Input
        id={id}
        className="font-mono text-xs"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
    if (isDate)
      actions = menu(
        <>
          {nullItem}
          <DropdownMenuItem onSelect={() => onChange(nowFor(kind))}>
            Set to now
          </DropdownMenuItem>
        </>,
      );
    else if (c.nullable || canDefault)
      actions = menu(
        <>
          {nullItem}
          {defaultItem}
        </>,
      );
  }

  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-4">
      <label htmlFor={id} className="flex min-w-0 flex-col gap-0.5 pt-1">
        <span className="flex items-center gap-1.5 truncate font-mono text-[13px] text-fg">
          {c.isPrimaryKey && (
            <Key className="size-3 shrink-0 rotate-45 text-key-primary" />
          )}
          {c.name}
        </span>
        <span className="truncate font-mono text-[11px] text-fg-subtle">
          {shortType(c.dataType)}
        </span>
      </label>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">{control}</div>
          {actions}
        </div>
        {reference && (
          <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
            <ArrowRight className="size-3" />
            <span className="font-mono">
              {reference.schema}.{reference.table}.{reference.column}
            </span>
          </span>
        )}
        {c.comment && (
          <span className="text-xs text-fg-subtle">{c.comment}</span>
        )}
      </div>
    </div>
  );
}

/** A set of fields under a small heading. */
export function FieldGroup({
  title,
  hint,
  children,
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      {title && (
        <div className="flex items-baseline gap-2">
          <h3 className="text-[11px] font-medium tracking-wider text-fg-subtle uppercase">
            {title}
          </h3>
          {hint && <p className="text-xs text-fg-subtle/80">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function FieldMenu({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Field options"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg data-[state=open]:bg-surface-hover data-[state=open]:text-fg"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
