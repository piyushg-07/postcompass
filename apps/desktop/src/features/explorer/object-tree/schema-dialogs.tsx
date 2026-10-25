import { Checkbox } from "@repo/ui";
import { useState } from "react";
import { createSchema, dropSchema, renameSchema } from "../../../lib/sql";
import { NameField, RunSqlDialog } from "../run-sql-dialog";
import type { Tab } from "../workspace-store";

export type SchemaDialogKind = "create-schema" | "rename-schema" | "drop-schema";

/** Create, rename or drop a schema. Mounted only while open, so it starts fresh each time. */
export function SchemaDialog({
  kind,
  database,
  schema,
  tableCount,
  onClose,
  onLocation,
  closeTabsFor,
}: {
  kind: SchemaDialogKind;
  database: string;
  /** The current schema (renamed or dropped). */
  schema: string | null;
  /** Tables in `schema`; dropping a non-empty one needs CASCADE. */
  tableCount: number;
  onClose: () => void;
  onLocation: (schema: string | null) => void;
  closeTabsFor: (predicate: (tab: Tab) => boolean) => void;
}) {
  const [name, setName] = useState(kind === "rename-schema" ? (schema ?? "") : "");
  const [cascade, setCascade] = useState(false);
  const onOpenChange = (o: boolean) => !o && onClose();
  const inSchema = (t: Tab) =>
    "schema" in t && t.database === database && t.schema === schema;

  if (kind === "create-schema")
    return (
      <RunSqlDialog
        open
        onOpenChange={onOpenChange}
        title="New schema"
        sql={name.trim() ? createSchema(name.trim()) : "-- type a name"}
        database={database}
        confirmLabel="Create schema"
        successMessage={`Schema ${name.trim()} created`}
        onDone={() => onLocation(name.trim())}
      >
        <NameField value={name} onChange={setName} placeholder="analytics" />
      </RunSqlDialog>
    );

  if (!schema) return null;

  if (kind === "rename-schema")
    return (
      <RunSqlDialog
        open
        onOpenChange={onOpenChange}
        title={`Rename schema ${schema}`}
        sql={
          name.trim() && name.trim() !== schema
            ? renameSchema(schema, name.trim())
            : "-- type a new name"
        }
        database={database}
        confirmLabel="Rename"
        successMessage={`Renamed to ${name.trim()}`}
        onDone={() => {
          closeTabsFor(inSchema);
          onLocation(name.trim());
        }}
      >
        <NameField value={name} onChange={setName} />
      </RunSqlDialog>
    );

  return (
    <RunSqlDialog
      open
      onOpenChange={onOpenChange}
      title={`Delete schema ${schema}?`}
      // Deleting a schema with tables needs CASCADE, so ask for an explicit OK first
      sql={
        tableCount === 0
          ? dropSchema(schema, false)
          : cascade
            ? dropSchema(schema, true)
            : "-- confirm deleting its tables"
      }
      database={database}
      confirmLabel="Delete schema"
      destructive
      successMessage={`Schema ${schema} deleted`}
      onDone={() => {
        closeTabsFor(inSchema);
        onLocation(null);
      }}
    >
      {tableCount === 0 ? (
        <p className="text-sm text-fg-muted">
          This schema is empty. It will be removed permanently.
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-control border border-danger/30 bg-danger/5 p-3">
          <p className="text-sm text-fg">
            <span className="font-mono">{schema}</span> has {tableCount}{" "}
            {tableCount === 1 ? "table" : "tables"}.{" "}
            {tableCount === 1 ? "It" : "They"} and all their data will be
            deleted permanently.
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
            <Checkbox
              checked={cascade}
              onCheckedChange={(v) => setCascade(v === true)}
            />
            I understand, delete everything in it
          </label>
        </div>
      )}
    </RunSqlDialog>
  );
}
