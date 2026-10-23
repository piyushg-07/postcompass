//! Paged, sorted, filtered table reads. Identifiers are quoted, values are always bind parameters.

use pc_core::driver::{ColumnInfo, FilterOp, RowsPage, RowsRequest, TableKind};
use pc_core::{CoreError, CoreResult};
use tokio_postgres::Client;
use tokio_postgres::types::ToSql;

use crate::introspect;
use crate::map_error;
use crate::sql::{escape_like, ident, qualified};

pub const MAX_PAGE_SIZE: u32 = 1000;
/// Below this planner estimate an exact `count(*)` is cheap enough to run on every page.
const EXACT_COUNT_LIMIT: f64 = 100_000.0;

/// Owned bind parameter, so the parameter list can be built up dynamically.
pub enum Param {
    Text(Option<String>),
    Int(i64),
}

impl Param {
    fn as_sql(&self) -> &(dyn ToSql + Sync) {
        match self {
            Param::Text(v) => v,
            Param::Int(v) => v,
        }
    }
}

pub fn as_refs(params: &[Param]) -> Vec<&(dyn ToSql + Sync)> {
    params.iter().map(Param::as_sql).collect()
}

pub async fn rows(client: &Client, schema: &str, table: &str, request: RowsRequest) -> CoreResult<RowsPage> {
    let rel = introspect::relation(client, schema, table).await?;
    let (columns, primary_key) = tokio::try_join!(
        introspect::columns(client, rel.oid),
        introspect::primary_key(client, rel.oid)
    )?;

    let mut params: Vec<Param> = Vec::new();
    let where_sql = build_where(&columns, &request, &mut params)?;
    let order_sql = build_order(&columns, &primary_key, &request)?;

    let limit = request.limit.clamp(1, MAX_PAGE_SIZE);
    let select_list: Vec<String> = columns.iter().map(|c| format!("{}::text", ident(&c.name))).collect();
    let from = qualified(schema, table);

    let filter_params = params.len();
    params.push(Param::Int(i64::from(limit) + 1));
    params.push(Param::Int(i64::from(request.offset)));
    let page_sql = format!(
        // The table is aliased so ORDER BY reaches the real (typed) column, not the ::text output column
        "select {} from {from} as t{where_sql}{order_sql} limit ${} offset ${}",
        if select_list.is_empty() { "null".into() } else { select_list.join(", ") },
        filter_params + 1,
        filter_params + 2,
    );

    let mut rows: Vec<Vec<Option<String>>> = client
        .query(page_sql.as_str(), &as_refs(&params))
        .await
        .map_err(map_error)?
        .iter()
        .map(|row| (0..columns.len()).map(|i| row.get::<_, Option<String>>(i)).collect())
        .collect();
    let has_more = rows.len() > limit as usize;
    rows.truncate(limit as usize);

    // Total: exact for small tables (or any filtered small table), estimated for large unfiltered ones
    let estimate = rel.row_estimate;
    // Views, partitioned and foreign tables have no estimate of their own (0 or -1), so they are
    // counted, but only up to the limit: a huge one costs at most that many rows per page
    let trusted = matches!(rel.kind, TableKind::Table) && estimate >= 0.0;
    let small = estimate < EXACT_COUNT_LIMIT; // -1 (never analyzed) counts as small
    let (total, total_is_estimate) = if !trusted {
        let count_sql = format!(
            "select count(*)::float8 from (select 1 from {from}{where_sql} limit {}) as capped",
            EXACT_COUNT_LIMIT as u64 + 1
        );
        let row = client
            .query_one(count_sql.as_str(), &as_refs(&params[..filter_params]))
            .await
            .map_err(map_error)?;
        let counted: f64 = row.get(0);
        if counted > EXACT_COUNT_LIMIT { (None, false) } else { (Some(counted), false) }
    } else if small {
        let count_sql = format!("select count(*)::float8 from {from}{where_sql}");
        let row = client
            .query_one(count_sql.as_str(), &as_refs(&params[..filter_params]))
            .await
            .map_err(map_error)?;
        (Some(row.get::<_, f64>(0)), false)
    } else if request.filters.is_empty() {
        (Some(estimate), true)
    } else {
        (None, false)
    };

    let editable = matches!(rel.kind, TableKind::Table | TableKind::PartitionedTable);
    Ok(RowsPage {
        columns,
        rows,
        key_columns: if editable { primary_key } else { Vec::new() },
        has_more,
        total,
        total_is_estimate,
    })
}

fn column<'a>(columns: &'a [ColumnInfo], name: &str) -> CoreResult<&'a ColumnInfo> {
    columns
        .iter()
        .find(|c| c.name == name)
        .ok_or_else(|| CoreError::InvalidInput(format!("unknown column {name}")))
}

