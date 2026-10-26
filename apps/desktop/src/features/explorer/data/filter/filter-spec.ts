/** Pure filter logic for the filter bar: operators, value suggestions, drafts ⇄ specs. */
import type { FilterSpec } from "../../../../lib/bindings";
import type { TypeKind } from "../../../../lib/pg-types";

/** A column as the filter bar needs it. */
export interface FilterColumn {
  name: string;
  /** Short type, shown next to the name in the list. */
  format?: string;
  kind?: TypeKind;
  enumValues?: string[];
}

export type Op =
  "=" | "<>" | ">" | "<" | ">=" | "<=" | "~~" | "~~*" | "in" | "is";
export type OpGroup = "comparison" | "pattern" | "setNull";

/** Supabase's operators, grouped as in its menu. */
export const OPERATORS: { value: Op; label: string; group: OpGroup }[] = [
  { value: "=", label: "Equals", group: "comparison" },
  { value: "<>", label: "Not equal", group: "comparison" },
  { value: ">", label: "Greater than", group: "comparison" },
  { value: "<", label: "Less than", group: "comparison" },
  { value: ">=", label: "Greater or equal", group: "comparison" },
  { value: "<=", label: "Less or equal", group: "comparison" },
  { value: "~~", label: "Like", group: "pattern" },
  { value: "~~*", label: "iLike", group: "pattern" },
  { value: "in", label: "In list", group: "setNull" },
  { value: "is", label: "Is", group: "setNull" },
];

const DATE_KINDS = new Set<TypeKind>([
  "date",
  "time",
  "timestamp",
  "timestamptz",
]);

export function operatorsFor(kind?: TypeKind) {
  if (kind === "bool")
    return OPERATORS.filter((o) => ["=", "<>", "is"].includes(o.value));
  if (kind && DATE_KINDS.has(kind))
    return OPERATORS.filter(
      (o) => o.group === "comparison" || o.value === "is",
    );
  return OPERATORS;
}

const pad = (n: number) => String(n).padStart(2, "0");
const day = (offset: number) => {
  const d = new Date(Date.now() - offset * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Ready-made values for a condition, like Supabase's value menu. */
export function valueOptions(column: FilterColumn | undefined, op: Op) {
  if (op === "is")
    return [
      { value: "null", label: "NULL" },
      { value: "not null", label: "NOT NULL" },
      ...(column?.kind === "bool"
        ? [
            { value: "true", label: "TRUE" },
            { value: "false", label: "FALSE" },
          ]
        : []),
    ];
  if (op === "~~" || op === "~~*" || op === "in") return [];
  if (column?.kind === "bool")
    return [
      { value: "true", label: "true" },
      { value: "false", label: "false" },
    ];
  if (column?.kind === "enum")
    return (column.enumValues ?? []).map((v) => ({ value: v, label: v }));
  if (column?.kind && DATE_KINDS.has(column.kind) && column.kind !== "time")
    return [
      { value: day(0), label: "Today" },
      { value: day(1), label: "Yesterday" },
      { value: day(7), label: "Last 7 days" },
      { value: day(30), label: "Last 30 days" },
    ];
  return [];
}

export interface Draft {
  column: string;
  op: Op;
  value: string;
}

const SIMPLE: Partial<Record<Op, FilterSpec["op"]>> = {
  "=": "equals",
  "<>": "not_equals",
  ">": "greater_than",
  "<": "less_than",
  ">=": "greater_or_equal",
  "<=": "less_or_equal",
  "~~": "like",
  "~~*": "i_like",
  in: "in_list",
};
const IS_VALUES: Record<string, FilterSpec["op"]> = {
  null: "is_null",
  "not null": "is_not_null",
  true: "is_true",
  false: "is_false",
};

/** A finished condition as the backend takes it; `null` while it's incomplete. */
export function toSpec(d: Draft, column?: FilterColumn): FilterSpec | null {
  if (d.op === "is") {
    const op = IS_VALUES[d.value.trim().toLowerCase()];
    return op ? { column: d.column, op, value: null } : null;
  }
  // Spaces only matter in text; uuids and numbers are often pasted with stray ones
  const text = column?.kind === "text" && column.format !== "uuid";
  const value = text ? d.value : d.value.trim();
  if (value === "") return null;
  return { column: d.column, op: SIMPLE[d.op]!, value };
}

export function fromSpec(f: FilterSpec): Draft {
  const is = Object.entries(IS_VALUES).find(([, op]) => op === f.op);
  if (is) return { column: f.column, op: "is", value: is[0] };
  if (f.op === "contains")
    return { column: f.column, op: "~~*", value: `%${f.value ?? ""}%` };
  if (f.op === "starts_with")
    return { column: f.column, op: "~~*", value: `${f.value ?? ""}%` };
  const op = (Object.entries(SIMPLE).find(([, o]) => o === f.op)?.[0] ??
    "=") as Op;
  return { column: f.column, op, value: f.value ?? "" };
}
