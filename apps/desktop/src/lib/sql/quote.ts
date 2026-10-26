/** Quoting and naming helpers every SQL builder goes through. */

const RESERVED = new Set(
  (
    "all analyse analyze and any array as asc asymmetric authorization binary both case cast check collate collation " +
    "column concurrently constraint create cross current_catalog current_date current_role current_schema current_time " +
    "current_timestamp current_user default deferrable desc distinct do else end except false fetch for foreign freeze " +
    "from full grant group having ilike in initially inner intersect into is isnull join lateral leading left like limit " +
    "localtime localtimestamp natural not notnull null offset on only or order outer overlaps placing primary references " +
    "returning right select session_user similar some symmetric system_user table tablesample then to trailing true union " +
    "unique user using variadic verbose when where window with " +
    // Can't be column names or types either, so quote_ident quotes them too
    "between bigint bit boolean char character coalesce dec decimal exists extract float greatest grouping inout int " +
    "integer interval json json_array json_arrayagg json_exists json_object json_objectagg json_query json_scalar " +
    "json_serialize json_table json_value least merge_action national nchar none normalize nullif numeric out overlay " +
    "position precision real row setof smallint substring time timestamp treat trim values varchar xmlattributes " +
    "xmlconcat xmlelement xmlexists xmlforest xmlnamespaces xmlparse xmlpi xmlroot xmlserialize xmltable"
  ).split(" "),
);

/**
 * Quotes an identifier only when needed, like PostgreSQL's `quote_ident`. `$` is quoted too (as
 * quote_ident does): unquoted, a name like `a$$b` would end a surrounding `$$` body.
 */
export function ident(name: string) {
  return /^[a-z_][a-z0-9_]*$/.test(name) && !RESERVED.has(name)
    ? name
    : `"${name.replaceAll('"', '""')}"`;
}

export function qualified(schema: string, name: string) {
  return `${ident(schema)}.${ident(name)}`;
}

/**
 * A string literal, like PostgreSQL's `quote_literal`: a value with backslashes becomes an `E'…'`
 * string, so it means the same whether or not `standard_conforming_strings` is on.
 */
export function literal(value: string) {
  const quoted = value.replaceAll("'", "''");
  return value.includes("\\")
    ? `E'${quoted.replaceAll("\\", "\\\\")}'`
    : `'${quoted}'`;
}

/** A dollar-quote tag (`$$`, `$fn1$`, …) that none of `bodies` contains. */
export function dollarTag(...bodies: string[]) {
  let tag = "$$";
  for (let i = 1; bodies.some((b) => b.includes(tag)); i++) tag = `$fn${i}$`;
  return tag;
}

/**
 * An integer typed into a form, for SQL. Kept as text when it is a plain integer, so bigint values
 * beyond 2^53 (which `Number` would round, e.g. 9223372036854775807) survive unchanged.
 */
export function integer(value: string) {
  const text = value.trim();
  return /^[+-]?\d+$/.test(text) ? text.replace(/^\+/, "") : String(Number(text));
}

/** Postgres folds unquoted names to lower case, so suggest names that never need quotes. */
export function suggestIdentifier(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
