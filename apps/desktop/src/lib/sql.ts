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
  return /^[a-z_][a-z0-9_$]*$/.test(name) && !RESERVED.has(name) ? name : `"${name.replaceAll('"', '""')}"`;
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
  return /^[a-zA-Z_][\w ."]*(\(\s*\d+(\s*,\s*\d+)?\s*\))?(\[\])*$/.test(type.trim());
}

export interface ColumnDraft {
  name: string;
  type: string;
  nullable: boolean;
  /** Raw SQL expression, e.g. `now()` or `'pending'`. Empty means no default. */
  defaultValue: string;
  primaryKey: boolean;
  unique: boolean;
}

export function createTable(schema: string, table: string, columns: ColumnDraft[]) {
  const lines = columns.map((c) => {
    let line = `  ${ident(c.name)} ${c.type.trim()}`;
    if (!c.nullable && !c.primaryKey) line += " NOT NULL";
    if (c.defaultValue.trim()) line += ` DEFAULT ${c.defaultValue.trim()}`;
    if (c.unique && !c.primaryKey) line += " UNIQUE";
    return line;
  });
  const pk = columns.filter((c) => c.primaryKey).map((c) => ident(c.name));
  if (pk.length) lines.push(`  PRIMARY KEY (${pk.join(", ")})`);
  return `CREATE TABLE ${qualified(schema, table)} (\n${lines.join(",\n")}\n);`;
}

export function addColumn(schema: string, table: string, c: ColumnDraft) {
  let sql = `ALTER TABLE ${qualified(schema, table)} ADD COLUMN ${ident(c.name)} ${c.type.trim()}`;
  if (!c.nullable) sql += " NOT NULL";
  if (c.defaultValue.trim()) sql += ` DEFAULT ${c.defaultValue.trim()}`;
  if (c.unique) sql += " UNIQUE";
  return `${sql};`;
}

/** ALTER statements that turn column `before` into `after`. Empty when nothing changed. */
export function alterColumn(
  schema: string,
  table: string,
  before: { name: string; type: string; nullable: boolean; defaultValue: string },
  after: { name: string; type: string; nullable: boolean; defaultValue: string },
) {
  const target = `ALTER TABLE ${qualified(schema, table)}`;
  const statements: string[] = [];
  let name = before.name;
  if (after.name !== before.name) {
    statements.push(`${target} RENAME COLUMN ${ident(before.name)} TO ${ident(after.name)};`);
    name = after.name;
  }
  const col = ident(name);
  if (after.type.trim() !== before.type.trim()) {
    statements.push(`${target} ALTER COLUMN ${col} TYPE ${after.type.trim()} USING ${col}::${after.type.trim()};`);
  }
  if (after.nullable !== before.nullable) {
    statements.push(`${target} ALTER COLUMN ${col} ${after.nullable ? "DROP NOT NULL" : "SET NOT NULL"};`);
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

export function dropTable(schema: string, table: string, kind: "table" | "view" | "materialized view", cascade: boolean) {
  const keyword = kind === "view" ? "VIEW" : kind === "materialized view" ? "MATERIALIZED VIEW" : "TABLE";
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
