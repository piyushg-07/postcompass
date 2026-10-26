//! Row Level Security: each table's RLS switches and policies, plus the roles a policy can target.

use std::collections::HashMap;

use pc_core::CoreResult;
use pc_core::driver::{PolicyInfo, PolicyTable, SchemaPolicies};
use tokio_postgres::Client;
use tokio_postgres::types::ToSql;

use crate::map_error;

pub async fn policies(client: &Client, schema: &str) -> CoreResult<SchemaPolicies> {
    let by_schema: &[&(dyn ToSql + Sync)] = &[&schema];
    let (table_rows, policy_rows, role_rows) = tokio::try_join!(
        client.query(
            "select c.relname::text, c.relrowsecurity, c.relforcerowsecurity
               from pg_class c
               join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = $1 and c.relkind in ('r', 'p')
              order by c.relname",
            by_schema,
        ),
        client.query(
            "select tablename::text, policyname::text, cmd::text, permissive = 'PERMISSIVE',
                    roles::text[], qual, with_check
               from pg_policies
              where schemaname = $1
              order by tablename, policyname",
            by_schema,
        ),
        client.query(
            "select rolname::text from pg_roles where rolname !~ '^pg_' order by rolname",
            &[]
        ),
    )
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
