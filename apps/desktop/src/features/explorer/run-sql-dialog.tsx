import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Field,
  Input,
  toast,
} from "@repo/ui";
import { AlertTriangle } from "lucide-react";
import { type ReactNode, useState } from "react";
import { describeError } from "../../lib/ipc";
import { useRunSql } from "./explorer-context";
import { SqlBlock } from "./sql/sql-editor";

/**
 * A small confirm dialog for one change (rename, create, drop…): just the inputs and a button.
 * The SQL it runs stays one click away under "View SQL". A `sql` starting with `--` means the
 * form isn't complete yet, so the button stays disabled. Enter confirms.
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
  wide = false,
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
  /** Wider, for forms with fields side by side. */
  wide?: boolean;
  /** The inputs (e.g. a name field or a "cascade" switch). */
  children?: ReactNode;
}) {
  const run = useRunSql();
  const [showSql, setShowSql] = useState(false);
  const ready = !sql.trimStart().startsWith("--");

  const submit = () => {
    if (!ready || run.isPending) return;
    run.mutate(
      { sql, database, refreshAll },
      {
        onSuccess: () => {
          toast.success(successMessage);
          onOpenChange(false);
          onDone?.();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          run.reset();
          setShowSql(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        title={title}
        description={description}
        className={wide ? "w-[620px]" : "w-[460px]"}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {children}
          {run.isError && (
            <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
              <span className="break-words text-fg">
                {describeError(run.error).message}
              </span>
            </div>
          )}
          {showSql && ready && <SqlBlock sql={sql} className="max-h-48" />}
          <div className="flex items-center gap-2 pt-1">
            {ready && (
              <button
                type="button"
                onClick={() => setShowSql((v) => !v)}
                className="mr-auto cursor-pointer text-xs text-fg-subtle hover:text-fg"
              >
                {showSql ? "Hide SQL" : "View SQL"}
              </button>
            )}
            <DialogClose asChild>
              <Button variant="ghost" className={ready ? undefined : "ml-auto"}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant={destructive ? "danger" : "primary"}
              loading={run.isPending}
              disabled={!ready}
            >
              {confirmLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Name input for create/rename dialogs; the current text is selected so typing replaces it. */
export function NameField({
  value,
  onChange,
  placeholder,
  label = "Name",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <Field label={label}>
      {(p) => (
        <Input
          {...p}
          className="font-mono"
          autoFocus
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
