//! Tables, columns and foreign keys of a schema, for the ER diagram.

use std::collections::HashMap;

use pc_core::CoreResult;
use pc_core::driver::{GraphColumn, GraphRelation, GraphTable, SchemaGraph};
use tokio_postgres::Client;

use super::table_kind;
use crate::map_error;

pub async fn schema_graph(client: &Client, schema: &str) -> CoreResult<SchemaGraph> {
    let (column_rows, relation_rows) = tokio::try_join!(
        async {
            client
                .query(
                    "select c.relname::text,
                            c.relkind::text,
                            a.attname::text,
                            format_type(a.atttypid, a.atttypmod),
                            not a.attnotnull,
                            coalesce(a.attnum = any(pk.indkey::int2[]), false),
                            exists (select 1 from pg_constraint f
                                     where f.conrelid = c.oid and f.contype = 'f' and a.attnum = any(f.conkey))
                       from pg_class c
                       join pg_namespace n on n.oid = c.relnamespace
                       join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
                       left join pg_index pk on pk.indrelid = c.oid and pk.indisprimary
                      where n.nspname = $1 and c.relkind in ('r', 'p', 'v', 'm', 'f') and not c.relispartition
                      order by c.relname, a.attnum",
                    &[&schema],
                )
                .await
                .map_err(map_error)
        },
        async {
            client
                .query(
                    "select c.conname::text,
                            src.relname::text,
                            array(select a.attname::text from unnest(c.conkey) with ordinality k(n, ord)
                                    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n order by k.ord),
                            nf.nspname::text,
                            cf.relname::text,
                            array(select a.attname::text from unnest(c.confkey) with ordinality k(n, ord)
                                    join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.n order by k.ord)
                       from pg_constraint c
                       join pg_class src on src.oid = c.conrelid
                       join pg_namespace ns on ns.oid = src.relnamespace
                       join pg_class cf on cf.oid = c.confrelid
                       join pg_namespace nf on nf.oid = cf.relnamespace
                      where c.contype = 'f' and ns.nspname = $1
                      order by src.relname, c.conname",
                    &[&schema],
                )
                .await
                .map_err(map_error)
        },
    )?;

    let mut tables: Vec<GraphTable> = Vec::new();
    let mut index: HashMap<String, usize> = HashMap::new();
    for row in &column_rows {
        let table: String = row.get(0);
        let position = *index.entry(table.clone()).or_insert_with(|| {
            tables.push(GraphTable {
                name: table.clone(),
                kind: table_kind(row.get(1)),
                columns: Vec::new(),
            });
            tables.len() - 1
        });
        tables[position].columns.push(GraphColumn {
            name: row.get(2),
            data_type: row.get(3),
            nullable: row.get(4),
            is_primary_key: row.get(5),
            is_foreign_key: row.get(6),
        });
    }

    Ok(SchemaGraph {
        tables,
        relations: relation_rows
            .iter()
            .map(|row| GraphRelation {
                name: row.get(0),
                from_table: row.get(1),
                from_columns: row.get(2),
                to_schema: row.get(3),
                to_table: row.get(4),
                to_columns: row.get(5),
            })
            .collect(),
    })
}
