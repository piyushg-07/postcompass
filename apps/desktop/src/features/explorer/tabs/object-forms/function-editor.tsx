import {
  Button,
  Dialog,
  DialogClose,
  SheetContent,
  Spinner,
  toast,
} from "@repo/ui";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import type { FunctionInfo } from "../../../../lib/bindings";
import { describeError } from "../../../../lib/ipc";
import { useDefinition, useRunSql } from "../../explorer-context";
import { SqlEditor } from "../../sql/sql-editor";
import type { Common } from "./shared";

/** Loads an existing function's code, then opens it in the editor. */
export function EditFunction(props: Common & { item: FunctionInfo }) {
  const definition = useDefinition(
    props.database,
    props.schema,
    "function",
    props.item.id,
  );
  return (
    <FunctionEditor
      {...props}
      initial={definition.data}
      loading={definition.isPending}
      loadError={
        definition.isError ? describeError(definition.error).message : undefined
      }
    />
  );
}

/** Side panel with the raw SQL, for functions the form can't show (OUT args, defaults…). */
function FunctionEditor({
  database,
  onClose,
  item,
  initial,
  loading = false,
  loadError,
}: Common & {
  item: FunctionInfo;
  initial?: string;
  loading?: boolean;
  loadError?: string;
}) {
  const run = useRunSql();
  const [sql, setSql] = useState("");

  // The code arrives after the panel opens when editing
  useEffect(() => {
    if (initial !== undefined) setSql(initial);
  }, [initial]);

  // Ctrl+Enter in the editor gets here too, past the disabled Save button
  const save = () => {
    if (!sql.trim() || loading || run.isPending) return;
    run.mutate(
      { sql, database },
      {
        onSuccess: () => {
          toast.success(`${item.name} saved`);
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        title={`Edit ${item.kind} ${item.name}`}
        description="Changing the arguments or return type creates a new function; delete the old one if needed."
        className="w-[760px]"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="primary"
              loading={run.isPending}
              disabled={!sql.trim() || loading}
              onClick={save}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex h-full min-h-[420px] flex-col gap-3">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-fg-subtle">
              <Spinner />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden rounded-card border border-border-strong">
              <SqlEditor
                value={sql}
                onChange={setSql}
                onRun={save}
                autoFocus
                className="h-full"
              />
            </div>
          )}
          {(run.isError || loadError) && (
            <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
              <span className="text-fg">
                {loadError ?? describeError(run.error).message}
              </span>
            </div>
          )}
        </div>
      </SheetContent>
    </Dialog>
  );
}
