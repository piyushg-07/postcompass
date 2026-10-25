import { Dialog } from "@repo/ui";
import { DuplicateTableDialog } from "./create-table/duplicate-table-dialog";
import { useCreateTableSheet } from "./create-table/store";
import { TableForm, UpdateTableLoader } from "./create-table/table-form";
import { useExplorer } from "./explorer-context";

export { useCreateTableSheet } from "./create-table/store";

/** Side panel for creating or updating a table, like Supabase's: name, security, columns, foreign keys. */
export function CreateTableSheet() {
  const { serverId } = useExplorer();
  const target = useCreateTableSheet((s) => s.target);
  const close = useCreateTableSheet((s) => s.close);
  const open = target?.serverId === serverId;

  if (open && target?.mode === "duplicate" && target.table)
    return (
      <DuplicateTableDialog
        key={`${target.database}.${target.schema}.${target.table}`}
        target={{ ...target, table: target.table }}
        onClose={close}
      />
    );
  const editing = target?.mode === "edit" && target.table !== undefined;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open &&
        target &&
        (editing ? (
          <UpdateTableLoader
            key={`${target.database}.${target.schema}.${target.table}`}
            target={target}
            onClose={close}
          />
        ) : (
          <TableForm
            key={`${target.database}.${target.schema}`}
            target={target}
            onClose={close}
          />
        ))}
    </Dialog>
  );
}
