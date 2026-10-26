/** Pure checks for pasted / imported rows: column matching and per-cell type checks. */
import type { ColumnInfo } from "../../../../lib/bindings";
import {
  baseTypeName,
  INTEGER_TYPES,
  typeKind,
} from "../../../../lib/pg-types";

/** A pasted column that isn't inserted. */
export const SKIP = "__skip__";

const BOOLS = new Set([
  "true",
  "false",
  "t",
  "f",
  "yes",
  "no",
  "y",
  "n",
  "on",
  "off",
  "1",
  "0",
]);
const UUID =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const SPECIAL_NUMBER = /^[+-]?(nan|infinity)$/i;

/** Why a pasted value won't fit; `null` when it looks fine. */
export type CellCheck = (value: string) => string | null;

/**
 * The check for one column, built once per column (not per cell). Mirrors what PostgreSQL
 * accepts closely enough to catch typos like "abcd" in a number column.
 */
export function cellCheck(
  column: ColumnInfo,
  enums: ReadonlyMap<string, string[]>,
): CellCheck {
  const kind = typeKind(column.dataType, new Set(enums.keys()));
  const base = baseTypeName(column.dataType);
  switch (kind) {
    case "number":
      if (INTEGER_TYPES.has(base))
        return (v) =>
          /^[+-]?\d+$/.test(v.trim()) ? null : "isn't a whole number";
      // money takes currency symbols and grouping (`$1,234.50`); leave it to the database
      if (base === "money") return () => null;
      return (v) =>
        NUMBER.test(v.trim()) || SPECIAL_NUMBER.test(v.trim())
          ? null
          : "isn't a number";
    case "bool":
      return (v) =>
        BOOLS.has(v.trim().toLowerCase()) ? null : "isn't true or false";
    case "date":
    case "timestamp":
    case "timestamptz":
      return (value) => {
        const v = value.trim();
        return Number.isNaN(Date.parse(v.replace(" ", "T"))) &&
          Number.isNaN(Date.parse(v))
          ? "isn't a date"
          : null;
      };
    case "time":
      return (v) =>
        /^\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?/.test(v.trim())
          ? null
          : "isn't a time";
    case "json":
      return (v) => {
        try {
          JSON.parse(v);
          return null;
        } catch {
          return "isn't valid JSON";
        }
      };
    case "enum": {
      const allowed = enums.get(base);
      return (v) =>
        !allowed || allowed.includes(v.trim())
          ? null
          : `isn't one of ${allowed.join(", ")}`;
    }
    case "array":
      return (v) =>
        /^\{.*\}$/s.test(v.trim()) ? null : "isn't a list like {a,b}";
    default:
      return base === "uuid"
        ? (v) => (UUID.test(v.trim()) ? null : "isn't a uuid")
        : () => null;
  }
}

/** Columns a pasted value can go into: generated and always-identity ones fill themselves. */
export const writable = (c: ColumnInfo) =>
  !c.generated && c.identity !== "always";

/**
 * Generated ids (identity or a primary key with a default, like serial or uuid), which pasted
 * data without a header usually leaves out when matching by order.
 */
const automatic = (c: ColumnInfo) =>
  c.identity !== null || (c.isPrimaryKey && c.default !== null);

/**
 * Matches pasted columns to table columns: by header names when the first row is a header,
 * otherwise by order, skipping columns the database fills in when there are fewer values.
 */
export function guessMapping(rows: string[][], columns: ColumnInfo[]) {
  // A loop, not Math.max(...spread), which overflows the call stack on big files
  let width = 0;
  for (const r of rows) width = Math.max(width, r.length);
  const targets = columns.filter(writable);
  const byName = new Map(targets.map((c) => [c.name.toLowerCase(), c.name]));
  const header = rows[0] ?? [];
  const headerHits = header.filter((h) =>
    byName.has(h.trim().toLowerCase()),
  ).length;
  if (headerHits > 0 && headerHits >= Math.ceil(header.length / 2))
    return {
      hasHeader: true,
      mapping: Array.from(
        { length: width },
        (_, i) => byName.get((header[i] ?? "").trim().toLowerCase()) ?? SKIP,
      ),
    };
  const order =
    width >= targets.length ? targets : targets.filter((c) => !automatic(c));
  const list = order.length >= width ? order : targets;
  return {
    hasHeader: false,
    mapping: Array.from({ length: width }, (_, i) => list[i]?.name ?? SKIP),
  };
}

export interface CellProblem {
  row: number;
  col: number;
  column: string;
  value: string;
  reason: string;
}

/** Every mapped, non-empty cell checked against its column's type. */
export function findProblems(
  rows: string[][],
  mapping: string[],
  checks: ReadonlyMap<string, CellCheck>,
) {
  const problems: CellProblem[] = [];
  rows.forEach((r, ri) =>
    mapping.forEach((m, i) => {
      const value = r[i] ?? "";
      const check = checks.get(m);
      if (m === SKIP || value === "" || !check) return;
      const reason = check(value);
      if (reason) problems.push({ row: ri, col: i, column: m, value, reason });
    }),
  );
  return problems;
}

/** The values to insert for each row. Empty cells are left out, so the column default applies. */
export function rowValues(rows: string[][], mapping: string[]) {
  return rows.map((r) =>
    mapping.flatMap((column, i) =>
      column === SKIP || (r[i] ?? "") === "" ? [] : [{ column, value: r[i]! }],
    ),
  );
}
