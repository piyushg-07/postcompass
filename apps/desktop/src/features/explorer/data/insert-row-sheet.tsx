import {
  Button,
  cn,
  Dialog,
  DialogClose,
  Input,
  Select,
  SheetContent,
  toast,
} from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, KeyRound, TextSearch } from "lucide-react";
import { useState } from "react";
import type { ColumnInfo, ColumnValue, RowChange } from "../../../lib/bindings";
import { commands, describeError, unwrap } from "../../../lib/ipc";
import { queryKeys } from "../../../lib/query";
import { useExplorer } from "../explorer-context";
import { RecordPicker, type Reference } from "./reference";

/** The row being edited: its current values and the key that identifies it. */
export interface EditTarget {
  values: (string | null)[];
  key: ColumnValue[];
}

/** Columns the database fills in by itself, so the form leaves them alone. */
function autoValue(c: ColumnInfo): string | null {
  if (c.generated) return `Generated: ${c.generated}`;
  if (c.identity === "always") return "Generated automatically (identity)";
  return null;
}

function insertHint(c: ColumnInfo) {
  if (c.identity === "by_default")
    return "Leave empty to generate automatically";
  if (c.default) return `Leave empty for the default: ${c.default}`;
  if (!c.nullable) return "Required";
  return "Leave empty for NULL";
}

/**
 * Row side panel, like Supabase's: one field per column. Inserts a new row, or edits `row`
 * (only changed fields are written). Saves right away.
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: string;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  /** Present when editing. */
  row?: EditTarget | null;
  /** Foreign keys by column name; those fields get a record picker. */
  references?: Record<string, Reference>;
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
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

/** `undefined` = not set (insert: use the default), `null` = NULL, string = value. */
type Value = string | null | undefined;

