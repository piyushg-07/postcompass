//! Row edits: one statement per change, all in one transaction. Values are bind parameters cast
//! to each column's real type; a display version with inlined literals is used for previews.

use pc_core::driver::{ApplyResult, ColumnInfo, ColumnValue, RowChange};
use pc_core::{CoreError, CoreResult};
use tokio_postgres::Client;

use crate::introspect;
use crate::map_error;
use crate::rows::{Param, as_refs};
use crate::sql::{ident, literal, qualified};

pub struct Statement {
    pub sql: String,
    pub params: Vec<Param>,
    /// Same statement with values inlined, for previews only.
    pub display: String,
    /// Updates and deletes must touch exactly one row.
    pub expect_one: bool,
    pub kind: ChangeKind,
}

#[derive(Clone, Copy)]
pub enum ChangeKind {
    Insert,
    Update,
    Delete,
}

pub async fn build(client: &Client, schema: &str, table: &str, changes: &[RowChange]) -> CoreResult<Vec<Statement>> {
    let rel = introspect::relation(client, schema, table).await?;
    let (columns, primary_key) = tokio::try_join!(
        introspect::columns(client, rel.oid),
        introspect::primary_key(client, rel.oid)
    )?;
    let target = qualified(schema, table);
    changes
        .iter()
        .map(|change| statement(&target, &columns, &primary_key, change))
        .collect()
}

fn statement(target: &str, columns: &[ColumnInfo], primary_key: &[String], change: &RowChange) -> CoreResult<Statement> {
    let mut params = Vec::new();
    let mut bind = |col: &ColumnInfo, value: &Option<String>| -> CoreResult<(String, String)> {
        params.push(Param::Text(value.clone()));
        let sql = format!("cast(${}::text as {})", params.len(), col.data_type);
        let shown = match value {
            Some(v) => format!("{}::{}", literal(v), col.data_type),
            None => "NULL".to_owned(),
        };
        Ok((sql, shown))
    };

    match change {
        RowChange::Insert { values } => {
            if values.is_empty() {
                return Ok(Statement {
                    sql: format!("insert into {target} default values"),
                    params: Vec::new(),
                    display: format!("INSERT INTO {target} DEFAULT VALUES;"),
                    expect_one: false,
                    kind: ChangeKind::Insert,
                });
            }
            let mut names = Vec::new();
            let mut sql_values = Vec::new();
            let mut shown_values = Vec::new();
            for cv in values {
                let col = find(columns, &cv.column)?;
                let (sql, shown) = bind(col, &cv.value)?;
                names.push(ident(&col.name));
                sql_values.push(sql);
                shown_values.push(shown);
            }
            Ok(Statement {
                sql: format!("insert into {target} ({}) values ({})", names.join(", "), sql_values.join(", ")),
                display: format!(
                    "INSERT INTO {target} ({}) VALUES ({});",
                    names.join(", "),
                    shown_values.join(", ")
                ),
                params,
                expect_one: false,
                kind: ChangeKind::Insert,
            })
        }
        RowChange::Update { key, values } => {
            if values.is_empty() {
                return Err(CoreError::InvalidInput("an update needs at least one value".into()));
            }
            check_key(primary_key, key)?;
            let mut sets = Vec::new();
            let mut shown_sets = Vec::new();
            for cv in values {
                let col = find(columns, &cv.column)?;
                let (sql, shown) = bind(col, &cv.value)?;
                sets.push(format!("{} = {sql}", ident(&col.name)));
                shown_sets.push(format!("{} = {shown}", ident(&col.name)));
            }
            let (where_sql, where_shown) = key_clause(columns, key, &mut bind)?;
            Ok(Statement {
                sql: format!("update {target} set {} where {where_sql}", sets.join(", ")),
                display: format!("UPDATE {target} SET {} WHERE {where_shown};", shown_sets.join(", ")),
                params,
                expect_one: true,
                kind: ChangeKind::Update,
            })
        }
        RowChange::Delete { key } => {
            check_key(primary_key, key)?;
            let (where_sql, where_shown) = key_clause(columns, key, &mut bind)?;
            Ok(Statement {
                sql: format!("delete from {target} where {where_sql}"),
                display: format!("DELETE FROM {target} WHERE {where_shown};"),
                params,
                expect_one: true,
                kind: ChangeKind::Delete,
            })
        }
    }
}

fn key_clause(
    columns: &[ColumnInfo],
    key: &[ColumnValue],
    bind: &mut impl FnMut(&ColumnInfo, &Option<String>) -> CoreResult<(String, String)>,
) -> CoreResult<(String, String)> {
    let mut sql = Vec::new();
    let mut shown = Vec::new();
    for cv in key {
        let col = find(columns, &cv.column)?;
        let (value_sql, value_shown) = bind(col, &cv.value)?;
        sql.push(format!("{} = {value_sql}", ident(&col.name)));
        shown.push(format!("{} = {value_shown}", ident(&col.name)));
    }
    Ok((sql.join(" and "), shown.join(" AND ")))
}

