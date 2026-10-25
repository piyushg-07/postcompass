/**
 * The SQL each object form runs, from its fields. Pure, so it's easy to test; a result starting
 * with `--` means the form isn't ready (it keeps Save disabled).
 */
import type { EnumInfo, FunctionInfo } from "../../../../lib/bindings";
import {
  addEnumValue,
  createEnum,
  createFunction,
  dropRoutine,
  type FunctionSpec,
  isSafeTypeName,
  removeEnumValue,
  renameEnumValue,
  renameType,
  type TriggerEvent,
  type TriggerTiming,
} from "../../../../lib/sql";

export const isName = (v: string) =>
  v.trim().length > 0 && v.trim().length <= 63;
export const isInt = (v: string) => /^-?\d+$/.test(v.trim());

/* ── Enums ────────────────────────────────────────────────────────────── */

export interface EnumRow {
  key: number;
  /** The value as it is in the database; unset for a new value. */
  original?: string;
  value: string;
}

/** What the enum form does with its rows, and the SQL for it. */
export function enumChanges(
  schema: string,
  name: string,
  rows: EnumRow[],
  item?: EnumInfo,
) {
  // New rows left empty are ignored; existing ones must keep a value
  const kept = rows.filter((r) => r.original !== undefined || r.value.trim());
  const values = kept.map((r) => r.value.trim());
  const valid =
    isName(name) &&
    values.length > 0 &&
    values.every(Boolean) &&
    new Set(values).size === values.length;

  const renamed = kept.filter(
    (r) => r.original !== undefined && r.value.trim() !== r.original,
  );
  const added = kept.filter((r) => r.original === undefined);
  const removed = (item?.values ?? []).filter(
    (v) => !kept.some((r) => r.original === v),
  );

  let sql = "-- name and values";
  if (valid && !item) sql = createEnum(schema, name.trim(), values);
  else if (valid && item) {
    const steps = renamed.map((r) =>
      renameEnumValue(schema, item.name, r.original!, r.value.trim()),
    );
    // Removing needs a rebuild, which also brings in the new values
    if (removed.length) steps.push(removeEnumValue(schema, item.name, values));
    else
      steps.push(
        ...added.map((r) => addEnumValue(schema, item.name, r.value.trim())),
      );
    if (name.trim() !== item.name)
      steps.push(renameType(schema, item.name, name.trim()));
    sql = steps.length ? steps.join("\n") : "-- nothing changed";
  }
  return { sql, removed };
}

/* ── Triggers ─────────────────────────────────────────────────────────── */

/**
 * Why PostgreSQL would reject this trigger, or null. Checked up front so the form explains it
 * instead of failing on Save.
 */
export function triggerProblem(t: {
  timing: TriggerTiming;
  events: TriggerEvent[];
  forEachRow: boolean;
  onView: boolean;
}): string | null {
  if (t.timing === "INSTEAD OF") {
    if (!t.onView) return "Instead of triggers only work on views.";
    if (!t.forEachRow) return "Instead of triggers run for each row.";
    if (t.events.includes("TRUNCATE"))
      return "Instead of triggers can't run on TRUNCATE.";
  } else if (t.onView && t.forEachRow)
    return "On a view, before and after triggers run once per statement.";
  if (t.forEachRow && t.events.includes("TRUNCATE"))
    return "TRUNCATE triggers run once per statement; turn off For each row.";
  return null;
}

/* ── Functions ────────────────────────────────────────────────────────── */

export interface ArgRow {
  key: number;
  name: string;
  type: string;
}

/** The function form's SQL; editing swaps the function when its signature changes. */
export function functionSql(
  spec: Omit<FunctionSpec, "args"> & { args: ArgRow[] },
  item?: FunctionInfo,
) {
  const argNames = spec.args.map((a) => a.name.trim()).filter(Boolean);
  const valid =
    isName(spec.name) &&
    spec.args.every((a) => isSafeTypeName(a.type)) &&
    new Set(argNames).size === argNames.length &&
    argNames.every(isName) &&
    isSafeTypeName(spec.returns) &&
    spec.body.trim().length > 0;
  if (!valid) return "-- fill in the function";

  const full: FunctionSpec = {
    ...spec,
    name: spec.name.trim(),
    args: spec.args.map((a) => ({ name: a.name, type: a.type })),
  };
  // CREATE OR REPLACE can't change the name, arguments or return type: swap the function
  const signatureChanged =
    item &&
    (full.name !== item.name ||
      spec.returns !== item.returns ||
      spec.args.length !== item.args?.length ||
      spec.args.some(
        (a, i) =>
          a.name.trim() !== item.args?.[i]?.name ||
          a.type !== item.args?.[i]?.dataType,
      ));
  return signatureChanged
    ? `${dropRoutine(spec.schema, item.name, item.arguments, "function", false)}\n${createFunction(full, false)}`
    : createFunction(full, true);
}
