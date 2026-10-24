import {
  DropdownMenu,
  Field,
  Input,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import {
  ArchiveRestore,
  Blocks,
  Check,
  ChevronsUpDown,
  Database,
  DatabaseBackup,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { formatBytes } from "../../lib/format";
import { createDatabase, dropDatabase, renameDatabase } from "../../lib/sql";
import { useBackupDialogs } from "../backup/backup-store";
import { useDatabases, useExplorer } from "./explorer-context";
import { NameField, RunSqlDialog } from "./run-sql-dialog";
import { useWorkspace } from "./workspace-store";

type DialogKind = "create" | "rename" | "drop";

/**
 * The database part of the explorer breadcrumb: shows the open database, switches to another one,
 * and holds everything you can do to a database (new, rename, extensions, backup, drop).
 */
export function DatabaseSwitcher({
  defaultDatabase,
}: {
  defaultDatabase: string;
}) {
  const { serverId } = useExplorer();
  const ws = useWorkspace(serverId);
  const database = ws.database ?? defaultDatabase;
  const databases = useDatabases();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [name, setName] = useState("");

  const openDialog = (kind: DialogKind, initialName = "") => {
    setName(initialName);
    setDialog(kind);
  };
  const switchTo = (next: string) =>
    ws.setLocation({ database: next, schema: null });
  // A database can't be renamed or dropped while connected to it, so run that from another one
  const maintenanceDb =
    database === defaultDatabase ? "template1" : defaultDatabase;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-control px-2 text-sm text-fg hover:bg-surface-hover data-[state=open]:bg-surface-hover"
          >
            <Database className="size-3.5 shrink-0 text-fg-subtle" />
            <span className="truncate font-mono">{database}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-fg-subtle" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          <DropdownMenuLabel>Databases</DropdownMenuLabel>
          <div className="max-h-72 overflow-y-auto">
            {(
              databases.data ?? [
                { name: database, sizeBytes: null, allowConnections: true },
              ]
            ).map((d) => (
              <DropdownMenuItem
                key={d.name}
                disabled={!d.allowConnections}
                icon={
                  <Check
                    className={
                      d.name === database ? "text-accent" : "invisible"
                    }
                  />
                }
                onSelect={() => d.name !== database && switchTo(d.name)}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono">{d.name}</span>
                  {d.sizeBytes ? (
                    <span className="shrink-0 font-mono text-[10px] text-fg-subtle">
                      {formatBytes(d.sizeBytes)}
                    </span>
                  ) : null}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
          <DropdownMenuItem
            icon={<Plus />}
            onSelect={() => openDialog("create")}
          >
            New database…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{database}</DropdownMenuLabel>
          <DropdownMenuItem
            icon={<Blocks />}
            onSelect={() => ws.openTab({ type: "extensions", database })}
          >
            Extensions
          </DropdownMenuItem>
          {/* Backup and restore use the bundled pg_dump, so only local servers have them */}
          {!serverId.startsWith("remote:") && (
            <>
              <DropdownMenuItem
                icon={<DatabaseBackup />}
                onSelect={() =>
                  useBackupDialogs.getState().openBackup({ serverId, database })
                }
              >
                Back up…
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<ArchiveRestore />}
                onSelect={() =>
                  useBackupDialogs
                    .getState()
                    .openRestore({ serverId, database })
                }
              >
                Restore a backup…
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem
            icon={<Pencil />}
            onSelect={() => openDialog("rename", database)}
          >
            Rename…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            icon={<Trash2 />}
            danger
            onSelect={() => openDialog("drop")}
          >
            Drop database…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewDatabaseDialog
        open={dialog === "create"}
        onOpenChange={(o) => !o && setDialog(null)}
        database={database}
        onCreated={switchTo}
      />
      {dialog === "rename" && (
        <RunSqlDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={`Rename ${database}`}
          description="Open connections to this database are closed first."
          sql={
            name.trim() && name.trim() !== database
              ? renameDatabase(database, name.trim())
              : "-- type a new name"
          }
          database={maintenanceDb}
          confirmLabel="Rename"
          successMessage={`Renamed to ${name.trim()}`}
          refreshAll
          onDone={() => switchTo(name.trim())}
        >
          <NameField value={name} onChange={setName} />
        </RunSqlDialog>
      )}
      {dialog === "drop" && (
        <RunSqlDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={`Drop database ${database}?`}
          description="Permanently deletes the database and everything in it. Open connections are closed."
          sql={dropDatabase(database)}
          database={maintenanceDb}
          confirmLabel="Drop database"
          destructive
          successMessage={`Database ${database} dropped`}
          refreshAll
          onDone={() => {
            ws.closeTabsFor((t) => t.database === database);
            switchTo(defaultDatabase);
          }}
        />
      )}
    </>
  );
}

/** Creates a database on the open server. `database` is any existing database to run the statement from. */
export function NewDatabaseDialog({
  open,
  onOpenChange,
  database,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: string;
  onCreated: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const databases = useDatabases();
  if (!open) return null;
  const trimmed = name.trim();
  const exists = (databases.data ?? []).some((d) => d.name === trimmed);
  // Postgres folds unquoted names to lowercase; anything else needs quotes in every query
  const plain = /^[a-z_][a-z0-9_$]*$/.test(trimmed);
  return (
    <RunSqlDialog
      open
      onOpenChange={(o) => {
        if (!o) setName("");
        onOpenChange(o);
      }}
      title="New database"
      description="Creates an empty database on this server, with its own schemas and tables."
      sql={
        !trimmed
          ? "-- type a name"
          : exists
            ? "-- name taken"
            : createDatabase(trimmed)
      }
      database={database}
      confirmLabel="Create database"
      successMessage={`Database ${trimmed} created`}
      refreshAll
      onDone={() => onCreated(trimmed)}
    >
      <Field
        label="Name"
        error={exists ? "A database with this name already exists." : undefined}
        hint={
          !trimmed || plain
            ? "Lowercase letters, numbers and underscores. You'll switch to it once it's created."
            : "Has capitals or symbols, so it must be written in double quotes in SQL."
        }
      >
        {(p) => (
          <Input
            {...p}
            className="font-mono"
            autoFocus
            spellCheck={false}
            placeholder="my_app"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </Field>
    </RunSqlDialog>
  );
}
