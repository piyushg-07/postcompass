//! `CREATE TABLE` text for a table, built from its catalog structure (PostgreSQL has no built-in for this).

use pc_core::driver::TableStructure;

use crate::sql::{ident, literal, qualified};

pub fn create_table(t: &TableStructure) -> String {
    let mut lines: Vec<String> = t
        .columns
        .iter()
        .map(|c| {
            let mut line = format!("  {} {}", ident(&c.name), c.data_type);
            if let Some(identity) = &c.identity {
                let kind = if identity == "always" { "ALWAYS" } else { "BY DEFAULT" };
                line.push_str(&format!(" GENERATED {kind} AS IDENTITY"));
            }
            if let Some(expr) = &c.generated {
                line.push_str(&format!(" GENERATED ALWAYS AS ({expr}) STORED"));
            }
            if !c.nullable {
                line.push_str(" NOT NULL");
            }
            if let Some(default) = &c.default {
                line.push_str(&format!(" DEFAULT {default}"));
            }
            line
        })
        .collect();

    if let Some(pk) = t.indexes.iter().find(|i| i.is_primary) {
        let columns: Vec<String> = t.primary_key.iter().map(|c| ident(c)).collect();
        lines.push(format!("  CONSTRAINT {} PRIMARY KEY ({})", ident(&pk.name), columns.join(", ")));
    }
    for c in &t.constraints {
        lines.push(format!("  CONSTRAINT {} {}", ident(&c.name), c.definition));
    }
    for fk in &t.foreign_keys {
        lines.push(format!("  CONSTRAINT {} {}", ident(&fk.name), fk.definition));
    }

    let mut out = format!("CREATE TABLE {} (\n{}\n);", qualified(&t.schema, &t.name), lines.join(",\n"));

    // Indexes not already created by a primary key or constraint
    for index in &t.indexes {
        if index.is_primary || t.constraints.iter().any(|c| c.name == index.name) {
            continue;
        }
        out.push_str(&format!("\n\n{};", index.definition));
    }
    for trigger in &t.triggers {
        out.push_str(&format!("\n\n{};", trigger.definition));
    }
    if let Some(comment) = &t.comment {
        out.push_str(&format!(
            "\n\nCOMMENT ON TABLE {} IS {};",
            qualified(&t.schema, &t.name),
            literal(comment)
        ));
    }
    for c in &t.columns {
        if let Some(comment) = &c.comment {
            out.push_str(&format!(
                "\nCOMMENT ON COLUMN {}.{} IS {};",
                qualified(&t.schema, &t.name),
                ident(&c.name),
                literal(comment)
            ));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use pc_core::driver::{ColumnInfo, IndexInfo, TableKind};

    fn column(name: &str, data_type: &str, nullable: bool) -> ColumnInfo {
        ColumnInfo {
            name: name.into(),
            data_type: data_type.into(),
            nullable,
            default: None,
            is_primary_key: false,
            identity: None,
            generated: None,
            comment: None,
        }
    }

    #[test]
    fn builds_create_table() {
        let mut id = column("id", "bigint", false);
        id.identity = Some("always".into());
        let mut email = column("email", "text", false);
        email.comment = Some("login".into());
        let table = TableStructure {
            schema: "public".into(),
            name: "user".into(),
            kind: TableKind::Table,
            comment: None,
            rls_enabled: false,
            security_invoker: false,
            columns: vec![id, email, column("bio", "text", true)],
            primary_key: vec!["id".into()],
            foreign_keys: vec![],
            indexes: vec![IndexInfo {
                name: "user_pkey".into(),
                columns: vec!["id".into()],
                is_unique: true,
                is_primary: true,
                method: "btree".into(),
                size_bytes: 0.0,
                definition: String::new(),
            }],
            constraints: vec![],
            triggers: vec![],
        };
        let ddl = create_table(&table);
        assert!(ddl.starts_with("CREATE TABLE public.\"user\" (\n"));
        assert!(ddl.contains("  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,"));
        assert!(ddl.contains("  bio text,"));
        assert!(ddl.contains("CONSTRAINT user_pkey PRIMARY KEY (id)"));
        assert!(ddl.contains("COMMENT ON COLUMN public.\"user\".email IS 'login';"));
    }
}
