import { Checkbox } from "@repo/ui";
import { useState } from "react";
import { NameField, RunSqlDialog } from "../run-sql-dialog";
import { useWorkspaceStore } from "../workspace-store";
import type { Target } from "./store";
import { duplicateTableSql } from "./table-sql";

/** Supabase's "Duplicate table": the same columns, constraints and indexes, optionally its rows. */
export function DuplicateTableDialog({
  target,
  onClose,
}: {
  target: Target & { table: string };
  onClose: () => void;
}) {
  const { serverId, database, schema, table } = target;
  const [name, setName] = useState(`${table}_duplicate`);
  const [withRows, setWithRows] = useState(false);
  const valid = name.trim().length > 0 && name.trim() !== table;
  const sql = !valid
    ? "-- give the copy a new name"
    : duplicateTableSql(schema, table, name.trim(), withRows);
  return (
    <RunSqlDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Duplicate table ${table}`}
      description="Copies the columns, defaults, constraints and indexes. Foreign keys aren't copied."
      sql={sql}
      database={database}
      confirmLabel="Duplicate"
      successMessage={`Table ${name.trim()} created`}
      onDone={() =>
        useWorkspaceStore.getState().openTab(serverId, {
          type: "table",
          database,
          schema,
          name: name.trim(),
          kind: "table",
          view: "data",
        })
      }
    >
      <NameField value={name} onChange={setName} />
      <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
        <Checkbox
          checked={withRows}
          onCheckedChange={(v) => setWithRows(v === true)}
        />
        Duplicate table entries
      </label>
    </RunSqlDialog>
  );
}
