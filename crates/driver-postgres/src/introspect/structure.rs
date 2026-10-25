//! The full structure of one table: columns, keys, indexes, constraints, triggers.

use pc_core::CoreResult;
use pc_core::driver::{
    ConstraintInfo, ConstraintKind, ForeignKeyInfo, IndexInfo, TableStructure, TriggerInfo,
};
use tokio_postgres::Client;

use super::{columns, primary_key, relation};
use crate::map_error;

/// Catalog functions such as `pg_get_indexdef` return NULL for an object dropped while this runs,
/// so their results are coalesced: a NULL read into a `String` would panic (and abort the app).
pub async fn structure(client: &Client, schema: &str, name: &str) -> CoreResult<TableStructure> {
    let rel = relation(client, schema, name).await?;
    let oid = rel.oid;

    let query =
        |sql: &'static str| async move { client.query(sql, &[&oid]).await.map_err(map_error) };
    let (columns, primary_key, fks, indexes, constraints, triggers) = tokio::try_join!(
        columns(client, oid),
        primary_key(client, oid),
        query(
            "select c.conname::text,
                    coalesce(pg_get_constraintdef(c.oid), ''),
                    array(select a.attname::text from unnest(c.conkey) with ordinality k(n, ord)
                            join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n order by k.ord),
                    nf.nspname::text,
                    cf.relname::text,
                    array(select a.attname::text from unnest(c.confkey) with ordinality k(n, ord)
                            join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.n order by k.ord),
                    c.confupdtype::text,
                    c.confdeltype::text
               from pg_constraint c
               join pg_class cf on cf.oid = c.confrelid
               join pg_namespace nf on nf.oid = cf.relnamespace
              where c.conrelid = $1 and c.contype = 'f'
              order by c.conname",
        ),
        query(
            "select ic.relname::text,
                    coalesce(pg_get_indexdef(i.indexrelid), ''),
                    i.indisunique,
                    i.indisprimary,
                    am.amname::text,
                    coalesce(pg_relation_size(i.indexrelid), 0)::float8,
                    array(select coalesce(a.attname::text, pg_get_indexdef(i.indexrelid, k.ord::int, true))
                            from unnest(i.indkey::int2[]) with ordinality k(n, ord)
                            left join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.n
                           order by k.ord)
               from pg_index i
               join pg_class ic on ic.oid = i.indexrelid
               join pg_am am on am.oid = ic.relam
              where i.indrelid = $1
              order by i.indisprimary desc, ic.relname",
        ),
        query(
            "select conname::text, contype::text, coalesce(pg_get_constraintdef(oid), '')
               from pg_constraint
              where conrelid = $1 and contype in ('c', 'u', 'x')
              order by conname",
        ),
        query(
            "select tgname::text, tgenabled::text <> 'D', coalesce(pg_get_triggerdef(oid, true), '')
               from pg_trigger
              where tgrelid = $1 and not tgisinternal
              order by tgname",
        ),
    )?;

    Ok(TableStructure {
        schema: schema.to_owned(),
        name: name.to_owned(),
        kind: rel.kind,
        comment: rel.comment,
        rls_enabled: rel.rls_enabled,
        security_invoker: rel.security_invoker,
        columns,
        primary_key,
        foreign_keys: fks
            .iter()
            .map(|row| ForeignKeyInfo {
                name: row.get(0),
                definition: row.get(1),
                columns: row.get(2),
                referenced_schema: row.get(3),
                referenced_table: row.get(4),
                referenced_columns: row.get(5),
                on_update: fk_action(row.get(6)).into(),
                on_delete: fk_action(row.get(7)).into(),
            })
            .collect(),
        indexes: indexes
            .iter()
            .map(|row| IndexInfo {
                name: row.get(0),
                definition: row.get(1),
                is_unique: row.get(2),
                is_primary: row.get(3),
                method: row.get(4),
                size_bytes: row.get(5),
                columns: row.get(6),
            })
            .collect(),
        constraints: constraints
            .iter()
            .map(|row| ConstraintInfo {
                name: row.get(0),
                kind: match row.get::<_, &str>(1) {
                    "u" => ConstraintKind::Unique,
                    "x" => ConstraintKind::Exclusion,
                    _ => ConstraintKind::Check,
                },
                definition: row.get(2),
            })
            .collect(),
        triggers: triggers
            .iter()
            .map(|row| TriggerInfo {
                name: row.get(0),
                enabled: row.get(1),
                definition: row.get(2),
            })
            .collect(),
    })
}

fn fk_action(code: &str) -> &'static str {
    match code {
        "r" => "RESTRICT",
        "c" => "CASCADE",
        "n" => "SET NULL",
        "d" => "SET DEFAULT",
        _ => "NO ACTION",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_fk_actions() {
        assert_eq!(fk_action("c"), "CASCADE");
        assert_eq!(fk_action("a"), "NO ACTION");
    }
}
