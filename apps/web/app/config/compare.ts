// Facts for the /compare page. Checked against each tool's official site and pricing page (October 2026).
// Only list what is verified: an unknown cell stays "unknown" rather than a guess. Re-check before changing prices.

export const COMPARED_ON = "October 2026";

export type ToolId = "postcompass" | "pgadmin" | "dbeaver" | "datagrip" | "tableplus" | "beekeeper" | "postico";

export interface Tool {
  id: ToolId;
  name: string;
  /** What the app ships with, i.e. what you're really installing */
  runtime: string;
  url: string;
}

export const TOOLS: Tool[] = [
  { id: "postcompass", name: "PostCompass", runtime: "Rust + system webview", url: "https://github.com/piyushg-07/postcompass" },
  { id: "pgadmin", name: "pgAdmin 4", runtime: "Python web app in Electron", url: "https://www.pgadmin.org/download/" },
  { id: "dbeaver", name: "DBeaver", runtime: "Java (Eclipse) + bundled JDK", url: "https://dbeaver.com/edition/" },
  { id: "datagrip", name: "DataGrip", runtime: "Java (IntelliJ platform)", url: "https://www.jetbrains.com/datagrip/buy/" },
  { id: "tableplus", name: "TablePlus", runtime: "Native", url: "https://tableplus.com/pricing" },
  { id: "beekeeper", name: "Beekeeper Studio", runtime: "Electron", url: "https://www.beekeeperstudio.io/pricing" },
  { id: "postico", name: "Postico 2", runtime: "Native (macOS only)", url: "https://eggerapps.at/postico2/buy.html" },
];

/** yes / no / partial (with a note), or unknown when we couldn't verify it */
export type Cell = { v: "yes" | "no" | "partial" | "unknown" | "text"; note?: string };

const yes = (note?: string): Cell => ({ v: "yes", note });
const no = (note?: string): Cell => ({ v: "no", note });
const partial = (note: string): Cell => ({ v: "partial", note });
const unknown: Cell = { v: "unknown" };
const text = (note: string): Cell => ({ v: "text", note });

export interface Row {
  label: string;
  hint?: string;
  cells: Record<ToolId, Cell>;
}

export const ROWS: Row[] = [
  {
    label: "Price",
    cells: {
      postcompass: text("Free, forever"),
      pgadmin: text("Free"),
      dbeaver: text("Free CE · PRO from $113/yr"),
      datagrip: text("Free non-commercial · paid for work"),
      tableplus: text("$99 per device"),
      beekeeper: text("Free CE · paid from $108/yr"),
      postico: text("$99 per device"),
    },
  },
  {
    label: "Runs PostgreSQL for you",
    hint: "Install, start and stop a local server from inside the app",
    cells: {
      postcompass: yes("One click, no Docker"),
      pgadmin: no(),
      dbeaver: no(),
      datagrip: no(),
      tableplus: no("Separate app (DBngin)"),
      beekeeper: no(),
      postico: no(),
    },
  },
  {
    label: "Open source",
    cells: {
      postcompass: yes("MIT"),
      pgadmin: yes("PostgreSQL License"),
      dbeaver: partial("Community only"),
      datagrip: no(),
      tableplus: no(),
      beekeeper: partial("Community only"),
      postico: no(),
    },
  },
  {
    label: "Windows, macOS and Linux",
    cells: {
      postcompass: yes(),
      pgadmin: yes(),
      dbeaver: yes(),
      datagrip: yes(),
      tableplus: yes(),
      beekeeper: yes(),
      postico: no("macOS only"),
    },
  },
  {
    label: "Built for PostgreSQL",
    hint: "Focused on Postgres rather than every database",
    cells: {
      postcompass: yes(),
      pgadmin: yes(),
      dbeaver: no("Multi-database"),
      datagrip: no("Multi-database"),
      tableplus: no("Multi-database"),
      beekeeper: no("Multi-database"),
      postico: yes(),
    },
  },
  {
    label: "Visual query plan",
    cells: {
      postcompass: yes("Free"),
      pgadmin: yes(),
      dbeaver: partial("Graph view in PRO"),
      datagrip: yes(),
      tableplus: unknown,
      beekeeper: partial("Community plugin"),
      postico: unknown,
    },
  },
  {
    label: "ER diagram",
    cells: {
      postcompass: yes("Free"),
      pgadmin: yes(),
      dbeaver: yes(),
      datagrip: yes(),
      tableplus: unknown,
      beekeeper: partial("Paid plans"),
      postico: unknown,
    },
  },
];


export const SOURCES = [
  { label: "DBeaver editions", url: "https://dbeaver.com/edition/" },
  { label: "pgAdmin", url: "https://www.pgadmin.org/download/" },
  { label: "DataGrip licensing", url: "https://blog.jetbrains.com/datagrip/2025/10/01/datagrip-is-now-free-for-non-commercial-use/" },
  { label: "TablePlus pricing", url: "https://tableplus.com/pricing" },
  { label: "Beekeeper Studio pricing", url: "https://www.beekeeperstudio.io/pricing" },
  { label: "Postico 2", url: "https://eggerapps.at/postico2/buy.html" },
] as const;
