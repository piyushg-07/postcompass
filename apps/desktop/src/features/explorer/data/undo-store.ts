import { create } from "zustand";
import type { RowChange } from "../../../lib/bindings";

/** One saved change and the changes that reverse and repeat it. */
export interface UndoEntry {
  /** Shown in toasts, e.g. "Edit name" or "Delete 3 rows". */
  label: string;
  undo: RowChange[];
  redo: RowChange[];
}

interface Stacks {
  past: UndoEntry[];
  future: UndoEntry[];
}

/** Changes kept per table; older ones fall off. */
const LIMIT = 50;
const EMPTY: Stacks = { past: [], future: [] };

/**
 * Undo/redo history per table, kept in memory while the app runs (not saved to disk: after a
 * restart the data may have changed elsewhere, so old undos would be unsafe).
 */
export const useUndoStore = create<{
  tables: Record<string, Stacks>;
  record: (table: string, entry: UndoEntry) => void;
  /** Moves the latest entry from past to future (or back) and returns it. */
  shift: (table: string, direction: "undo" | "redo") => UndoEntry | null;
  /** Puts an entry back where it came from, when applying it failed. */
  restore: (
    table: string,
    direction: "undo" | "redo",
    entry: UndoEntry,
  ) => void;
}>()((set, get) => ({
  tables: {},
  record: (table, entry) =>
    set((s) => {
      const stacks = s.tables[table] ?? EMPTY;
      return {
        tables: {
          ...s.tables,
          // A new change makes the redo list meaningless
          [table]: { past: [...stacks.past, entry].slice(-LIMIT), future: [] },
        },
      };
    }),
  shift: (table, direction) => {
    const stacks = get().tables[table] ?? EMPTY;
    const from = direction === "undo" ? stacks.past : stacks.future;
    const entry = from.at(-1);
    if (!entry) return null;
    const rest = from.slice(0, -1);
    set((s) => ({
      tables: {
        ...s.tables,
        [table]:
          direction === "undo"
            ? { past: rest, future: [...stacks.future, entry] }
            : { past: [...stacks.past, entry], future: rest },
      },
    }));
    return entry;
  },
  restore: (table, direction, entry) =>
    set((s) => {
      const stacks = s.tables[table] ?? EMPTY;
      return {
        tables: {
          ...s.tables,
          [table]:
            direction === "undo"
              ? {
                  past: [...stacks.past, entry],
                  future: stacks.future.slice(0, -1),
                }
              : {
                  past: stacks.past.slice(0, -1),
                  future: [...stacks.future, entry],
                },
        },
      };
    }),
}));
