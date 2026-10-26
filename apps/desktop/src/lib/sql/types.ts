/** Types offered in pickers. Any other type can still be typed in by hand. */
export const COMMON_TYPES = [
  "bigint",
  "integer",
  "smallint",
  "numeric",
  "real",
  "double precision",
  "text",
  "varchar(255)",
  "boolean",
  "uuid",
  "date",
  "timestamp",
  "timestamptz",
  "time",
  "interval",
  "jsonb",
  "json",
  "bytea",
  "inet",
  "text[]",
  "integer[]",
];

/** Loose check that a type name is plausible and cannot smuggle extra SQL. */
export function isSafeTypeName(type: string) {
  return /^[a-zA-Z_][\w ."]*(\(\s*\d+(\s*,\s*\d+)?\s*\))?(\[\])*$/.test(
    type.trim(),
  );
}
