import { Badge, Button, IconButton, Skeleton } from "@repo/ui";
import { KeyRound, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { ColumnInfo } from "../../../lib/bindings";
import { formatBytes } from "../../../lib/format";
import { describeError } from "../../../lib/ipc";
import { dropColumn, dropConstraint, dropIndex } from "../../../lib/sql";
import { useStructure } from "../explorer-context";
import { RunSqlDialog } from "../run-sql-dialog";
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
  const structure = useStructure(database, schema, table);
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

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      {s.comment && <p className="text-sm text-fg-muted">{s.comment}</p>}

      <Section
        title="Columns"
        count={s.columns.length}
        action={
          isTable && (
            <AddButton onClick={() => setColumnDialog({})}>
              Add column
            </AddButton>
          )
        }
      >
        <Table head={["Name", "Type", "Nullable", "Default", "Comment", ""]}>
          {s.columns.map((c) => (
            <tr
              key={c.name}
              className="group border-b border-border/60 hover:bg-surface-hover/50"
            >
              <Cell>
                <span className="flex items-center gap-1.5 font-mono text-fg">
                  {c.isPrimaryKey && (
                    <KeyRound
                      className="size-3 text-warning"
                      aria-label="Primary key"
                    />
                  )}
                  {s.foreignKeys.some((fk) => fk.columns.includes(c.name)) && (
                    <Link2
                      className="size-3 text-info"
                      aria-label="Foreign key"
                    />
                  )}
                  {c.name}
                </span>
              </Cell>
              <Cell mono>{c.dataType}</Cell>
              <Cell>
                {c.nullable ? (
                  <span className="text-fg-subtle">yes</span>
                ) : (
                  "NOT NULL"
                )}
              </Cell>
              <Cell mono>
                {c.identity ? (
                  <Badge>
                    identity ·{" "}
                    {c.identity === "always" ? "always" : "by default"}
                  </Badge>
                ) : c.generated ? (
                  <span>generated: {c.generated}</span>
                ) : (
                  (c.default ?? <span className="text-fg-subtle">—</span>)
                )}
              </Cell>
              <Cell>
                {c.comment ?? <span className="text-fg-subtle">—</span>}
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
            </tr>
          ))}
        </Table>
      </Section>

      <Section
        title="Indexes"
        count={s.indexes.length}
        action={
          isTable && (
            <AddButton onClick={() => setIndexOpen(true)}>Add index</AddButton>
          )
        }
      >
        {s.indexes.length === 0 ? (
          <Empty>No indexes</Empty>
        ) : (
          <Table head={["Name", "Columns", "Type", "Size", "Definition", ""]}>
            {s.indexes.map((i) => (
              <tr
                key={i.name}
                className="group border-b border-border/60 hover:bg-surface-hover/50"
              >
                <Cell mono>{i.name}</Cell>
                <Cell mono>{i.columns.join(", ")}</Cell>
                <Cell>
                  <span className="flex gap-1">
                    {i.isPrimary && <Badge variant="warning">primary</Badge>}
                    {i.isUnique && !i.isPrimary && <Badge>unique</Badge>}
                    <Badge>{i.method}</Badge>
                  </span>
                </Cell>
                <Cell mono>{formatBytes(i.sizeBytes)}</Cell>
                <Cell mono truncate>
                  {i.definition}
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
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section
        title="Foreign keys"
        count={s.foreignKeys.length}
        action={
          isTable && (
            <AddButton onClick={() => setFkOpen(true)}>
              Add foreign key
            </AddButton>
          )
        }
      >
        {s.foreignKeys.length === 0 ? (
          <Empty>No foreign keys</Empty>
        ) : (
          <Table
            head={[
              "Name",
              "Columns",
              "References",
              "On update",
              "On delete",
              "",
            ]}
          >
            {s.foreignKeys.map((fk) => (
              <tr
                key={fk.name}
                className="group border-b border-border/60 hover:bg-surface-hover/50"
              >
                <Cell mono>{fk.name}</Cell>
                <Cell mono>{fk.columns.join(", ")}</Cell>
                <Cell mono>
                  {fk.referencedSchema === schema
                    ? ""
                    : `${fk.referencedSchema}.`}
                  {fk.referencedTable} ({fk.referencedColumns.join(", ")})
                </Cell>
                <Cell>{fk.onUpdate}</Cell>
                <Cell>{fk.onDelete}</Cell>
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
              </tr>
            ))}
          </Table>
        )}
      </Section>

      {s.constraints.length > 0 && (
        <Section title="Constraints" count={s.constraints.length}>
          <Table head={["Name", "Type", "Definition", ""]}>
            {s.constraints.map((c) => (
              <tr
                key={c.name}
                className="group border-b border-border/60 hover:bg-surface-hover/50"
              >
                <Cell mono>{c.name}</Cell>
                <Cell>
                  <Badge>{c.kind}</Badge>
                </Cell>
                <Cell mono truncate>
                  {c.definition}
                </Cell>
                <Cell>
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
                </Cell>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {s.triggers.length > 0 && (
        <Section title="Triggers" count={s.triggers.length}>
          <Table head={["Name", "Enabled", "Definition"]}>
            {s.triggers.map((t) => (
              <tr key={t.name} className="border-b border-border/60">
                <Cell mono>{t.name}</Cell>
                <Cell>
                  {t.enabled ? (
                    "yes"
                  ) : (
                    <span className="text-fg-subtle">disabled</span>
                  )}
                </Cell>
                <Cell mono truncate>
                  {t.definition}
                </Cell>
              </tr>
            ))}
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

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          {title} <span className="text-fg-subtle/70">· {count}</span>
        </h3>
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
              <th key={i} className="px-3 py-2 font-medium">
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

function Cell({
  children,
  mono,
  truncate,
}: {
  children: ReactNode;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <td
      className={`px-3 py-1.5 text-fg-muted ${mono ? "font-mono" : ""} ${truncate ? "max-w-md truncate" : ""}`}
    >
      {children}
    </td>
  );
}

function RowActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-card border border-dashed border-border px-3 py-3 text-xs text-fg-subtle">
      {children}
    </p>
  );
}
