//! `CREATE` statements for views, functions and sequences, from the server's own deparsers.

use pc_core::{CoreError, CoreResult};
use tokio_postgres::Client;

use super::relation;
use crate::map_error;
use crate::sql::qualified;

pub async fn view_definition(
    client: &Client,
    schema: &str,
    name: &str,
    materialized: bool,
) -> CoreResult<String> {
    let rel = relation(client, schema, name).await?;
    let row = client
        .query_one("select pg_get_viewdef($1::oid, true)", &[&rel.oid])
        .await
        .map_err(map_error)?;
    // NULL when the view is dropped in the meantime
    let body: String = row
        .get::<_, Option<String>>(0)
        .ok_or_else(|| CoreError::NotFound(format!("view {schema}.{name} does not exist")))?;
    let keyword = if materialized {
        "MATERIALIZED VIEW"
    } else {
        "VIEW"
    };
    Ok(format!(
        "CREATE {keyword} {} AS\n{}",
        qualified(schema, name),
        body.trim_end()
    ))
}

/// `id` is the function's oid, as `FunctionInfo::id` reports it.
pub async fn function_definition(client: &Client, id: &str) -> CoreResult<String> {
    let oid: u32 = id
        .trim()
        .parse()
        .map_err(|_| CoreError::InvalidInput(format!("{id} is not a function id")))?;
    let row = client
        .query_one("select pg_get_functiondef($1::oid)", &[&oid])
        .await
        .map_err(map_error)?;
    // NULL when no function has this oid (dropped since the list was loaded)
    let definition: String = row
        .get::<_, Option<String>>(0)
        .ok_or_else(|| CoreError::NotFound("this function no longer exists".into()))?;
    Ok(definition.trim_end().to_owned())
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
        qualified(schema, name),
        row.get::<_, String>(0),
        row.get::<_, String>(4),
        row.get::<_, String>(2),
        row.get::<_, String>(3),
        row.get::<_, String>(1),
        row.get::<_, String>(6),
        if cycle { "CYCLE" } else { "NO CYCLE" },
    ))
}
