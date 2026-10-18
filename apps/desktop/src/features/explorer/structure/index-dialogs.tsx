import { Checkbox, Field, Input, Select, Switch } from "@repo/ui";
import { useState } from "react";
import type { TableStructure } from "../../../lib/bindings";
import { addForeignKey, createIndex, suggestIdentifier } from "../../../lib/sql";
import { useStructure, useTables } from "../explorer-context";
import { RunSqlDialog } from "../run-sql-dialog";

const METHODS = ["btree", "hash", "gin", "gist", "brin"];

/** Ordered column picker: click to add/remove; order is the click order. */
function ColumnPicker({
  columns,
  value,
  onChange,
}: {
  columns: string[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="flex max-h-44 flex-col overflow-y-auto rounded-control border border-border-strong bg-bg p-1">
      {columns.map((c) => {
        const position = value.indexOf(c);
        return (
          <label key={c} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-surface-hover">
            <Checkbox
              checked={position >= 0}
              onCheckedChange={(checked) => onChange(checked ? [...value, c] : value.filter((x) => x !== c))}
            />
            <span className="flex-1 font-mono text-xs">{c}</span>
            {position >= 0 && value.length > 1 && <span className="text-[10px] text-fg-subtle">#{position + 1}</span>}
          </label>
        );
      })}
    </div>
  );
}

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
  const [columns, setColumns] = useState<string[]>([]);
  const [unique, setUnique] = useState(false);
  const [method, setMethod] = useState("btree");
  const [name, setName] = useState("");
  const suggested = suggestIdentifier(`${structure.name}_${columns.join("_")}_${unique ? "key" : "idx"}`).slice(0, 63);
  const finalName = name.trim() || suggested;
  const sql = columns.length ? createIndex(structure.schema, structure.name, finalName, columns, unique, method) : "-- pick at least one column";

  return (
    <RunSqlDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setColumns([]);
          setName("");
          setUnique(false);
        }
        onOpenChange(next);
      }}
      title="Add index"
      sql={sql}
      database={database}
      confirmLabel="Create index"
      successMessage={`Index ${finalName} created`}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Columns">
          {() => <ColumnPicker columns={structure.columns.map((c) => c.name)} value={columns} onChange={setColumns} />}
        </Field>
        <div className="flex flex-col gap-3">
          <Field label="Name">
            {(p) => (
              <Input {...p} className="font-mono" placeholder={suggested} value={name} onChange={(e) => setName(e.target.value)} />
            )}
          </Field>
          <Field label="Method">
            {(p) => (
              <Select
                {...p}
                mono
                value={method}
                onValueChange={setMethod}
                options={METHODS.map((m) => ({ value: m, label: m }))}
              />
            )}
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={unique} onCheckedChange={setUnique} />
            Unique
          </label>
        </div>
      </div>
    </RunSqlDialog>
  );
}

const ACTIONS = ["NO ACTION", "CASCADE", "SET NULL", "RESTRICT", "SET DEFAULT"];

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
  const tables = useTables(database, structure.schema);
  const [columns, setColumns] = useState<string[]>([]);
  const [refTable, setRefTable] = useState("");
  const [refColumns, setRefColumns] = useState<string[]>([]);
  const [onDelete, setOnDelete] = useState("NO ACTION");
  const target = useStructure(database, structure.schema, refTable || structure.name);
  const refOptions = refTable && target.data ? target.data.columns.map((c) => c.name) : [];

  const name = suggestIdentifier(`${structure.name}_${columns.join("_")}_fkey`).slice(0, 63);
  const ready = columns.length > 0 && refTable && refColumns.length === columns.length;
  const sql = ready
    ? addForeignKey(structure.schema, structure.name, name, columns, structure.schema, refTable, refColumns, onDelete)
    : "-- pick columns, a table, and the same number of referenced columns";

  return (
    <RunSqlDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add foreign key"
      sql={sql}
      database={database}
      confirmLabel="Add foreign key"
      successMessage={`Foreign key ${name} added`}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Columns">
          {() => <ColumnPicker columns={structure.columns.map((c) => c.name)} value={columns} onChange={setColumns} />}
        </Field>
        <div className="flex flex-col gap-3">
          <Field label="References table">
            {(p) => (
              <Select
                {...p}
                mono
                placeholder="Choose a table…"
                value={refTable}
                onValueChange={(table) => {
                  setRefTable(table);
                  setRefColumns([]);
                }}
                options={(tables.data ?? [])
                  .filter((t) => t.kind === "table" || t.kind === "partitioned_table")
                  .map((t) => ({ value: t.name, label: t.name }))}
              />
            )}
          </Field>
          {refTable && (
            <Field label="Referenced columns" hint="Usually the primary key">
              {() => <ColumnPicker columns={refOptions} value={refColumns} onChange={setRefColumns} />}
            </Field>
          )}
          <Field label="On delete">
            {(p) => (
              <Select
                {...p}
                value={onDelete}
                onValueChange={setOnDelete}
                options={ACTIONS.map((a) => ({ value: a, label: a }))}
              />
            )}
          </Field>
        </div>
      </div>
    </RunSqlDialog>
  );
}
