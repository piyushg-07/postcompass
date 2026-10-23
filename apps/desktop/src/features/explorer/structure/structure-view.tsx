import { Badge, Button, cn, IconButton, Skeleton, Tooltip } from "@repo/ui";
import {
  Check,
  KeyRound,
  Link2,
  Pencil,
  Plus,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type { ColumnInfo, TableKind } from "../../../lib/bindings";
import { formatBytes } from "../../../lib/format";
import { describeError } from "../../../lib/ipc";
import { dropColumn, dropConstraint, dropIndex } from "../../../lib/sql";
import { useExplorer, useSchemaGraph, useStructure } from "../explorer-context";
import { RunSqlDialog } from "../run-sql-dialog";
import { useWorkspace } from "../workspace-store";
import { ColumnSheet } from "./add-column-sheet";
import { ForeignKeyDialog, IndexDialog } from "./index-dialogs";

interface PendingSql {
  title: string;
  sql: string;
  success: string;
}

/** Columns, keys, indexes, constraints and triggers of a table, with editors for each. */
export function StructureView({
  database,
  schema,
  table,
}: {
  database: string;
  schema: string;
  table: string;
}) {
  const { serverId } = useExplorer();
  const { openTab } = useWorkspace(serverId);
  const structure = useStructure(database, schema, table);
  // Tables in the same schema whose foreign keys point here
  const graph = useSchemaGraph(database, schema);
  const [columnDialog, setColumnDialog] = useState<{
    column?: ColumnInfo;
  } | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const [fkOpen, setFkOpen] = useState(false);
  const [pending, setPending] = useState<PendingSql | null>(null);

  if (structure.isPending) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
    );
  }
  if (structure.isError)
    return (
      <p className="p-4 text-sm text-danger">
        {describeError(structure.error).message}
      </p>
    );

  const s = structure.data;
  const isTable = s.kind === "table" || s.kind === "partitioned_table";
  const referencedBy =
    graph.data?.relations.filter(
      (r) => r.toSchema === schema && r.toTable === table,
    ) ?? [];
  const kindOf = (name: string): TableKind =>
    graph.data?.tables.find((t) => t.name === name)?.kind ?? "table";
  const openStructure = (tableSchema: string, name: string) =>
    openTab({
      type: "table",
      database,
      schema: tableSchema,
      name,
      kind: tableSchema === schema ? kindOf(name) : "table",
      view: "structure",
    });

  return (
    <div className="flex h-full flex-col gap-8 overflow-y-auto p-4 pb-10">
      <div className="-mb-2 flex items-center justify-between gap-4">
        <p className="text-sm text-fg-muted">
          {s.comment ?? (
            <span className="text-fg-subtle">
              {s.columns.length} column{s.columns.length === 1 ? "" : "s"} ·{" "}
              {s.indexes.length} index{s.indexes.length === 1 ? "" : "es"} ·{" "}
              {s.foreignKeys.length} foreign key
              {s.foreignKeys.length === 1 ? "" : "s"}
            </span>
          )}
        </p>
        <Tooltip
          content={
            s.rlsEnabled
              ? "Row Level Security is on: policies decide which rows each role sees"
              : "Row Level Security is off: anyone with access sees every row"
          }
        >
          <span className="shrink-0">
            {s.rlsEnabled ? (
              <Badge variant="accent">
                <ShieldCheck className="size-3" />
                RLS enabled
              </Badge>
            ) : (
              <Badge>
                <ShieldOff className="size-3" />
                RLS disabled
              </Badge>
            )}
          </span>
        </Tooltip>
      </div>

      <Section
        title="Columns"
        count={s.columns.length}
        hint="The fields every row has."
        action={
          isTable && (
            <AddButton onClick={() => setColumnDialog({})}>
              Add column
            </AddButton>
          )
        }
      >
        <Table head={["Name", "Type", "Required", "Default", "Comment", ""]}>
          {s.columns.map((c) => {
            const fk = s.foreignKeys.find((f) => f.columns.includes(c.name));
            return (
              <Row key={c.name}>
                <Cell>
                  <span className="flex items-center gap-2">
                    <span className="flex w-3.5 justify-center">
                      {c.isPrimaryKey ? (
                        <Tooltip content="Primary key">
                          <KeyRound className="size-3.5 text-warning" />
                        </Tooltip>
                      ) : fk ? (
                        <Tooltip content="Foreign key">
                          <Link2 className="size-3.5 text-info" />
                        </Tooltip>
                      ) : null}
                    </span>
                    <span className="font-mono text-fg">{c.name}</span>
                    {fk && (
                      <button
                        type="button"
                        onClick={() =>
                          openStructure(fk.referencedSchema, fk.referencedTable)
                        }
                        className="font-mono text-[11px] text-fg-subtle hover:text-info"
                      >
                        → {fk.referencedTable}.
                        {fk.referencedColumns[fk.columns.indexOf(c.name)]}
                      </button>
                    )}
                  </span>
                </Cell>
                <Cell mono>{c.dataType}</Cell>
                <Cell>
                  {!c.nullable ? (
                    <Check className="size-3.5 text-fg-muted" />
                  ) : (
                    <None />
                  )}
                </Cell>
                <Cell mono>
                  {c.identity ? (
                    <span className="font-sans text-fg-subtle">
                      auto-increment
                    </span>
                  ) : c.generated ? (
                    <span>
                      <span className="font-sans text-fg-subtle">
                        generated:{" "}
                      </span>
                      {c.generated}
                    </span>
                  ) : c.default ? (
                    <span title={c.default}>{tidyDefault(c.default)}</span>
                  ) : (
                    <None />
                  )}
                </Cell>
                <Cell className="max-w-64 truncate">
                  {c.comment ? (
                    <span title={c.comment}>{c.comment}</span>
                  ) : (
                    <None />
                  )}
                </Cell>
                <Cell>
                  {isTable && (
                    <RowActions>
                      <IconButton
                        size="sm"
                        label="Edit column"
                        icon={<Pencil />}
                        onClick={() => setColumnDialog({ column: c })}
                      />
                      <IconButton
                        size="sm"
                        label="Drop column"
                        icon={<Trash2 />}
                        onClick={() =>
                          setPending({
                            title: `Drop column ${c.name}?`,
                            sql: dropColumn(schema, table, c.name),
                            success: `Column ${c.name} dropped`,
                          })
                        }
                      />
                    </RowActions>
                  )}
                </Cell>
              </Row>
            );
          })}
        </Table>
      </Section>

      <Section
        title="Indexes"
        count={s.indexes.length}
        hint="Make lookups and sorting on these columns faster."
        action={
          isTable &&
          s.indexes.length > 0 && (
            <AddButton onClick={() => setIndexOpen(true)}>Add index</AddButton>
          )
        }
      >
        {s.indexes.length === 0 ? (
          <Empty
            action={
              isTable && (
                <AddButton onClick={() => setIndexOpen(true)}>
                  Add index
                </AddButton>
              )
            }
          >
            No indexes yet. Add one on columns you often filter or sort by.
          </Empty>
        ) : (
          <Table head={["Name", "Columns", "Type", "Size", ""]}>
            {s.indexes.map((i) => (
              <Row key={i.name}>
                <Cell mono>
                  <span className="text-fg">{i.name}</span>
                </Cell>
                <Cell mono>
                  <span title={i.definition}>{indexedOn(i)}</span>
                </Cell>
                <Cell>
                  {i.isPrimary
                    ? "Primary key"
                    : i.isUnique
                      ? "Unique"
                      : "Index"}
                  <span className="text-fg-subtle"> · {i.method}</span>
                </Cell>
                <Cell mono>
                  {i.sizeBytes === null ? <None /> : formatBytes(i.sizeBytes)}
                </Cell>
                <Cell>
                  {isTable &&
                    !i.isPrimary &&
                    !s.constraints.some((c) => c.name === i.name) && (
                      <RowActions>
                        <IconButton
                          size="sm"
                          label="Drop index"
                          icon={<Trash2 />}
                          onClick={() =>
                            setPending({
                              title: `Drop index ${i.name}?`,
                              sql: dropIndex(schema, i.name),
                              success: `Index ${i.name} dropped`,
                            })
                          }
                        />
                      </RowActions>
                    )}
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Section>

      <Section
        title="Foreign keys"
        count={s.foreignKeys.length}
        hint="Columns that must match a row in another table."
        action={
          isTable &&
          s.foreignKeys.length > 0 && (
            <AddButton onClick={() => setFkOpen(true)}>
              Add foreign key
            </AddButton>
          )
        }
      >
        {s.foreignKeys.length === 0 ? (
          <Empty
            action={
              isTable && (
                <AddButton onClick={() => setFkOpen(true)}>
                  Add foreign key
                </AddButton>
              )
            }
          >
            Not linked to other tables yet.
          </Empty>
        ) : (
          <Table head={["Column", "References", "On delete", "On update", ""]}>
            {s.foreignKeys.map((fk) => (
              <Row key={fk.name}>
                <Cell mono>
                  <span className="text-fg" title={fk.name}>
                    {fk.columns.join(", ")}
                  </span>
                </Cell>
                <Cell mono>
                  <TableLink
                    onClick={() =>
                      openStructure(fk.referencedSchema, fk.referencedTable)
                    }
                  >
                    {fk.referencedSchema === schema
                      ? ""
                      : `${fk.referencedSchema}.`}
                    {fk.referencedTable}
                  </TableLink>
                  <span className="text-fg-subtle">
                    {" "}
                    ({fk.referencedColumns.join(", ")})
                  </span>
                </Cell>
                <Cell>
                  <FkAction action={fk.onDelete} />
                </Cell>
                <Cell>
                  <FkAction action={fk.onUpdate} />
                </Cell>
                <Cell>
                  {isTable && (
                    <RowActions>
                      <IconButton
                        size="sm"
                        label="Drop foreign key"
                        icon={<Trash2 />}
                        onClick={() =>
                          setPending({
                            title: `Drop foreign key ${fk.name}?`,
                            sql: dropConstraint(schema, table, fk.name),
                            success: `Foreign key ${fk.name} dropped`,
                          })
                        }
                      />
                    </RowActions>
                  )}
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Section>

      {referencedBy.length > 0 && (
        <Section
          title="Referenced by"
          count={referencedBy.length}
          hint="Tables whose foreign keys point to this table."
        >
          <Table head={["Table", "Column", "Points to"]}>
            {referencedBy.map((r) => (
              <Row key={`${r.fromTable}.${r.name}`}>
                <Cell mono>
                  <TableLink onClick={() => openStructure(schema, r.fromTable)}>
                    {r.fromTable}
                  </TableLink>
                </Cell>
                <Cell mono>{r.fromColumns.join(", ")}</Cell>
                <Cell mono>{r.toColumns.join(", ")}</Cell>
              </Row>
            ))}
          </Table>
        </Section>
      )}

      {s.constraints.length > 0 && (
        <Section
          title="Constraints"
          count={s.constraints.length}
          hint="Rules every row must pass."
        >
          <Table head={["Name", "Type", "Rule", ""]}>
            {s.constraints.map((c) => (
              <Row key={c.name}>
                <Cell mono>
                  <span className="text-fg">{c.name}</span>
                </Cell>
                <Cell className="capitalize">{c.kind}</Cell>
                <Cell mono className="max-w-xl truncate">
                  <span title={c.definition}>
                    {constraintRule(c.definition)}
                  </span>
                </Cell>
                <Cell>
                  {isTable && (
                    <RowActions>
                      <IconButton
                        size="sm"
                        label="Drop constraint"
                        icon={<Trash2 />}
                        onClick={() =>
                          setPending({
                            title: `Drop constraint ${c.name}?`,
                            sql: dropConstraint(schema, table, c.name),
                            success: `Constraint ${c.name} dropped`,
                          })
                        }
                      />
                    </RowActions>
                  )}
                </Cell>
              </Row>
            ))}
          </Table>
        </Section>
      )}

      {s.triggers.length > 0 && (
        <Section
          title="Triggers"
          count={s.triggers.length}
          hint="Functions that run automatically when rows change."
        >
          <Table head={["Name", "Runs", "Function", "Status"]}>
            {s.triggers.map((t) => {
              const parsed = parseTrigger(t.definition);
              return (
                <Row key={t.name}>
                  <Cell mono>
                    <span className="text-fg">{t.name}</span>
                  </Cell>
                  <Cell>
                    {parsed ? (
                      `${parsed.timing} ${parsed.events.join(" / ")}`.toLowerCase()
                    ) : (
                      <span className="font-mono" title={t.definition}>
                        {t.definition}
                      </span>
                    )}
                  </Cell>
                  <Cell mono>{parsed ? `${parsed.fn}()` : <None />}</Cell>
                  <Cell>
                    {t.enabled ? (
                      "Enabled"
                    ) : (
                      <span className="text-fg-subtle">Disabled</span>
                    )}
                  </Cell>
                </Row>
              );
            })}
          </Table>
        </Section>
      )}

      <ColumnSheet
        open={columnDialog !== null}
        onOpenChange={(open) => !open && setColumnDialog(null)}
        database={database}
        schema={schema}
        table={table}
        column={columnDialog?.column}
      />
      {indexOpen && (
        <IndexDialog
          open
          onOpenChange={setIndexOpen}
          database={database}
          structure={s}
        />
      )}
      {fkOpen && (
        <ForeignKeyDialog
          open
          onOpenChange={setFkOpen}
          database={database}
          structure={s}
        />
      )}
      {pending && (
        <RunSqlDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={pending.title}
          description="This can't be undone."
          sql={pending.sql}
          database={database}
          confirmLabel="Drop"
          destructive
          successMessage={pending.success}
        />
      )}
    </div>
  );
}

const FK_ACTIONS: Record<string, { label: string; hint: string }> = {
  CASCADE: { label: "Cascade", hint: "Rows here change or go with it" },
  "SET NULL": { label: "Set null", hint: "The column here is set to NULL" },
  "SET DEFAULT": {
    label: "Set default",
    hint: "The column here goes back to its default",
  },
  RESTRICT: { label: "Restrict", hint: "Blocked while rows here point to it" },
  "NO ACTION": {
    label: "No action",
    hint: "Blocked while rows here point to it",
  },
};

/** `'pending'::order_status` → `'pending'`; the cast only repeats the column type. */
function tidyDefault(value: string) {
  return value.replace(/^('(?:[^']|'')*')::[\w\s."[\]]+$/, "$1");
}

/** The part of an index after `USING method`, e.g. `(placed_at DESC)`, without the brackets. */
function indexedOn(index: { definition: string; columns: string[] }) {
  const m = /USING \S+ \((.*)\)(.*)$/i.exec(index.definition);
  if (!m) return index.columns.join(", ");
  return `${m[1]}${m[2]}`;
}

/** `CHECK ((price > 0))` → `price > 0`; other kinds as written. */
function constraintRule(definition: string) {
  const check = /^CHECK \((.*)\)$/i.exec(definition.trim());
  if (!check) return definition;
  const inner = check[1]!;
  return inner.startsWith("(") && inner.endsWith(")")
    ? inner.slice(1, -1)
    : inner;
}

/** Pulls the timing, events and function out of a `CREATE TRIGGER` statement. */
function parseTrigger(definition: string) {
  const m =
    /TRIGGER \S+ (BEFORE|AFTER|INSTEAD OF) (.+?) ON .+?EXECUTE (?:FUNCTION|PROCEDURE) ([^\s(]+)/i.exec(
      definition,
    );
  if (!m) return null;
  return {
    timing: m[1]!,
    events: m[2]!.split(/\s+OR\s+/i).map((e) => e.split(/\s/)[0]!),
    fn: m[3]!,
  };
}

function Section({
  title,
  count,
  hint,
  action,
  children,
}: {
  title: string;
  count: number;
  hint: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="flex items-center gap-2 text-sm font-medium text-fg">
            {title}
            <span className="rounded-full bg-surface-hover px-1.5 font-mono text-[10px] font-normal text-fg-muted">
              {count}
            </span>
          </h3>
          <p className="text-xs text-fg-subtle">{hint}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function AddButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button size="sm" variant="ghost" iconLeft={<Plus />} onClick={onClick}>
      {children}
    </Button>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full text-xs">
        <thead className="bg-surface text-left text-fg-subtle">
          <tr className="border-b border-border">
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <tr className="group border-b border-border/60 last:border-b-0 hover:bg-surface-hover/40">
      {children}
    </tr>
  );
}

function Cell({
  children,
  mono,
  className,
}: {
  children: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn("px-3 py-2 text-fg-muted", mono && "font-mono", className)}
    >
      {children}
    </td>
  );
}

function RowActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      {children}
    </div>
  );
}

function Empty({
  action,
  children,
}: {
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-dashed border-border px-3 py-2 text-xs text-fg-subtle">
      <p className="py-1">{children}</p>
      {action}
    </div>
  );
}

function None() {
  return <span className="text-fg-subtle/60">—</span>;
}

function TableLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-fg hover:text-info hover:underline"
    >
      {children}
    </button>
  );
}

function FkAction({ action }: { action: string }) {
  const known = FK_ACTIONS[action.toUpperCase()];
  if (!known) return <>{action}</>;
  return (
    <Tooltip content={known.hint}>
      <span className="cursor-default">{known.label}</span>
    </Tooltip>
  );
}
