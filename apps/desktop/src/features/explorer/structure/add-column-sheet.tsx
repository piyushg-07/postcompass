import {
  Button,
  Checkbox,
  Dialog,
  DialogClose,
  Input,
  SheetContent,
  Switch,
  toast,
  Tooltip,
} from "@repo/ui";
import { AlertTriangle, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { ColumnInfo } from "../../../lib/bindings";
import { describeError } from "../../../lib/ipc";
import {
  baseTypeName,
  INTEGER_TYPES,
  RECOMMENDED_TYPE,
  shortType,
} from "../../../lib/pg-types";
import {
  alterColumn,
  ident,
  isSafeTypeName,
  literal,
  qualified,
} from "../../../lib/sql";
import { useRunSql, useSchemaObjects, useStructure } from "../explorer-context";
import { SqlBlock } from "../sql/sql-editor";
import {
  type ForeignKeyEntry,
  foreignKeyEntry,
  ForeignKeyRow,
  ForeignKeySheet,
  foreignKeyStatements,
  removeForeignKey,
  saveForeignKey,
  undoRemoveForeignKey,
} from "./foreign-key-sheet";
import { DefaultValueInput, TypePicker } from "./type-picker";

interface Draft {
  name: string;
  comment: string;
  type: string;
  isArray: boolean;
  defaultValue: string;
  primaryKey: boolean;
  nullable: boolean;
  unique: boolean;
  identity: boolean;
  check: string;
}

const BLANK: Draft = {
  name: "",
  comment: "",
  type: "",
  isArray: false,
  defaultValue: "",
  primaryKey: false,
  nullable: true,
  unique: false,
  identity: false,
  check: "",
};

const typeOf = (d: Draft) => `${d.type.trim()}${d.isArray ? "[]" : ""}`;

/** Column side panel, laid out like Supabase's: general, data type, foreign keys, constraints. */
export function ColumnSheet({
  open,
  onOpenChange,
  database,
  schema,
  table,
  column,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  database: string;
  schema: string;
  table: string;
  /** Present when editing. */
  column?: ColumnInfo | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <ColumnForm
          database={database}
          schema={schema}
          table={table}
          column={column ?? undefined}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function ColumnForm({
  database,
  schema,
  table,
  column,
  onDone,
}: {
  database: string;
  schema: string;
  table: string;
  column?: ColumnInfo;
  onDone: () => void;
}) {
  const run = useRunSql();
  const editing = column !== undefined;
  const structure = useStructure(database, schema, table);
  const objects = useSchemaObjects(database, schema);
  const enums = objects.data?.enums ?? [];

  // An existing UNIQUE constraint on just this column, so the switch can show and drop it
  const uniqueConstraint = column
    ? structure.data?.constraints.find(
        (c) =>
          c.kind === "unique" &&
          new RegExp(`^UNIQUE \\((${column.name}|"${column.name}")\\)$`).test(
            c.definition,
          ),
      )
    : undefined;
  const existingFks = column
    ? (structure.data?.foreignKeys ?? []).filter((fk) =>
        fk.columns.includes(column.name),
      )
    : [];

  const [initial] = useState<Draft>(() => {
    if (!column) return BLANK;
    const isArray = column.dataType.endsWith("[]");
    return {
      ...BLANK,
      name: column.name,
      comment: column.comment ?? "",
      type: shortType(isArray ? column.dataType.slice(0, -2) : column.dataType),
      isArray,
      defaultValue: column.default ?? "",
      primaryKey: column.isPrimaryKey,
      nullable: column.nullable,
      identity: column.identity !== null,
    };
  });
  const [d, setD] = useState<Draft>(initial);
  const [unique, setUnique] = useState<boolean | null>(null);
  // Until something changes, the list is this column's existing foreign keys
  const [fkEdits, setFkEdits] = useState<ForeignKeyEntry[] | null>(null);
  const fks = fkEdits ?? existingFks.map(foreignKeyEntry);
  /** Index of the foreign key being edited; -1 adds one. */
  const [fkEditor, setFkEditor] = useState<number | null>(null);
  const [createMore, setCreateMore] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setD((x) => ({ ...x, [key]: value }));

  const isUnique =
    unique ?? (editing ? uniqueConstraint !== undefined : d.unique);
  const base = baseTypeName(d.type);
  const canIdentity = !editing && INTEGER_TYPES.has(base) && !d.isArray;
  const identity = d.identity && canIdentity;
  const enumValues = enums.find((e) => e.name === d.type)?.values;
  const recommended = RECOMMENDED_TYPE[base];
  const valid =
    d.name.trim().length > 0 &&
    d.name.trim().length <= 63 &&
    d.type.trim().length > 0 &&
    isSafeTypeName(d.type);

  const target = qualified(schema, table);
  const col = ident(d.name.trim());
  // Pairs still name the column as it was; point them at its (new) name
  const colName = d.name.trim();
  const fkSql = foreignKeyStatements(
    schema,
    table,
    fks.map((fk) => ({
      ...fk,
      pairs: fk.pairs.map((p) =>
        !p.column || p.column === initial.name ? { ...p, column: colName } : p,
      ),
    })),
  );
  const statements: string[] = valid ? [...fkSql.drops] : [];
  if (valid && !editing) {
    const parts = [`ALTER TABLE ${target} ADD COLUMN ${col} ${typeOf(d)}`];
    if (identity) parts.push("GENERATED BY DEFAULT AS IDENTITY");
    if (d.primaryKey) parts.push("PRIMARY KEY");
    else if (!d.nullable) parts.push("NOT NULL");
    if (d.defaultValue.trim() && !identity)
      parts.push(`DEFAULT ${d.defaultValue.trim()}`);
    if (isUnique && !d.primaryKey) parts.push("UNIQUE");
    if (d.check.trim()) parts.push(`CHECK (${d.check.trim()})`);
    statements.push(`${parts.join(" ")};`);
    if (d.comment.trim())
      statements.push(
        `COMMENT ON COLUMN ${target}.${col} IS ${literal(d.comment.trim())};`,
      );
  } else if (valid && column) {
    statements.push(
      ...alterColumn(
        schema,
        table,
        {
          name: initial.name,
          type: typeOf(initial),
          nullable: initial.nullable,
          defaultValue: initial.defaultValue,
        },
        {
          name: d.name.trim(),
          type: typeOf(d),
          nullable: d.nullable,
          defaultValue: d.defaultValue,
        },
      ),
    );
    if (d.primaryKey !== initial.primaryKey)
      statements.push(
        d.primaryKey
          ? `ALTER TABLE ${target} ADD PRIMARY KEY (${col});`
          : `DO $$ BEGIN EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', ${literal(target)}::regclass, (SELECT conname FROM pg_constraint WHERE conrelid = ${literal(target)}::regclass AND contype = 'p')); END $$;`,
      );
    if (unique !== null && unique !== (uniqueConstraint !== undefined))
      statements.push(
        unique
          ? `ALTER TABLE ${target} ADD UNIQUE (${col});`
          : `ALTER TABLE ${target} DROP CONSTRAINT ${ident(uniqueConstraint!.name)};`,
      );
    if (d.check.trim())
      statements.push(`ALTER TABLE ${target} ADD CHECK (${d.check.trim()});`);
    if (d.comment.trim() !== initial.comment.trim())
      statements.push(
        `COMMENT ON COLUMN ${target}.${col} IS ${d.comment.trim() ? literal(d.comment.trim()) : "NULL"};`,
      );
  }
  if (valid) statements.push(...fkSql.adds);
  const sql = statements.join("\n");

  const save = () => {
    if (!sql || run.isPending) return;
    run.mutate(
      { sql, database },
      {
        onSuccess: () => {
          toast.success(
            editing
              ? `Column ${d.name.trim()} updated`
              : `Column ${d.name.trim()} added to ${table}`,
          );
          if (createMore && !editing) {
            setD(BLANK);
            setFkEdits([]);
            setUnique(null);
          } else onDone();
        },
      },
    );
  };

  return (
    <SheetContent
      title={
        editing ? (
          <>
            Update column <span className="font-mono">{column.name}</span> from{" "}
            <span className="font-mono">{table}</span>
          </>
        ) : (
          <>
            Add new column to <span className="font-mono">{table}</span>
          </>
        )
      }
      className="w-[720px]"
      footer={
        <>
          {!editing && (
            <label className="mr-auto flex cursor-pointer items-center gap-2 text-xs text-fg-muted">
              <Switch checked={createMore} onCheckedChange={setCreateMore} />
              Create more
            </label>
          )}
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="primary"
            loading={run.isPending}
            disabled={!sql}
            onClick={save}
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
          save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
        }}
      >
        <Section title="General">
          <Labeled
            label="Name"
            description="Recommended to use lowercase and use an underscore to separate words e.g. column_name"
          >
            <Input
              autoFocus
              className="font-mono"
              placeholder="column_name"
              spellCheck={false}
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Labeled>
          <Labeled label="Description" optional>
            <Input
              value={d.comment}
              onChange={(e) => set("comment", e.target.value)}
            />
          </Labeled>
        </Section>

        <Section title="Data Type">
          <Labeled
            label="Type"
            description={
              editing && d.type !== initial.type
                ? "Existing values are converted to the new type."
                : undefined
            }
          >
            <TypePicker
              value={d.type}
              enums={enums.map((e) => e.name)}
              onChange={(type) =>
                setD((x) => ({
                  ...x,
                  type,
                  defaultValue:
                    !editing && baseTypeName(type) === "uuid" && !x.defaultValue
                      ? "gen_random_uuid()"
                      : x.defaultValue,
                }))
              }
            />
          </Labeled>
          {recommended && (
            <div className="flex items-start gap-2.5 rounded-control border border-warning/30 bg-warning/5 p-3 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <span className="flex flex-1 flex-col gap-2">
                <span className="text-fg">
                  It is recommended to use{" "}
                  <span className="font-mono">{recommended}</span> instead
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-fit"
                  onClick={() => set("type", recommended)}
                >
                  Use {recommended}
                </Button>
              </span>
            </div>
          )}
          {canIdentity && (
            <CheckRow
              label="Is Identity"
              description="Automatically assign a sequential unique number to the column"
              checked={d.identity}
              onChange={(v) => set("identity", v)}
            />
          )}
          {!editing && (
            <CheckRow
              label="Define as array"
              description="Allow the column to be defined as variable-length multidimensional arrays"
              checked={d.isArray}
              onChange={(v) =>
                setD((x) => ({
                  ...x,
                  isArray: v,
                  identity: v ? false : x.identity,
                }))
              }
            />
          )}
          <Labeled
            label="Default Value"
            description="Can either be a literal or an expression. When using an expression wrap your expression in brackets, e.g. (gen_random_uuid())"
          >
            <DefaultValueInput
              value={d.defaultValue}
              onChange={(v) => set("defaultValue", v)}
              type={typeOf(d)}
              nullable={d.nullable}
              enumValues={enumValues}
              disabled={identity}
              placeholder={
                identity ? "Automatically generated as identity" : undefined
              }
            />
          </Labeled>
        </Section>

        <Section title="Foreign Keys">
          {fks.map((fk, i) => (
            <ForeignKeyRow
              key={fk.name ?? `new-${i}`}
              fk={fk}
              onEdit={() => setFkEditor(i)}
              onRemove={() => setFkEdits(removeForeignKey(fks, i))}
              onUndoRemove={() => setFkEdits(undoRemoveForeignKey(fks, i))}
            />
          ))}
          <Button
            size="sm"
            variant="secondary"
            className="w-fit"
            iconLeft={<Plus />}
            disabled={!d.name.trim()}
            onClick={() => setFkEditor(-1)}
          >
            Add foreign key
          </Button>
        </Section>

        <Section title="Constraints">
          <SwitchRow
            label="Is Primary Key"
            description="A primary key indicates that a column or group of columns can be used as a unique identifier for rows in the table"
            checked={d.primaryKey}
            onChange={(v) =>
              setD((x) => ({
                ...x,
                primaryKey: v,
                nullable: v ? false : x.nullable,
              }))
            }
          />
          <SwitchRow
            label="Allow Nullable"
            description="Allow the column to assume a NULL value if no value is provided"
            checked={d.nullable && !d.primaryKey}
            disabled={
              d.primaryKey
                ? "Column is a primary key and hence cannot be NULL"
                : undefined
            }
            onChange={(v) => set("nullable", v)}
          />
          <SwitchRow
            label="Is unique"
            description="Enforce values in the column to be unique across rows"
            checked={isUnique && !d.primaryKey}
            disabled={
              d.primaryKey ? "A primary key is already unique" : undefined
            }
            onChange={(v) => setUnique(v)}
          />
          <Labeled label="CHECK constraint" optional>
            <Input
              className="font-mono"
              placeholder={
                d.name.trim()
                  ? `length(${ident(d.name.trim())}) < 500`
                  : "value > 0"
              }
              value={d.check}
              onChange={(e) => set("check", e.target.value)}
            />
          </Labeled>
        </Section>

        <section className="flex flex-col gap-3 px-5 py-4">
          <button
            type="button"
            onClick={() => setShowSql((s) => !s)}
            className="w-fit cursor-pointer text-xs text-fg-subtle hover:text-fg"
          >
            {showSql ? "Hide SQL" : "View SQL"}
          </button>
          {showSql && (
            <SqlBlock
              sql={
                sql ||
                (editing
                  ? "-- no changes yet"
                  : "-- give the column a name and type")
              }
              className="max-h-60"
            />
          )}
          {run.isError && (
            <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
              <span className="text-fg">
                {describeError(run.error).message}
              </span>
            </div>
          )}
        </section>
      </form>

      <ForeignKeySheet
        open={fkEditor !== null}
        onOpenChange={(o) => !o && setFkEditor(null)}
        database={database}
        schema={schema}
        table={table}
        columns={(structure.data?.columns ?? []).map((c) => c.name)}
        // A composite key lists other columns too; a single one is just this column
        fixedColumn={
          fkEditor !== null && (fks[fkEditor]?.pairs.length ?? 1) > 1
            ? undefined
            : colName
        }
        initial={fkEditor !== null && fkEditor >= 0 ? fks[fkEditor] : undefined}
        onSave={(fk) => setFkEdits(saveForeignKey(fks, fkEditor ?? -1, fk))}
      />
    </SheetContent>
  );
}

/** Supabase's section layout: the title on the left third, fields on the right. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[1fr_2fr] gap-6 px-5 py-6">
      <h3 className="text-sm text-fg">{title}</h3>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  );
}

function Labeled({
  label,
  optional,
  description,
  children,
}: {
  label: string;
  optional?: boolean;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-xs text-fg-muted">
        {label}
        {optional && <span className="text-fg-subtle">Optional</span>}
      </span>
      {children}
      {description && (
        <span className="text-xs text-fg-subtle">{description}</span>
      )}
    </div>
  );
}

function CheckRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <Checkbox
        className="mt-0.5"
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-fg">{label}</span>
        <span className="text-xs text-fg-subtle">{description}</span>
      </span>
    </label>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  /** Why it can't be changed. */
  disabled?: string;
  onChange: (v: boolean) => void;
}) {
  const control = (
    <span>
      <Switch
        className="mt-0.5"
        checked={checked}
        disabled={disabled !== undefined}
        onCheckedChange={onChange}
      />
    </span>
  );
  return (
    <label className="flex cursor-pointer items-start gap-3">
      {disabled ? <Tooltip content={disabled}>{control}</Tooltip> : control}
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-fg">{label}</span>
        <span className="text-xs text-fg-subtle">{description}</span>
      </span>
    </label>
  );
}
