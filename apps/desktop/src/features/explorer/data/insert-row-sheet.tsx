import {
  Button,
  Dialog,
  DialogClose,
  Kbd,
  SheetContent,
  Switch,
  toast,
} from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import type { ColumnInfo, RowChange } from "../../../lib/bindings";
import { commands, describeError, unwrap } from "../../../lib/ipc";
import { baseTypeName, typeKind } from "../../../lib/pg-types";
import { queryKeys } from "../../../lib/query";
import { useExplorer } from "../explorer-context";
import { ExpandEditor } from "./cell-editors";
import { RecordPicker, type Reference } from "./reference";
import { FieldGroup, FieldRow } from "./row-sheet/field-row";
import { type EditTarget, rowChange, type Value } from "./row-sheet/row-change";

export type { EditTarget } from "./row-sheet/row-change";

const NO_REFERENCES: Record<string, Reference> = {};
const NO_ENUMS: ReadonlyMap<string, string[]> = new Map();

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
  references = NO_REFERENCES,
  enums = NO_ENUMS,
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

  const kinds = useMemo(() => {
    const enumNames = new Set(enums.keys());
    return columns.map((c) => typeKind(c.dataType, enumNames));
  }, [columns, enums]);

  const save = useMutation({
    mutationFn: async () => {
      const c = rowChange(columns, kinds, values, row);
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
  // Ctrl+Enter, Enter and the button can all fire while a save is running; one insert is enough
  const submit = () => {
    if (!save.isPending) save.mutate();
  };

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
            onClick={submit}
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
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
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
