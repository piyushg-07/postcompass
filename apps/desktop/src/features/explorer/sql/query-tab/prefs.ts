import { create } from "zustand";
import { persist } from "zustand/middleware";

/** "No limit" still stops at this many rows per result, to protect memory. */
export const NO_LIMIT = 100_000;
export const LIMITS = [100, 500, 1000, NO_LIMIT];

/** The row limit is remembered between sessions, like Supabase's. */
export const useSqlPrefs = create<{
  limit: number;
  setLimit: (limit: number) => void;
}>()(
  persist((set) => ({ limit: 100, setLimit: (limit) => set({ limit }) }), {
    name: "postcompass-sql-prefs",
  }),
);
