import {
  Button,
  cn,
  Dialog,
  DialogClose,
  Field,
  Input,
  Select,
  SheetContent,
  toast,
} from "@repo/ui";
import { AlertTriangle, Check } from "lucide-react";
import { useState } from "react";
import type { PolicyInfo } from "../../../lib/bindings";
import { describeError } from "../../../lib/ipc";
import { ident, qualified } from "../../../lib/sql";
import { useRunSql } from "../explorer-context";
import { SqlBlock } from "../sql/sql-editor";

export const COMMANDS = [
  "ALL",
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
] as const;
type Command = (typeof COMMANDS)[number];

interface Draft {
  name: string;
  command: Command;
  permissive: boolean;
  roles: string[];
  using: string;
  withCheck: string;
}

/** Which expressions a command takes: USING filters existing rows, WITH CHECK new ones. */
const usesUsing = (c: Command) => c !== "INSERT";
const usesCheck = (c: Command) =>
  c === "ALL" || c === "INSERT" || c === "UPDATE";

const COMMAND_HINTS: Record<Command, string> = {
  ALL: "Every operation",
  SELECT: "Reading rows",
  INSERT: "Adding rows",
  UPDATE: "Changing rows",
  DELETE: "Removing rows",
};

const TEMPLATES: {
  title: string;
  description: string;
  draft: Partial<Draft>;
}[] = [
  {
    title: "Read access for everyone",
    description: "Any role can read every row.",
    draft: {
      name: "Enable read access for all",
      command: "SELECT",
      permissive: true,
      roles: ["public"],
      using: "true",
    },
  },
  {
    title: "Insert for everyone",
    description: "Any role can add rows.",
    draft: {
      name: "Enable insert for all",
      command: "INSERT",
      permissive: true,
      roles: ["public"],
      withCheck: "true",
    },
  },
  {
    title: "Only their own rows",
    description:
      "Roles see and change rows they own. Replace owner with your column.",
    draft: {
      name: "Users can manage their own rows",
      command: "ALL",
      permissive: true,
      roles: ["public"],
      using: "owner = current_user",
      withCheck: "owner = current_user",
    },
  },
  {
    title: "Block deletes",
    description: "A restrictive policy no one can get past to delete.",
    draft: {
      name: "Block deletes",
      command: "DELETE",
      permissive: false,
      roles: ["public"],
      using: "false",
    },
  },
];

/** Role names in a `TO` list: `public` is a keyword, the rest are identifiers. */
function roleList(roles: string[]) {
  return roles.map((r) => (r === "public" ? "public" : ident(r))).join(", ");
}

export function createPolicySql(schema: string, table: string, d: Draft) {
  const lines = [
    `CREATE POLICY ${ident(d.name.trim())}`,
    `  ON ${qualified(schema, table)}`,
    `  AS ${d.permissive ? "PERMISSIVE" : "RESTRICTIVE"}`,
    `  FOR ${d.command}`,
    `  TO ${roleList(d.roles.length ? d.roles : ["public"])}`,
  ];
  if (usesUsing(d.command) && d.using.trim())
    lines.push(`  USING (${d.using.trim()})`);
  if (usesCheck(d.command) && d.withCheck.trim())
    lines.push(`  WITH CHECK (${d.withCheck.trim()})`);
  return `${lines.join("\n")};`;
}

export function dropPolicySql(schema: string, table: string, name: string) {
  return `DROP POLICY ${ident(name)} ON ${qualified(schema, table)};`;
}

/**
 * "Create / edit policy" side panel, like Supabase's: name, command, roles and the two
 * expressions, with templates to start from and the SQL it will run.
 */
