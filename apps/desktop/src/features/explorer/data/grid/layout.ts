/** Pure column layout math for the data grid: widths, order, offsets, drag targets. */
import type { GridColumn } from "./types";

export const ROW_HEIGHT = 34;
export const SELECT_WIDTH = 65;
export const ADD_COLUMN_WIDTH = 96;
export const MIN_WIDTH = 100;

/** Supabase's default widths: narrow for numbers and booleans, wide for text. */
export function initialWidth(column: GridColumn) {
  const byKind =
    column.kind === "number" || column.kind === "bool"
      ? 120
      : column.kind === "date" ||
          column.kind === "time" ||
          column.kind === "timestamp" ||
          column.kind === "timestamptz" ||
          column.kind === "enum"
        ? 150
        : 250;
  const header =
    (column.name.length + (column.format?.length ?? 0)) * 9 +
    (column.isKey ? 16 : 0) +
    (column.references ? 16 : 0) +
    40;
  return Math.max(MIN_WIDTH, byKind, header);
}

/** Every column index in the user's arrangement; unlisted columns follow in table order. */
export function arrangeColumns(
  columns: readonly GridColumn[],
  columnOrder?: readonly string[],
) {
  // A map instead of indexOf in the comparator keeps this O(n log n) for wide tables
  const rankOf = new Map<string, number>();
  columnOrder?.forEach((id, i) => {
    if (!rankOf.has(id)) rankOf.set(id, i);
  });
  const rest = columnOrder?.length ?? 0;
  const rank = (i: number) => rankOf.get(columns[i]!.id) ?? rest + i;
  return columns.map((_, i) => i).sort((a, b) => rank(a) - rank(b));
}

/** Column indexes in display order: frozen ones first, hidden ones left out. */
export function displayOrder(
  arranged: readonly number[],
  columns: readonly GridColumn[],
  hidden?: ReadonlySet<string>,
  frozen?: ReadonlySet<string>,
) {
  const visible = arranged.filter((i) => !hidden?.has(columns[i]!.id));
  const pinned = visible.filter((i) => frozen?.has(columns[i]!.id));
  return {
    order: [...pinned, ...visible.filter((i) => !frozen?.has(columns[i]!.id))],
    frozenCount: pinned.length,
  };
}

/** Column widths, with the last visible column taking up any room left on the right. */
export function stretchWidths(
  baseWidths: number[],
  order: readonly number[],
  fixed: number,
  viewWidth: number,
) {
  const last = order.at(-1);
  if (last === undefined) return baseWidths;
  const used = fixed + order.reduce((sum, i) => sum + baseWidths[i]!, 0);
  const spare = viewWidth - used;
  if (spare <= 0) return baseWidths;
  return baseWidths.map((w, i) => (i === last ? w + spare : w));
}

/** Left edge of each column (by its index), counting from `start`. */
export function columnOffsets(
  order: readonly number[],
  widths: readonly number[],
  start: number,
) {
  const out: number[] = [];
  let x = start;
  for (const i of order) {
    out[i] = x;
    x += widths[i]!;
  }
  return out;
}

/** The display position (within `first`..`end`) a header dropped at `x` goes to. */
export function dropPosition(
  x: number,
  order: readonly number[],
  first: number,
  end: number,
  offsets: readonly number[],
  widths: readonly number[],
) {
  for (let p = first; p < end; p++) {
    const i = order[p]!;
    if (x < offsets[i]! + widths[i]! / 2) return p;
  }
  return end;
}

/**
 * Every column id in the new arrangement after moving `moving` just before `before` (or just
 * after `after` when dropped at the end of its group). Hidden columns keep their place.
 */
export function reorderIds(
  arrangedIds: readonly string[],
  moving: string,
  target: { before: string } | { after: string },
) {
  const ids = arrangedIds.filter((id) => id !== moving);
  if ("before" in target) ids.splice(ids.indexOf(target.before), 0, moving);
  else ids.splice(ids.indexOf(target.after) + 1, 0, moving);
  return ids;
}
