import { create } from "zustand";

export type Section = "home" | "servers" | "settings" | "playground" | "explorer";

interface NavigationState {
  section: Section;
  /** Server shown in the explorer, if one is open. */
  openServerId: string | null;
  installDialogOpen: boolean;

  goTo: (section: Section) => void;
  openServer: (serverId: string) => void;
  closeServer: () => void;
  setInstallDialogOpen: (open: boolean) => void;
  /** Jumps to Servers and opens the install dialog. */
  startInstall: () => void;
}

/** UI navigation state, readable from any component without prop drilling. */
export const useNavigation = create<NavigationState>()((set) => ({
  section: "home",
  openServerId: null,
  installDialogOpen: false,

  goTo: (section) => set({ section }),
  openServer: (serverId) => set({ openServerId: serverId, section: "explorer" }),
  closeServer: () => set({ openServerId: null, section: "servers" }),
  setInstallDialogOpen: (open) => set({ installDialogOpen: open }),
  startInstall: () => set({ section: "servers", installDialogOpen: true }),
}));
