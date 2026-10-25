//! Catalog queries: databases, schemas, tables, structure, other objects, definitions, ER graph,
//! RLS policies. This module holds the per-table lookups the others (and rows / edits) share.

mod browse;
mod definitions;
mod graph;
mod objects;
mod policies;
mod structure;

use pc_core::driver::{ColumnInfo, TableKind};
use pc_core::{CoreError, CoreResult};
use tokio_postgres::Client;

pub use browse::{databases, extensions, schemas, tables};
pub use definitions::{function_definition, sequence_definition, view_definition};
pub use graph::schema_graph;
pub use objects::schema_objects;
pub use policies::policies;
pub use structure::structure;

use crate::map_error;

/// A table's oid, kind, planner row estimate and comment.
pub struct Relation {
    pub oid: u32,
    pub kind: TableKind,
    pub row_estimate: f64,
    pub comment: Option<String>,
    pub rls_enabled: bool,
    pub security_invoker: bool,
}

pub async fn relation(client: &Client, schema: &str, name: &str) -> CoreResult<Relation> {
    let row = client
        .query_opt(
            "select c.oid, c.relkind::text, c.reltuples::float8, obj_description(c.oid, 'pg_class'), c.relrowsecurity,
                    exists (select 1 from unnest(c.reloptions) o where o ~* '^security_invoker=(true|on|yes|1)$')
               from pg_class c
               join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = $1 and c.relname = $2 and c.relkind in ('r', 'p', 'v', 'm', 'f')",
            &[&schema, &name],
        )
        .await
        .map_err(map_error)?
        .ok_or_else(|| CoreError::NotFound(format!("table {schema}.{name} does not exist")))?;
    Ok(Relation {
        oid: row.get(0),
        kind: table_kind(row.get(1)),
        row_estimate: row.get(2),
        comment: row.get(3),
        rls_enabled: row.get(4),
        security_invoker: row.get(5),
    })
}

pub async fn columns(client: &Client, oid: u32) -> CoreResult<Vec<ColumnInfo>> {
    let rows = client
        .query(
            "select a.attname::text,
                    format_type(a.atttypid, a.atttypmod),
                    not a.attnotnull,
                    case when a.attgenerated::text = '' then pg_get_expr(d.adbin, d.adrelid) end,
                    coalesce(a.attnum = any(pk.indkey::int2[]), false),
                    a.attidentity::text,
                    case when a.attgenerated::text <> '' then pg_get_expr(d.adbin, d.adrelid) end,
                    col_description(a.attrelid, a.attnum)
               from pg_attribute a
               left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
               left join pg_index pk on pk.indrelid = a.attrelid and pk.indisprimary
              where a.attrelid = $1 and a.attnum > 0 and not a.attisdropped
              order by a.attnum",
            &[&oid],
        )
        .await
        .map_err(map_error)?;
    Ok(rows
        .iter()
        .map(|row| ColumnInfo {
            name: row.get(0),
            data_type: row.get(1),
            nullable: row.get(2),
            default: row.get(3),
            is_primary_key: row.get(4),
            identity: match row.get::<_, &str>(5) {
                "a" => Some("always".into()),
                "d" => Some("by_default".into()),
                _ => None,
            },
            generated: row.get(6),
            comment: row.get(7),
        })
        .collect())
}

/// Primary key columns in key order.
pub async fn primary_key(client: &Client, oid: u32) -> CoreResult<Vec<String>> {
    let rows = client
        .query(
            "select a.attname::text
               from pg_index i
               cross join lateral unnest(i.indkey::int2[]) with ordinality k(attnum, ord)
               join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
              where i.indrelid = $1 and i.indisprimary
              order by k.ord",
            &[&oid],
        )
        .await
        .map_err(map_error)?;
    Ok(rows.iter().map(|row| row.get(0)).collect())
}

pub fn table_kind(relkind: &str) -> TableKind {
    match relkind {
        "p" => TableKind::PartitionedTable,
        "v" => TableKind::View,
        "m" => TableKind::MaterializedView,
        "f" => TableKind::ForeignTable,
        _ => TableKind::Table,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_relkinds() {
        assert_eq!(table_kind("r"), TableKind::Table);
        assert_eq!(table_kind("p"), TableKind::PartitionedTable);
        assert_eq!(table_kind("v"), TableKind::View);
        assert_eq!(table_kind("m"), TableKind::MaterializedView);
        assert_eq!(table_kind("f"), TableKind::ForeignTable);
    }
}
