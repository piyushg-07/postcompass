import { create } from "zustand";

export interface Target {
  serverId: string;
  database: string;
  schema: string;
  /** The table to update or duplicate; absent when creating one. */
  table?: string;
  mode?: "create" | "edit" | "duplicate";
}

/** The table panel (create, update, duplicate) can be opened from the sidebar, a table tab or the palette. */
export const useCreateTableSheet = create<{
  target: Target | null;
  open: (target: Target) => void;
  close: () => void;
}>()((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
