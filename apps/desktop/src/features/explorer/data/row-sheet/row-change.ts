/** Pure logic for the row panel: what a form's values mean as a change to save. */
import type {
  ColumnInfo,
  ColumnValue,
  RowChange,
} from "../../../../lib/bindings";
import type { TypeKind } from "../../../../lib/pg-types";

/** `undefined` = not set (insert: use the default), `null` = NULL, string = value. */
export type Value = string | null | undefined;

/** The row being edited: its current values and the key that identifies it. */
export interface EditTarget {
  values: (string | null)[];
  key: ColumnValue[];
}

/** Generated columns aren't part of the form, and identity ALWAYS ones can't be written. */
export const writable = (c: ColumnInfo) =>
  !c.generated && c.identity !== "always";

const isTextKind = (kind: TypeKind | undefined) =>
  kind === "text" || kind === "array" || kind === "json";

/**
 * The change the form describes: an update of only the fields that differ from `row`, or an
 * insert of the fields that were set. `null` when an edit changed nothing.
 */
export function rowChange(
  columns: ColumnInfo[],
  kinds: TypeKind[],
  values: Value[],
  row: EditTarget | null,
): RowChange | null {
  // Non-text fields left empty mean "not set" (insert) or NULL (update)
  const normalized = (i: number): Value => {
    const v = values[i];
    if (v === "" && !isTextKind(kinds[i])) return row ? null : undefined;
    return v;
  };
  if (row) {
    const changed = columns
      .map((c, i) => ({ c, i, value: normalized(i) ?? null }))
      .filter(({ c, i, value }) => writable(c) && value !== row.values[i])
      .map(({ c, value }) => ({ column: c.name, value }));
    return changed.length
      ? { type: "update", key: row.key, values: changed }
      : null;
  }
  // Unset fields are left out, so the database applies the default (or NULL)
  return {
    type: "insert",
    values: columns
      .map((c, i) => ({ column: c.name, value: normalized(i) }))
      .filter(
        (x, i): x is ColumnValue =>
          writable(columns[i]!) && x.value !== undefined,
      ),
  };
}
