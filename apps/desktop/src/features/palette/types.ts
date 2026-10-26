import type { ReactNode } from "react";

export interface Command {
  id: string;
  group: string;
  label: string;
  /** Extra words that match but aren't shown, e.g. the schema name. */
  keywords?: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}
