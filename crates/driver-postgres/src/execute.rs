//! Running user SQL (one or more statements) and EXPLAIN.

use std::time::Instant;

use futures_util::StreamExt;
use pc_core::driver::{CancellationToken, ExecuteResult, ExplainResult, SqlError, StatementResult};
use pc_core::{CoreError, CoreResult};
use postgres_native_tls::MakeTlsConnector;
use tokio_postgres::error::ErrorPosition;
use tokio_postgres::{Client, NoTls, SimpleQueryMessage};

use crate::map_error;

/// A result set being received.
struct Pending {
    columns: Vec<String>,
    rows: Vec<Vec<Option<String>>>,
    truncated: bool,
    count: u64,
}

/// Runs `sql` with the simple query protocol, so several statements can be sent at once and every
/// value comes back as text. Keeps at most `max_rows` rows per result set (but keeps counting).
/// `tls` is how the connection was made, so a cancel request reaches TLS-only servers too.
pub async fn execute(
    client: &Client,
    sql: &str,
    max_rows: u32,
    cancel: CancellationToken,
    tls: Option<MakeTlsConnector>,
) -> CoreResult<ExecuteResult> {
    let started = Instant::now();
    let mut statements: Vec<StatementResult> = Vec::new();
    let mut current: Option<Pending> = None;
    let mut error = None;
    let mut cancelled = false;

    let stream = client.simple_query_raw(sql).await;
    match stream {
        Err(e) => error = Some(sql_error(&e)),
        Ok(stream) => {
            let mut stream = std::pin::pin!(stream);
            loop {
                let message = tokio::select! {
                    // Ask the server to cancel, then keep reading until it reports the cancellation
                    _ = cancel.cancelled(), if !cancelled => {
                        cancelled = true;
                        let token = client.cancel_token();
                        let tls = tls.clone();
                        tokio::spawn(async move {
                            let _ = match tls {
                                Some(tls) => token.cancel_query(tls).await,
                                None => token.cancel_query(NoTls).await,
                            };
                        });
                        continue;
                    }
                    message = stream.next() => message,
                };
                match message {
                    None => break,
                    Some(Err(e)) => {
                        error = Some(sql_error(&e));
                        break;
                    }
                    Some(Ok(SimpleQueryMessage::RowDescription(columns))) => {
                        current = Some(Pending {
                            columns: columns.iter().map(|c| c.name().to_owned()).collect(),
                            rows: Vec::new(),
                            truncated: false,
                            count: 0,
                        });
                    }
                    Some(Ok(SimpleQueryMessage::Row(row))) => {
                        if let Some(pending) = current.as_mut() {
                            pending.count += 1;
                            if pending.rows.len() < max_rows as usize {
                                pending.rows.push(
                                    (0..row.len())
                                        .map(|i| row.get(i).map(str::to_owned))
                                        .collect(),
                                );
                            } else {
                                pending.truncated = true;
                            }
                        }
                    }
                    Some(Ok(SimpleQueryMessage::CommandComplete(affected))) => match current.take()
                    {
                        Some(pending) => statements.push(StatementResult::Rows {
                            columns: pending.columns,
                            rows: pending.rows,
                            truncated: pending.truncated,
                            row_count: pending.count.max(affected) as f64,
                        }),
                        None => statements.push(StatementResult::Command {
                            rows_affected: affected as f64,
                        }),
                    },
                    Some(Ok(_)) => {}
                }
            }
        }
    }

    Ok(ExecuteResult {
        notices: Vec::new(),
        statements,
        error,
        cancelled,
        duration_ms: started.elapsed().as_millis().min(u32::MAX as u128) as u32,
    })
}

/// `EXPLAIN (FORMAT JSON)`. With `analyze`, the statement really runs, so it is wrapped in a
/// transaction that is always rolled back, on a dedicated connection.
pub async fn explain(client: &Client, sql: &str, analyze: bool) -> CoreResult<ExplainResult> {
    let statement = sql.trim().trim_end_matches(';').trim();
    if statement.is_empty() {
        return Err(CoreError::InvalidInput("nothing to explain".into()));
    }
    let options = if analyze {
        "ANALYZE, BUFFERS, FORMAT JSON"
    } else {
        "FORMAT JSON"
    };
    let explain_sql = format!("EXPLAIN ({options}) {statement}");
    // The simple protocol would run anything after a `;` too (even a COMMIT); preparing first
    // rejects more than one statement without running anything
    if let Err(e) = client.prepare(&explain_sql).await {
        if e.as_db_error()
            .is_some_and(|db| db.message().contains("multiple commands"))
        {
            return Err(CoreError::InvalidInput(
                "Explain works on one statement at a time. Select the one you want and try again."
                    .into(),
            ));
        }
        return Err(map_error(e));
    }

    if analyze {
        client.batch_execute("BEGIN").await.map_err(map_error)?;
    }
    let result = client.simple_query(&explain_sql).await;
    if analyze {
        let _ = client.batch_execute("ROLLBACK").await;
    }

    let messages = result.map_err(|e| CoreError::QueryFailed(sql_error(&e).message))?;
    let plan = messages
        .iter()
        .find_map(|m| match m {
            SimpleQueryMessage::Row(row) => row.get(0).map(str::to_owned),
            _ => None,
        })
        .ok_or_else(|| CoreError::QueryFailed("EXPLAIN returned no plan".into()))?;
    Ok(ExplainResult {
        plan_json: plan,
        analyzed: analyze,
    })
}

pub fn sql_error(error: &tokio_postgres::Error) -> SqlError {
    match error.as_db_error() {
        Some(db) => SqlError {
            message: db.message().to_owned(),
            detail: db.detail().map(str::to_owned),
            hint: db.hint().map(str::to_owned),
            position: match db.position() {
                Some(ErrorPosition::Original(p)) => Some(*p),
                _ => None,
            },
            code: Some(db.code().code().to_owned()),
        },
        None => SqlError {
            message: error.to_string(),
            detail: None,
            hint: None,
            position: None,
            code: None,
        },
    }
}
