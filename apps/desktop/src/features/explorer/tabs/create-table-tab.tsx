import { Button, Checkbox, Field, IconButton, Input, toast } from "@repo/ui";
import { useForm, useStore } from "@tanstack/react-form";
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { describeError } from "../../../lib/ipc";
import { type ColumnDraft, createTable } from "../../../lib/sql";
import { useRunSql } from "../explorer-context";
import { SqlBlock } from "../sql/sql-editor";
import { fieldError, identifierSchema, TypeInput, typeSchema } from "../structure/form-fields";

const columnSchema = z.object({
  name: identifierSchema,
  type: typeSchema,
  nullable: z.boolean(),
  defaultValue: z.string(),
  primaryKey: z.boolean(),
  unique: z.boolean(),
});

const tableSchema = z.object({
  name: identifierSchema,
  columns: z
    .array(columnSchema)
    .min(1, "Add at least one column")
    .refine((cols) => new Set(cols.map((c) => c.name.trim())).size === cols.length, "Column names must be unique"),
});

const blankColumn = (): ColumnDraft => ({
  name: "",
  type: "text",
  nullable: true,
  defaultValue: "",
  primaryKey: false,
  unique: false,
});

/** Visual table designer with a live SQL preview. */
export function CreateTableTab({
  database,
  schema,
  onCreated,
}: {
  database: string;
  schema: string;
  onCreated: (table: string) => void;
}) {
  const run = useRunSql();
  const form = useForm({
    defaultValues: {
      name: "",
      columns: [
        { name: "id", type: "bigint generated always as identity", nullable: false, defaultValue: "", primaryKey: true, unique: false },
        { name: "created_at", type: "timestamptz", nullable: false, defaultValue: "now()", primaryKey: false, unique: false },
      ] as ColumnDraft[],
    },
    validators: { onChange: tableSchema },
    onSubmit: ({ value }) =>
      run.mutate(
        { sql: createTable(schema, value.name.trim(), value.columns), database },
        {
          onSuccess: () => {
            toast.success(`Table ${value.name.trim()} created`);
            onCreated(value.name.trim());
          },
        },
      ),
  });

  const values = useStore(form.store, (s) => s.values);
  const formErrors = useStore(form.store, (s) => s.errors);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);
  const preview = values.name.trim()
    ? createTable(schema, values.name.trim(), values.columns.filter((c) => c.name.trim()))
    : "-- give the table a name";

  return (
    <form
      className="flex h-full min-h-0"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
        <form.Field name="name">
          {(field) => (
            <Field label={`Table name (in ${schema})`} error={fieldError(field.state.meta.errors)} className="max-w-sm">
              {(p) => (
                <Input
                  {...p}
                  className="font-mono"
                  autoFocus
                  placeholder="customers"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              )}
            </Field>
          )}
        </form.Field>

        <form.Field name="columns" mode="array">
          {(columns) => (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_1.3fr_1fr_56px_56px_56px_64px] gap-2 px-1 text-[11px] font-medium text-fg-subtle">
                <span>Column</span>
                <span>Type</span>
                <span>Default</span>
                <span className="text-center">Null</span>
                <span className="text-center">PK</span>
                <span className="text-center">Unique</span>
                <span />
              </div>
              {columns.state.value.map((_, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.3fr_1fr_56px_56px_56px_64px] items-start gap-2">
                  <form.Field name={`columns[${i}].name`}>
                    {(f) => (
                      <div className="flex flex-col gap-1">
                        <Input
                          aria-label="Column name"
                          className="font-mono"
                          placeholder="column_name"
                          value={f.state.value}
                          onChange={(e) => f.handleChange(e.target.value)}
                          onBlur={f.handleBlur}
                          aria-invalid={f.state.meta.errors.length > 0 || undefined}
                        />
                        {f.state.meta.isTouched && fieldError(f.state.meta.errors) && (
                          <span className="text-[11px] text-danger">{fieldError(f.state.meta.errors)}</span>
                        )}
                      </div>
                    )}
                  </form.Field>
                  <form.Field name={`columns[${i}].type`}>
                    {(f) => (
                      <div className="flex flex-col gap-1">
                        <TypeInput value={f.state.value} onChange={f.handleChange} onBlur={f.handleBlur} invalid={f.state.meta.errors.length > 0} />
                        {fieldError(f.state.meta.errors) && (
                          <span className="text-[11px] text-danger">{fieldError(f.state.meta.errors)}</span>
                        )}
                      </div>
                    )}
                  </form.Field>
                  <form.Field name={`columns[${i}].defaultValue`}>
                    {(f) => (
                      <Input
                        aria-label="Default"
                        className="font-mono"
                        placeholder="—"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                      />
                    )}
                  </form.Field>
                  {(["nullable", "primaryKey", "unique"] as const).map((key) => (
                    <form.Field key={key} name={`columns[${i}].${key}`}>
                      {(f) => (
                        <div className="flex h-8 items-center justify-center">
                          <Checkbox
                            aria-label={key}
                            checked={f.state.value}
                            onCheckedChange={(checked) => f.handleChange(checked === true)}
                          />
                        </div>
                      )}
                    </form.Field>
                  ))}
                  <div className="flex h-8 items-center">
                    <IconButton size="sm" label="Move up" icon={<ArrowUp />} disabled={i === 0} onClick={() => columns.moveValue(i, i - 1)} />
                    <IconButton size="sm" label="Move down" icon={<ArrowDown />} disabled={i === columns.state.value.length - 1} onClick={() => columns.moveValue(i, i + 1)} />
                    <IconButton size="sm" label="Remove column" icon={<Trash2 />} onClick={() => columns.removeValue(i)} />
                  </div>
                </div>
              ))}
              <Button size="sm" variant="ghost" iconLeft={<Plus />} className="w-fit" onClick={() => columns.pushValue(blankColumn())}>
                Add column
              </Button>
            </div>
          )}
        </form.Field>

        {formErrors.length > 0 && values.name && (
          <p className="text-xs text-danger">{formErrors.map((e) => fieldError([e])).filter(Boolean)[0]}</p>
        )}
      </div>

      <aside className="flex w-[420px] shrink-0 flex-col gap-3 border-l border-border bg-surface p-4">
        <h3 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">SQL preview</h3>
        <SqlBlock sql={preview} className="min-h-0 flex-1" />
        {run.isError && (
          <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5 text-xs">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
            <span className="text-fg">{describeError(run.error).message}</span>
          </div>
        )}
        <Button type="submit" variant="primary" loading={run.isPending} disabled={!canSubmit || !values.name.trim()}>
          Create table
        </Button>
      </aside>
    </form>
  );
}