fn build_where(columns: &[ColumnInfo], request: &RowsRequest, params: &mut Vec<Param>) -> CoreResult<String> {
    let mut clauses = Vec::new();
    for filter in &request.filters {
        let col = column(columns, &filter.column)?;
        let name = ident(&col.name);
        let needs_value = !matches!(
            filter.op,
            FilterOp::IsNull | FilterOp::IsNotNull | FilterOp::IsTrue | FilterOp::IsFalse
        );
        let value = filter.value.clone();
        if needs_value && value.is_none() {
            return Err(CoreError::InvalidInput(format!("filter on {} needs a value", col.name)));
        }

        let mut bind = |v: Option<String>| {
            params.push(Param::Text(v));
            format!("${}", params.len())
        };
        // Comparisons cast the text value to the column's real type on the server
        let typed = |p: String| format!("cast({p}::text as {})", col.data_type);

        clauses.push(match filter.op {
            FilterOp::Equals => format!("{name} = {}", typed(bind(value))),
            FilterOp::NotEquals => format!("{name} is distinct from {}", typed(bind(value))),
            FilterOp::GreaterThan => format!("{name} > {}", typed(bind(value))),
            FilterOp::GreaterOrEqual => format!("{name} >= {}", typed(bind(value))),
            FilterOp::LessThan => format!("{name} < {}", typed(bind(value))),
            FilterOp::LessOrEqual => format!("{name} <= {}", typed(bind(value))),
            FilterOp::Contains => {
                let p = bind(value.map(|v| format!("%{}%", escape_like(&v))));
                format!("{name}::text ilike {p}")
            }
            FilterOp::StartsWith => {
                let p = bind(value.map(|v| format!("{}%", escape_like(&v))));
                format!("{name}::text ilike {p}")
            }
            FilterOp::IsNull => format!("{name} is null"),
            FilterOp::IsNotNull => format!("{name} is not null"),
            FilterOp::IsTrue => format!("{name} is true"),
            FilterOp::IsFalse => format!("{name} is false"),
            FilterOp::Like => format!("{name}::text like {}", bind(value)),
            FilterOp::ILike => format!("{name}::text ilike {}", bind(value)),
            FilterOp::InList => {
                // `a, b, c` or `(a, b, c)` becomes a text array, cast to the column's type
                let list = value.unwrap_or_default();
                let items: Vec<String> = list
                    .trim()
                    .trim_start_matches('(')
                    .trim_end_matches(')')
                    .split(',')
                    .map(|v| v.trim().trim_matches('\'').to_owned())
                    .filter(|v| !v.is_empty())
                    .map(|v| format!("\"{}\"", v.replace('\\', "\\\\").replace('"', "\\\"")))
                    .collect();
                let p = bind(Some(format!("{{{}}}", items.join(","))));
                format!("{name} = any(cast({p}::text as {}[]))", col.data_type)
            }
        });
    }
    Ok(if clauses.is_empty() {
        String::new()
    } else {
        format!(" where {}", clauses.join(" and "))
    })
}

fn build_order(columns: &[ColumnInfo], primary_key: &[String], request: &RowsRequest) -> CoreResult<String> {
    let mut parts = Vec::new();
    for sort in &request.sort {
        let col = column(columns, &sort.column)?;
        parts.push(format!(
            "t.{} {} nulls last",
            ident(&col.name),
            if sort.descending { "desc" } else { "asc" }
        ));
    }
    // Stable paging: always end with the primary key
    for key in primary_key {
        if !request.sort.iter().any(|s| &s.column == key) {
            parts.push(format!("t.{}", ident(key)));
        }
    }
    Ok(if parts.is_empty() {
        String::new()
    } else {
        format!(" order by {}", parts.join(", "))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use pc_core::driver::{FilterSpec, SortSpec};

    fn col(name: &str, data_type: &str) -> ColumnInfo {
        ColumnInfo {
            name: name.into(),
            data_type: data_type.into(),
            nullable: true,
            default: None,
            is_primary_key: false,
            identity: None,
            generated: None,
            comment: None,
        }
    }

    fn request(sort: Vec<SortSpec>, filters: Vec<FilterSpec>) -> RowsRequest {
        RowsRequest {
            offset: 0,
            limit: 100,
            sort,
            filters,
        }
    }

    #[test]
    fn builds_typed_filters_with_parameters() {
        let columns = vec![col("id", "integer"), col("Name", "text")];
        let mut params = Vec::new();
        let sql = build_where(
            &columns,
            &request(
                vec![],
                vec![
                    FilterSpec {
                        column: "id".into(),
                        op: FilterOp::GreaterThan,
                        value: Some("5".into()),
                    },
                    FilterSpec {
                        column: "Name".into(),
                        op: FilterOp::Contains,
                        value: Some("a%b".into()),
                    },
                    FilterSpec {
                        column: "Name".into(),
                        op: FilterOp::IsNull,
                        value: None,
                    },
                ],
            ),
            &mut params,
        )
        .unwrap();
        assert_eq!(
            sql,
            " where id > cast($1::text as integer) and \"Name\"::text ilike $2 and \"Name\" is null"
        );
        assert!(matches!(&params[1], Param::Text(Some(v)) if v == "%a\\%b%"));
    }

    #[test]
    fn rejects_unknown_columns() {
        let columns = vec![col("id", "integer")];
        let err = build_order(
            &columns,
            &[],
            &request(
                vec![SortSpec {
                    column: "id; drop table x".into(),
                    descending: false,
                }],
                vec![],
            ),
        )
        .unwrap_err();
        assert_eq!(err.code(), pc_core::ErrorCode::InvalidInput);
    }

    #[test]
    fn orders_by_sort_then_primary_key() {
        let columns = vec![col("id", "integer"), col("created", "timestamp")];
        let sql = build_order(
            &columns,
            &["id".into()],
            &request(
                vec![SortSpec {
                    column: "created".into(),
                    descending: true,
                }],
                vec![],
            ),
        )
        .unwrap();
        assert_eq!(sql, " order by t.created desc nulls last, t.id");
    }
}
