//! Catalog queries: databases, schemas, tables, structure, other objects, definitions, ER graph.

use std::collections::HashMap;

use pc_core::driver::{
    ColumnInfo, ConstraintInfo, ConstraintKind, DatabaseInfo, EnumInfo, ExtensionInfo, ForeignKeyInfo, FunctionArg, FunctionInfo,
    GraphColumn, GraphRelation, GraphTable, IndexInfo, PolicyInfo, PolicyTable, SchemaGraph, SchemaInfo, SchemaObjects,
    SchemaPolicies, SchemaTriggerInfo,
    SequenceInfo,
    TableInfo, TableKind, TableStructure, TriggerInfo,
};
use pc_core::{CoreError, CoreResult};
use tokio_postgres::Client;

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
                    pg_total_relation_size(c.oid)::float8,
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

pub async fn structure(client: &Client, schema: &str, name: &str) -> CoreResult<TableStructure> {
    let rel = relation(client, schema, name).await?;
    let oid = rel.oid;

    let query = |sql: &'static str| async move { client.query(sql, &[&oid]).await.map_err(map_error) };
    let (columns, primary_key, fks, indexes, constraints, triggers) = tokio::try_join!(
        columns(client, oid),
        primary_key(client, oid),
        query(
            "select c.conname::text,
                    pg_get_constraintdef(c.oid),
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
                    pg_get_indexdef(i.indexrelid),
                    i.indisunique,
                    i.indisprimary,
                    am.amname::text,
                    pg_relation_size(i.indexrelid)::float8,
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
            "select conname::text, contype::text, pg_get_constraintdef(oid)
               from pg_constraint
              where conrelid = $1 and contype in ('c', 'u', 'x')
              order by conname",
        ),
        query(
            "select tgname::text, tgenabled::text <> 'D', pg_get_triggerdef(oid, true)
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

pub async fn schema_objects(client: &Client, schema: &str) -> CoreResult<SchemaObjects> {
    let (functions, sequences, enums, triggers) = tokio::try_join!(
        async {
            client
                .query(
                    "select p.oid::text,
                            p.proname::text,
                            pg_get_function_identity_arguments(p.oid),
                            coalesce(pg_get_function_result(p.oid), ''),
                            l.lanname::text,
                            p.prokind::text,
                            p.prosrc,
                            case p.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end,
                            p.prosecdef,
                            -- plain input arguments only; OUT, VARIADIC or defaults leave these null
                            case when p.proallargtypes is null and p.pronargdefaults = 0 and p.provariadic = 0
                                 then array(select coalesce(p.proargnames[u.i::int], '')
                                              from unnest(p.proargtypes::oid[]) with ordinality u(t, i) order by u.i) end,
                            case when p.proallargtypes is null and p.pronargdefaults = 0 and p.provariadic = 0
                                 then array(select format_type(u.t, null)
                                              from unnest(p.proargtypes::oid[]) with ordinality u(t, i) order by u.i) end
                       from pg_proc p
                       join pg_language l on l.oid = p.prolang
                       join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = $1
                        -- hide functions that belong to extensions (pgcrypto, postgis, …)
                        and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
                      order by p.proname, 3",
                    &[&schema],
                )
                .await
                .map_err(map_error)
        },
        async {
            client
                .query(
                    "select sequencename::text, data_type::text, last_value::text, increment_by::text
                       from pg_sequences
                      where schemaname = $1
                      order by 1",
                    &[&schema],
                )
                .await
                .map_err(map_error)
        },
        async {
            client
                .query(
                    "select t.typname::text, array_agg(e.enumlabel::text order by e.enumsortorder)
                       from pg_type t
                       join pg_enum e on e.enumtypid = t.oid
                       join pg_namespace n on n.oid = t.typnamespace
                      where n.nspname = $1
                      group by t.typname
                      order by 1",
                    &[&schema],
                )
                .await
                .map_err(map_error)
        },
        async {
            client
                .query(
                    "select t.tgname::text, c.relname::text, t.tgenabled::text <> 'D',
                            t.tgfoid::regproc::text, pg_get_triggerdef(t.oid, true)
                       from pg_trigger t
                       join pg_class c on c.oid = t.tgrelid
                       join pg_namespace n on n.oid = c.relnamespace
                      where n.nspname = $1 and not t.tgisinternal
                      order by 1, 2",
                    &[&schema],
                )
                .await
                .map_err(map_error)
        },
    )?;

    Ok(SchemaObjects {
        functions: functions
            .iter()
            .map(|row| FunctionInfo {
                id: row.get(0),
                name: row.get(1),
                arguments: row.get(2),
                returns: row.get(3),
                language: row.get(4),
                kind: match row.get::<_, &str>(5) {
                    "p" => "procedure",
                    "a" => "aggregate",
                    "w" => "window",
                    _ => "function",
                }
                .into(),
                body: row.get(6),
                volatility: row.get(7),
                security_definer: row.get(8),
                args: match (row.get::<_, Option<Vec<String>>>(9), row.get::<_, Option<Vec<String>>>(10)) {
                    (Some(names), Some(types)) => Some(
                        names
                            .into_iter()
                            .zip(types)
                            .map(|(name, data_type)| FunctionArg { name, data_type })
                            .collect(),
                    ),
                    _ => None,
                },
            })
            .collect(),
        sequences: sequences
            .iter()
            .map(|row| SequenceInfo {
                name: row.get(0),
                data_type: row.get(1),
                last_value: row.get(2),
                increment: row.get(3),
            })
            .collect(),
        enums: enums
            .iter()
            .map(|row| EnumInfo {
                name: row.get(0),
                values: row.get(1),
            })
            .collect(),
        triggers: triggers
            .iter()
            .map(|row| SchemaTriggerInfo {
                name: row.get(0),
                table: row.get(1),
                enabled: row.get(2),
                function: row.get(3),
                definition: row.get(4),
            })
            .collect(),
    })
}

pub async fn view_definition(client: &Client, schema: &str, name: &str, materialized: bool) -> CoreResult<String> {
    let rel = relation(client, schema, name).await?;
    let row = client
        .query_one("select pg_get_viewdef($1::oid, true)", &[&rel.oid])
        .await
        .map_err(map_error)?;
    let body: String = row.get(0);
    let keyword = if materialized { "MATERIALIZED VIEW" } else { "VIEW" };
    Ok(format!(
        "CREATE {keyword} {} AS\n{}",
        crate::sql::qualified(schema, name),
        body.trim_end()
    ))
}

pub async fn function_definition(client: &Client, id: &str) -> CoreResult<String> {
    let row = client
        .query_one("select pg_get_functiondef($1::text::oid)", &[&id])
        .await
        .map_err(map_error)?;
    Ok(row.get::<_, String>(0).trim_end().to_owned())
}

pub async fn sequence_definition(client: &Client, schema: &str, name: &str) -> CoreResult<String> {
    let row = client
        .query_opt(
            "select data_type::text, start_value::text, min_value::text, max_value::text,
                    increment_by::text, cycle, cache_size::text
               from pg_sequences
              where schemaname = $1 and sequencename = $2",
            &[&schema, &name],
        )
        .await
        .map_err(map_error)?
        .ok_or_else(|| CoreError::NotFound(format!("sequence {schema}.{name} does not exist")))?;
    let cycle: bool = row.get(5);
    Ok(format!(
        "CREATE SEQUENCE {}\n  AS {}\n  INCREMENT BY {}\n  MINVALUE {}\n  MAXVALUE {}\n  START WITH {}\n  CACHE {}\n  {};",
        crate::sql::qualified(schema, name),
        row.get::<_, String>(0),
        row.get::<_, String>(4),
        row.get::<_, String>(2),
        row.get::<_, String>(3),
        row.get::<_, String>(1),
        row.get::<_, String>(6),
        if cycle { "CYCLE" } else { "NO CYCLE" },
    ))
}

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

pub async fn policies(client: &Client, schema: &str) -> CoreResult<SchemaPolicies> {
    let table_rows = client
        .query(
            "select c.relname::text, c.relrowsecurity, c.relforcerowsecurity
               from pg_class c
               join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = $1 and c.relkind in ('r', 'p')
              order by c.relname",
            &[&schema],
        )
        .await
        .map_err(map_error)?;
    let policy_rows = client
        .query(
            "select tablename::text, policyname::text, cmd::text, permissive = 'PERMISSIVE',
                    roles::text[], qual, with_check
               from pg_policies
              where schemaname = $1
              order by tablename, policyname",
            &[&schema],
        )
        .await
        .map_err(map_error)?;
    let role_rows = client
        .query(
            "select rolname::text from pg_roles where rolname !~ '^pg_' order by rolname",
            &[],
        )
        .await
        .map_err(map_error)?;

    let mut by_table: HashMap<String, Vec<PolicyInfo>> = HashMap::new();
    for row in &policy_rows {
        by_table.entry(row.get(0)).or_default().push(PolicyInfo {
            name: row.get(1),
            command: row.get(2),
            permissive: row.get(3),
            roles: row.get(4),
            using: row.get(5),
            with_check: row.get(6),
        });
    }
    Ok(SchemaPolicies {
        tables: table_rows
            .iter()
            .map(|row| {
                let name: String = row.get(0);
                PolicyTable {
                    policies: by_table.remove(&name).unwrap_or_default(),
                    name,
                    rls_enabled: row.get(1),
                    rls_forced: row.get(2),
                }
            })
            .collect(),
        roles: std::iter::once("public".to_owned())
            .chain(role_rows.iter().map(|row| row.get(0)))
            .collect(),
    })
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
    fn maps_relkinds() {
        assert_eq!(table_kind("r"), TableKind::Table);
        assert_eq!(table_kind("p"), TableKind::PartitionedTable);
        assert_eq!(table_kind("v"), TableKind::View);
        assert_eq!(table_kind("m"), TableKind::MaterializedView);
        assert_eq!(table_kind("f"), TableKind::ForeignTable);
    }

    #[test]
    fn maps_fk_actions() {
        assert_eq!(fk_action("c"), "CASCADE");
        assert_eq!(fk_action("a"), "NO ACTION");
    }
}
