/** Pure helpers behind the table data view: grid columns, row ids, keys and undo changes. */
import type {
  ColumnInfo,
  ColumnValue,
  EnumInfo,
  FilterSpec,
  ForeignKeyInfo,
  RowChange,
  RowsPage,
  SortSpec,
} from "../../../../lib/bindings";
import { commands, unwrap } from "../../../../lib/ipc";
import { baseTypeName, shortType, typeKind } from "../../../../lib/pg-types";
import type { GridColumn, GridRow } from "../grid/types";
import type { Reference } from "../reference";

export const EMPTY_PAGE: RowsPage = {
  columns: [],
  rows: [],
  keyColumns: [],
  hasMore: false,
  total: null,
  totalIsEstimate: false,
};

/** Rows fetched (and deleted) per request when acting on the whole table. */
export const ALL_ROWS_PAGE = 1000;
/** Most rows "Select all" copies or exports in one go. */
export const ALL_ROWS_MAX = 200_000;

export type Cells = (string | null)[];

export type TableReference = Reference & { onUpdate: string; onDelete: string };

/** Single-column foreign keys, by column: those columns link to another table. */
export function foreignKeyReferences(foreignKeys: readonly ForeignKeyInfo[]) {
  const out: Record<string, TableReference> = {};
  for (const fk of foreignKeys) {
    if (fk.columns.length === 1 && fk.referencedColumns.length === 1)
      out[fk.columns[0]!] = {
        schema: fk.referencedSchema,
        table: fk.referencedTable,
        column: fk.referencedColumns[0]!,
        onUpdate: fk.onUpdate,
        onDelete: fk.onDelete,
      };
  }
  return out;
}

/** Enum values by lowercased type name. */
export function enumValuesByName(enums: readonly EnumInfo[]) {
  return new Map(enums.map((e) => [e.name.toLowerCase(), e.values]));
}

export function toGridColumns(
  columns: readonly ColumnInfo[],
  references: Record<string, TableReference>,
  enums: ReadonlyMap<string, string[]>,
  editable: boolean,
): GridColumn[] {
  const enumNames = new Set(enums.keys());
  return columns.map((c) => {
    const kind = typeKind(c.dataType, enumNames);
    const ref = references[c.name];
    return {
      id: c.name,
      name: c.name,
      format: shortType(c.dataType),
      kind,
      isKey: c.isPrimaryKey,
      nullable: c.nullable,
      comment: c.comment,
      enumValues:
        kind === "enum" ? enums.get(baseTypeName(c.dataType)) : undefined,
      // Like Supabase, keys and generated values aren't edited in place
      editable:
        editable && !c.isPrimaryKey && !c.generated && c.identity !== "always",
      references: ref
        ? {
            target: `${ref.schema}.${ref.table}.${ref.column}`,
            onUpdate: ref.onUpdate,
            onDelete: ref.onDelete,
          }
        : undefined,
    };
  });
}

/**
 * Columns where a summary says something: numbers, booleans and enums, plus text that
 * repeats a lot (city, status). Ids, uuids, names, dates and times (almost all unique), JSON
 * and links are left out.
 */
export function pickStatsColumns(
  columns: readonly GridColumn[],
  rows: readonly Cells[],
) {
  const out = new Set<string>();
  columns.forEach((c, i) => {
    if (c.isKey || c.references || c.format === "uuid") return;
    if (c.kind === "number" || c.kind === "bool" || c.kind === "enum") {
      out.add(c.id);
      return;
    }
    if (c.kind !== "text") return;
    // Judge text by the rows on screen: few distinct values means categories
    const values = rows
      .map((r) => r[i])
      .filter((v): v is string => v !== null && v !== undefined && v !== "");
    const distinct = new Set(values).size;
    if (values.length >= 5 && distinct <= 20 && distinct <= values.length * 0.6)
      out.add(c.id);
  });
  return out;
}

/** Index of each key column in the row's cells. */
export function keyIndexesOf(page: RowsPage) {
  return page.keyColumns.map((k) =>
    page.columns.findIndex((c) => c.name === k),
  );
}

/**
 * The grid's rows, each with a stable id: its primary key when the table has one, otherwise
 * its position on the page (read-only tables can't be addressed any other way).
 */
export function toGridRows(page: RowsPage, keyIndexes: readonly number[]) {
  const keyed = page.keyColumns.length > 0;
  return page.rows.map((cells, index): GridRow => ({
    id: keyed
      ? JSON.stringify(keyIndexes.map((i) => cells[i]))
      : `row:${index}`,
    cells,
  }));
}

/** The key of a row with these cells. */
export function keyOf(
  cells: Cells,
  keyColumns: readonly string[],
  keyIndexes: readonly number[],
): ColumnValue[] {
  return keyColumns.map((column, i) => ({
    column,
    value: cells[keyIndexes[i]!] ?? null,
  }));
}

/** The key of a row as it is after `values` were written (keys can be edited in the panel). */
export function keyAfter(key: ColumnValue[], values: ColumnValue[]) {
  return key.map((k) => values.find((v) => v.column === k.column) ?? k);
}

/** Changes that put deleted rows back with every value they had (generated ones are recomputed). */
export function reinsertChanges(
  rows: readonly Cells[],
  columns: readonly ColumnInfo[],
): RowChange[] {
  return rows.map((cells) => ({
    type: "insert",
    values: columns.flatMap((c, i) =>
      c.generated ? [] : [{ column: c.name, value: cells[i] ?? null }],
    ),
  }));
}

/**
 * Deletes undoing these inserts, or `null` when some row's key isn't known (the database
 * generated it), so the inserts can't be undone.
 */
export function undoInserts(
  inserts: readonly ColumnValue[][],
  keyColumns: readonly string[],
): RowChange[] | null {
  if (keyColumns.length === 0) return null;
  const deletes: RowChange[] = [];
  for (const values of inserts) {
    const key: ColumnValue[] = [];
    for (const column of keyColumns) {
      const v = values.find((x) => x.column === column);
      if (!v) return null;
      key.push(v);
    }
    deletes.push({ type: "delete", key });
  }
  return deletes;
}

/** Every row matching `filters` in `sort` order, fetched page by page (at most ALL_ROWS_MAX). */
export async function fetchAllRows(
  target: {
    connectionId: string;
    database: string;
    schema: string;
    table: string;
  },
  sort: SortSpec[],
  filters: FilterSpec[],
) {
  const all: Cells[] = [];
  for (let offset = 0; ; offset += ALL_ROWS_PAGE) {
    const batch = await unwrap(
      commands.tableRows(
        target.connectionId,
        target.database,
        target.schema,
        target.table,
        { offset, limit: ALL_ROWS_PAGE, sort, filters },
      ),
    );
    for (const row of batch.rows) all.push(row);
    if (!batch.hasMore || all.length >= ALL_ROWS_MAX) break;
  }
  return all;
}
