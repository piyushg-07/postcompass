import { ident, qualified } from "./quote";

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
  // Access methods are plain names (btree, gin, …); quoting keeps anything else from becoming SQL
  const using = method && method !== "btree" ? ` USING ${ident(method)}` : "";
  return `CREATE ${unique ? "UNIQUE " : ""}INDEX ${ident(name)} ON ${qualified(schema, table)}${using} (${columns
    .map(ident)
    .join(", ")});`;
}

export function dropIndex(schema: string, name: string) {
  return `DROP INDEX ${qualified(schema, name)};`;
}

const REFERENTIAL_ACTIONS = new Set([
  "NO ACTION",
  "RESTRICT",
  "CASCADE",
  "SET NULL",
  "SET DEFAULT",
]);

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
  // Spliced in as keywords, so only the known actions get through
  const action = onDelete.trim().replace(/\s+/g, " ").toUpperCase();
  return (
    `ALTER TABLE ${qualified(schema, table)} ADD CONSTRAINT ${ident(name)} FOREIGN KEY (${columns.map(ident).join(", ")}) ` +
    `REFERENCES ${qualified(refSchema, refTable)} (${refColumns.map(ident).join(", ")}) ON DELETE ${REFERENTIAL_ACTIONS.has(action) ? action : "NO ACTION"};`
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
