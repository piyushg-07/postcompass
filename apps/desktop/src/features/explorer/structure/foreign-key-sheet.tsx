import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogClose,
  Field,
  IconButton,
  Select,
  SheetContent,
} from "@repo/ui";
import { AlertTriangle, ArrowRight, Plus, X } from "lucide-react";
import { useState } from "react";
import { describeError } from "../../../lib/ipc";
import { useSchemas, useStructure, useTables } from "../explorer-context";
import { SqlBlock } from "../sql/sql-editor";
import {
  type ForeignKeyDraft,
  type ForeignKeyEntry,
  foreignKeyStatus,
} from "./foreign-key-sql";

export {
  foreignKeyClause,
  type ForeignKeyDraft,
  type ForeignKeyEntry,
  foreignKeyEntry,
  type ForeignKeyStatus,
  foreignKeyStatements,
  foreignKeyStatus,
  removeForeignKey,
  saveForeignKey,
  undoRemoveForeignKey,
} from "./foreign-key-sql";

/** One foreign key in a list, like Supabase's: where it points, with Edit and Remove. */
export function ForeignKeyRow({
  fk,
  onEdit,
  onRemove,
  onUndoRemove,
}: {
  fk: ForeignKeyEntry;
  onEdit: () => void;
  onRemove: () => void;
  onUndoRemove: () => void;
}) {
  const status = foreignKeyStatus(fk);
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-control border border-border-strong px-4 py-3",
        status === "REMOVE" && "opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {fk.name && (
          <p className="truncate font-mono text-xs text-fg">{fk.name}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          {status && (
            <Badge
              className={cn(
                status === "ADD" && "border-accent/40 text-accent",
                status === "UPDATE" && "border-warning/40 text-warning",
                status === "REMOVE" && "border-danger/40 text-danger",
              )}
            >
              {status}
            </Badge>
          )}
          {fk.pairs.length > 1 ? "Composite foreign" : "Foreign"} key relation
          to:
          <span className="font-mono text-fg">
            {fk.schema}.{fk.table}
          </span>
        </div>
        {fk.pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-2 font-mono text-xs">
            <span className={p.column ? "text-fg" : "text-fg-subtle"}>
              {p.column || "[column_name]"}
            </span>
            <ArrowRight className="size-3.5 text-fg-subtle" />
            <span className="text-fg">
              {fk.schema}.{fk.table}.{p.refColumn}
            </span>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        {fk.toRemove ? (
          <Button size="sm" variant="secondary" onClick={onUndoRemove}>
            Cancel remove
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

const ACTIONS = [
  {
    value: "NO ACTION",
    label: "No action",
    hint: "error if rows still point to it",
  },
  {
    value: "CASCADE",
    label: "Cascade",
    hint: "apply the change to these rows",
  },
  {
    value: "RESTRICT",
    label: "Restrict",
    hint: "block it, checked immediately",
  },
  { value: "SET NULL", label: "Set NULL", hint: "clear these columns" },
  { value: "SET DEFAULT", label: "Set default", hint: "reset these columns" },
];

/**
 * "Add foreign key relationship", like Supabase's: pick the schema and table to point to, match
 * columns, and choose what happens when the referenced row changes.
 */
export function ForeignKeySheet({
  open,
  onOpenChange,
  database,
  schema,
  table,
  columns,
  fixedColumn,
  initial,
  saveLabel,
  preview,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: string;
  /** Schema of the table getting the foreign key (the default to point into). */
  schema: string;
  /** Name shown in the title. */
  table: string;
  /** This table's columns to choose from. */
  columns: string[];
  /** Only this column can point elsewhere (the column panel). */
  fixedColumn?: string;
  initial?: ForeignKeyDraft;
  /** Defaults to "Save". */
  saveLabel?: string;
  /** The SQL the save will run, shown under the form once it's complete. */
  preview?: (fk: ForeignKeyDraft) => string;
  /** May return a promise (running the SQL); the panel stays open with the error if it fails. */
  onSave: (fk: ForeignKeyDraft) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <ForeignKeyForm
          database={database}
          schema={schema}
          table={table}
          columns={columns}
          fixedColumn={fixedColumn}
          initial={initial}
          saveLabel={saveLabel}
          preview={preview}
          onSave={async (fk) => {
            await onSave(fk);
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}

function ForeignKeyForm({
  database,
  schema,
  table,
  columns,
  fixedColumn,
  initial,
  saveLabel = "Save",
  preview,
  onSave,
}: {
  database: string;
  schema: string;
  table: string;
  columns: string[];
  fixedColumn?: string;
  initial?: ForeignKeyDraft;
  saveLabel?: string;
  preview?: (fk: ForeignKeyDraft) => string;
  onSave: (fk: ForeignKeyDraft) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [draft, setDraft] = useState<ForeignKeyDraft>(
    initial ?? {
      schema,
      table: "",
      pairs: [{ column: fixedColumn ?? "", refColumn: "" }],
      onUpdate: "NO ACTION",
      onDelete: "NO ACTION",
    },
  );
  const schemas = useSchemas(database);
  const tables = useTables(database, draft.schema);
  const patch = (p: Partial<ForeignKeyDraft>) =>
    setDraft((d) => ({ ...d, ...p }));
  const setPair = (i: number, p: Partial<ForeignKeyDraft["pairs"][number]>) =>
    setDraft((d) => ({
      ...d,
      pairs: d.pairs.map((x, j) => (j === i ? { ...x, ...p } : x)),
    }));
  const valid =
    draft.table !== "" && draft.pairs.every((p) => p.column && p.refColumn);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (e) {
      setError(e);
      setSaving(false);
    }
  };

  return (
    <SheetContent
      title={
        <>
          {initial?.table ? "Update" : "Add"} foreign key relationship to{" "}
          <span className="font-mono">{table || "new table"}</span>
        </>
      }
      description="Links a column here to rows in another table, so it can only hold values that exist there."
      className="w-[560px]"
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="primary"
            disabled={!valid}
            loading={saving}
            onClick={() => void save()}
          >
            {saveLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Select a schema">
          {(p) => (
            <Select
              {...p}
              mono
              value={draft.schema}
              onValueChange={(s) =>
                patch({
                  schema: s,
                  table: "",
                  pairs: draft.pairs.map((x) => ({ ...x, refColumn: "" })),
                })
              }
              options={(schemas.data ?? [])
                .filter((s) => !s.isSystem)
                .map((s) => ({ value: s.name, label: s.name }))}
            />
          )}
        </Field>
        <Field label="Select a table to reference to">
          {(p) => (
            <Select
              {...p}
              mono
              value={draft.table}
              placeholder="Choose a table…"
              onValueChange={(t) =>
                patch({
                  table: t,
                  pairs: draft.pairs.map((x) => ({ ...x, refColumn: "" })),
                })
              }
              options={(tables.data ?? [])
                .filter(
                  (t) => t.kind === "table" || t.kind === "partitioned_table",
                )
                .map((t) => ({ value: t.name, label: t.name }))}
            />
          )}
        </Field>

        {draft.table && (
          <ColumnPairs
            database={database}
            draft={draft}
            columns={columns}
            fixedColumn={fixedColumn}
            onPair={setPair}
            onAdd={() =>
              patch({ pairs: [...draft.pairs, { column: "", refColumn: "" }] })
            }
            onRemove={(i) =>
              patch({ pairs: draft.pairs.filter((_, j) => j !== i) })
            }
          />
        )}

        <Field label="Action if referenced row is updated">
          {(p) => (
            <Select
              {...p}
              value={draft.onUpdate}
              onValueChange={(v) => patch({ onUpdate: v })}
              options={ACTIONS}
            />
          )}
        </Field>
        <Field label="Action if referenced row is removed">
          {(p) => (
            <Select
              {...p}
              value={draft.onDelete}
              onValueChange={(v) => patch({ onDelete: v })}
              options={ACTIONS}
            />
          )}
        </Field>

        {error !== null && (
          <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5 text-xs">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
            <span className="break-words text-fg">
              {describeError(error).message}
            </span>
          </div>
        )}
        {preview && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-fg-muted">
              SQL preview
            </span>
            {valid ? (
              <SqlBlock sql={preview(draft)} className="max-h-48" />
            ) : (
              <p className="rounded-control border border-dashed border-border px-3 py-2.5 text-xs text-fg-subtle">
                Pick a table and match the columns to see the SQL.
              </p>
            )}
          </div>
        )}
      </div>
    </SheetContent>
  );
}

function ColumnPairs({
  database,
  draft,
  columns,
  fixedColumn,
  onPair,
  onAdd,
  onRemove,
}: {
  database: string;
  draft: ForeignKeyDraft;
  columns: string[];
  fixedColumn?: string;
  onPair: (i: number, p: { column?: string; refColumn?: string }) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  const target = useStructure(database, draft.schema, draft.table);
  const refColumns = (target.data?.columns ?? []).map((c) => ({
    value: c.name,
    label: c.name,
    hint: c.isPrimaryKey ? "primary key" : undefined,
  }));
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_16px_1fr_28px] items-center gap-2 text-xs text-fg-muted">
        <span>This table</span>
        <span />
        <span className="font-mono">{draft.table}</span>
        <span />
      </div>
      {draft.pairs.map((pair, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_16px_1fr_28px] items-center gap-2"
        >
          <Select
            mono
            aria-label="Column"
            value={pair.column}
            placeholder="Column…"
            disabled={fixedColumn !== undefined}
            onValueChange={(v) => onPair(i, { column: v })}
            options={(fixedColumn ? [fixedColumn] : columns)
              .filter(Boolean)
              .map((c) => ({ value: c, label: c }))}
          />
          <ArrowRight className="size-3.5 text-fg-subtle" />
          <Select
            mono
            aria-label="Referenced column"
            value={pair.refColumn}
            placeholder={target.isPending ? "Loading…" : "Column…"}
            onValueChange={(v) => onPair(i, { refColumn: v })}
            options={refColumns}
          />
          {draft.pairs.length > 1 ? (
            <IconButton
              size="sm"
              label="Remove"
              icon={<X />}
              onClick={() => onRemove(i)}
            />
          ) : (
            <span />
          )}
        </div>
      ))}
      {fixedColumn === undefined && (
        <Button
          size="sm"
          variant="secondary"
          iconLeft={<Plus />}
          className="w-fit"
          onClick={onAdd}
        >
          Add another column
        </Button>
      )}
    </div>
  );
}
