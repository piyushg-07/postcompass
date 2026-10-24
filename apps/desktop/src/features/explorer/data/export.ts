import { ident, literal, qualified } from "../../../lib/sql";
import type { GridCell } from "./data-grid";

function csvField(value: GridCell) {
  if (value === null || value === undefined) return "";
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(columns: string[], rows: GridCell[][]) {
  return [columns.map(csvField).join(","), ...rows.map((r) => r.map(csvField).join(","))].join("\n");
}

/** Values stay strings (that's how they arrive); NULL becomes `null`. */
export function toJson(columns: string[], rows: GridCell[][]) {
  return JSON.stringify(
    rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i] ?? null]))),
    null,
    2,
  );
}

export function toInsertSql(schema: string, table: string, columns: string[], rows: GridCell[][]) {
  const target = qualified(schema, table);
  const names = columns.map(ident).join(", ");
  return rows
    .map((r) => `INSERT INTO ${target} (${names}) VALUES (${r.map((v) => (v == null ? "NULL" : literal(v))).join(", ")});`)
    .join("\n");
}

/** A Markdown table; pipes and line breaks in values are escaped so the table stays intact. */
export function toMarkdown(columns: string[], rows: GridCell[][]) {
  const cell = (v: GridCell) =>
    v === null || v === undefined
      ? "NULL"
      : v.replaceAll("|", "\\|").replace(/\r?\n/g, " ");
  return [
    `| ${columns.map(cell).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n");
}

export type ExportFormat = "csv" | "json" | "sql" | "markdown";

export function exportRows(format: ExportFormat, columns: string[], rows: GridCell[][], target?: { schema: string; table: string }) {
  if (format === "csv") return toCsv(columns, rows);
  if (format === "json") return toJson(columns, rows);
  if (format === "markdown") return toMarkdown(columns, rows);
  return toInsertSql(target?.schema ?? "public", target?.table ?? "my_table", columns, rows);
}