/// Updates and deletes identify rows by the full primary key, so each touches exactly one row.
fn check_key(primary_key: &[String], key: &[ColumnValue]) -> CoreResult<()> {
    if primary_key.is_empty() {
        return Err(CoreError::InvalidInput(
            "this table has no primary key, so rows can't be edited safely".into(),
        ));
    }
    let mut given: Vec<&str> = key.iter().map(|k| k.column.as_str()).collect();
    let mut expected: Vec<&str> = primary_key.iter().map(String::as_str).collect();
    given.sort_unstable();
    expected.sort_unstable();
    if given != expected || key.iter().any(|k| k.value.is_none()) {
        return Err(CoreError::InvalidInput("rows must be identified by their full primary key".into()));
    }
    Ok(())
}

fn find<'a>(columns: &'a [ColumnInfo], name: &str) -> CoreResult<&'a ColumnInfo> {
    columns
        .iter()
        .find(|c| c.name == name)
        .ok_or_else(|| CoreError::InvalidInput(format!("unknown column {name}")))
}

/// Runs all statements in one transaction on a dedicated connection.
pub async fn apply(client: &mut Client, statements: &[Statement]) -> CoreResult<ApplyResult> {
    let tx = client.transaction().await.map_err(map_error)?;
    let mut result = ApplyResult {
        inserted: 0,
        updated: 0,
        deleted: 0,
    };
    for (index, statement) in statements.iter().enumerate() {
        let affected = tx
            .execute(statement.sql.as_str(), &as_refs(&statement.params))
            .await
            .map_err(|e| prefix(index, map_error(e)))?;
        if statement.expect_one && affected != 1 {
            return Err(CoreError::QueryFailed(format!(
                "change {} matched {affected} rows instead of 1 (the row may have been changed or deleted). Nothing was saved.",
                index + 1
            )));
        }
        let affected = affected as u32;
        match statement.kind {
            ChangeKind::Insert => result.inserted += affected,
            ChangeKind::Update => result.updated += affected,
            ChangeKind::Delete => result.deleted += affected,
        }
    }
    tx.commit().await.map_err(map_error)?;
    Ok(result)
}

fn prefix(index: usize, error: CoreError) -> CoreError {
    match error {
        CoreError::QueryFailed(msg) => {
            CoreError::QueryFailed(format!("change {} failed: {msg}. Nothing was saved.", index + 1))
        }
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn col(name: &str, data_type: &str) -> ColumnInfo {
        ColumnInfo {
            name: name.into(),
            data_type: data_type.into(),
            nullable: true,
            default: None,
            is_primary_key: name == "id",
            identity: None,
            generated: None,
            comment: None,
        }
    }

    fn cv(column: &str, value: Option<&str>) -> ColumnValue {
        ColumnValue {
            column: column.into(),
            value: value.map(Into::into),
        }
    }

    #[test]
    fn builds_update_with_typed_parameters() {
        let columns = vec![col("id", "integer"), col("name", "text")];
        let stmt = statement(
            "public.users",
            &columns,
            &["id".into()],
            &RowChange::Update {
                key: vec![cv("id", Some("7"))],
                values: vec![cv("name", Some("O'Brien"))],
            },
        )
        .unwrap();
        assert_eq!(
            stmt.sql,
            "update public.users set name = cast($1::text as text) where id = cast($2::text as integer)"
        );
        assert_eq!(
            stmt.display,
            "UPDATE public.users SET name = 'O''Brien'::text WHERE id = '7'::integer;"
        );
        assert!(stmt.expect_one);
    }

    #[test]
    fn builds_insert_and_default_insert() {
        let columns = vec![col("id", "integer"), col("name", "text")];
        let stmt = statement(
            "t",
            &columns,
            &["id".into()],
            &RowChange::Insert {
                values: vec![cv("name", None)],
            },
        )
        .unwrap();
        assert_eq!(stmt.sql, "insert into t (name) values (cast($1::text as text))");
        assert_eq!(stmt.display, "INSERT INTO t (name) VALUES (NULL);");

        let empty = statement("t", &columns, &["id".into()], &RowChange::Insert { values: vec![] }).unwrap();
        assert_eq!(empty.sql, "insert into t default values");
    }

    #[test]
    fn requires_full_primary_key_for_deletes() {
        let columns = vec![col("id", "integer"), col("name", "text")];
        let no_pk = statement("t", &columns, &[], &RowChange::Delete { key: vec![cv("id", Some("1"))] });
        assert!(no_pk.is_err());
        let wrong_key = statement(
            "t",
            &columns,
            &["id".into()],
            &RowChange::Delete {
                key: vec![cv("name", Some("x"))],
            },
        );
        assert!(wrong_key.is_err());
    }
}
