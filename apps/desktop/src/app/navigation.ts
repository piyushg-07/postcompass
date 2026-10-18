import { create } from "zustand";

export type Section =
  "home" | "databases" | "settings" | "playground" | "explorer";

interface NavigationState {
  section: Section;
  /** Database shown in the explorer, if one is open. */
  openServerId: string | null;
  installDialogOpen: boolean;
  paletteOpen: boolean;

  goTo: (section: Section) => void;
  openServer: (serverId: string) => void;
  closeServer: () => void;
  setInstallDialogOpen: (open: boolean) => void;
  /** Jumps to Databases and opens the install dialog. */
  startInstall: () => void;
  setPaletteOpen: (open: boolean | ((open: boolean) => boolean)) => void;
}

/** UI navigation state, readable from any component without prop drilling. */
export const useNavigation = create<NavigationState>()((set) => ({
  section: "home",
  openServerId: null,
  installDialogOpen: false,
  paletteOpen: false,

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
}));
