import {
  Badge,
  Button,
  Checkbox,
  cn,
  DialogClose,
  Input,
  SheetContent,
  Skeleton,
  toast,
  Tooltip,
} from "@repo/ui";
import { AlertTriangle, GripVertical, Info, Link2, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { describeError } from "../../../lib/ipc";
import { baseTypeName, INTEGER_TYPES } from "../../../lib/pg-types";
import { isSafeTypeName } from "../../../lib/sql";
import {
  useRunSql,
  useSchemaObjects,
  useStructure,
} from "../explorer-context";
import { SqlBlock } from "../sql/sql-editor";
import { columnTypeSql, enumOf } from "../structure/column-sql";
import {
  type ForeignKeyEntry,
  ForeignKeyRow,
  ForeignKeySheet,
  removeForeignKey,
  saveForeignKey,
  undoRemoveForeignKey,
} from "../structure/foreign-key-sheet";
import { DefaultValueInput, TypePicker } from "../structure/type-picker";
import { useWorkspaceStore } from "../workspace-store";
import { ExtraOptions } from "./extra-options";
import { Block, Horizontal, Note } from "./form-layout";
import type { Target } from "./store";
import {
  blankColumn,
  buildCreateTableSql,
  buildUpdateTableSql,
  canIdentity,
  type ColumnRow,
  initialFrom,
  STARTER,
  type TableInitial,
} from "./table-sql";

/** Loads the table's current definition, then shows it in the form. */
export function UpdateTableLoader({
  target,
  onClose,
}: {
  target: Target;
  onClose: () => void;
}) {
  const structure = useStructure(target.database, target.schema, target.table!);
  // Diffed against on save, so only rebuilt when the structure really reloads
  const initial = useMemo(
    () => (structure.data ? initialFrom(structure.data) : undefined),
    [structure.data],
  );
  if (!initial)
    return (
      <SheetContent title="Update table" className="w-[920px]">
        {structure.isError ? (
          <p className="text-sm text-danger">
            {describeError(structure.error).message}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        )}
      </SheetContent>
    );
  return (
    <TableForm
      target={target}
      initial={initial}
      onClose={onClose}
    />
  );
}

export function TableForm({
  target,
  initial,
  onClose,
}: {
  target: Target;
  /** Present when updating an existing table. */
  initial?: TableInitial;
  onClose: () => void;
}) {
  const { database, schema, serverId } = target;
  const run = useRunSql();
  const objects = useSchemaObjects(database, schema);
  const enums = objects.data?.enums ?? [];
  const enumNames = enums.map((e) => e.name);
  const [name, setName] = useState(initial?.name ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [rls, setRls] = useState(initial?.rls ?? true);
  const [columns, setColumns] = useState<ColumnRow[]>(
    initial?.columns ?? STARTER,
  );
  const [nextKey, setNextKey] = useState(
    initial?.columns.length ?? STARTER.length,
  );
  const [foreignKeys, setForeignKeys] = useState<ForeignKeyEntry[]>(
    initial?.foreignKeys ?? [],
  );
  /** Index of the foreign key being edited, or `-1` for a new one (optionally for one column). */
  const [fkEditor, setFkEditor] = useState<{
    index: number;
    column?: string;
  } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [showSql, setShowSql] = useState(false);

  const patch = (key: number, p: Partial<ColumnRow>) =>
    setColumns((cs) => cs.map((c) => (c.key === key ? { ...c, ...p } : c)));
  const addColumn = () => {
    setColumns((cs) => [...cs, blankColumn(nextKey)]);
    setNextKey((k) => k + 1);
  };
  const move = (from: number, to: number) =>
    setColumns((cs) => {
      const next = [...cs];
      const [c] = next.splice(from, 1);
      next.splice(to, 0, c!);
      return next;
    });

  const named = columns.filter((c) => c.name.trim());
  const names = named.map((c) => c.name.trim());
  const nameValid = name.trim().length > 0 && name.trim().length <= 63;
  const columnsValid =
    named.length > 0 &&
    // Clearing an existing column's name must not silently drop it
    columns.every((c) => !c.original || c.name.trim()) &&
    new Set(names).size === names.length &&
    named.every((c) => c.type.trim() && isSafeTypeName(c.type));
  const valid = nameValid && columnsValid;
  const primaryKeys = named.filter((c) => c.primaryKey).length;
  const sql = !valid
    ? "-- give the table a name and its columns a name and type"
    : initial
      ? buildUpdateTableSql(
          schema,
          initial,
          name.trim(),
          comment,
          rls,
          named,
          foreignKeys,
          enumNames,
        )
      : buildCreateTableSql(
          schema,
          name.trim(),
          comment,
          rls,
          named,
          foreignKeys,
          enumNames,
        );
  const changed = sql.trim() !== "";

  const submit = () => {
    if (!valid || !changed || run.isPending) return;
    const table = name.trim();
    run.mutate(
      { sql, database },
      {
        onSuccess: () => {
          toast.success(
            initial ? `Table ${table} updated` : `Table ${table} created`,
          );
          onClose();
          const store = useWorkspaceStore.getState();
          // A renamed table's open tabs point at a name that no longer exists
          if (initial && initial.name !== table)
            store.closeTabsFor(
              serverId,
              (t) =>
                t.type === "table" &&
                t.database === database &&
                t.schema === schema &&
                t.name === initial.name,
            );
          if (!initial || initial.name !== table)
            store.openTab(serverId, {
              type: "table",
              database,
              schema,
              name: table,
              kind: "table",
              view: "data",
            });
        },
      },
    );
  };

  return (
    <SheetContent
      title={
        initial ? (
          <>
            Update table <span className="font-mono">{initial.name}</span>
          </>
        ) : (
          <>
            Create a new table under <span className="font-mono">{schema}</span>
          </>
        )
      }
      className="w-[920px]"
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="primary"
            loading={run.isPending}
            disabled={!valid || !changed}
            onClick={submit}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        className="-mx-5 -my-4 flex flex-col divide-y divide-border"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
        }}
      >
        <Block>
          <Horizontal label="Name">
            <Input
              autoFocus
              className="font-mono"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Horizontal>
          <Horizontal label="Description">
            <Input
              placeholder="Optional"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Horizontal>
        </Block>

        <Block>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              className="mt-0.5"
              checked={rls}
              onCheckedChange={(v) => setRls(v === true)}
            />
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm text-fg">
                Enable Row Level Security (RLS)
                <Badge>Recommended</Badge>
              </span>
              <span className="text-xs text-fg-muted">
                Restrict access to your table by enabling RLS and writing
                Postgres policies.
              </span>
            </span>
          </label>
          {rls && (
            <Note icon={<Info />}>
              <span className="text-fg">
                Policies are required to query data
              </span>
              <span>
                With RLS on, roles see no rows until a policy allows them. The
                table owner and superusers aren&apos;t affected.
              </span>
            </Note>
          )}
        </Block>

        <Block>
          <h3 className="text-sm text-fg">Columns</h3>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[16px_1fr_1.15fr_1fr_56px_32px_28px] gap-2 text-xs text-fg-muted">
              <span />
              <span>Name</span>
              <span>Type</span>
              <span>Default value</span>
              <span className="text-center">Primary</span>
              <span />
              <span />
            </div>
            {columns.map((c, i) => {
              const enumValues = enumOf(c.type, schema, enums)?.values;
              // An existing identity column keeps generating its values unless retyped
              const identity =
                (c.identity || c.original?.identity === true) &&
                canIdentity(c);
              const options = [
                !c.nullable,
                c.unique,
                c.identity && canIdentity(c),
                c.isArray,
              ].filter(Boolean).length;
              return (
                <div
                  key={c.key}
                  onDragOver={(e) => {
                    if (dragging === null) return;
                    e.preventDefault();
                    if (dragging !== i) {
                      move(dragging, i);
                      setDragging(i);
                    }
                  }}
                  className={cn(
                    "grid grid-cols-[16px_1fr_1.15fr_1fr_56px_32px_28px] items-center gap-2",
                    dragging === i && "opacity-50",
                  )}
                >
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(i);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className="flex cursor-grab items-center text-fg-subtle hover:text-fg"
                  >
                    <GripVertical className="size-4" />
                  </span>
                  <div className="relative">
                    <Input
                      aria-label="Column name"
                      className="pr-8 font-mono"
                      placeholder="column_name"
                      spellCheck={false}
                      value={c.name}
                      onChange={(e) => patch(c.key, { name: e.target.value })}
                    />
                    <Tooltip content="Reference a column in another table">
                      <button
                        type="button"
                        aria-label="Reference a column in another table"
                        disabled={!c.name.trim()}
                        onClick={() =>
                          setFkEditor({ index: -1, column: c.name.trim() })
                        }
                        className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-fg-subtle hover:text-fg disabled:pointer-events-none disabled:opacity-40"
                      >
                        <Link2 className="size-3.5 -rotate-45" />
                      </button>
                    </Tooltip>
                  </div>
                  <TypePicker
                    value={c.type}
                    enums={enumNames}
                    onChange={(type) =>
                      patch(c.key, {
                        type,
                        // uuid columns usually want a random default
                        defaultValue:
                          baseTypeName(type) === "uuid" && !c.defaultValue
                            ? "gen_random_uuid()"
                            : c.defaultValue,
                        identity:
                          c.identity && INTEGER_TYPES.has(baseTypeName(type)),
                      })
                    }
                  />
                  <DefaultValueInput
                    value={c.defaultValue}
                    onChange={(v) => patch(c.key, { defaultValue: v })}
                    // The enum cast must name the type the way the SQL does
                    type={
                      enumValues
                        ? columnTypeSql(c.type, c.isArray, schema, enumNames)
                        : `${c.type}${c.isArray ? "[]" : ""}`
                    }
                    nullable={c.nullable}
                    enumValues={enumValues}
                    disabled={identity}
                    placeholder={
                      identity
                        ? "Automatically generated"
                        : undefined
                    }
                  />
                  <span className="flex justify-center">
                    <Checkbox
                      aria-label="Primary key"
                      checked={c.primaryKey}
                      onCheckedChange={(v) =>
                        patch(c.key, {
                          primaryKey: v === true,
                          nullable: v === true ? false : c.nullable,
                        })
                      }
                    />
                  </span>
                  <ExtraOptions
                    column={c}
                    count={options}
                    onChange={(p) => patch(c.key, p)}
                  />
                  <button
                    type="button"
                    aria-label="Remove column"
                    onClick={() =>
                      setColumns((cs) => cs.filter((x) => x.key !== c.key))
                    }
                    className="flex size-7 cursor-pointer items-center justify-center rounded text-fg-subtle hover:bg-surface-hover hover:text-fg"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addColumn}
              className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-dashed border-border-strong text-xs text-fg-muted hover:border-fg-subtle hover:text-fg"
            >
              <Plus className="size-3.5" />
              Add column
            </button>
            {named.length > 0 && primaryKeys === 0 && (
              <Note icon={<AlertTriangle />} warning>
                <span className="text-fg">
                  Warning: No primary keys selected
                </span>
                <span>
                  Rows can only be edited in the table editor when the table has
                  a primary key.
                </span>
              </Note>
            )}
            {primaryKeys > 1 && (
              <Note icon={<Info />}>
                <span className="text-fg">Composite primary key selected</span>
                <span>
                  Each row is identified by the combination of the selected
                  columns.
                </span>
              </Note>
            )}
          </div>
        </Block>

        <Block>
          <h3 className="text-sm text-fg">Foreign keys</h3>
          {foreignKeys.map((fk, i) => (
            <ForeignKeyRow
              key={fk.name ?? `new-${i}`}
              fk={fk}
              onEdit={() => setFkEditor({ index: i })}
              onRemove={() => setForeignKeys((f) => removeForeignKey(f, i))}
              onUndoRemove={() =>
                setForeignKeys((f) => undoRemoveForeignKey(f, i))
              }
            />
          ))}
          <Button
            size="sm"
            variant="secondary"
            className="w-fit"
            iconLeft={<Plus />}
            disabled={named.length === 0}
            onClick={() => setFkEditor({ index: -1 })}
          >
            Add foreign key relation
          </Button>
        </Block>

        <Block>
          <button
            type="button"
            onClick={() => setShowSql((s) => !s)}
            className="w-fit cursor-pointer text-xs text-fg-subtle hover:text-fg"
          >
            {showSql ? "Hide SQL" : "View SQL"}
          </button>
          {showSql && <SqlBlock sql={sql} className="max-h-72" />}
          {run.isError && (
            <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
              <span className="text-fg">
                {describeError(run.error).message}
              </span>
            </div>
          )}
        </Block>
      </form>

      <ForeignKeySheet
        open={fkEditor !== null}
        onOpenChange={(o) => !o && setFkEditor(null)}
        database={database}
        schema={schema}
        table={name.trim()}
        columns={names}
        initial={
          fkEditor && fkEditor.index >= 0
            ? foreignKeys[fkEditor.index]
            : fkEditor?.column
              ? {
                  schema,
                  table: "",
                  pairs: [{ column: fkEditor.column, refColumn: "" }],
                  onUpdate: "NO ACTION",
                  onDelete: "NO ACTION",
                }
              : undefined
        }
        onSave={(fk) =>
          setForeignKeys((list) =>
            saveForeignKey(list, fkEditor?.index ?? -1, fk),
          )
        }
      />
    </SheetContent>
  );
}
