import {
  Button,
  Dialog,
  DialogClose,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Kbd,
  Select,
  SheetContent,
  Switch,
  toast,
} from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Key,
  Maximize2,
  MoreHorizontal,
  Search,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type { ColumnInfo, ColumnValue, RowChange } from "../../../lib/bindings";
import { commands, describeError, unwrap } from "../../../lib/ipc";
import {
  baseTypeName,
  dateFormat,
  nowFor,
  shortType,
  type TypeKind,
  typeKind,
} from "../../../lib/pg-types";
import { queryKeys } from "../../../lib/query";
import { useExplorer } from "../explorer-context";
import { ExpandEditor } from "./cell-editors";
import { RecordPicker, type Reference } from "./reference";

/** The row being edited: its current values and the key that identifies it. */
export interface EditTarget {
  values: (string | null)[];
  key: ColumnValue[];
}

/**
 * Row side panel, like Supabase's: required fields first, then the optional ones. Inserts a
 * new row, or updates `row` (only changed fields are written).
 */
export function RowSheet({
  open,
  onOpenChange,
  database,
  schema,
  table,
  columns,
  row,
  references = {},
  enums = new Map(),
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: string;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  /** Present when editing. */
  row?: EditTarget | null;
  /** Foreign keys by column name; those fields can pick a record. */
  references?: Record<string, Reference>;
  /** Enum values by type name. */
  enums?: ReadonlyMap<string, string[]>;
  /** Called with each change once it's saved (for undo). */
  onApplied?: (change: RowChange) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <RowForm
          database={database}
          schema={schema}
          table={table}
          columns={columns}
          row={row ?? null}
          references={references}
          enums={enums}
          onApplied={onApplied}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

/** `undefined` = not set (insert: use the default), `null` = NULL, string = value. */
type Value = string | null | undefined;

const LONG_TEXT = new Set([
  "text",
  "varchar",
  "bpchar",
  "char",
  "citext",
  "xml",
]);

function RowForm({
  database,
  schema,
  table,
  columns,
  row,
  references,
  enums,
  onApplied,
  onDone,
}: {
  database: string;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  row: EditTarget | null;
  references: Record<string, Reference>;
  enums: ReadonlyMap<string, string[]>;
  onApplied?: (change: RowChange) => void;
  onDone: () => void;
}) {
  const { connectionId } = useExplorer();
  const queryClient = useQueryClient();
  const editing = row !== null;
  const blank = () => columns.map((_, i) => (row ? row.values[i] : undefined));
  const [values, setValues] = useState<Value[]>(blank);
  const [createMore, setCreateMore] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const [expand, setExpand] = useState<{ index: number; json: boolean } | null>(
    null,
  );
  const set = (index: number, value: Value) =>
    setValues((v) => v.map((x, i) => (i === index ? value : x)));

  const enumNames = new Set(enums.keys());
  const kinds = columns.map((c) => typeKind(c.dataType, enumNames));
  const isText = (i: number) =>
    kinds[i] === "text" || kinds[i] === "array" || kinds[i] === "json";
  /** Generated columns aren't part of the form, and identity ALWAYS ones can't be written. */
  const writable = (c: ColumnInfo) => !c.generated && c.identity !== "always";

  // Non-text fields left empty mean "not set" (insert) or NULL (update)
  const normalized = (i: number): Value => {
    const v = values[i];
    if (v === "" && !isText(i)) return editing ? null : undefined;
    return v;
  };

  const change = (): RowChange | null => {
    if (row) {
      const changed = columns
        .map((c, i) => ({ c, i, value: normalized(i) ?? null }))
        .filter(({ c, i, value }) => writable(c) && value !== row.values[i])
        .map(({ c, value }) => ({ column: c.name, value }));
      return changed.length
        ? { type: "update", key: row.key, values: changed }
        : null;
    }
    // Unset fields are left out, so the database applies the default (or NULL)
    return {
      type: "insert",
      values: columns
        .map((c, i) => ({ column: c.name, value: normalized(i) }))
        .filter(
          (x, i): x is ColumnValue =>
            writable(columns[i]!) && x.value !== undefined,
        ),
    };
  };

  const save = useMutation({
    mutationFn: async () => {
      const c = change();
      if (!c) return null;
      await unwrap(
        commands.applyChanges(connectionId, database, schema, table, [c]),
      );
      return c;
    },
    onSuccess: (result) => {
      if (result) {
        onApplied?.(result);
        toast.success(
          editing ? `Row updated in ${table}` : `Row added to ${table}`,
        );
        void queryClient.invalidateQueries({
          queryKey: queryKeys.explorer.table(
            connectionId,
            database,
            schema,
            table,
          ),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.explorer.tables(connectionId, database, schema),
        });
      }
      if (createMore && !editing) setValues(blank());
      else onDone();
    },
  });

  const fields = columns
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.generated);
  const required = fields.filter(
    ({ c }) => !c.nullable && c.default === null && c.identity === null,
  );
  const optional = fields.filter((f) => !required.includes(f));

  const field = ({ c, i }: { c: ColumnInfo; i: number }) => (
    <FieldRow
      key={c.name}
      column={c}
      kind={kinds[i]!}
      value={values[i]}
      editing={editing}
      reference={references[c.name]}
      enumValues={enums.get(baseTypeName(c.dataType))}
      onChange={(v) => set(i, v)}
      onPick={() => setPicking(i)}
      onExpand={() => setExpand({ index: i, json: kinds[i] === "json" })}
    />
  );

  return (
    <SheetContent
      title={
        <>
          {editing ? "Update row from " : "Add new row to "}
          <span className="font-mono">{table}</span>
        </>
      }
      description={
        editing
          ? "Only the fields you change are saved."
          : "Fields you leave empty get the column's default, or NULL."
      }
      className="w-[640px]"
      footer={
        <>
          {!editing && (
            <label className="mr-auto flex cursor-pointer items-center gap-2 text-xs text-fg-muted">
              <Switch checked={createMore} onCheckedChange={setCreateMore} />
              Create more
            </label>
          )}
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="primary"
            loading={save.isPending}
            iconRight={
              <Kbd className="border-0 bg-black/15 text-current">⌃↵</Kbd>
            }
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            save.mutate();
          }
        }}
      >
        {required.length > 0 && (
          <FieldGroup
            title="Required"
            hint={optional.length > 0 ? "These need a value." : undefined}
          >
            {required.map(field)}
          </FieldGroup>
        )}
        {optional.length > 0 && (
          <FieldGroup
            title={required.length > 0 ? "Optional" : undefined}
            hint={
              required.length > 0
                ? "Can be left empty; they use their default or NULL."
                : undefined
            }
          >
            {optional.map(field)}
          </FieldGroup>
        )}
        {save.isError && (
          <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5 text-xs">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
            <span className="text-fg">{describeError(save.error).message}</span>
          </div>
        )}
      </form>

      <RecordPicker
        database={database}
        open={picking !== null}
        reference={
          picking !== null ? (references[columns[picking]!.name] ?? null) : null
        }
        nullable={picking !== null && columns[picking]!.nullable}
        onOpenChange={(o) => !o && setPicking(null)}
        onPick={(v) => picking !== null && set(picking, v)}
      />
      <ExpandEditor
        target={
          expand
            ? {
                column: columns[expand.index]!.name,
                json: expand.json,
                text: values[expand.index] ?? "",
              }
            : null
        }
        onClose={() => setExpand(null)}
        onSave={(v) => expand && set(expand.index, v)}
      />
    </SheetContent>
  );
}

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
function FieldRow({
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
            <Key className="size-3 shrink-0 rotate-45 text-accent" />
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
function FieldGroup({
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