function RowForm({
  database,
  schema,
  table,
  columns,
  row,
  references,
  onDone,
}: {
  database: string;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  row: EditTarget | null;
  references: Record<string, Reference>;
  onDone: () => void;
}) {
  const [picking, setPicking] = useState<number | null>(null);
  const { connectionId } = useExplorer();
  const queryClient = useQueryClient();
  const editing = row !== null;
  const [values, setValues] = useState<Value[]>(() =>
    columns.map((_, i) => (row ? row.values[i] : undefined)),
  );
  const set = (index: number, value: Value) =>
    setValues((v) => v.map((x, i) => (i === index ? value : x)));

  const change = (): RowChange | null => {
    if (row) {
      const changed = columns
        .map((c, i) => ({
          column: c.name,
          value: values[i] ?? null,
          before: row.values[i],
        }))
        .filter((x, i) => !autoValue(columns[i]!) && x.value !== x.before)
        .map(({ column, value }) => ({ column, value }));
      return changed.length
        ? { type: "update", key: row.key, values: changed }
        : null;
    }
    // Unset fields are left out, so the database applies the default (or NULL)
    return {
      type: "insert",
      values: columns
        .map((c, i) => ({ column: c.name, value: values[i] }))
        .filter(
          (x, i): x is ColumnValue =>
            !autoValue(columns[i]!) && x.value !== undefined && x.value !== "",
        ),
    };
  };

  const save = useMutation({
    mutationFn: async () => {
      const c = change();
      if (!c) return null;
      return unwrap(
        commands.applyChanges(connectionId, database, schema, table, [c]),
      );
    },
    onSuccess: (result) => {
      if (result) {
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
      onDone();
    },
  });

  return (
    <SheetContent
      title={
        <>
          {editing ? "Edit row in " : "Add new row to "}
          <span className="font-mono">{table}</span>
        </>
      }
      description={
        editing
          ? "Only the fields you change are saved."
          : "Empty fields use the column's default value, or NULL."
      }
      className="w-[580px]"
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="primary"
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col divide-y divide-border"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {columns.map((c, i) => {
          const auto = autoValue(c);
          const value = values[i];
          const id = `row-${c.name}`;
          const isBool = c.dataType === "boolean";
          const isLong =
            /json|text|xml/.test(c.dataType) && (value?.length ?? 0) > 60;
          const changed = editing && value !== row.values[i];
          return (
            <div
              key={c.name}
              className="grid grid-cols-[170px_1fr] gap-4 py-3 first:pt-0"
            >
              <label
                htmlFor={id}
                className="flex min-w-0 flex-col gap-0.5 pt-1.5"
              >
                <span className="flex items-center gap-1.5 truncate font-mono text-xs text-fg">
                  {c.isPrimaryKey && (
                    <KeyRound className="size-3 shrink-0 text-warning" />
                  )}
                  {c.name}
                  {changed && (
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-warning"
                      title="Changed"
                    />
                  )}
                </span>
                <span className="truncate font-mono text-[11px] text-fg-subtle">
                  {c.dataType}
                </span>
              </label>
              <div className="flex min-w-0 flex-col gap-1">
                {auto ? (
                  <Input
                    id={id}
                    disabled
                    className="font-mono text-xs"
                    placeholder={editing ? (value ?? "NULL") : auto}
                  />
                ) : (
                  <div className="flex items-start gap-1.5">
                    {isBool ? (
                      <Select
                        id={id}
                        className="flex-1"
                        value={value ?? ""}
                        onValueChange={(v) => set(i, v)}
                        placeholder={
                          value === null
                            ? "NULL"
                            : c.default
                              ? `Default (${c.default})`
                              : "Choose…"
                        }
                        options={[
                          { value: "true", label: "true" },
                          { value: "false", label: "false" },
                        ]}
                      />
                    ) : isLong ? (
                      <textarea
                        id={id}
                        rows={4}
                        className="min-h-20 w-full flex-1 resize-y rounded-control border border-border-strong bg-bg px-2.5 py-1.5 font-mono text-xs text-fg outline-none focus-visible:border-accent"
                        value={value ?? ""}
                        onChange={(e) => set(i, e.target.value)}
                      />
                    ) : (
                      <Input
                        id={id}
                        autoFocus={
                          i === columns.findIndex((x) => !autoValue(x))
                        }
                        className={cn(
                          "flex-1 font-mono text-xs",
                          value === null && "placeholder:italic",
                        )}
                        placeholder={
                          value === null
                            ? "NULL"
                            : (c.default ?? (c.nullable ? "NULL" : ""))
                        }
                        value={value ?? ""}
                        onChange={(e) => set(i, e.target.value)}
                      />
                    )}
                    {references[c.name] && (
                      <button
                        type="button"
                        title={`Select a record from ${references[c.name]!.table}`}
                        onClick={() => setPicking(i)}
                        className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-control border border-border px-2 text-[11px] text-fg-muted hover:border-fg-subtle hover:text-fg"
                      >
                        <TextSearch className="size-3.5" />
                        Select record
                      </button>
                    )}
                    {c.nullable && (
                      <button
                        type="button"
                        title="Set to NULL"
                        onClick={() => set(i, null)}
                        className={cn(
                          "h-8 shrink-0 cursor-pointer rounded-control border px-2 font-mono text-[10px]",
                          value === null
                            ? "border-accent/40 bg-accent/10 text-accent"
                            : "border-border text-fg-subtle hover:border-fg-subtle hover:text-fg",
                        )}
                      >
                        NULL
                      </button>
                    )}
                  </div>
                )}
                {references[c.name] && (
                  <span className="text-[11px] text-fg-subtle">
                    References{" "}
                    <span className="font-mono">
                      {references[c.name]!.table}.{references[c.name]!.column}
                    </span>
                  </span>
                )}
                {!auto && !editing && (
                  <span className="text-[11px] text-fg-subtle">
                    {insertHint(c)}
                  </span>
                )}
                {c.comment && (
                  <span className="text-[11px] text-fg-muted">{c.comment}</span>
                )}
              </div>
            </div>
          );
        })}
        {save.isError && (
          <div className="mt-3 flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5 text-xs">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
            <span className="text-fg">{describeError(save.error).message}</span>
          </div>
        )}
        <button type="submit" hidden />
      </form>
      {picking !== null && references[columns[picking]!.name] && (
        <RecordPicker
          database={database}
          reference={references[columns[picking]!.name]!}
          open
          onOpenChange={(o) => !o && setPicking(null)}
          onPick={(v) => set(picking, v)}
        />
      )}
    </SheetContent>
  );
}
