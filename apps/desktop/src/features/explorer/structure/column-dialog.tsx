import { Button, Dialog, DialogClose, DialogContent, DialogFooter, Field, Input, Switch, toast } from "@repo/ui";
import { useForm, useStore } from "@tanstack/react-form";
import { AlertTriangle } from "lucide-react";
import { z } from "zod";
import type { ColumnInfo } from "../../../lib/bindings";
import { describeError } from "../../../lib/ipc";
import { addColumn, alterColumn } from "../../../lib/sql";
import { useRunSql } from "../explorer-context";
import { SqlBlock } from "../sql/sql-editor";
import { fieldError, identifierSchema, TypeInput, typeSchema } from "./form-fields";

const schema = z.object({
  name: identifierSchema,
  type: typeSchema,
  nullable: z.boolean(),
  defaultValue: z.string(),
  unique: z.boolean(),
});

/** Add a column, or edit an existing one (rename, change type, nullability, default). */
export function ColumnDialog({
  open,
  onOpenChange,
  database,
  schema: schemaName,
  table,
  column,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: string;
  schema: string;
  table: string;
  /** Present when editing. */
  column?: ColumnInfo;
}) {
  const run = useRunSql();
  const initial = {
    name: column?.name ?? "",
    type: column?.dataType ?? "text",
    nullable: column?.nullable ?? true,
    defaultValue: column?.default ?? "",
    unique: false,
  };

  const form = useForm({
    defaultValues: initial,
    validators: { onChange: schema },
    onSubmit: ({ value }) =>
      run.mutate(
        { sql: buildSql(value), database },
        {
          onSuccess: () => {
            toast.success(column ? `Column ${value.name} updated` : `Column ${value.name} added`);
            onOpenChange(false);
          },
        },
      ),
  });

  const buildSql = (v: typeof initial) =>
    column
      ? alterColumn(schemaName, table, initial, v).join("\n")
      : addColumn(schemaName, table, { ...v, primaryKey: false });

  const values = useStore(form.store, (s) => s.values);
  const valid = useStore(form.store, (s) => s.isValid);
  const sql = valid ? buildSql(values) : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset();
          run.reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent title={column ? `Edit column ${column.name}` : "Add column"} className="w-[560px]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <form.Field name="name">
              {(field) => (
                <Field label="Name" error={fieldError(field.state.meta.errors)}>
                  {(p) => (
                    <Input
                      {...p}
                      className="font-mono"
                      autoFocus
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  )}
                </Field>
              )}
            </form.Field>
            <form.Field name="type">
              {(field) => (
                <Field label="Type" error={fieldError(field.state.meta.errors)}>
                  {(p) => (
                    <TypeInput
                      id={p.id}
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      invalid={p["aria-invalid"]}
                    />
                  )}
                </Field>
              )}
            </form.Field>
          </div>
          <form.Field name="defaultValue">
            {(field) => (
              <Field label="Default (SQL expression)" hint="e.g. now(), 0, 'pending', gen_random_uuid()">
                {(p) => (
                  <Input
                    {...p}
                    className="font-mono"
                    placeholder="No default"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </Field>
            )}
          </form.Field>
          <div className="flex gap-6">
            <form.Field name="nullable">
              {(field) => (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                  Allow NULL
                </label>
              )}
            </form.Field>
            {!column && (
              <form.Field name="unique">
                {(field) => (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                    Unique
                  </label>
                )}
              </form.Field>
            )}
          </div>

          {sql ? (
            <SqlBlock sql={sql} className="max-h-40" />
          ) : (
            column && valid && <p className="text-xs text-fg-subtle">No changes yet.</p>
          )}
          {run.isError && (
            <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
              <span className="text-fg">{describeError(run.error).message}</span>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={run.isPending} disabled={!sql}>
              {column ? "Apply changes" : "Add column"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
