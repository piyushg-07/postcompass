import { toast } from "@repo/ui";
import { open as openFile } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { commands, describeError, unwrap } from "../../../../lib/ipc";
import { isTabular } from "../paste/parse-clipboard";

/** Rows waiting in the paste/import preview: the text, and the file it came from (if any). */
export interface PasteSource {
  text: string;
  fileName: string | null;
}

/** Pasting rows from a spreadsheet or importing a CSV/TSV file into the preview. */
export function useRowPaste() {
  const [source, setSource] = useState<PasteSource | null>(null);

  const close = () => setSource(null);

  /** Opens the preview for clipboard text. */
  const paste = (text: string) => setSource({ text, fileName: null });

  const importFile = async () => {
    const path = await openFile({
      filters: [{ name: "CSV", extensions: ["csv", "tsv", "txt"] }],
    });
    if (typeof path !== "string") return;
    try {
      const text = await unwrap(commands.readTextFile(path));
      if (!text.trim()) {
        toast.info("The file is empty");
        return;
      }
      setSource({ text, fileName: path.split(/[\\/]/).pop() ?? path });
    } catch (e) {
      toast.error("Couldn't open the file", {
        description: describeError(e).message,
      });
    }
  };

  const pasteFromClipboard = async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    if (isTabular(text)) paste(text);
    else
      toast.info("Nothing to paste", {
        description: "Copy some rows from Excel or Google Sheets first.",
      });
  };

  return { source, close, paste, importFile, pasteFromClipboard };
}
