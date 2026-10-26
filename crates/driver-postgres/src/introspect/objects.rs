//! Functions, sequences, enums and triggers of a schema.

use pc_core::CoreResult;
use pc_core::driver::{
    EnumInfo, FunctionArg, FunctionInfo, SchemaObjects, SchemaTriggerInfo, SequenceInfo,
};
use tokio_postgres::Client;

use crate::map_error;

pub async fn schema_objects(client: &Client, schema: &str) -> CoreResult<SchemaObjects> {
    let (functions, sequences, enums, triggers) = tokio::try_join!(
        async {
            client
                .query(
                    "select p.oid::text,
                            p.proname::text,
                            coalesce(pg_get_function_identity_arguments(p.oid), ''),
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
                            t.tgfoid::regproc::text, coalesce(pg_get_triggerdef(t.oid, true), '')
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
                args: match (
                    row.get::<_, Option<Vec<String>>>(9),
                    row.get::<_, Option<Vec<String>>>(10),
                ) {
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
