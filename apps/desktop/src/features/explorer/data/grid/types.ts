import type { ReactNode } from "react";
import type { TypeKind } from "../../../../lib/pg-types";

/** `undefined` means "not set" (a new row's column that will use its DEFAULT). */
export type GridCell = string | null | undefined;

export interface GridColumn {
  id: string;
  name: string;
  /** Short type shown in the header, e.g. `int8`. */
  format?: string;
  kind?: TypeKind;
  isKey?: boolean;
  nullable?: boolean;
  enumValues?: string[];
  /** Cells can be edited in place (not primary keys or generated columns). */
  editable?: boolean;
  comment?: string | null;
  /** Foreign key: `schema.table.column` it points to, plus its ON UPDATE / ON DELETE rules. */
  references?: { target: string; onUpdate: string; onDelete: string };
}

export interface GridRow {
  id: string;
  cells: GridCell[];
  state?: "new" | "deleted";
  /** Indexes of cells with unsaved edits. */
  modified?: ReadonlySet<number>;
}

export interface GridSort {
  column: string;
  descending: boolean;
}

/** A cell, as handed to the context menu and reference callbacks. */
export interface CellTarget {
  rowId: string;
  col: number;
  value: GridCell;
}

export interface DataGridProps {
  columns: GridColumn[];
  rows: GridRow[];
  sort?: GridSort[];
  selected?: ReadonlySet<string>;
  onSelectedChange?: (selected: Set<string>) => void;
  /** When set, cells can be edited in place. */
  onEdit?: (rowId: string, columnIndex: number, value: string | null) => void;
  /** Editing a foreign-key cell picks a record instead (Supabase's "Select a record"). */
  onEditReference?: (target: CellTarget) => void;
  /** Contents of the popover opened from a foreign-key cell's arrow. */
  renderReference?: (target: CellTarget, close: () => void) => ReactNode;
  /** Shown instead of rows when there are none. */
  empty?: ReactNode;
  /** Menu shown from a button in each column header (sort, edit, delete…). */
  headerMenu?: (column: GridColumn) => ReactNode;
  /** Extra header button shown on hover, before the menu (e.g. column stats). */
  headerExtra?: (column: GridColumn) => ReactNode;
  /** When set, each row shows an expand button that calls this (e.g. to edit it in a panel). */
  onExpandRow?: (rowId: string) => void;
  /** Right-click menu items for a cell. */
  cellMenu?: (target: CellTarget) => ReactNode;
  /** The "+" column at the end of the header. */
  onAddColumn?: () => void;
  /** Column ids left out of the view. */
  hidden?: ReadonlySet<string>;
  /** Column ids pinned to the left while scrolling sideways (shown first). */
  frozen?: ReadonlySet<string>;
  /** Column ids in the order the user arranged them; columns not listed follow, in table order. */
  columnOrder?: readonly string[];
  /** Lets headers be dragged sideways; gets every column id (hidden ones too) in the new order. */
  onReorder?: (ids: string[]) => void;
}
