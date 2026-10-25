//! Schema objects besides tables: functions, sequences, enums, triggers, extensions, RLS policies.

use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FunctionInfo {
    /// Stable identifier for fetching the definition (overloads share a name).
    pub id: String,
    pub name: String,
    pub arguments: String,
    pub returns: String,
    pub language: String,
    /// `function`, `procedure`, `aggregate` or `window`
    pub kind: String,
    /// The code between the `$$` quotes.
    pub body: String,
    /// `volatile`, `stable` or `immutable`
    pub volatility: String,
    pub security_definer: bool,
    /// The input arguments, or `None` when they use OUT, VARIADIC or defaults
    /// (too much for the simple form; edit the SQL instead).
    pub args: Option<Vec<FunctionArg>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FunctionArg {
    /// Empty for an unnamed argument.
    pub name: String,
    pub data_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SequenceInfo {
    pub name: String,
    pub data_type: String,
    pub last_value: Option<String>,
    pub increment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EnumInfo {
    pub name: String,
    pub values: Vec<String>,
}

/// A trigger anywhere in a schema, with the table it fires on.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SchemaTriggerInfo {
    pub name: String,
    pub table: String,
    pub enabled: bool,
    /// The function the trigger runs, e.g. `public.set_updated_at`
    pub function: String,
    pub definition: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SchemaObjects {
    pub functions: Vec<FunctionInfo>,
    pub sequences: Vec<SequenceInfo>,
    pub enums: Vec<EnumInfo>,
    pub triggers: Vec<SchemaTriggerInfo>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ObjectKind {
    Table,
    View,
    MaterializedView,
    Function,
    Sequence,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionInfo {
    pub name: String,
    pub default_version: Option<String>,
    pub installed_version: Option<String>,
    pub comment: Option<String>,
}

/// A Row Level Security policy on a table (`pg_policies`).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PolicyInfo {
    pub name: String,
    /// `ALL`, `SELECT`, `INSERT`, `UPDATE` or `DELETE`.
    pub command: String,
    /// `false` for a `RESTRICTIVE` policy.
    pub permissive: bool,
    /// Roles the policy applies to; `public` means everyone.
    pub roles: Vec<String>,
    /// The `USING` expression: which existing rows are visible / changeable.
    pub using: Option<String>,
    /// The `WITH CHECK` expression: which new or updated rows are allowed.
    pub with_check: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PolicyTable {
    pub name: String,
    pub rls_enabled: bool,
    /// RLS applies to the table owner too (`FORCE ROW LEVEL SECURITY`).
    pub rls_forced: bool,
    pub policies: Vec<PolicyInfo>,
}

/// Tables of a schema with their RLS state and policies, plus the roles a policy can target.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SchemaPolicies {
    pub tables: Vec<PolicyTable>,
    pub roles: Vec<String>,
}
