/**
 * SQL text builders for schema changes. Every statement built here is shown to the user before it
 * runs, and every identifier / literal goes through `ident` / `literal`.
 * (Row data edits are built in Rust with bind parameters instead.)
 */

export { ident, literal, qualified, suggestIdentifier } from "./sql/quote";
export { COMMON_TYPES, isSafeTypeName } from "./sql/types";
export * from "./sql/tables";
export * from "./sql/databases";
export * from "./sql/objects";
