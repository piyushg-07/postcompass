import { create } from "zustand";

export type Section = "home" | "databases" | "settings" | "explorer";

interface NavigationState {
  section: Section;
  /** Database shown in the explorer, if one is open. */
  openServerId: string | null;
  installDialogOpen: boolean;
  paletteOpen: boolean;
  /** Remote connection add/edit dialog. `editingRemoteId` is null when adding. */
  remoteDialogOpen: boolean;
  editingRemoteId: string | null;

  goTo: (section: Section) => void;
  openServer: (serverId: string) => void;
  closeServer: () => void;
  setInstallDialogOpen: (open: boolean) => void;
  /** Jumps to Databases and opens the install dialog. */
  startInstall: () => void;
  setPaletteOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  openRemoteDialog: (editId?: string | null) => void;
  closeRemoteDialog: () => void;
}

/** UI navigation state, readable from any component without prop drilling. */
export const useNavigation = create<NavigationState>()((set) => ({
  section: "home",
  openServerId: null,
  installDialogOpen: false,
  paletteOpen: false,
  remoteDialogOpen: false,
  editingRemoteId: null,

  goTo: (section) => set({ section }),
  openServer: (serverId) =>
    set({ openServerId: serverId, section: "explorer" }),
  closeServer: () => set({ openServerId: null, section: "databases" }),
  setInstallDialogOpen: (open) => set({ installDialogOpen: open }),
  startInstall: () => set({ section: "databases", installDialogOpen: true }),
  setPaletteOpen: (open) =>
    set((s) => ({
      paletteOpen: typeof open === "function" ? open(s.paletteOpen) : open,
    })),
  openRemoteDialog: (editId = null) =>
    set({ remoteDialogOpen: true, editingRemoteId: editId ?? null, section: "databases" }),
  closeRemoteDialog: () => set({ remoteDialogOpen: false, editingRemoteId: null }),
}));

