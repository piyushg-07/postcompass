import { Checkbox, Field, Select, Switch, toast } from "@repo/ui";
import { useState } from "react";
import type { FunctionInfo, SchemaTriggerInfo } from "../../../../lib/bindings";
import { describeError } from "../../../../lib/ipc";
import {
  createTrigger,
  setTriggerEnabled,
  type TriggerEvent,
  type TriggerTiming,
} from "../../../../lib/sql";
import { useRunSql, useTables } from "../../explorer-context";
import { NameField } from "../../run-sql-dialog";
import { isName, triggerProblem } from "./ddl";
import { type Common, FormSheet, Section } from "./shared";

const EVENTS: TriggerEvent[] = ["INSERT", "UPDATE", "DELETE", "TRUNCATE"];

export function NewTrigger({
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
  const onView =
    tables.data?.find((t) => t.name === table)?.kind === "view";
  const problem = table
    ? triggerProblem({ timing, events, forEachRow, onView })
    : null;
  const ok = isName(name) && table && events.length > 0 && fn && !problem;
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
          : `-- ${problem ?? "fill in the trigger"}`
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
        {problem && <p className="text-xs text-warning">{problem}</p>}
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
