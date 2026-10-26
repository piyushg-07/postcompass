import {
  Button,
  Checkbox,
  Dialog,
  DialogClose,
  Field,
  Input,
  SheetContent,
  toast,
} from "@repo/ui";
import { AlertTriangle } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { describeError } from "../../../../lib/ipc";
import { useRunSql } from "../../explorer-context";
import { NameField, RunSqlDialog } from "../../run-sql-dialog";
import { SqlBlock } from "../../sql/sql-editor";
import { isInt, isName } from "./ddl";

export interface Common {
  database: string;
  schema: string;
  onClose: () => void;
}

/* ── Shared ───────────────────────────────────────────────────────────── */

export function Rename({
  database,
  onClose,
  title,
  current,
  build,
}: Common & {
  title: string;
  current: string;
  build: (newName: string) => string;
}) {
  const [name, setName] = useState(current);
  const ok = isName(name) && name.trim() !== current;
  return (
    <RunSqlDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={title}
      sql={ok ? build(name.trim()) : "-- type a new name"}
      database={database}
      confirmLabel="Rename"
      successMessage={`Renamed to ${name.trim()}`}
    >
      <NameField value={name} onChange={setName} />
    </RunSqlDialog>
  );
}

export function Drop({
  database,
  onClose,
  title,
  what,
  detail,
  build,
  cascadeLabel,
}: Common & {
  title: string;
  what: string;
  detail?: string;
  build: (cascade: boolean) => string;
  cascadeLabel?: string;
}) {
  const [cascade, setCascade] = useState(false);
  return (
    <RunSqlDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={title}
      sql={build(cascade)}
      database={database}
      confirmLabel={`Delete ${what}`}
      destructive
      successMessage={`${what[0]!.toUpperCase()}${what.slice(1)} deleted`}
    >
      <p className="text-sm text-fg-muted">
        {detail ?? "This can't be undone."}
      </p>
      {cascadeLabel && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
          <Checkbox
            checked={cascade}
            onCheckedChange={(v) => setCascade(v === true)}
          />
          {cascadeLabel}
        </label>
      )}
    </RunSqlDialog>
  );
}

/**
 * Side panel for creating or editing an object: the fields in sections, Save pinned at the bottom.
 * Like `RunSqlDialog`, a `sql` starting with `--` keeps Save disabled; Enter saves.
 */
export function FormSheet({
  database,
  onClose,
  title,
  description,
  sql,
  confirmLabel,
  successMessage,
  className = "w-[520px]",
  children,
}: Pick<Common, "database" | "onClose"> & {
  className?: string;
  title: string;
  description?: ReactNode;
  sql: string;
  confirmLabel: string;
  successMessage: string;
  children: ReactNode;
}) {
  const run = useRunSql();
  const formId = useId();
  const [showSql, setShowSql] = useState(false);
  const ready = !sql.trimStart().startsWith("--");
  const submit = () => {
    if (!ready || run.isPending) return;
    run.mutate(
      { sql, database },
      {
        onSuccess: () => {
          toast.success(successMessage);
          onClose();
        },
      },
    );
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        title={title}
        description={description}
        className={className}
        footer={
          <>
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
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              form={formId}
              variant="primary"
              loading={run.isPending}
              disabled={!ready}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          className="flex flex-col gap-6"
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
          {showSql && ready && <SqlBlock sql={sql} className="max-h-64" />}
        </form>
      </SheetContent>
    </Dialog>
  );
}

/** A titled group of fields inside a `FormSheet`. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] font-medium tracking-wide text-fg-subtle uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      {(p) => (
        <Input
          {...p}
          inputMode="numeric"
          className="font-mono"
          placeholder={placeholder}
          value={value}
          aria-invalid={(value.trim() !== "" && !isInt(value)) || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
