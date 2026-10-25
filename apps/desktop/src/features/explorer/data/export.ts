import { ident, literal, qualified } from "../../../lib/sql";
import type { GridCell } from "./grid/types";

function csvField(value: GridCell) {
  if (value === null || value === undefined) return "";
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(columns: string[], rows: GridCell[][]) {
  return [
    columns.map(csvField).join(","),
    ...rows.map((r) => r.map(csvField).join(",")),
  ].join("\n");
}

/**
 * Object keys for `columns`. Query results can repeat a name (`select a.id, b.id`), and plain
 * keys would silently drop all but the last, so repeats become `id_2`, `id_3`…
 */
function uniqueKeys(columns: string[]) {
  const seen = new Set<string>();
  return columns.map((name) => {
    let key = name;
    for (let n = 2; seen.has(key); n++) key = `${name}_${n}`;
    seen.add(key);
    return key;
  });
}

/** Values stay strings (that's how they arrive); NULL becomes `null`. */
export function toJson(columns: string[], rows: GridCell[][]) {
  const keys = uniqueKeys(columns);
  return JSON.stringify(
    rows.map((r) => Object.fromEntries(keys.map((c, i) => [c, r[i] ?? null]))),
    null,
    2,
  );
}

export function toInsertSql(
  schema: string,
  table: string,
  columns: string[],
  rows: GridCell[][],
) {
  const target = qualified(schema, table);
  const names = columns.map(ident).join(", ");
  return rows
    .map(
      (r) =>
        `INSERT INTO ${target} (${names}) VALUES (${r.map((v) => (v == null ? "NULL" : literal(v))).join(", ")});`,
    )
    .join("\n");
}

/** A Markdown table; pipes and line breaks in values are escaped so the table stays intact. */
export function toMarkdown(columns: string[], rows: GridCell[][]) {
  const cell = (v: GridCell) =>
    v === null || v === undefined
      ? "NULL"
      : v.replaceAll("|", "\\|").replace(/\r?\n|\r/g, " ");
  return [
    `| ${columns.map(cell).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n");
}

export type ExportFormat = "csv" | "json" | "sql" | "markdown";

export function exportRows(
  format: ExportFormat,
  columns: string[],
  rows: GridCell[][],
  target?: { schema: string; table: string },
) {
  if (format === "csv") return toCsv(columns, rows);
  if (format === "json") return toJson(columns, rows);
  if (format === "markdown") return toMarkdown(columns, rows);
  return toInsertSql(
    target?.schema ?? "public",
    target?.table ?? "my_table",
    columns,
    rows,
  );
}
