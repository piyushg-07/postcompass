import { Button, Checkbox, Dialog, DialogClose, Field, IconButton, Input, SheetContent, Switch, toast } from "@repo/ui";
import { useForm, useStore } from "@tanstack/react-form";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { create } from "zustand";
import { describeError } from "../../lib/ipc";
import { type ColumnDraft, createTable, literal, qualified } from "../../lib/sql";
import { useExplorer, useRunSql } from "./explorer-context";
import { SqlBlock } from "./sql/sql-editor";
import { fieldError, identifierSchema, TypeInput, typeSchema } from "./structure/form-fields";
import { useWorkspaceStore } from "./workspace-store";

interface Target {
  serverId: string;
  database: string;
  schema: string;
}

/** "New table" can be started from the sidebar or the command palette. */
export const useCreateTableSheet = create<{
  target: Target | null;
  open: (target: Target) => void;
  close: () => void;
}>()((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));

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
  comment: z.string(),
  rls: z.boolean(),
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

function buildSql(schema: string, name: string, comment: string, rls: boolean, columns: ColumnDraft[]) {
  const table = qualified(schema, name);
  return [
    createTable(schema, name, columns),
    rls && `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
    comment.trim() && `COMMENT ON TABLE ${table} IS ${literal(comment.trim())};`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Side panel for creating a table, like Supabase's: name, description, RLS, then columns. */
export function CreateTableSheet() {
  const { serverId } = useExplorer();
  const target = useCreateTableSheet((s) => s.target);
  const close = useCreateTableSheet((s) => s.close);
  const open = target?.serverId === serverId;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && target && <CreateTableForm key={`${target.database}.${target.schema}`} target={target} onClose={close} />}
    </Dialog>
  );
}

function CreateTableForm({ target, onClose }: { target: Target; onClose: () => void }) {
  const { database, schema, serverId } = target;
  const run = useRunSql();
  const [showSql, setShowSql] = useState(false);
  const form = useForm({
    defaultValues: {
      name: "",
      comment: "",
      rls: false,
      columns: [
        { name: "id", type: "bigint generated always as identity", nullable: false, defaultValue: "", primaryKey: true, unique: false },
        { name: "created_at", type: "timestamptz", nullable: false, defaultValue: "now()", primaryKey: false, unique: false },
      ] as ColumnDraft[],
    },
    validators: { onChange: tableSchema },
    onSubmit: ({ value }) => {
      const name = value.name.trim();
      run.mutate(
        { sql: buildSql(schema, name, value.comment, value.rls, value.columns), database },
        {
          onSuccess: () => {
            toast.success(`Table ${name} created`);
            onClose();
            useWorkspaceStore
              .getState()
              .openTab(serverId, { type: "table", database, schema, name, kind: "table", view: "data" });
          },
        },
      );
    },
  });

  const values = useStore(form.store, (s) => s.values);
  const formErrors = useStore(form.store, (s) => s.errors);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);
  const preview = values.name.trim()
    ? buildSql(schema, values.name.trim(), values.comment, values.rls, values.columns.filter((c) => c.name.trim()))
    : "-- give the table a name";

  return (
    <SheetContent
      title={
        <>
          New table in <span className="font-mono">{schema}</span>
        </>
      }
      description={`Database ${database}`}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="primary"
            loading={run.isPending}
            disabled={!canSubmit || !values.name.trim()}
            onClick={() => void form.handleSubmit()}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <section className="flex flex-col gap-4">
          <form.Field name="name">
            {(field) => (
              <Field label="Name" error={fieldError(field.state.meta.errors)}>
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
          <form.Field name="comment">
            {(field) => (
              <Field label="Description" hint="Optional. Saved as a comment on the table.">
                {(p) => (
                  <Input
                    {...p}
                    placeholder="What this table holds"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </Field>
            )}
          </form.Field>
          <form.Field name="rls">
            {(field) => (
              <label className="flex cursor-pointer items-start gap-3 rounded-card border border-border p-3">
                <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm text-fg">Enable Row Level Security</span>
                  <span className="text-xs text-fg-muted">
                    Only rows allowed by a policy can be read or changed. Roles without a policy see nothing.
                  </span>
                </span>
              </label>
            )}
          </form.Field>
        </section>

        <form.Field name="columns" mode="array">
          {(columns) => (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-fg">Columns</h3>
              <div className="grid grid-cols-[1fr_1.3fr_1fr_40px_40px_48px_84px] gap-2 px-1 text-[11px] font-medium text-fg-subtle">
                <span>Name</span>
                <span>Type</span>
                <span>Default</span>
                <span className="text-center">Null</span>
                <span className="text-center">PK</span>
                <span className="text-center">Unique</span>
                <span />
              </div>
              {columns.state.value.map((_, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.3fr_1fr_40px_40px_48px_84px] items-start gap-2">
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
                        <TypeInput
                          value={f.state.value}
                          onChange={f.handleChange}
                          onBlur={f.handleBlur}
                          invalid={f.state.meta.errors.length > 0}
                        />
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
                        placeholder="NULL"
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
                    <IconButton
                      size="sm"
                      label="Move up"
                      icon={<ArrowUp />}
                      disabled={i === 0}
                      onClick={() => columns.moveValue(i, i - 1)}
                    />
                    <IconButton
                      size="sm"
                      label="Move down"
                      icon={<ArrowDown />}
                      disabled={i === columns.state.value.length - 1}
                      onClick={() => columns.moveValue(i, i + 1)}
                    />
                    <IconButton size="sm" label="Remove column" icon={<Trash2 />} onClick={() => columns.removeValue(i)} />
                  </div>
                </div>
              ))}
              <Button
                size="sm"
                variant="secondary"
                iconLeft={<Plus />}
                className="w-fit"
                onClick={() => columns.pushValue(blankColumn())}
              >
                Add column
              </Button>
            </section>
          )}
        </form.Field>

        {formErrors.length > 0 && values.name && (
          <p className="text-xs text-danger">{formErrors.map((e) => fieldError([e])).filter(Boolean)[0]}</p>
        )}

        <section className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowSql((s) => !s)}
            className="flex w-fit cursor-pointer items-center gap-1 text-xs text-fg-muted hover:text-fg"
            aria-expanded={showSql}
          >
            <ChevronRight className={`size-3.5 transition-transform ${showSql ? "rotate-90" : ""}`} />
            SQL that will run
          </button>
          {showSql && <SqlBlock sql={preview} className="max-h-72" />}
        </section>

        {run.isError && (
          <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5 text-xs">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
            <span className="text-fg">{describeError(run.error).message}</span>
          </div>
        )}
      </form>
    </SheetContent>
  );
}
