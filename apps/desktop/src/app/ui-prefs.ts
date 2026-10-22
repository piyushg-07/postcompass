import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiPrefsState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

/** Small per-user layout preferences, remembered across restarts. */
export const useUiPrefs = create<UiPrefsState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    { name: "postcompass-ui", version: 1 },
  ),
);
