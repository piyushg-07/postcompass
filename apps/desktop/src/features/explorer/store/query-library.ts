import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface HistoryEntry {
  sql: string;
  database: string;
  at: number;
  durationMs: number;
  ok: boolean;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  /** Folder name; none means it sits at the top level. */
  folder?: string;
  favorite?: boolean;
}

interface QueryLibraryState {
  history: Record<string, HistoryEntry[]>;
  saved: Record<string, SavedQuery[]>;
  /** Folders per server, including empty ones. */
  folders: Record<string, string[]>;
  addHistory: (serverId: string, entry: HistoryEntry) => void;
  clearHistory: (serverId: string) => void;
  saveQuery: (
    serverId: string,
    name: string,
    sql: string,
    folder?: string,
  ) => string;
  updateSaved: (
    serverId: string,
    id: string,
    patch: Partial<Omit<SavedQuery, "id">>,
  ) => void;
  deleteSaved: (serverId: string, id: string) => void;
  addFolder: (serverId: string, name: string) => void;
  renameFolder: (serverId: string, from: string, to: string) => void;
  /** Deletes the folder; its queries move to the top level. */
  deleteFolder: (serverId: string, name: string) => void;
}

const MAX_HISTORY = 200;

/** A new saved query id; unique even when two are saved within the same millisecond. */
function newSavedId(existing: SavedQuery[]) {
  let id = Date.now();
  while (existing.some((q) => q.id === `${id}`)) id++;
  return `${id}`;
}

/** Query history and saved queries per server. Persisted. */
export const useQueryLibrary = create<QueryLibraryState>()(
  persist(
    (set, get) => ({
      history: {},
      saved: {},
      folders: {},
      addHistory: (serverId, entry) =>
        set((s) => {
          const list = s.history[serverId] ?? [];
          // Re-running the same SQL moves it to the top instead of duplicating it
          const rest = list.filter(
            (h) => h.sql !== entry.sql || h.database !== entry.database,
          );
          return {
            history: {
              ...s.history,
              [serverId]: [entry, ...rest].slice(0, MAX_HISTORY),
            },
          };
        }),
      clearHistory: (serverId) =>
        set((s) => ({ history: { ...s.history, [serverId]: [] } })),
      saveQuery: (serverId, name, sql, folder) => {
        const id = newSavedId(get().saved[serverId] ?? []);
        set((s) => ({
          saved: {
            ...s.saved,
            [serverId]: [
              { id, name, sql, folder: folder || undefined },
              ...(s.saved[serverId] ?? []),
            ],
          },
        }));
        return id;
      },
      updateSaved: (serverId, id, patch) =>
        set((s) => ({
          saved: {
            ...s.saved,
            [serverId]: (s.saved[serverId] ?? []).map((q) =>
              q.id === id ? { ...q, ...patch } : q,
            ),
          },
        })),
      addFolder: (serverId, name) =>
        set((s) => {
          const list = s.folders[serverId] ?? [];
          return list.includes(name)
            ? s
            : { folders: { ...s.folders, [serverId]: [...list, name] } };
        }),
      renameFolder: (serverId, from, to) =>
        set((s) => ({
          folders: {
            ...s.folders,
            [serverId]: (s.folders[serverId] ?? []).map((f) =>
              f === from ? to : f,
            ),
          },
          saved: {
            ...s.saved,
            [serverId]: (s.saved[serverId] ?? []).map((q) =>
              q.folder === from ? { ...q, folder: to } : q,
            ),
          },
        })),
      deleteFolder: (serverId, name) =>
        set((s) => ({
          folders: {
            ...s.folders,
            [serverId]: (s.folders[serverId] ?? []).filter((f) => f !== name),
          },
          saved: {
            ...s.saved,
            [serverId]: (s.saved[serverId] ?? []).map((q) =>
              q.folder === name ? { ...q, folder: undefined } : q,
            ),
          },
        })),
      deleteSaved: (serverId, id) =>
        set((s) => ({
          saved: {
            ...s.saved,
            [serverId]: (s.saved[serverId] ?? []).filter((q) => q.id !== id),
          },
        })),
    }),
    {
      name: "postcompass-queries",
      version: 2,
      // v1 had no folders; saved queries stay as they were
      migrate: (state) =>
        ({ folders: {}, ...(state as object) }) as QueryLibraryState,
    },
  ),
);
