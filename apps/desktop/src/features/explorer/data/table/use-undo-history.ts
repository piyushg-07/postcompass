import { toast } from "@repo/ui";
import { useRef, useState } from "react";
import type { RowChange } from "../../../../lib/bindings";
import { describeError } from "../../../../lib/ipc";
import { type UndoEntry, useUndoStore } from "../undo-store";

/**
 * Undo/redo for one table's row changes. History lives in the undo store, per `historyKey`, so it
 * survives switching tabs.
 */
export function useUndoHistory({
  historyKey,
  apply,
  reload,
}: {
  historyKey: string;
  /** Writes changes to the table. */
  apply: (changes: RowChange[]) => Promise<unknown>;
  /** Refreshes what's shown after a change. */
  reload: () => Promise<unknown>;
}) {
  const canUndo = useUndoStore(
    (s) => (s.tables[historyKey]?.past.length ?? 0) > 0,
  );
  const canRedo = useUndoStore(
    (s) => (s.tables[historyKey]?.future.length ?? 0) > 0,
  );
  const [undoing, setUndoing] = useState(false);
  // The guard is a ref, not `undoing`: a toast's Undo button keeps the closure of the render that
  // showed it, which would still see `false` while another undo runs
  const busy = useRef(false);

  /** Applies the latest undo (or redo) entry. */
  const step = async (direction: "undo" | "redo") => {
    if (busy.current) return;
    const store = useUndoStore.getState();
    const entry = store.shift(historyKey, direction);
    if (!entry) return;
    busy.current = true;
    setUndoing(true);
    try {
      await apply(direction === "undo" ? entry.undo : entry.redo);
    } catch (e) {
      // Only a failed write goes back on its stack; once applied, putting it back would let the
      // same change run twice (re-inserting deleted rows again, say)
      store.restore(historyKey, direction, entry);
      toast.error(`Couldn't ${direction} ${entry.label.toLowerCase()}`, {
        description: describeError(e).message,
      });
      return;
    } finally {
      busy.current = false;
      setUndoing(false);
    }
    toast.success(
      `${direction === "undo" ? "Undid" : "Redid"}: ${entry.label}`,
    );
    await reload();
  };

  /** Saves `entry` so it can be undone, without a toast. */
  const record = (entry: UndoEntry) =>
    useUndoStore.getState().record(historyKey, entry);

  /** Saves `entry` so it can be undone, and offers Undo in a toast. */
  const remember = (entry: UndoEntry, message: string) => {
    record(entry);
    toast.success(message, {
      action: { label: "Undo", onClick: () => void step("undo") },
    });
  };

  return { canUndo, canRedo, undoing, step, record, remember };
}
