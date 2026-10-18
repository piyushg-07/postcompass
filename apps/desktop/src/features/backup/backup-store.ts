import { create } from "zustand";

interface Target {
  serverId: string;
  database: string;
}

interface BackupDialogsState {
  backup: Target | null;
  restore: Target | null;
  openBackup: (target: Target) => void;
  openRestore: (target: Target) => void;
  close: () => void;
}

/** Backup / restore dialogs can be opened from the database menu or the command palette. */
export const useBackupDialogs = create<BackupDialogsState>()((set) => ({
  backup: null,
  restore: null,
  openBackup: (target) => set({ backup: target, restore: null }),
  openRestore: (target) => set({ restore: target, backup: null }),
  close: () => set({ backup: null, restore: null }),
}));
