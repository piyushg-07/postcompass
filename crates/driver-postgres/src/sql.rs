//! Quoting helpers. Every identifier or literal written into SQL text goes through here.

/// Words that must be quoted when used as identifiers: PostgreSQL's reserved keywords plus the ones
/// that can't be column names or types (`time`, `values`, `position` …), as `quote_ident` does.
const RESERVED: &[&str] = &[
    "all",
    "analyse",
    "analyze",
    "and",
    "any",
    "array",
    "as",
    "asc",
    "asymmetric",
    "authorization",
    "binary",
    "both",
    "case",
    "cast",
    "check",
    "collate",
    "collation",
    "column",
    "concurrently",
    "constraint",
    "create",
    "cross",
    "current_catalog",
    "current_date",
    "current_role",
    "current_schema",
    "current_time",
    "current_timestamp",
    "current_user",
    "default",
    "deferrable",
    "desc",
    "distinct",
    "do",
    "else",
    "end",
    "except",
    "false",
    "fetch",
    "for",
    "foreign",
    "freeze",
    "from",
    "full",
    "grant",
    "group",
    "having",
    "ilike",
    "in",
    "initially",
    "inner",
    "intersect",
    "into",
    "is",
    "isnull",
    "join",
    "lateral",
    "leading",
    "left",
    "like",
    "limit",
    "localtime",
    "localtimestamp",
    "natural",
    "not",
    "notnull",
    "null",
    "offset",
    "on",
    "only",
    "or",
    "order",
    "outer",
    "overlaps",
    "placing",
    "primary",
    "references",
    "returning",
    "right",
    "select",
    "session_user",
    "similar",
    "some",
    "symmetric",
    "system_user",
    "table",
    "tablesample",
    "then",
    "to",
    "trailing",
    "true",
    "union",
    "unique",
    "user",
    "using",
    "variadic",
    "verbose",
    "when",
    "where",
    "window",
    "with",
    "between",
    "bigint",
    "bit",
    "boolean",
    "char",
    "character",
    "coalesce",
    "dec",
    "decimal",
    "exists",
    "extract",
    "float",
    "greatest",
    "grouping",
    "inout",
    "int",
    "integer",
    "interval",
    "json",
    "json_array",
    "json_arrayagg",
    "json_exists",
    "json_object",
    "json_objectagg",
    "json_query",
    "json_scalar",
    "json_serialize",
    "json_table",
    "json_value",
    "least",
    "merge_action",
    "national",
    "nchar",
    "none",
    "normalize",
    "nullif",
    "numeric",
    "out",
    "overlay",
    "position",
    "precision",
    "real",
    "row",
    "setof",
    "smallint",
    "substring",
    "time",
    "timestamp",
    "treat",
    "trim",
    "values",
    "varchar",
    "xmlattributes",
    "xmlconcat",
    "xmlelement",
    "xmlexists",
    "xmlforest",
    "xmlnamespaces",
    "xmlparse",
    "xmlpi",
    "xmlroot",
    "xmlserialize",
    "xmltable",
];

/// Quotes an identifier only when needed, like PostgreSQL's `quote_ident`.
pub fn ident(name: &str) -> String {
    let simple = name
        .chars()
        .next()
        .is_some_and(|c| c.is_ascii_lowercase() || c == '_')
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '$')
        && !RESERVED.contains(&name);
    if simple {
        name.to_owned()
    } else {
        format!("\"{}\"", name.replace('"', "\"\""))
    }
}

/// `schema.table`, each part quoted as needed.
pub fn qualified(schema: &str, name: &str) -> String {
    format!("{}.{}", ident(schema), ident(name))
}

/// A string literal for display. Execution always uses bind parameters instead.
pub fn literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

/// Escapes `%`, `_` and `\` so user text is matched literally inside `LIKE`.
pub fn escape_like(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        if matches!(c, '%' | '_' | '\\') {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quotes_only_when_needed() {
        assert_eq!(ident("users"), "users");
        assert_eq!(ident("user_id2"), "user_id2");
        assert_eq!(ident("user"), "\"user\"");
        assert_eq!(ident("Users"), "\"Users\"");
        assert_eq!(ident("first name"), "\"first name\"");
        assert_eq!(ident("2fa"), "\"2fa\"");
        assert_eq!(ident("we\"ird"), "\"we\"\"ird\"");
        assert_eq!(ident(""), "\"\"");
    }

    #[test]
    fn qualifies_names() {
        assert_eq!(qualified("public", "Order"), "public.\"Order\"");
    }

    #[test]
    fn escapes_literals_and_like_patterns() {
        assert_eq!(literal("it's"), "'it''s'");
        assert_eq!(escape_like("50%_off\\"), "50\\%\\_off\\\\");
    }
}
