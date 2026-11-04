import { create } from "zustand";

interface Target {
  serverId: string;
  database: string;
}

/** A saved cloud connection and which of its databases to copy. */
export interface CopySource {
  remoteId: string;
  database: string;
}

interface BackupDialogsState {
  backup: Target | null;
  restore: Target | null;
  /** The cloud database being copied to a local server. */
  copy: CopySource | null;
  /** A backup or restore is running; its dialog must stay up so it can be followed and cancelled. */
  running: boolean;
  openBackup: (target: Target) => void;
  openRestore: (target: Target) => void;
  openCopy: (source: CopySource) => void;
  close: () => void;
  setRunning: (running: boolean) => void;
}

/** Backup / restore / copy dialogs can be opened from database menus, connection cards or the command palette. */
export const useBackupDialogs = create<BackupDialogsState>()((set) => ({
  backup: null,
  restore: null,
  copy: null,
  running: false,
  // Opening the other dialog would unmount the running one and lose its progress and cancel button
  openBackup: (target) =>
    set((s) =>
      s.running ? s : { backup: target, restore: null, copy: null },
    ),
  openRestore: (target) =>
    set((s) =>
      s.running ? s : { restore: target, backup: null, copy: null },
    ),
  openCopy: (source) =>
    set((s) =>
      s.running ? s : { copy: source, backup: null, restore: null },
    ),
  close: () =>
    set((s) => (s.running ? s : { backup: null, restore: null, copy: null })),
  setRunning: (running) => set({ running }),
}));
