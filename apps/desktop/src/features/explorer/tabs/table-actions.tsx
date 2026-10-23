import { Field, Input, Switch } from "@repo/ui";
import { useState } from "react";
import type { TableKind } from "../../../lib/bindings";
import {
  dropTable,
  qualified,
  renameTable,
  truncateTable,
} from "../../../lib/sql";
import { useExplorer } from "../explorer-context";
import { RunSqlDialog } from "../run-sql-dialog";
import { useWorkspace } from "../workspace-store";

export type TableAction = "rename" | "truncate" | "drop" | "refresh";

export interface TableTarget {
  database: string;
  schema: string;
  name: string;
  kind: TableKind;
}

/** Rename / empty / drop / refresh for a table or view, opened from its right-click menu. */
export function TableActionDialog({
  target,
  action,
  onClose,
}: {
  target: TableTarget;
  action: TableAction;
  onClose: () => void;
}) {
  const { serverId } = useExplorer();
  const { closeTabsFor } = useWorkspace(serverId);
  const [newName, setNewName] = useState(target.name);
  const [cascade, setCascade] = useState(false);
  const kindLabel =
    target.kind === "view"
      ? "view"
      : target.kind === "materialized_view"
        ? "materialized view"
        : "table";
  // Its tab shows a table that no longer exists under that name
  const closeItsTab = () =>
    closeTabsFor(
      (t) =>
        t.type === "table" &&
        t.database === target.database &&
        t.schema === target.schema &&
        t.name === target.name,
    );
  const onOpenChange = (open: boolean) => !open && onClose();

  if (action === "rename")
    return (
      <RunSqlDialog
        open
        onOpenChange={onOpenChange}
        title={`Rename ${target.name}`}
        sql={
          newName.trim() && newName !== target.name
            ? renameTable(target.schema, target.name, newName.trim())
            : "-- type a new name"
        }
        database={target.database}
        confirmLabel="Rename"
        successMessage={`Renamed to ${newName.trim()}`}
        onDone={closeItsTab}
      >
        <Field label="New name">
          {(p) => (
            <Input
              {...p}
              className="font-mono"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          )}
        </Field>
      </RunSqlDialog>
    );
  if (action === "refresh")
    return (
      <RunSqlDialog
        open
        onOpenChange={onOpenChange}
        title={`Refresh ${target.name}?`}
        description="Runs the view's query again and replaces its stored rows."
        sql={`REFRESH MATERIALIZED VIEW ${qualified(target.schema, target.name)};`}
        database={target.database}
        confirmLabel="Refresh"
        successMessage={`${target.name} refreshed`}
      />
    );
  if (action === "truncate")
    return (
      <RunSqlDialog
        open
        onOpenChange={onOpenChange}
        title={`Empty ${target.name}?`}
        description="Deletes every row. This can't be undone."
        sql={truncateTable(target.schema, target.name)}
        database={target.database}
        confirmLabel="Delete all rows"
        destructive
        successMessage={`${target.name} emptied`}
      />
    );
  return (
    <RunSqlDialog
      open
      onOpenChange={onOpenChange}
      title={`Drop ${target.name}?`}
      description={`Permanently deletes the ${kindLabel} and all its data.`}
      sql={dropTable(target.schema, target.name, kindLabel, cascade)}
      database={target.database}
      confirmLabel={`Drop ${kindLabel}`}
      destructive
      successMessage={`${target.name} dropped`}
      onDone={closeItsTab}
    >
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Switch checked={cascade} onCheckedChange={setCascade} />
        Also drop objects that depend on it (CASCADE)
      </label>
    </RunSqlDialog>
  );
}
