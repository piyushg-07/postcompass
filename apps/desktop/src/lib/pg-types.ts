/**
 * Postgres type helpers shared by the grid and the table/column forms. Types are shown the way
 * Supabase shows them: short internal names like `int8`, `timestamptz`, `varchar`.
 */

/** How Postgres prints a type → the short name. */
const SHORT_NAMES: Record<string, string> = {
  smallint: "int2",
  integer: "int4",
  bigint: "int8",
  real: "float4",
  "double precision": "float8",
  boolean: "bool",
  "timestamp with time zone": "timestamptz",
  "timestamp without time zone": "timestamp",
  "time with time zone": "timetz",
  "time without time zone": "time",
  "character varying": "varchar",
  character: "bpchar",
  "bit varying": "varbit",
};

/** `character varying(255)` → `varchar(255)`, `integer[]` → `int4[]`. */
export function shortType(dataType: string) {
  let base = dataType.trim();
  let suffix = "";
  while (base.endsWith("[]")) {
    base = base.slice(0, -2);
    suffix += "[]";
  }
  const m = /^(.*?)(\(.*\))?$/.exec(base);
  const name = m?.[1] ?? base;
  const args = m?.[2] ?? "";
  return `${SHORT_NAMES[name] ?? name}${args}${suffix}`;
}

/** The type's name without length/precision or schema, lowercased: `public.mood` → `mood`. */
export function baseTypeName(dataType: string) {
  const short = shortType(dataType).replace(/(\[\])+$/, "");
  return short
    .replace(/\(.*\)$/, "")
    .split(".")
    .pop()!
    .replaceAll('"', "")
    .toLowerCase();
}

export type TypeKind =
  | "number"
  | "text"
  | "json"
  | "array"
  | "bool"
  | "enum"
  | "date"
  | "timestamp"
  | "timestamptz"
  | "time"
  | "binary"
  | "other";

const NUMBER = new Set([
  "int2",
  "int4",
  "int8",
  "float4",
  "float8",
  "numeric",
  "decimal",
  "money",
  "oid",
]);
const TEXT = new Set([
  "text",
  "varchar",
  "bpchar",
  "char",
  "citext",
  "uuid",
  "name",
  "inet",
  "cidr",
  "macaddr",
  "interval",
  "xml",
  "tsvector",
]);

/** Which editor a column gets, in Supabase's order of precedence. */
export function typeKind(
  dataType: string,
  enums: ReadonlySet<string>,
): TypeKind {
  if (dataType.trim().endsWith("[]")) return "array";
  const base = baseTypeName(dataType);
  if (NUMBER.has(base)) return "number";
  if (base === "json" || base === "jsonb") return "json";
  if (TEXT.has(base)) return "text";
  if (base === "date") return "date";
  if (base === "time" || base === "timetz") return "time";
  if (base === "timestamp") return "timestamp";
  if (base === "timestamptz") return "timestamptz";
  if (base === "bool") return "bool";
  if (enums.has(base)) return "enum";
  if (base === "bytea") return "binary";
  return "other";
}

export const INTEGER_TYPES = new Set(["int2", "int4", "int8"]);

/** The type picker's list, as in Supabase: name and what it holds. */
export const PG_TYPES: { name: string; description: string }[] = [
  { name: "int2", description: "Signed two-byte integer" },
  { name: "int4", description: "Signed four-byte integer" },
  { name: "int8", description: "Signed eight-byte integer" },
  {
    name: "float4",
    description: "Single precision floating-point number (4 bytes)",
  },
  {
    name: "float8",
    description: "Double precision floating-point number (8 bytes)",
  },
  { name: "numeric", description: "Exact numeric of selectable precision" },
  { name: "json", description: "Textual JSON data" },
  { name: "jsonb", description: "Binary JSON data, decomposed" },
  { name: "text", description: "Variable-length character string" },
  { name: "varchar", description: "Variable-length character string" },
  { name: "uuid", description: "Universally unique identifier" },
  { name: "date", description: "Calendar date (year, month, day)" },
  { name: "time", description: "Time of day (no time zone)" },
  { name: "timetz", description: "Time of day, including time zone" },
  { name: "timestamp", description: "Date and time (no time zone)" },
  { name: "timestamptz", description: "Date and time, including time zone" },
  { name: "bool", description: "Logical boolean (true/false)" },
  { name: "bytea", description: "Variable-length binary string" },
];

/** Better choices Supabase nudges you towards. */
export const RECOMMENDED_TYPE: Record<string, string> = {
  varchar: "text",
  json: "jsonb",
  timetz: "timestamptz",
  timestamp: "timestamptz",
};

/** "Suggested expressions" for a column's default value. */
export function defaultSuggestions(
  type: string,
): { label: string; value: string }[] {
  const base = baseTypeName(type);
  if (type.endsWith("[]")) return [];
  if (base === "uuid")
    return [{ label: "gen_random_uuid()", value: "gen_random_uuid()" }];
  if (["timestamptz", "timestamp", "date", "time", "timetz"].includes(base))
    return [
      { label: "now()", value: "now()" },
      {
        label: "(now() at time zone 'utc')",
        value: "(now() at time zone 'utc')",
      },
    ];
  if (base === "text" || base === "varchar")
    return [{ label: "Set as empty string", value: "''" }];
  if (base === "bool")
    return [
      { label: "true", value: "true" },
      { label: "false", value: "false" },
    ];
  if (base === "jsonb" || base === "json")
    return [
      { label: "Empty object", value: `'{}'::${base}` },
      { label: "Empty array", value: `'[]'::${base}` },
    ];
  return [];
}

/** Placeholder for date/time editors, like Supabase's. */
export function dateFormat(kind: TypeKind) {
  if (kind === "date") return "YYYY-MM-DD";
  if (kind === "timestamp") return "YYYY-MM-DD HH:mm:ss";
  if (kind === "timestamptz") return "YYYY-MM-DD HH:mm:ss+ZZ";
  return "HH:mm:ss";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The current moment in the format Postgres prints for `kind`. */
export function nowFor(kind: TypeKind) {
  const d = new Date();
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  if (kind === "date") return date;
  if (kind === "time") return time;
  if (kind === "timestamp") return `${date} ${time}`;
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return `${date} ${time}${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

/** Parses a date/time the way it's typed in the editor; `null` when it isn't valid. */
export function parseDate(text: string, kind: TypeKind) {
  const t = text.trim();
  if (!t) return null;
  const iso =
    kind === "date"
      ? `${t}T00:00:00`
      : t.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
