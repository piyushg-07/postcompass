import {
  Button,
  Checkbox,
  cn,
  Dialog,
  DialogClose,
  Field,
  Input,
  Select,
  SheetContent,
  Spinner,
  Switch,
  toast,
} from "@repo/ui";
import { AlertTriangle, ChevronRight, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import type {
  EnumInfo,
  FunctionInfo,
  SchemaTriggerInfo,
  SequenceInfo,
} from "../../../lib/bindings";
import { describeError } from "../../../lib/ipc";
import {
  addEnumValue,
  alterSequence,
  COMMON_TYPES,
  createEnum,
  createFunction,
  createSequence,
  createTrigger,
  dropRoutine,
  dropSequence,
  dropTrigger,
  dropType,
  isSafeTypeName,
  removeEnumValue,
  renameEnumValue,
  renameRoutine,
  renameSequence,
  renameTrigger,
  renameType,
  restartSequence,
  setTriggerEnabled,
  type TriggerEvent,
  type TriggerTiming,
  type Volatility,
} from "../../../lib/sql";
import { useDefinition, useRunSql, useTables } from "../explorer-context";
import { NameField, RunSqlDialog } from "../run-sql-dialog";
import { SqlBlock, SqlEditor } from "../sql/sql-editor";

/** Which form is open on a Database page. */
export type ObjectAction =
  | { kind: "enum-new" }
  | { kind: "enum-edit"; item: EnumInfo }
  | { kind: "enum-drop"; item: EnumInfo }
  | { kind: "trigger-new" }
  | { kind: "trigger-rename"; item: SchemaTriggerInfo }
  | { kind: "trigger-drop"; item: SchemaTriggerInfo }
  | { kind: "function-new" }
  | { kind: "function-edit"; item: FunctionInfo }
  | { kind: "function-rename"; item: FunctionInfo }
  | { kind: "function-drop"; item: FunctionInfo }
  | { kind: "sequence-new" }
  | { kind: "sequence-edit"; item: SequenceInfo }
  | { kind: "sequence-restart"; item: SequenceInfo }
  | { kind: "sequence-rename"; item: SequenceInfo }
  | { kind: "sequence-drop"; item: SequenceInfo };

const isName = (v: string) => v.trim().length > 0 && v.trim().length <= 63;
const isInt = (v: string) => /^-?\d+$/.test(v.trim());

/** Renders the form for `action`; `onClose` closes it. */
export function ObjectForms({
  action,
  onClose,
  database,
  schema,
  functions,
}: {
  action: ObjectAction | null;
  onClose: () => void;
  database: string;
  schema: string;
  functions: FunctionInfo[];
}) {
  if (!action) return null;
  const common = { database, schema, onClose };
  switch (action.kind) {
    case "enum-new":
      return <EnumSheet {...common} />;
    case "enum-edit":
      return <EnumSheet {...common} item={action.item} />;
    case "enum-drop":
      return (
        <Drop
          {...common}
          title={`Delete enum ${action.item.name}?`}
          what="enum"
          build={(cascade) => dropType(schema, action.item.name, cascade)}
          cascadeLabel="Also delete columns that use it"
        />
      );
    case "trigger-new":
      return <NewTrigger {...common} functions={functions} />;
    case "trigger-rename":
      return (
        <Rename
          {...common}
          title={`Rename trigger ${action.item.name}`}
          current={action.item.name}
          build={(n) =>
            renameTrigger(schema, action.item.table, action.item.name, n)
          }
        />
      );
    case "trigger-drop":
      return (
        <Drop
          {...common}
          title={`Delete trigger ${action.item.name}?`}
          what="trigger"
          detail={`It stops running on ${action.item.table}. The table and its data aren't changed.`}
          build={() => dropTrigger(schema, action.item.table, action.item.name)}
        />
      );
    case "function-new":
      return <FunctionSheet {...common} />;
    case "function-edit":
      return fitsFunctionForm(action.item) ? (
        <FunctionSheet {...common} item={action.item} />
      ) : (
        <EditFunction {...common} item={action.item} />
      );
    case "function-rename":
      return (
        <Rename
          {...common}
          title={`Rename ${action.item.kind} ${action.item.name}`}
          current={action.item.name}
          build={(n) =>
            renameRoutine(
              schema,
              action.item.name,
              action.item.arguments,
              action.item.kind,
              n,
            )
          }
        />
      );
    case "function-drop":
      return (
        <Drop
          {...common}
          title={`Delete ${action.item.kind} ${action.item.name}?`}
          what={action.item.kind}
          build={(cascade) =>
            dropRoutine(
              schema,
              action.item.name,
              action.item.arguments,
              action.item.kind,
              cascade,
            )
          }
          cascadeLabel="Also delete triggers and other objects that use it"
        />
      );
    case "sequence-new":
      return <NewSequence {...common} />;
    case "sequence-edit":
      return <EditSequence {...common} item={action.item} />;
    case "sequence-restart":
      return (
        <RunSqlDialog
          open
          onOpenChange={(o) => !o && onClose()}
          title={`Restart sequence ${action.item.name}?`}
          description="The next value goes back to the sequence's start value. New rows could clash with existing ids."
          sql={restartSequence(schema, action.item.name)}
          database={database}
          confirmLabel="Restart"
          destructive
          successMessage={`${action.item.name} restarted`}
        />
      );
    case "sequence-rename":
      return (
        <Rename
          {...common}
          title={`Rename sequence ${action.item.name}`}
          current={action.item.name}
          build={(n) => renameSequence(schema, action.item.name, n)}
        />
      );
    case "sequence-drop":
      return (
        <Drop
          {...common}
          title={`Delete sequence ${action.item.name}?`}
          what="sequence"
          build={(cascade) => dropSequence(schema, action.item.name, cascade)}
          cascadeLabel="Also remove column defaults that use it"
        />
      );
  }
}

interface Common {
  database: string;
  schema: string;
  onClose: () => void;
}

/* ── Shared ───────────────────────────────────────────────────────────── */

function Rename({
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

function Drop({
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
function FormSheet({
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
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] font-medium tracking-wide text-fg-subtle uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/* ── Enums ────────────────────────────────────────────────────────────── */

interface EnumRow {
  key: number;
  /** The value as it is in the database; unset for a new value. */
  original?: string;
  value: string;
}

/**
 * Create or edit an enum, like Supabase: the name plus its values as a list. Values can be
 * renamed in place, removed, or added at the end.
 */
function EnumSheet({
  database,
  schema,
  onClose,
  item,
}: Common & { item?: EnumInfo }) {
  const [name, setName] = useState(item?.name ?? "");
  const [rows, setRows] = useState<EnumRow[]>(
    item
      ? item.values.map((v, i) => ({ key: i, original: v, value: v }))
      : [{ key: 0, value: "" }],
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const [focusKey, setFocusKey] = useState<number | null>(null);

  const addRow = () => {
    setRows((rs) => [...rs, { key: nextKey, value: "" }]);
    setFocusKey(nextKey);
    setNextKey((k) => k + 1);
  };
  const setValue = (key: number, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, value } : r)));
  const removeRow = (key: number) =>
    setRows((rs) => rs.filter((r) => r.key !== key));

  // New rows left empty are ignored; existing ones must keep a value
  const kept = rows.filter((r) => r.original !== undefined || r.value.trim());
  const values = kept.map((r) => r.value.trim());
  const valid =
    isName(name) &&
    values.length > 0 &&
    values.every(Boolean) &&
    new Set(values).size === values.length;
  const duplicate = (r: EnumRow) =>
    !!r.value.trim() &&
    rows.some((o) => o.key !== r.key && o.value.trim() === r.value.trim());

  const renamed = kept.filter(
    (r) => r.original !== undefined && r.value.trim() !== r.original,
  );
  const added = kept.filter((r) => r.original === undefined);
  const removed = (item?.values ?? []).filter(
    (v) => !kept.some((r) => r.original === v),
  );

  let sql = "-- name and values";
  if (valid && !item) sql = createEnum(schema, name.trim(), values);
  else if (valid && item) {
    const steps = renamed.map((r) =>
      renameEnumValue(schema, item.name, r.original!, r.value.trim()),
    );
    // Removing needs a rebuild, which also brings in the new values
    if (removed.length) steps.push(removeEnumValue(schema, item.name, values));
    else
      steps.push(
        ...added.map((r) => addEnumValue(schema, item.name, r.value.trim())),
      );
    if (name.trim() !== item.name)
      steps.push(renameType(schema, item.name, name.trim()));
    sql = steps.length ? steps.join("\n") : "-- nothing changed";
  }

  return (
    <FormSheet
      database={database}
      onClose={onClose}
      title={item ? `Edit enum ${item.name}` : "New enum"}
      description="A fixed list of allowed values, like order status."
      sql={sql}
      confirmLabel={item ? "Save" : "Create enum"}
      successMessage={
        item ? `${name.trim()} saved` : `Enum ${name.trim()} created`
      }
    >
      <Section title="General">
        <NameField value={name} onChange={setName} placeholder="order_status" />
      </Section>
      <Section title="Values">
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-2">
              <Input
                aria-label="Value"
                className="font-mono"
                spellCheck={false}
                placeholder="e.g. pending"
                value={r.value}
                autoFocus={r.key === focusKey}
                aria-invalid={
                  duplicate(r) ||
                  (r.original !== undefined && !r.value.trim()) ||
                  undefined
                }
                onChange={(e) => setValue(r.key, e.target.value)}
                onKeyDown={(e) => {
                  // Enter moves on to a new value instead of saving
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRow();
                  }
                }}
              />
              <button
                type="button"
                aria-label={`Remove ${r.value || "value"}`}
                disabled={rows.length === 1}
                onClick={() => removeRow(r.key)}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-fg-subtle hover:bg-surface-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            iconLeft={<Plus />}
            className="self-start"
            onClick={addRow}
          >
            Add value
          </Button>
        </div>
        {removed.length > 0 && (
          <p className="text-xs text-fg-muted">
            Removing a value rebuilds the enum. It fails, changing nothing, if a
            row still uses{" "}
            <span className="font-mono text-fg">{removed.join(", ")}</span>.
          </p>
        )}
      </Section>
    </FormSheet>
  );
}

/* ── Triggers ─────────────────────────────────────────────────────────── */

const EVENTS: TriggerEvent[] = ["INSERT", "UPDATE", "DELETE", "TRUNCATE"];

function NewTrigger({
  database,
  schema,
  onClose,
  functions,
}: Common & { functions: FunctionInfo[] }) {
  const tables = useTables(database, schema);
  const triggerFns = functions.filter((f) => f.returns === "trigger");
  const [name, setName] = useState("");
  const [table, setTable] = useState("");
  const [timing, setTiming] = useState<TriggerTiming>("BEFORE");
  const [events, setEvents] = useState<TriggerEvent[]>(["INSERT"]);
  const [forEachRow, setForEachRow] = useState(true);
  const [fn, setFn] = useState(triggerFns[0]?.name ?? "");
  const ok = isName(name) && table && events.length > 0 && fn;
  const toggle = (e: TriggerEvent) =>
    setEvents((xs) =>
      xs.includes(e) ? xs.filter((x) => x !== e) : [...xs, e],
    );

  return (
    <FormSheet
      database={database}
      onClose={onClose}
      title="New trigger"
      description="Runs a function automatically when rows change."
      sql={
        ok
          ? createTrigger({
              schema,
              name: name.trim(),
              table,
              timing,
              events,
              forEachRow,
              functionName: fn,
            })
          : "-- fill in the trigger"
      }
      confirmLabel="Create trigger"
      successMessage={`Trigger ${name.trim()} created`}
    >
      <Section title="General">
        <NameField
          value={name}
          onChange={setName}
          placeholder="orders_set_updated_at"
        />
        <Field label="Table">
          {(p) => (
            <Select
              {...p}
              mono
              value={table}
              placeholder="Choose a table…"
              onValueChange={setTable}
              options={(tables.data ?? [])
                .filter(
                  (t) =>
                    t.kind === "table" ||
                    t.kind === "partitioned_table" ||
                    t.kind === "view",
                )
                .map((t) => ({
                  value: t.name,
                  label: t.name,
                  hint: t.kind === "view" ? "view" : undefined,
                }))}
            />
          )}
        </Field>
      </Section>

      <Section title="Conditions">
        <Field label="When">
          {(p) => (
            <Select
              {...p}
              value={timing}
              onValueChange={(v) => setTiming(v as TriggerTiming)}
              options={[
                { value: "BEFORE", label: "Before the change" },
                { value: "AFTER", label: "After the change" },
                { value: "INSTEAD OF", label: "Instead of (views only)" },
              ]}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-fg-muted">Events</span>
          <div className="grid grid-cols-2 gap-2">
            {EVENTS.map((e) => (
              <label
                key={e}
                className="flex h-9 cursor-pointer items-center gap-2.5 rounded-control border border-border px-3 font-mono text-xs text-fg hover:border-border-strong has-[[data-state=checked]]:border-accent/50 has-[[data-state=checked]]:bg-accent/5"
              >
                <Checkbox
                  checked={events.includes(e)}
                  onCheckedChange={() => toggle(e)}
                />
                {e}
              </label>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-control border border-border px-3 py-2.5">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm text-fg">For each row</span>
            <span className="text-xs text-fg-muted">
              Off runs it once per statement.
            </span>
          </span>
          <Switch checked={forEachRow} onCheckedChange={setForEachRow} />
        </label>
      </Section>

      <Section title="Function">
        <Field
          label="Trigger function"
          hint={
            triggerFns.length
              ? undefined
              : "Create one first: Functions, New, Trigger function."
          }
        >
          {(p) => (
            <Select
              {...p}
              mono
              value={fn}
              placeholder="No trigger functions"
              disabled={!triggerFns.length}
              onValueChange={setFn}
              options={triggerFns.map((f) => ({
                value: f.name,
                label: `${f.name}()`,
              }))}
            />
          )}
        </Field>
      </Section>
    </FormSheet>
  );
}

/** Inline enable/disable switch for a trigger row. */
export function TriggerSwitch({
  database,
  schema,
  item,
}: {
  database: string;
  schema: string;
  item: SchemaTriggerInfo;
}) {
  const run = useRunSql();
  return (
    <span
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-2"
    >
      <Switch
        checked={item.enabled}
        disabled={run.isPending}
        aria-label={
          item.enabled ? `Disable ${item.name}` : `Enable ${item.name}`
        }
        onCheckedChange={(enabled) =>
          run.mutate(
            {
              sql: setTriggerEnabled(schema, item.table, item.name, enabled),
              database,
            },
            {
              onSuccess: () =>
                toast.success(
                  `${item.name} ${enabled ? "enabled" : "disabled"}`,
                ),
              onError: (e) =>
                toast.error("Couldn't change the trigger", {
                  description: describeError(e).message,
                }),
            },
          )
        }
      />
      <span className="text-xs text-fg-muted">
        {item.enabled ? "Enabled" : "Disabled"}
      </span>
    </span>
  );
}

/* ── Functions ────────────────────────────────────────────────────────── */

const LANGUAGES = ["plpgsql", "sql"];
const PLPGSQL_BODY = "begin\n  \nend;";

/** Type choices for the function form, keeping `current` if it isn't a common one. */
function typeOptions(extra: string[], current: string) {
  const all = [...extra, ...COMMON_TYPES];
  if (current && !all.includes(current)) all.unshift(current);
  return all.map((t) => ({ value: t, label: t }));
}

/** Whether `item` fits the form; others (OUT args, defaults, TABLE results…) open as SQL. */
export function fitsFunctionForm(item: FunctionInfo) {
  return (
    item.kind === "function" &&
    item.args !== null &&
    !/^TABLE\(/i.test(item.returns)
  );
}

interface ArgRow {
  key: number;
  name: string;
  type: string;
}

/** Create or edit a function like Supabase: name, arguments, return type, then the code. */
function FunctionSheet({
  database,
  schema,
  onClose,
  item,
}: Common & { item?: FunctionInfo }) {
  const [name, setName] = useState(item?.name ?? "");
  const [args, setArgs] = useState<ArgRow[]>(
    (item?.args ?? []).map((a, i) => ({
      key: i,
      name: a.name,
      type: a.dataType,
    })),
  );
  const [nextKey, setNextKey] = useState(args.length);
  const [returns, setReturns] = useState(item?.returns ?? "void");
  const [language, setLanguage] = useState(item?.language ?? "plpgsql");
  const [body, setBody] = useState(item?.body.trim() ?? PLPGSQL_BODY);
  const [volatility, setVolatility] = useState<Volatility>(
    (item?.volatility as Volatility | undefined) ?? "volatile",
  );
  const [definer, setDefiner] = useState(item?.securityDefiner ?? false);
  const [advanced, setAdvanced] = useState(false);

  const addArg = () => {
    setArgs((xs) => [...xs, { key: nextKey, name: "", type: "text" }]);
    setNextKey((k) => k + 1);
  };
  const patchArg = (key: number, patch: Partial<ArgRow>) =>
    setArgs((xs) => xs.map((a) => (a.key === key ? { ...a, ...patch } : a)));

  const argNames = args.map((a) => a.name.trim()).filter(Boolean);
  const valid =
    isName(name) &&
    args.every((a) => isSafeTypeName(a.type)) &&
    new Set(argNames).size === argNames.length &&
    argNames.every(isName) &&
    isSafeTypeName(returns) &&
    body.trim().length > 0;

  let sql = "-- fill in the function";
  if (valid) {
    const spec = {
      schema,
      name: name.trim(),
      args: args.map((a) => ({ name: a.name, type: a.type })),
      returns,
      language,
      body,
      volatility,
      securityDefiner: definer,
    };
    // CREATE OR REPLACE can't change the name, arguments or return type: swap the function
    const signatureChanged =
      item &&
      (spec.name !== item.name ||
        returns !== item.returns ||
        args.length !== item.args?.length ||
        args.some(
          (a, i) =>
            a.name.trim() !== item.args?.[i]?.name ||
            a.type !== item.args?.[i]?.dataType,
        ));
    sql = signatureChanged
      ? `${dropRoutine(schema, item.name, item.arguments, "function", false)}\n${createFunction(spec, false)}`
      : createFunction(spec, true);
  }

  return (
    <FormSheet
      database={database}
      onClose={onClose}
      className="w-[640px]"
      title={item ? `Edit function ${item.name}` : "New function"}
      description={
        item
          ? undefined
          : "Code that runs inside the database. Return trigger to use it in a trigger."
      }
      sql={sql}
      confirmLabel={item ? "Save" : "Create function"}
      successMessage={
        item ? `${name.trim()} saved` : `Function ${name.trim()} created`
      }
    >
      <Section title="General">
        <NameField value={name} onChange={setName} placeholder="my_function" />
      </Section>

      <Section title="Arguments">
        {args.length > 0 && (
          <div className="flex flex-col gap-2">
            {args.map((a) => (
              <div key={a.key} className="flex items-center gap-2">
                <Input
                  aria-label="Argument name"
                  className="font-mono"
                  spellCheck={false}
                  placeholder="name"
                  value={a.name}
                  autoFocus={a.key === nextKey - 1 && !item}
                  onChange={(e) => patchArg(a.key, { name: e.target.value })}
                />
                <Select
                  aria-label="Argument type"
                  mono
                  className="w-48 shrink-0"
                  value={a.type}
                  onValueChange={(type) => patchArg(a.key, { type })}
                  options={typeOptions([], a.type)}
                />
                <button
                  type="button"
                  aria-label={`Remove ${a.name || "argument"}`}
                  onClick={() =>
                    setArgs((xs) => xs.filter((x) => x.key !== a.key))
                  }
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-fg-subtle hover:bg-surface-hover hover:text-fg"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          iconLeft={<Plus />}
          className="self-start"
          onClick={addArg}
        >
          Add argument
        </Button>
      </Section>

      <Section title="Returns">
        <Field label="Return type">
          {(p) => (
            <Select
              {...p}
              mono
              value={returns}
              onValueChange={setReturns}
              options={typeOptions(["void", "trigger", "record"], returns)}
            />
          )}
        </Field>
      </Section>

      <Section title="Definition">
        <div className="h-64 overflow-hidden rounded-card border border-border-strong">
          <SqlEditor value={body} onChange={setBody} className="h-full" />
        </div>
        <p className="text-xs text-fg-muted">
          {language === "plpgsql"
            ? returns === "trigger"
              ? "Runs between begin and end. NEW is the row being written, OLD the previous one; return NEW to keep the change."
              : "Runs between begin and end. Use the arguments by name."
            : "One or more SQL statements; the last one gives the result."}
        </p>
      </Section>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="flex cursor-pointer items-center gap-1.5 self-start text-xs text-fg-muted hover:text-fg"
        >
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform",
              advanced && "rotate-90",
            )}
          />
          {advanced ? "Hide advanced settings" : "Show advanced settings"}
        </button>
        {advanced && (
          <div className="flex flex-col gap-3">
            <Field label="Language">
              {(p) => (
                <Select
                  {...p}
                  mono
                  value={language}
                  onValueChange={(l) => {
                    setLanguage(l);
                    // Swap the untouched starter code for one that fits
                    if (l === "sql" && body === PLPGSQL_BODY)
                      setBody("select 1;");
                    if (l === "plpgsql" && body === "select 1;")
                      setBody(PLPGSQL_BODY);
                  }}
                  options={[...new Set([...LANGUAGES, language])].map((l) => ({
                    value: l,
                    label: l,
                  }))}
                />
              )}
            </Field>
            <Field label="Behavior">
              {(p) => (
                <Select
                  {...p}
                  value={volatility}
                  onValueChange={(v) => setVolatility(v as Volatility)}
                  options={[
                    {
                      value: "volatile",
                      label: "Volatile",
                      hint: "can change data",
                    },
                    {
                      value: "stable",
                      label: "Stable",
                      hint: "reads data only",
                    },
                    {
                      value: "immutable",
                      label: "Immutable",
                      hint: "same input, same result",
                    },
                  ]}
                />
              )}
            </Field>
            <Field label="Security">
              {(p) => (
                <Select
                  {...p}
                  value={definer ? "definer" : "invoker"}
                  onValueChange={(v) => setDefiner(v === "definer")}
                  options={[
                    {
                      value: "invoker",
                      label: "Security invoker",
                      hint: "caller's permissions",
                    },
                    {
                      value: "definer",
                      label: "Security definer",
                      hint: "owner's permissions",
                    },
                  ]}
                />
              )}
            </Field>
          </div>
        )}
      </div>
    </FormSheet>
  );
}

/** Loads an existing function's code, then opens it in the editor. */
function EditFunction(props: Common & { item: FunctionInfo }) {
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

  const save = () =>
    run.mutate(
      { sql, database },
      {
        onSuccess: () => {
          toast.success(`${item.name} saved`);
          onClose();
        },
      },
    );

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

/* ── Sequences ────────────────────────────────────────────────────────── */

function NewSequence({ database, schema, onClose }: Common) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("1");
  const [increment, setIncrement] = useState("1");
  const ok =
    isName(name) && isInt(start) && isInt(increment) && Number(increment) !== 0;
  return (
    <FormSheet
      database={database}
      onClose={onClose}
      title="New sequence"
      description="A counter that hands out unique numbers, e.g. for ids."
      sql={
        ok
          ? createSequence(schema, name.trim(), start, increment)
          : "-- fill in the sequence"
      }
      confirmLabel="Create sequence"
      successMessage={`Sequence ${name.trim()} created`}
    >
      <Section title="General">
        <NameField
          value={name}
          onChange={setName}
          placeholder="invoice_number_seq"
        />
      </Section>
      <Section title="Numbers">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Start at" value={start} onChange={setStart} />
          <NumberField label="Step" value={increment} onChange={setIncrement} />
        </div>
      </Section>
    </FormSheet>
  );
}

function EditSequence({
  database,
  schema,
  onClose,
  item,
}: Common & { item: SequenceInfo }) {
  const [increment, setIncrement] = useState(item.increment);
  const [next, setNext] = useState("");
  const incChanged =
    isInt(increment) &&
    increment.trim() !== item.increment &&
    Number(increment) !== 0;
  const nextSet = isInt(next);
  const ok = incChanged || nextSet;
  return (
    <FormSheet
      database={database}
      onClose={onClose}
      title={`Edit sequence ${item.name}`}
      description={`Last value handed out: ${item.lastValue ?? "none yet"}.`}
      sql={
        ok
          ? alterSequence(schema, item.name, {
              increment: incChanged ? increment.trim() : undefined,
              next: nextSet ? next.trim() : undefined,
            })
          : "-- change the step or the next value"
      }
      confirmLabel="Save"
      successMessage={`${item.name} updated`}
    >
      <Section title="Numbers">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Step" value={increment} onChange={setIncrement} />
          <NumberField
            label="Next value"
            value={next}
            onChange={setNext}
            placeholder="Unchanged"
          />
        </div>
      </Section>
    </FormSheet>
  );
}

function NumberField({
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
