/**
 * Pure SQL helpers shared by the column panel and the table panel. Like `lib/sql`, every
 * identifier goes through `ident` / `qualified`.
 */
import type { ConstraintInfo } from "../../../lib/bindings";
import { ident, literal, qualified } from "../../../lib/sql";

/**
 * The column type as SQL. The type picker offers the schema's enums by bare name, which only
 * resolves when the schema is on the search_path and the name needs no quotes, so those are
 * written schema-qualified. Anything else is used as typed.
 */
export function columnTypeSql(
  type: string,
  isArray: boolean,
  schema: string,
  enums: readonly string[],
) {
  const t = type.trim();
  const base = enums.includes(t) ? qualified(schema, t) : t;
  return `${base}${isArray ? "[]" : ""}`;
}

/**
 * The enum a column type refers to: its bare name (from the picker), or how Postgres prints it
 * (`mood`, `"Mood"`, `app.mood` when the schema isn't on the search_path).
 */
export function enumOf<E extends { name: string }>(
  type: string,
  schema: string,
  enums: readonly E[],
): E | undefined {
  const t = type.trim();
  return enums.find(
    (e) =>
      t === e.name ||
      t === ident(e.name) ||
      t === qualified(schema, e.name) ||
      t === `${schema}.${e.name}`,
  );
}

/** `UNIQUE (name)` as Postgres prints it, quoted or not. */
function isUniqueOn(definition: string, column: string) {
  const quoted = `"${column.replaceAll('"', '""')}"`;
  return (
    definition === `UNIQUE (${column})` ||
    definition === `UNIQUE (${ident(column)})` ||
    definition === `UNIQUE (${quoted})`
  );
}

/** The UNIQUE constraint on exactly this one column, if there is one. */
export function uniqueConstraintOn(
  constraints: readonly ConstraintInfo[],
  column: string,
) {
  return constraints.find(
    (c) => c.kind === "unique" && isUniqueOn(c.definition, column),
  );
}

/** Drops the table's primary key, whatever its constraint is called. */
export function dropPrimaryKeySql(schema: string, table: string) {
  const target = literal(qualified(schema, table));
  return `DO $$ BEGIN EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', ${target}::regclass, (SELECT conname FROM pg_constraint WHERE conrelid = ${target}::regclass AND contype = 'p')); END $$;`;
}