export function PolicySheet({
  open,
  onOpenChange,
  database,
  schema,
  table,
  roles,
  policy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: string;
  schema: string;
  table: string;
  /** Roles a policy can target, `public` first. */
  roles: string[];
  /** The policy being edited; empty for a new one. */
  policy?: PolicyInfo;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <PolicyForm
          database={database}
          schema={schema}
          table={table}
          roles={roles}
          policy={policy}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function PolicyForm({
  database,
  schema,
  table,
  roles,
  policy,
  onDone,
}: {
  database: string;
  schema: string;
  table: string;
  roles: string[];
  policy?: PolicyInfo;
  onDone: () => void;
}) {
  const run = useRunSql();
  const [draft, setDraft] = useState<Draft>(() => ({
    name: policy?.name ?? "",
    command: (policy?.command as Command | undefined) ?? "SELECT",
    permissive: policy?.permissive ?? true,
    roles: policy?.roles ?? ["public"],
    using: policy?.using ?? "",
    withCheck: policy?.withCheck ?? "",
  }));
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const missing = !draft.name.trim()
    ? "Give the policy a name."
    : usesUsing(draft.command) &&
        !draft.using.trim() &&
        !(usesCheck(draft.command) && draft.withCheck.trim())
      ? "Add a USING expression."
      : draft.command === "INSERT" && !draft.withCheck.trim()
        ? "Add a WITH CHECK expression."
        : null;

  const create = createPolicySql(schema, table, draft);
  // Postgres can't change a policy's command or behaviour in place, so edits replace it
  const sql = policy
    ? `BEGIN;\n${dropPolicySql(schema, table, policy.name)}\n${create}\nCOMMIT;`
    : create;

  const toggleRole = (role: string) =>
    patch({
      roles:
        role === "public"
          ? ["public"]
          : draft.roles.includes(role)
            ? draft.roles.filter((r) => r !== role)
            : [...draft.roles.filter((r) => r !== "public"), role],
    });

  const submit = () => {
    if (missing || run.isPending) return;
    run.mutate(
      { sql, database },
      {
        onSuccess: () => {
          toast.success(
            policy
              ? `Policy ${draft.name.trim()} updated`
              : `Policy ${draft.name.trim()} created`,
          );
          onDone();
        },
      },
    );
  };

  return (
    <SheetContent
      title={
        <>
          {policy ? "Edit policy on" : "Create a new policy on"}{" "}
          <span className="font-mono">{table}</span>
        </>
      }
      description="Policies decide which rows each role can read or change while Row Level Security is on."
      className="w-[680px]"
      footer={
        <>
          {missing && (
            <span className="mr-auto text-xs text-fg-subtle">{missing}</span>
          )}
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="primary"
            disabled={missing !== null}
            loading={run.isPending}
            onClick={submit}
          >
            {policy ? "Save policy" : "Create policy"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!policy && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-fg-muted">
              Start from a template
            </span>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.title}
                  type="button"
                  onClick={() =>
                    setDraft({
                      name: "",
                      command: "SELECT",
                      permissive: true,
                      roles: ["public"],
                      using: "",
                      withCheck: "",
                      ...t.draft,
                    })
                  }
                  className="flex flex-col gap-0.5 rounded-control border border-border-strong px-3 py-2 text-left transition-colors hover:border-accent/50 hover:bg-surface-hover"
                >
                  <span className="text-xs font-medium text-fg">{t.title}</span>
                  <span className="text-[11px] text-fg-subtle">
                    {t.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="Policy name">
          {(p) => (
            <Input
              {...p}
              autoFocus
              placeholder="e.g. Users can read their own orders"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Table">
            {(p) => (
              <Input
                {...p}
                disabled
                className="font-mono"
                value={`${schema}.${table}`}
              />
            )}
          </Field>
          <Field label="Policy behavior">
            {(p) => (
              <Select
                {...p}
                value={draft.permissive ? "permissive" : "restrictive"}
                onValueChange={(v) => patch({ permissive: v === "permissive" })}
                options={[
                  {
                    value: "permissive",
                    label: "Permissive",
                    hint: "any one can allow",
                  },
                  {
                    value: "restrictive",
                    label: "Restrictive",
                    hint: "all must allow",
                  },
                ]}
              />
            )}
          </Field>
        </div>

        <Field label="Policy command" hint={COMMAND_HINTS[draft.command]}>
          {() => (
            <div className="grid grid-cols-5 gap-1 rounded-control border border-border-strong bg-bg p-1">
              {COMMANDS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => patch({ command: c })}
                  className={cn(
                    "rounded px-2 py-1 font-mono text-xs transition-colors",
                    draft.command === c
                      ? "bg-accent text-accent-fg"
                      : "text-fg-muted hover:bg-surface-hover hover:text-fg",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field
          label="Target roles"
          hint={
            draft.roles.includes("public")
              ? "Applies to every role"
              : `Applies to ${draft.roles.length} role${draft.roles.length === 1 ? "" : "s"}`
          }
        >
          {() => (
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {roles.map((r) => {
                const on = draft.roles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors",
                      on
                        ? "border-accent/50 bg-accent-muted text-accent"
                        : "border-border-strong text-fg-muted hover:text-fg",
                    )}
                  >
                    {on && <Check className="size-3" />}
                    {r === "public" ? "public (all roles)" : r}
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        {usesUsing(draft.command) && (
          <Expression
            label="USING expression"
            hint="Rows where this is true can be seen, updated or deleted."
            placeholder="e.g. owner = current_user"
            value={draft.using}
            onChange={(using) => patch({ using })}
          />
        )}
        {usesCheck(draft.command) && (
          <Expression
            label="WITH CHECK expression"
            hint="New or changed rows must make this true. Leave empty to reuse USING."
            placeholder="e.g. owner = current_user"
            value={draft.withCheck}
            onChange={(withCheck) => patch({ withCheck })}
          />
        )}

        <div className="flex flex-col gap-2">
          {run.isError && (
            <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
              <span className="break-words text-fg">
                {describeError(run.error).message}
              </span>
            </div>
          )}
          <span className="text-xs font-medium text-fg-muted">SQL preview</span>
          <SqlBlock sql={sql} className="max-h-56" />
        </div>
      </div>
    </SheetContent>
  );
}

function Expression({
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      {(p) => (
        <textarea
          {...p}
          rows={2}
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-y rounded-control border border-border-strong bg-bg px-2.5 py-2 font-mono text-xs text-fg transition-colors placeholder:text-fg-subtle focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none"
        />
      )}
    </Field>
  );
}
