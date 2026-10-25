import type { QueryClient } from "@tanstack/react-query";
import { commands } from "../../lib/ipc";
import { queryKeys } from "../../lib/query";

/**
 * Rust's session id for a sidebar id: `server:<id>` for a managed server, the id itself for
 * `remote:<id>` (mirrors `server_connection_id` / `remote_connection_id`).
 */
export function connectionIdFor(id: string) {
  return id.startsWith("remote:") ? id : `server:${id}`;
}

/**
 * Drops the cached session and everything the explorer loaded through it, for when Rust has
 * already closed it (server stopped or removed), so the next open starts a fresh one.
 */
export function forgetConnection(queryClient: QueryClient, id: string) {
  queryClient.removeQueries({ queryKey: queryKeys.connection(id) });
  queryClient.removeQueries({ queryKey: queryKeys.explorer.all(connectionIdFor(id)) });
}

/** Closes the session in Rust too, e.g. when disconnecting or after its settings changed. */
export async function closeConnection(queryClient: QueryClient, id: string) {
  forgetConnection(queryClient, id);
  // A Result, never a throw for a missing session; closing is best effort
  await commands.closeConnection(connectionIdFor(id));
}
