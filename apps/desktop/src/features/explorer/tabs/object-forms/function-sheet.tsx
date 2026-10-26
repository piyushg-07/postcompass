import { Button, cn, Field, Input, Select } from "@repo/ui";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FunctionInfo } from "../../../../lib/bindings";
import { COMMON_TYPES, type Volatility } from "../../../../lib/sql";
import { NameField } from "../../run-sql-dialog";
import { SqlEditor } from "../../sql/sql-editor";
import { type ArgRow, functionSql } from "./ddl";
import { type Common, FormSheet, Section } from "./shared";

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

/** Create or edit a function like Supabase: name, arguments, return type, then the code. */
export function FunctionSheet({
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

  const sql = functionSql(
    {
      schema,
      name,
      args,
      returns,
      language,
      body,
      volatility,
      securityDefiner: definer,
    },
    item,
  );

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
