/**
 * SQL text builders for schema changes. Every statement built here is shown to the user before it
 * runs, and every identifier / literal goes through `ident` / `literal`.
 * (Row data edits are built in Rust with bind parameters instead.)
 */

const RESERVED = new Set(
  (
    "all analyse analyze and any array as asc asymmetric authorization binary both case cast check collate collation " +
    "column concurrently constraint create cross current_catalog current_date current_role current_schema current_time " +
    "current_timestamp current_user default deferrable desc distinct do else end except false fetch for foreign freeze " +
    "from full grant group having ilike in initially inner intersect into is isnull join lateral leading left like limit " +
    "localtime localtimestamp natural not notnull null offset on only or order outer overlaps placing primary references " +
    "returning right select session_user similar some symmetric system_user table tablesample then to trailing true union " +
    "unique user using variadic verbose when where window with"
  ).split(" "),
);

/** Quotes an identifier only when needed, like PostgreSQL's `quote_ident`. */
export function ident(name: string) {
  return /^[a-z_][a-z0-9_$]*$/.test(name) && !RESERVED.has(name)
    ? name
    : `"${name.replaceAll('"', '""')}"`;
}

export function qualified(schema: string, name: string) {
  return `${ident(schema)}.${ident(name)}`;
}

export function literal(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

/** Types offered in pickers. Any other type can still be typed in by hand. */
export const COMMON_TYPES = [
  "bigint",
  "integer",
  "smallint",
  "numeric",
  "real",
  "double precision",
  "text",
  "varchar(255)",
  "boolean",
  "uuid",
  "date",
  "timestamp",
  "timestamptz",
  "time",
  "interval",
  "jsonb",
  "json",
  "bytea",
  "inet",
  "text[]",
  "integer[]",
];

/** Loose check that a type name is plausible and cannot smuggle extra SQL. */
export function isSafeTypeName(type: string) {
  return /^[a-zA-Z_][\w ."]*(\(\s*\d+(\s*,\s*\d+)?\s*\))?(\[\])*$/.test(
    type.trim(),
  );
}

/** ALTER statements that turn column `before` into `after`. Empty when nothing changed. */
export function alterColumn(
  schema: string,
  table: string,
  before: {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue: string;
  },
  after: {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue: string;
  },
) {
  const target = `ALTER TABLE ${qualified(schema, table)}`;
  const statements: string[] = [];
  let name = before.name;
  if (after.name !== before.name) {
    statements.push(
      `${target} RENAME COLUMN ${ident(before.name)} TO ${ident(after.name)};`,
    );
    name = after.name;
  }
  const col = ident(name);
  if (after.type.trim() !== before.type.trim()) {
    statements.push(
      `${target} ALTER COLUMN ${col} TYPE ${after.type.trim()} USING ${col}::${after.type.trim()};`,
    );
  }
  if (after.nullable !== before.nullable) {
    statements.push(
      `${target} ALTER COLUMN ${col} ${after.nullable ? "DROP NOT NULL" : "SET NOT NULL"};`,
    );
  }
  if (after.defaultValue.trim() !== before.defaultValue.trim()) {
    statements.push(
      after.defaultValue.trim()
        ? `${target} ALTER COLUMN ${col} SET DEFAULT ${after.defaultValue.trim()};`
        : `${target} ALTER COLUMN ${col} DROP DEFAULT;`,
    );
  }
  return statements;
}

export function dropColumn(schema: string, table: string, column: string) {
  return `ALTER TABLE ${qualified(schema, table)} DROP COLUMN ${ident(column)};`;
}

export function createIndex(
  schema: string,
  table: string,
  name: string,
  columns: string[],
  unique: boolean,
  method: string,
) {
  const using = method && method !== "btree" ? ` USING ${method}` : "";
  return `CREATE ${unique ? "UNIQUE " : ""}INDEX ${ident(name)} ON ${qualified(schema, table)}${using} (${columns
    .map(ident)
    .join(", ")});`;
}

export function dropIndex(schema: string, name: string) {
  return `DROP INDEX ${qualified(schema, name)};`;
}

export function addForeignKey(
  schema: string,
  table: string,
  name: string,
  columns: string[],
  refSchema: string,
  refTable: string,
  refColumns: string[],
  onDelete: string,
) {
  return (
    `ALTER TABLE ${qualified(schema, table)} ADD CONSTRAINT ${ident(name)} FOREIGN KEY (${columns.map(ident).join(", ")}) ` +
    `REFERENCES ${qualified(refSchema, refTable)} (${refColumns.map(ident).join(", ")}) ON DELETE ${onDelete};`
  );
}

export function dropConstraint(schema: string, table: string, name: string) {
  return `ALTER TABLE ${qualified(schema, table)} DROP CONSTRAINT ${ident(name)};`;
}

export function renameTable(schema: string, table: string, newName: string) {
  return `ALTER TABLE ${qualified(schema, table)} RENAME TO ${ident(newName)};`;
}

export function dropTable(
  schema: string,
  table: string,
  kind: "table" | "view" | "materialized view",
  cascade: boolean,
) {
  const keyword =
    kind === "view"
      ? "VIEW"
      : kind === "materialized view"
        ? "MATERIALIZED VIEW"
        : "TABLE";
  return `DROP ${keyword} ${qualified(schema, table)}${cascade ? " CASCADE" : ""};`;
}

export function truncateTable(schema: string, table: string) {
  return `TRUNCATE TABLE ${qualified(schema, table)};`;
}

export function createSchema(name: string) {
  return `CREATE SCHEMA ${ident(name)};`;
}

export function renameSchema(name: string, newName: string) {
  return `ALTER SCHEMA ${ident(name)} RENAME TO ${ident(newName)};`;
}

export function dropSchema(name: string, cascade: boolean) {
  return `DROP SCHEMA ${ident(name)}${cascade ? " CASCADE" : ""};`;
}

export function createDatabase(name: string) {
  return `CREATE DATABASE ${ident(name)};`;
}

/** Renaming needs no open connections to the database, so close them first. */
export function renameDatabase(name: string, newName: string) {
  return (
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${literal(name)} AND pid <> pg_backend_pid();\n` +
    `ALTER DATABASE ${ident(name)} RENAME TO ${ident(newName)};`
  );
}

export function dropDatabase(name: string) {
  return `DROP DATABASE ${ident(name)} WITH (FORCE);`;
}

export function createExtension(name: string, schema?: string) {
  return `CREATE EXTENSION IF NOT EXISTS ${ident(name)}${schema ? ` SCHEMA ${ident(schema)}` : ""};`;
}

export function dropExtension(name: string) {
  return `DROP EXTENSION ${ident(name)};`;
}

/** Postgres folds unquoted names to lower case, so suggest names that never need quotes. */
export function suggestIdentifier(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/* ── Database objects: enums, triggers, functions, sequences, extensions ── */

export function createEnum(schema: string, name: string, values: string[]) {
  return `CREATE TYPE ${qualified(schema, name)} AS ENUM (${values.map(literal).join(", ")});`;
}

export function addEnumValue(
  schema: string,
  name: string,
  value: string,
  position?: { before?: string; after?: string },
) {
  const where = position?.before
    ? ` BEFORE ${literal(position.before)}`
    : position?.after
      ? ` AFTER ${literal(position.after)}`
      : "";
  return `ALTER TYPE ${qualified(schema, name)} ADD VALUE ${literal(value)}${where};`;
}

export function renameEnumValue(
  schema: string,
  name: string,
  from: string,
  to: string,
) {
  return `ALTER TYPE ${qualified(schema, name)} RENAME VALUE ${literal(from)} TO ${literal(to)};`;
}

export function renameType(schema: string, name: string, newName: string) {
  return `ALTER TYPE ${qualified(schema, name)} RENAME TO ${ident(newName)};`;
}

export function dropType(schema: string, name: string, cascade: boolean) {
  return `DROP TYPE ${qualified(schema, name)}${cascade ? " CASCADE" : ""};`;
}

/**
 * PostgreSQL can't drop a value from an enum, so this rebuilds it: rename the old type, create
 * the new one without the value, convert every column (and its default) to it, drop the old type.
 * One DO block, so it all succeeds or nothing changes (e.g. if a row still uses the value).
 */
export function removeEnumValue(schema: string, name: string, keep: string[]) {
  const target = qualified(schema, name);
  const old = `${name}__old`;
  const oldQualified = qualified(schema, old);
  return `DO $$
DECLARE
  col record;
BEGIN
  ALTER TYPE ${target} RENAME TO ${ident(old)};
  CREATE TYPE ${target} AS ENUM (${keep.map(literal).join(", ")});
  FOR col IN
    SELECT n.nspname AS sch, c.relname AS tbl, a.attname AS colname,
           pg_get_expr(d.adbin, d.adrelid) AS def
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.atttypid = ${literal(oldQualified)}::regtype
       AND a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r', 'p')
  LOOP
    IF col.def IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT', col.sch, col.tbl, col.colname);
    END IF;
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE ${target.replaceAll("'", "''")} USING %I::text::${target.replaceAll("'", "''")}',
                   col.sch, col.tbl, col.colname, col.colname);
    IF col.def IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %s', col.sch, col.tbl, col.colname,
                     replace(col.def, ${literal(old)}, ${literal(name)}));
    END IF;
  END LOOP;
  DROP TYPE ${oldQualified};
END $$;`;
}

export type TriggerTiming = "BEFORE" | "AFTER" | "INSTEAD OF";
export type TriggerEvent = "INSERT" | "UPDATE" | "DELETE" | "TRUNCATE";

export function createTrigger(t: {
  schema: string;
  name: string;
  table: string;
  timing: TriggerTiming;
  events: TriggerEvent[];
  forEachRow: boolean;
  functionName: string;
}) {
  return (
    `CREATE TRIGGER ${ident(t.name)}\n  ${t.timing} ${t.events.join(" OR ")} ON ${qualified(t.schema, t.table)}\n` +
    `  FOR EACH ${t.forEachRow ? "ROW" : "STATEMENT"}\n  EXECUTE FUNCTION ${qualified(t.schema, t.functionName)}();`
  );
}

export function setTriggerEnabled(
  schema: string,
  table: string,
  trigger: string,
  enabled: boolean,
) {
  return `ALTER TABLE ${qualified(schema, table)} ${enabled ? "ENABLE" : "DISABLE"} TRIGGER ${ident(trigger)};`;
}

export function renameTrigger(
  schema: string,
  table: string,
  trigger: string,
  newName: string,
) {
  return `ALTER TRIGGER ${ident(trigger)} ON ${qualified(schema, table)} RENAME TO ${ident(newName)};`;
}

export function dropTrigger(schema: string, table: string, trigger: string) {
  return `DROP TRIGGER ${ident(trigger)} ON ${qualified(schema, table)};`;
}

/** `kind` from the catalog: function, procedure, aggregate or window (a window function). */
function routineKeyword(kind: string) {
  return kind === "procedure"
    ? "PROCEDURE"
    : kind === "aggregate"
      ? "AGGREGATE"
      : "FUNCTION";
}

export function renameRoutine(
  schema: string,
  name: string,
  args: string,
  kind: string,
  newName: string,
) {
  return `ALTER ${routineKeyword(kind)} ${qualified(schema, name)}(${args}) RENAME TO ${ident(newName)};`;
}

export function dropRoutine(
  schema: string,
  name: string,
  args: string,
  kind: string,
  cascade: boolean,
) {
  return `DROP ${routineKeyword(kind)} ${qualified(schema, name)}(${args})${cascade ? " CASCADE" : ""};`;
}

export type Volatility = "volatile" | "stable" | "immutable";

export interface FunctionSpec {
  schema: string;
  name: string;
  /** An empty name makes an unnamed argument. */
  args: { name: string; type: string }[];
  returns: string;
  language: string;
  body: string;
  volatility: Volatility;
  securityDefiner: boolean;
}

/** `CREATE [OR REPLACE] FUNCTION` from the function form. */
export function createFunction(f: FunctionSpec, replace: boolean) {
  const args = f.args
    .map((a) => (a.name.trim() ? `${ident(a.name.trim())} ${a.type}` : a.type))
    .join(", ");
  // A dollar quote the body doesn't contain
  let tag = "$$";
  for (let i = 1; f.body.includes(tag); i++) tag = `$fn${i}$`;
  return [
    `CREATE ${replace ? "OR REPLACE " : ""}FUNCTION ${qualified(f.schema, f.name)}(${args})`,
    `RETURNS ${f.returns}`,
    `LANGUAGE ${f.language}`,
    f.volatility.toUpperCase(),
    ...(f.securityDefiner ? ["SECURITY DEFINER"] : []),
    `AS ${tag}`,
    f.body.trim(),
    `${tag};`,
  ].join("\n");
}

export function createSequence(
  schema: string,
  name: string,
  start: string,
  increment: string,
) {
  return `CREATE SEQUENCE ${qualified(schema, name)} START WITH ${Number(start)} INCREMENT BY ${Number(increment)};`;
}

/** Changes the step and/or the next value `nextval` will return. */
export function alterSequence(
  schema: string,
  name: string,
  change: { increment?: string; next?: string },
) {
  const target = qualified(schema, name);
  const out: string[] = [];
  if (change.increment !== undefined)
    out.push(
      `ALTER SEQUENCE ${target} INCREMENT BY ${Number(change.increment)};`,
    );
  if (change.next !== undefined)
    out.push(
      `SELECT setval(${literal(target)}, ${Number(change.next)}, false);`,
    );
  return out.join("\n");
}

export function restartSequence(schema: string, name: string) {
  return `ALTER SEQUENCE ${qualified(schema, name)} RESTART;`;
}

export function renameSequence(schema: string, name: string, newName: string) {
  return `ALTER SEQUENCE ${qualified(schema, name)} RENAME TO ${ident(newName)};`;
}

export function dropSequence(schema: string, name: string, cascade: boolean) {
  return `DROP SEQUENCE ${qualified(schema, name)}${cascade ? " CASCADE" : ""};`;
}

export function updateExtension(name: string) {
  return `ALTER EXTENSION ${ident(name)} UPDATE;`;
}
