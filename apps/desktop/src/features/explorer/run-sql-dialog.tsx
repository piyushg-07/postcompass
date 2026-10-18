import { Button, Dialog, DialogClose, DialogContent, DialogFooter, toast } from "@repo/ui";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { describeError } from "../../lib/ipc";
import { useRunSql } from "./explorer-context";
import { SqlBlock } from "./sql/sql-editor";

/**
 * Shows the SQL a change will run and runs it on confirm. Every schema change goes through here,
 * so nothing is changed without the user seeing the exact statement.
 */
export function RunSqlDialog({
  open,
  onOpenChange,
  title,
  description,
  sql,
  database,
  confirmLabel = "Run",
  destructive = false,
  successMessage,
  refreshAll,
  onDone,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  sql: string;
  database: string;
  confirmLabel?: string;
  destructive?: boolean;
  successMessage: string;
  /** Refresh every database (for database-level changes). */
  refreshAll?: boolean;
  onDone?: () => void;
  /** Extra options rendered above the SQL (e.g. a "cascade" switch). */
  children?: ReactNode;
}) {
  const run = useRunSql();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) run.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent title={title} description={description} className="w-[640px]">
        {children}
        <SqlBlock sql={sql} className="max-h-72" />
        {run.isError && (
          <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5 text-xs">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
            <span className="break-words text-fg">{describeError(run.error).message}</span>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant={destructive ? "danger" : "primary"}
            loading={run.isPending}
            onClick={() =>
              run.mutate(
                { sql, database, refreshAll },
                {
                  onSuccess: () => {
                    toast.success(successMessage);
                    onOpenChange(false);
                    onDone?.();
                  },
                },
              )
            }
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
