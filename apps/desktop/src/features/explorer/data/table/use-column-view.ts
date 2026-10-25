import { useState } from "react";

export interface ColumnView {
  hidden: string[];
  frozen: string[];
  /** Column names as dragged into place; empty for table order. */
  order: string[];
}

const EMPTY_VIEW: ColumnView = { hidden: [], frozen: [], order: [] };

/** Hidden/frozen/rearranged columns for one table, kept in this computer's storage. */
export function useColumnView(key: string) {
  const storageKey = `postcompass-columns:${key}`;
  const [view, setViewState] = useState<ColumnView>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved
        ? { ...EMPTY_VIEW, ...(JSON.parse(saved) as ColumnView) }
        : EMPTY_VIEW;
    } catch {
      return EMPTY_VIEW;
    }
  });
  const setView = (update: (v: ColumnView) => ColumnView) =>
    setViewState((v) => {
      const next = update(v);
      try {
        if (next.hidden.length || next.frozen.length || next.order.length)
          localStorage.setItem(storageKey, JSON.stringify(next));
        else localStorage.removeItem(storageKey);
      } catch {
        // Storage can be unavailable; the view just won't be remembered
      }
      return next;
    });
  return [view, setView] as const;
}

/**
 * Freeze panes, like a spreadsheet: freezing a column pins it and every column to its left (as
 * arranged on screen); freezing again, on any frozen column, releases them all.
 */
export function toggleFrozen(
  view: ColumnView,
  columns: readonly string[],
  column: string,
): ColumnView {
  if (view.frozen.includes(column)) return { ...view, frozen: [] };
  const rank = (name: string, i: number) => {
    const at = view.order.indexOf(name);
    return at === -1 ? view.order.length + i : at;
  };
  const names = columns
    .map((name, i) => ({ name, rank: rank(name, i) }))
    .sort((a, b) => a.rank - b.rank)
    .map((c) => c.name);
  return { ...view, frozen: names.slice(0, names.indexOf(column) + 1) };
}

/** Adds `column` to the list, or takes it out if it's there. */
export function toggleIn(
  view: ColumnView,
  list: "hidden" | "frozen",
  column: string,
): ColumnView {
  return {
    ...view,
    [list]: view[list].includes(column)
      ? view[list].filter((c) => c !== column)
      : [...view[list], column],
  };
}
