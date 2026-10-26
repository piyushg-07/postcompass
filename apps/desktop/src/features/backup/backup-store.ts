import { create } from "zustand";

interface Target {
  serverId: string;
  database: string;
}

interface BackupDialogsState {
  backup: Target | null;
  restore: Target | null;
  /** A backup or restore is running; its dialog must stay up so it can be followed and cancelled. */
  running: boolean;
  openBackup: (target: Target) => void;
  openRestore: (target: Target) => void;
  close: () => void;
  setRunning: (running: boolean) => void;
}

/** Backup / restore dialogs can be opened from the database menu or the command palette. */
export const useBackupDialogs = create<BackupDialogsState>()((set) => ({
  backup: null,
  restore: null,
  running: false,
  // Opening the other dialog would unmount the running one and lose its progress and cancel button
  openBackup: (target) =>
    set((s) => (s.running ? s : { backup: target, restore: null })),
  openRestore: (target) =>
    set((s) => (s.running ? s : { restore: target, backup: null })),
  close: () => set((s) => (s.running ? s : { backup: null, restore: null })),
  setRunning: (running) => set({ running }),
}));
