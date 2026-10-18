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

export type ExportFormat = "csv" | "json" | "sql";

export function exportRows(format: ExportFormat, columns: string[], rows: GridCell[][], target?: { schema: string; table: string }) {
  if (format === "csv") return toCsv(columns, rows);
  if (format === "json") return toJson(columns, rows);
  return toInsertSql(target?.schema ?? "public", target?.table ?? "my_table", columns, rows);
}
