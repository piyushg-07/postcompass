/** RLS policy SQL. Pure, so the policy panel stays thin. */
import { ident, qualified } from "../../../lib/sql";

export const COMMANDS = [
  "ALL",
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
] as const;
export type Command = (typeof COMMANDS)[number];

export interface PolicyDraft {
  name: string;
  command: Command;
  permissive: boolean;
  roles: string[];
  using: string;
  withCheck: string;
}

/** Which expressions a command takes: USING filters existing rows, WITH CHECK new ones. */
export const usesUsing = (c: Command) => c !== "INSERT";
export const usesCheck = (c: Command) =>
  c === "ALL" || c === "INSERT" || c === "UPDATE";

/** Role names in a `TO` list: `public` is a keyword, the rest are identifiers. */
function roleList(roles: string[]) {
  return roles.map((r) => (r === "public" ? "public" : ident(r))).join(", ");
}

export function createPolicySql(schema: string, table: string, d: PolicyDraft) {
  const lines = [
    `CREATE POLICY ${ident(d.name.trim())}`,
    `  ON ${qualified(schema, table)}`,
    `  AS ${d.permissive ? "PERMISSIVE" : "RESTRICTIVE"}`,
    `  FOR ${d.command}`,
    `  TO ${roleList(d.roles.length ? d.roles : ["public"])}`,
  ];
  if (usesUsing(d.command) && d.using.trim())
    lines.push(`  USING (${d.using.trim()})`);
  if (usesCheck(d.command) && d.withCheck.trim())
    lines.push(`  WITH CHECK (${d.withCheck.trim()})`);
  return `${lines.join("\n")};`;
}

export function dropPolicySql(schema: string, table: string, name: string) {
  return `DROP POLICY ${ident(name)} ON ${qualified(schema, table)};`;
}


/**
 * Postgres can't change a policy's command or behaviour in place, so an edit replaces it. One
 * query string already runs as one transaction; an explicit BEGIN/COMMIT would leave the shared
 * editor session in an aborted transaction when CREATE fails, since COMMIT never runs.
 */
export function replacePolicySql(
  schema: string,
  table: string,
  name: string,
  d: PolicyDraft,
) {
  return `${dropPolicySql(schema, table, name)}\n${createPolicySql(schema, table, d)}`;
}
