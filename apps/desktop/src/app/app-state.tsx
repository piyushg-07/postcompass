import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback } from "react";
import type { AppInfo, AppState } from "../lib/bindings";
import { commands, unwrap } from "../lib/ipc";
import { queryKeys } from "../lib/query";

/** Blocks rendering until app state and info are loaded from Rust. */
export function AppStateGate({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const state = useQuery({ queryKey: queryKeys.appState, queryFn: () => commands.getState(), staleTime: Infinity });
  const info = useQuery({ queryKey: queryKeys.appInfo, queryFn: () => unwrap(commands.appInfo()), staleTime: Infinity });

  const error = state.error ?? info.error;
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <p className="text-sm font-medium text-danger">PostCompass couldn't start</p>
          <p className="mt-1 font-mono text-xs text-fg-muted">{error.message}</p>
        </div>
      </div>
    );
  }
  if (!state.data || !info.data) return fallback;
  return children;
}

/**
 * App state from Rust (profile, servers, settings). Only use below `AppStateGate`.
 * Commands that change state return the new snapshot; pass it to `setState`.
 */
export function useAppState() {
  const queryClient = useQueryClient();
  const state = useQuery({ queryKey: queryKeys.appState, queryFn: () => commands.getState(), staleTime: Infinity });
  const info = useQuery({ queryKey: queryKeys.appInfo, queryFn: () => unwrap(commands.appInfo()), staleTime: Infinity });

  const setState = useCallback(
    (next: AppState) => queryClient.setQueryData(queryKeys.appState, next),
    [queryClient],
  );
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.appState }),
    [queryClient],
  );

  return {
    // Safe: AppStateGate renders children only once both are loaded
    state: state.data as AppState,
    info: info.data as AppInfo,
    setState,
    refresh,
  };
}
