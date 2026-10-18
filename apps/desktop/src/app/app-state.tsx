import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { AppInfo, AppState } from "../lib/bindings";
import { commands, unwrap } from "../lib/ipc";

interface AppStateValue {
  state: AppState;
  info: AppInfo;
  /** Replace state with the snapshot a command returned. */
  setState: (state: AppState) => void;
  /** Reload state from Rust. */
  refresh: () => Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState(await commands.getState());
  }, []);

  useEffect(() => {
    Promise.all([commands.getState(), unwrap(commands.appInfo())])
      .then(([state, info]) => {
        setState(state);
        setInfo(info);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <p className="text-sm font-medium text-danger">PostCompass couldn't start</p>
          <p className="mt-1 font-mono text-xs text-fg-muted">{error}</p>
        </div>
      </div>
    );
  }
  if (!state || !info) return fallback;

  return (
    <AppStateContext.Provider value={{ state, info, setState, refresh }}>{children}</AppStateContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState must be used inside AppStateProvider");
  return value;
}
