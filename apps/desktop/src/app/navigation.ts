import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Section = "home" | "databases" | "settings" | "explorer";

interface NavigationState {
  section: Section;
  /** Database shown in the explorer, if one is open. */
  openServerId: string | null;
  /** Every connection kept in the sidebar, in the order they were opened. */
  openServerIds: string[];
  installDialogOpen: boolean;
  paletteOpen: boolean;
  /** Remote connection add/edit dialog. `editingRemoteId` is null when adding. */
  remoteDialogOpen: boolean;
  editingRemoteId: string | null;
  /** Prefilled fields for a new connection, e.g. a server found on this computer. */
  remoteDraft: RemoteDraft | null;

  goTo: (section: Section) => void;
  /** Shows a connection in the explorer and keeps it in the sidebar. */
  openServer: (serverId: string) => void;
  /**
   * Takes a connection out of the sidebar (the current one when no id is given). If it was on
   * screen, the next open connection takes its place, or Databases when none is left.
   */
  closeServer: (serverId?: string) => void;
  setInstallDialogOpen: (open: boolean) => void;
  /** Jumps to Databases and opens the install dialog. */
  startInstall: () => void;
  setPaletteOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  openRemoteDialog: (editId?: string | null) => void;
  /** Opens the add-connection dialog with some fields already filled in. */
  openRemoteDialogWith: (draft: RemoteDraft) => void;
  closeRemoteDialog: () => void;
}

export interface RemoteDraft {
  name: string;
  host: string;
  port: number;
}

/** UI navigation state, readable from any component without prop drilling. */
export const useNavigation = create<NavigationState>()(
  persist(
    (set) => ({
      section: "home",
      openServerId: null,
      openServerIds: [],
      installDialogOpen: false,
      paletteOpen: false,
      remoteDialogOpen: false,
      editingRemoteId: null,
      remoteDraft: null,

      goTo: (section) => set({ section }),
      openServer: (serverId) =>
        set((s) => ({
          openServerId: serverId,
          section: "explorer",
          openServerIds: s.openServerIds.includes(serverId)
            ? s.openServerIds
            : [...s.openServerIds, serverId],
        })),
      closeServer: (serverId) =>
        set((s) => {
          const id = serverId ?? s.openServerId;
          if (!id) return s;
          const index = s.openServerIds.indexOf(id);
          const rest = s.openServerIds.filter((x) => x !== id);
          if (s.openServerId !== id) return { openServerIds: rest };
          // The neighbour that slid into its place, else the one before it
          const next = rest[Math.min(index, rest.length - 1)] ?? null;
          return {
            openServerIds: rest,
            openServerId: next,
            // Only the explorer depends on it; Home or Settings stay where they are
            section:
              s.section !== "explorer"
                ? s.section
                : next
                  ? "explorer"
                  : "databases",
          };
        }),
      setInstallDialogOpen: (open) => set({ installDialogOpen: open }),
      startInstall: () =>
        set({ section: "databases", installDialogOpen: true }),
      setPaletteOpen: (open) =>
        set((s) => ({
          paletteOpen: typeof open === "function" ? open(s.paletteOpen) : open,
        })),
      openRemoteDialog: (editId = null) =>
        set({
          remoteDialogOpen: true,
          editingRemoteId: editId ?? null,
          remoteDraft: null,
          section: "databases",
        }),
      openRemoteDialogWith: (draft) =>
        set({
          remoteDialogOpen: true,
          editingRemoteId: null,
          remoteDraft: draft,
          section: "databases",
        }),
      closeRemoteDialog: () =>
        set({ remoteDialogOpen: false, editingRemoteId: null, remoteDraft: null }),
    }),
    {
      name: "postcompass-open-connections",
      // Only the list survives a restart; the app still starts on Home
      partialize: (s) => ({ openServerIds: s.openServerIds }),
    },
  ),
);
