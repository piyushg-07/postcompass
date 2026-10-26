import { toast } from "@repo/ui";
import { save as saveFile } from "@tauri-apps/plugin-dialog";
import { commands, describeError, unwrap } from "../../../../lib/ipc";
import { type ExportFormat, exportRows } from "../export";
import type { Cells } from "./model";

interface Source {
  /** Column names, in table order. */
  columns: string[];
  /** Loads the rows (they may have to be fetched, after "Select all"). */
  load: () => Promise<Cells[]>;
  schema: string;
  table: string;
}

const rowCount = (n: number) =>
  `${n.toLocaleString()} row${n === 1 ? "" : "s"}`;

/** Copies the rows to the clipboard as CSV, JSON or INSERT statements. */
export async function copyRows(format: ExportFormat, source: Source) {
  try {
    const rows = await source.load();
    const text = exportRows(format, source.columns, rows, source);
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${rowCount(rows.length)} as ${format.toUpperCase()}`);
  } catch (e) {
    toast.error("Couldn't copy", { description: describeError(e).message });
  }
}

/** Saves the rows to a file the user picks. */
export async function exportRowsToFile(format: ExportFormat, source: Source) {
  let rows: Cells[];
  try {
    rows = await source.load();
  } catch (e) {
    toast.error("Couldn't export", { description: describeError(e).message });
    return;
  }
  const text = exportRows(format, source.columns, rows, source);
  const path = await saveFile({
    defaultPath: `${source.table}.${format}`,
    filters: [{ name: format.toUpperCase(), extensions: [format] }],
  });
  if (!path) return;
  try {
    await unwrap(commands.saveTextFile(path, text));
    toast.success(`Exported ${rowCount(rows.length)}`, { description: path });
  } catch (e) {
    toast.error("Couldn't export", { description: describeError(e).message });
  }
}
