/* ── Database objects: enums, triggers, functions, sequences ── */

import { dollarTag, ident, integer, literal, qualified } from "./quote";

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
  // Spliced into a format() string: escape its quotes, and `%` so format() doesn't read it as a placeholder
  const inFormat = target.replaceAll("'", "''").replaceAll("%", "%%");
  const body = `
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
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE ${inFormat} USING %I::text::${inFormat}',
                   col.sch, col.tbl, col.colname, col.colname);
    IF col.def IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %s', col.sch, col.tbl, col.colname,
                     replace(col.def, ${literal(old)}, ${literal(name)}));
    END IF;
  END LOOP;
  DROP TYPE ${oldQualified};
END `;
  // Enum values can contain `$$`, which would end a fixed `$$` body early
  const tag = dollarTag(body);
  return `DO ${tag}${body}${tag};`;
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
  const tag = dollarTag(f.body);
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
  return `CREATE SEQUENCE ${qualified(schema, name)} START WITH ${integer(start)} INCREMENT BY ${integer(increment)};`;
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
      `ALTER SEQUENCE ${target} INCREMENT BY ${integer(change.increment)};`,
    );
  if (change.next !== undefined)
    out.push(
      `SELECT setval(${literal(target)}, ${integer(change.next)}, false);`,
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
