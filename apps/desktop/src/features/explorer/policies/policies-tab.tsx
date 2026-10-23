import { Badge, Button, IconButton, Input, Skeleton, Tooltip } from "@repo/ui";
import {
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Table2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { PolicyInfo, PolicyTable } from "../../../lib/bindings";
import { qualified } from "../../../lib/sql";
import { usePolicies } from "../explorer-context";
import { RunSqlDialog } from "../run-sql-dialog";
import { dropPolicySql, PolicySheet } from "./policy-sheet";
import { LoadError } from "../load-error";

interface PendingSql {
  title: string;
  description: string;
  sql: string;
  confirm: string;
  success: string;
  destructive?: boolean;
}

/**
 * Row Level Security for a schema, like Supabase's Policies page: every table with its RLS
 * switch and policies, and a side panel to write them.
 */
export function PoliciesTab({
  database,
  schema,
  focusTable,
}: {
  database: string;
  schema: string;
  /** Scrolls to and highlights this table (opened from its Structure tab). */
  focusTable?: string;
}) {
  const policies = usePolicies(database, schema);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<{
    table: string;
    policy?: PolicyInfo;
  } | null>(null);
  const [pending, setPending] = useState<PendingSql | null>(null);

  if (policies.isPending) {
    return (
      <div className="flex flex-col gap-3 p-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }
  if (policies.isError) return <LoadError query={policies} />;

  const query = search.trim().toLowerCase();
  const tables = policies.data.tables.filter(
    (t) => !query || t.name.toLowerCase().includes(query),
  );

  const toggleRls = (t: PolicyTable) =>
    setPending(
      t.rlsEnabled
        ? {
            title: `Disable RLS on ${t.name}?`,
            description:
              "Every role with access to the table will read and change all rows; its policies stop applying.",
            sql: `ALTER TABLE ${qualified(schema, t.name)} DISABLE ROW LEVEL SECURITY;`,
            confirm: "Disable RLS",
            success: `RLS disabled on ${t.name}`,
            destructive: true,
          }
        : {
            title: `Enable RLS on ${t.name}?`,
            description:
              t.policies.length === 0
                ? "With no policies yet, roles other than the owner won't see any rows until you add one."
                : "Rows will only be visible and changeable as its policies allow.",
            sql: `ALTER TABLE ${qualified(schema, t.name)} ENABLE ROW LEVEL SECURITY;`,
            confirm: "Enable RLS",
            success: `RLS enabled on ${t.name}`,
          },
    );

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-medium text-fg">Policies</h2>
          <div className="relative w-60 shrink-0">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-subtle" />
            <Input
              className="pl-8"
              placeholder="Filter tables"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {tables.length === 0 && (
          <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-fg-subtle">
            {query ? "No tables match." : `No tables in ${schema}.`}
          </p>
        )}

        {tables.map((t) => (
          <section
            key={t.name}
            ref={(el) => {
              if (el && t.name === focusTable)
                el.scrollIntoView({ block: "start" });
            }}
            className={
              t.name === focusTable
                ? "overflow-hidden rounded-card border border-accent/50 bg-surface/40"
                : "overflow-hidden rounded-card border border-border bg-surface/40"
            }
          >
            <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
              <Table2 className="size-4 text-fg-subtle" />
              <span className="font-mono text-sm text-fg">{t.name}</span>
              {t.rlsEnabled ? (
                <Badge variant="accent">
                  <ShieldCheck className="size-3" />
                  RLS enabled
                </Badge>
              ) : (
                <Badge variant="warning">
                  <ShieldOff className="size-3" />
                  RLS disabled
                </Badge>
              )}
              {t.rlsForced && (
                <Tooltip content="RLS applies to the table owner too">
                  <span>
                    <Badge>forced</Badge>
                  </span>
                </Tooltip>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => toggleRls(t)}>
                  {t.rlsEnabled ? "Disable RLS" : "Enable RLS"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  iconLeft={<Plus />}
                  onClick={() => setSheet({ table: t.name })}
                >
                  Create policy
                </Button>
              </div>
            </header>

            {t.policies.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-fg-subtle">
                {t.rlsEnabled ? (
                  <>
                    <ShieldAlert className="size-3.5 text-warning" />
                    No policies yet, so roles other than the owner can't see any
                    rows.
                  </>
                ) : (
                  <>
                    <ShieldOff className="size-3.5" />
                    No policies. RLS is off, so every role with access reads and
                    changes all rows.
                  </>
                )}
              </div>
            ) : (
              <ul>
                {!t.rlsEnabled && (
                  <li className="flex items-center gap-2 border-b border-border/60 bg-warning/5 px-4 py-2 text-xs text-warning">
                    <ShieldOff className="size-3.5" />
                    RLS is off, so these policies aren't applied yet.
                  </li>
                )}
                {t.policies.map((p) => (
                  <li
                    key={p.name}
                    className="group flex cursor-pointer items-center gap-4 border-b border-border/60 px-4 py-2.5 last:border-b-0 hover:bg-surface-hover/40"
                    onClick={() => setSheet({ table: t.name, policy: p })}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm text-fg">{p.name}</span>
                      <span className="truncate font-mono text-[11px] text-fg-subtle">
                        {[
                          p.using && `USING (${p.using})`,
                          p.withCheck && `WITH CHECK (${p.withCheck})`,
                        ]
                          .filter(Boolean)
                          .join("  ·  ")}
                      </span>
                    </div>
                    <span className="w-20 shrink-0">
                      <Badge className="font-mono">{p.command}</Badge>
                    </span>
                    <span className="w-44 shrink-0 truncate text-xs text-fg-muted">
                      <span className="text-fg-subtle">Applied to: </span>
                      {p.roles.includes("public")
                        ? "all roles"
                        : p.roles.join(", ")}
                    </span>
                    <span className="w-20 shrink-0 text-xs">
                      {p.permissive ? (
                        <span className="text-fg-subtle">Permissive</span>
                      ) : (
                        <span className="text-warning">Restrictive</span>
                      )}
                    </span>
                    <div
                      className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconButton
                        size="sm"
                        label="Edit policy"
                        icon={<Pencil />}
                        onClick={() => setSheet({ table: t.name, policy: p })}
                      />
                      <IconButton
                        size="sm"
                        label="Delete policy"
                        icon={<Trash2 />}
                        onClick={() =>
                          setPending({
                            title: `Delete policy “${p.name}”?`,
                            description: "This can't be undone.",
                            sql: dropPolicySql(schema, t.name, p.name),
                            confirm: "Delete",
                            success: `Policy ${p.name} deleted`,
                            destructive: true,
                          })
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <PolicySheet
        open={sheet !== null}
        onOpenChange={(open) => !open && setSheet(null)}
        database={database}
        schema={schema}
        table={sheet?.table ?? ""}
        roles={policies.data.roles}
        policy={sheet?.policy}
      />
      {pending && (
        <RunSqlDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={pending.title}
          description={pending.description}
          sql={pending.sql}
          database={database}
          confirmLabel={pending.confirm}
          destructive={pending.destructive}
          successMessage={pending.success}
        />
      )}
    </div>
  );
}
