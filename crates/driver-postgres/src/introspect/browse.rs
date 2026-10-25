//! The sidebar tree: databases, schemas, tables, extensions.

use pc_core::CoreResult;
use pc_core::driver::{DatabaseInfo, ExtensionInfo, SchemaInfo, TableInfo};
use tokio_postgres::Client;

use super::table_kind;
use crate::map_error;

pub async fn databases(client: &Client) -> CoreResult<Vec<DatabaseInfo>> {
    let rows = client
        .query(
            "select datname::text,
                    case when has_database_privilege(datname, 'CONNECT')
                         then pg_database_size(datname)::float8 end,
                    datallowconn
               from pg_database
              where not datistemplate
              order by datname",
            &[],
        )
        .await
        .map_err(map_error)?;
    Ok(rows
        .iter()
        .map(|row| DatabaseInfo {
            name: row.get(0),
            size_bytes: row.get(1),
            allow_connections: row.get(2),
        })
        .collect())
}

pub async fn schemas(client: &Client) -> CoreResult<Vec<SchemaInfo>> {
    let rows = client
        .query(
            "select n.nspname::text,
                    pg_get_userbyid(n.nspowner)::text,
                    (select count(*) from pg_class c
                      where c.relnamespace = n.oid and c.relkind in ('r', 'p', 'v', 'm', 'f')
                        and not c.relispartition)::int4,
                    n.nspname in ('pg_catalog', 'information_schema') as is_system
               from pg_namespace n
              where n.nspname not like 'pg\\_toast%' and n.nspname not like 'pg\\_temp\\_%'
              order by is_system, n.nspname",
            &[],
        )
        .await
        .map_err(map_error)?;
    Ok(rows
        .iter()
        .map(|row| SchemaInfo {
            name: row.get(0),
            owner: row.get(1),
            table_count: row.get::<_, i32>(2).max(0) as u32,
            is_system: row.get(3),
        })
        .collect())
}

pub async fn tables(client: &Client, schema: &str) -> CoreResult<Vec<TableInfo>> {
    let rows = client
        .query(
            "select c.relname::text,
                    c.relkind::text,
                    greatest(c.reltuples, 0)::float8,
                    -- NULL when the table is dropped while this runs
                    coalesce(pg_total_relation_size(c.oid), 0)::float8,
                    obj_description(c.oid, 'pg_class')
               from pg_class c
               join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = $1 and c.relkind in ('r', 'p', 'v', 'm', 'f') and not c.relispartition
              order by c.relname",
            &[&schema],
        )
        .await
        .map_err(map_error)?;
    Ok(rows
        .iter()
        .map(|row| TableInfo {
            schema: schema.to_owned(),
            name: row.get(0),
            kind: table_kind(row.get(1)),
            row_estimate: row.get(2),
            size_bytes: row.get(3),
            comment: row.get(4),
        })
        .collect())
}

pub async fn extensions(client: &Client) -> CoreResult<Vec<ExtensionInfo>> {
    let rows = client
        .query(
            "select name::text, default_version::text, installed_version::text, comment
               from pg_available_extensions
              order by installed_version is null, name",
            &[],
        )
        .await
        .map_err(map_error)?;
    Ok(rows
        .iter()
        .map(|row| ExtensionInfo {
            name: row.get(0),
            default_version: row.get(1),
            installed_version: row.get(2),
            comment: row.get(3),
        })
        .collect())
}
