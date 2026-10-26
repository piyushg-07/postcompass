import {
  Button,
  Checkbox,
  cn,
  Dialog,
  DialogClose,
  Field,
  Input,
  Select,
  SheetContent,
  Switch,
  toast,
} from "@repo/ui";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { TableStructure } from "../../../lib/bindings";
import { describeError } from "../../../lib/ipc";
import {
  createIndex,
  ident,
  qualified,
  suggestIdentifier,
} from "../../../lib/sql";
import { useRunSql } from "../explorer-context";
import { SqlBlock } from "../sql/sql-editor";
import {
  type ForeignKeyDraft,
  ForeignKeySheet,
  foreignKeyClause,
} from "./foreign-key-sheet";

const METHODS = [
  {
    value: "btree",
    label: "B-tree",
    hint: "default · equality, ranges, sorting",
  },
  { value: "hash", label: "Hash", hint: "equality only" },
  { value: "gin", label: "GIN", hint: "arrays, JSONB, full-text" },
  { value: "gist", label: "GiST", hint: "geometry, ranges" },
  { value: "brin", label: "BRIN", hint: "huge, naturally ordered tables" },
];

/** Ordered column picker: click to add/remove; order is the click order. */
function ColumnPicker({
  columns,
  value,
  onChange,
}: {
  columns: { name: string; type: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="flex max-h-64 flex-col overflow-y-auto rounded-control border border-border-strong bg-bg p-1">
      {columns.map((c) => {
        const position = value.indexOf(c.name);
        return (
          <label
            key={c.name}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-surface-hover",
              position >= 0 && "bg-surface-hover/60",
            )}
          >
            <Checkbox
              checked={position >= 0}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...value, c.name]
                    : value.filter((x) => x !== c.name),
                )
              }
            />
            <span className="flex-1 truncate font-mono text-xs text-fg">
              {c.name}
            </span>
            <span className="truncate font-mono text-[11px] text-fg-subtle">
              {c.type}
            </span>
            <span className="flex w-5 justify-end">
              {position >= 0 && value.length > 1 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-accent-fg">
                  {position + 1}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** "Add index" side panel: columns in order, the index type, unique, and the SQL it will run. */
export function IndexDialog({
  open,
  onOpenChange,
  database,
  structure,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: string;
  structure: TableStructure;
}) {
  const run = useRunSql();
  const [columns, setColumns] = useState<string[]>([]);
  const [unique, setUnique] = useState(false);
  const [method, setMethod] = useState("btree");
  const [name, setName] = useState("");
  // Only B-tree indexes can be unique; Postgres rejects UNIQUE for the other methods
  const canUnique = method === "btree";
  const isUnique = unique && canUnique;
  const suggested = suggestIdentifier(
    `${structure.name}_${columns.join("_") || "col"}_${isUnique ? "key" : "idx"}`,
  ).slice(0, 63);
  const finalName = name.trim() || suggested;
  const sql = columns.length
    ? createIndex(
        structure.schema,
        structure.name,
        finalName,
        columns,
        isUnique,
        method,
      )
    : null;

  const submit = () => {
    if (!sql || run.isPending) return;
    run.mutate(
      { sql, database },
      {
        onSuccess: () => {
          toast.success(`Index ${finalName} created`);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={
          <>
            Add index to <span className="font-mono">{structure.name}</span>
          </>
        }
        description="Makes filtering, joining and sorting on these columns faster."
        className="w-[560px]"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="primary"
              disabled={!sql}
              loading={run.isPending}
              onClick={submit}
            >
              Create index
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <Field
            label="Columns"
            hint="Pick them in the order your queries filter by"
          >
            {() => (
              <div className="flex flex-col gap-2">
                <ColumnPicker
                  columns={structure.columns.map((c) => ({
                    name: c.name,
                    type: c.dataType,
                  }))}
                  value={columns}
                  onChange={setColumns}
                />
                {columns.length > 1 && (
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-fg-subtle">
                    Order:
                    {columns.map((c, i) => (
                      <span key={c} className="flex items-center gap-1.5">
                        {i > 0 && <ArrowRight className="size-3" />}
                        <span className="font-mono text-fg-muted">{c}</span>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            )}
          </Field>

          <Field label="Index type">
            {(p) => (
              <Select
                {...p}
                value={method}
                onValueChange={setMethod}
                options={METHODS}
              />
            )}
          </Field>

          {canUnique && (
            <ToggleRow
              title="Unique"
              description="Reject rows that repeat these values"
              checked={unique}
              onChange={setUnique}
            />
          )}

          <Field label="Name" hint="Optional">
            {(p) => (
              <Input
                {...p}
                className="font-mono"
                placeholder={suggested}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>

          <SqlPreview sql={sql} error={run.isError ? run.error : null} />
        </div>
      </SheetContent>
    </Dialog>
  );
}

/** "Add foreign key" side panel on the structure page: runs the change when saved. */
export function ForeignKeyDialog({
  open,
  onOpenChange,
  database,
  structure,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: string;
  structure: TableStructure;
}) {
  const run = useRunSql();
  const nameFor = (fk: ForeignKeyDraft) =>
    suggestIdentifier(
      `${structure.name}_${fk.pairs.map((p) => p.column).join("_")}_fkey`,
    ).slice(0, 63);
  const sqlFor = (fk: ForeignKeyDraft) =>
    `ALTER TABLE ${qualified(structure.schema, structure.name)}
  ADD CONSTRAINT ${ident(nameFor(fk))}
  ${foreignKeyClause(fk)};`;

  return (
    <ForeignKeySheet
      open={open}
      onOpenChange={onOpenChange}
      database={database}
      schema={structure.schema}
      table={structure.name}
      columns={structure.columns.map((c) => c.name)}
      saveLabel="Add foreign key"
      preview={sqlFor}
      onSave={async (fk) => {
        await run.mutateAsync({ sql: sqlFor(fk), database });
        toast.success(`Foreign key ${nameFor(fk)} added`);
      }}
    />
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-control border border-border-strong px-3 py-2.5">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-fg">{title}</span>
        <span className="text-xs text-fg-subtle">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/** The statement a side panel will run, and the error if running it failed. */
export function SqlPreview({
  sql,
  error,
  empty = "Pick at least one column to see the SQL.",
}: {
  sql: string | null;
  error: unknown;
  empty?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {error !== null && error !== undefined && (
        <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
          <span className="break-words text-fg">
            {describeError(error).message}
          </span>
        </div>
      )}
      <span className="text-xs font-medium text-fg-muted">SQL preview</span>
      {sql ? (
        <SqlBlock sql={sql} className="max-h-48" />
      ) : (
        <p className="rounded-control border border-dashed border-border px-3 py-2.5 text-xs text-fg-subtle">
          {empty}
        </p>
      )}
    </div>
  );
}
