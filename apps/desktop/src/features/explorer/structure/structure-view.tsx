import { Badge, IconButton, Skeleton, Tooltip } from "@repo/ui";
import {
  Check,
  KeyRound,
  Link2,
  Pencil,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { ColumnInfo, TableKind } from "../../../lib/bindings";
import { formatBytes } from "../../../lib/format";
import { dropColumn, dropConstraint, dropIndex } from "../../../lib/sql";
import { useExplorer, useSchemaGraph, useStructure } from "../explorer-context";
import { RunSqlDialog } from "../run-sql-dialog";
import { useWorkspaceActions } from "../workspace-store";
import { ColumnSheet } from "./add-column-sheet";
import { ForeignKeyDialog, IndexDialog } from "./index-dialogs";
import { LoadError } from "../load-error";
import {
  constraintRule,
  indexedOn,
  parseTrigger,
  tidyDefault,
} from "./structure-format";
import {
  AddButton,
  Cell,
  Empty,
  FkAction,
  None,
  Row,
  RowActions,
  Section,
  Table,
  TableLink,
} from "./structure-parts";

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
  const { openTab } = useWorkspaceActions(serverId);
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
  if (structure.isError) return <LoadError query={structure} />;

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
        <p className="text-sm text-fg-muted">{s.comment}</p>
        <Tooltip
          content={
            s.rlsEnabled
              ? "Row Level Security is on: policies decide which rows each role sees. Click to manage policies."
              : "Row Level Security is off: anyone with access sees every row. Click to set it up."
          }
        >
          <button
            type="button"
            className="shrink-0 cursor-pointer transition-opacity hover:opacity-80"
            onClick={() =>
              openTab({ type: "policies", database, schema, table })
            }
          >
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
          </button>
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
                          <KeyRound className="size-3.5 text-key-primary" />
                        </Tooltip>
                      ) : fk ? (
                        <Tooltip content="Foreign key">
                          <Link2 className="size-3.5 text-key-foreign" />
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
