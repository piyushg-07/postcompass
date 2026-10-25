import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  IconButton,
} from "@repo/ui";
import {
  ChevronDown,
  ClipboardPaste,
  Columns3,
  Copy,
  Download,
  FileUp,
  Plus,
  Rows3,
  X,
} from "lucide-react";
import type { ExportFormat } from "../export";
import { InsertOption, RowsMenu } from "./menus";

/** The left of the toolbar while rows are selected: count, "Select all", copy and export. */
export function SelectionToolbar({
  count,
  everyRow,
  totalLabel,
  canSelectAll,
  onClear,
  onSelectAll,
  onCopy,
  onExport,
}: {
  /** Rows selected on this page. */
  count: number;
  /** "Select all N rows" is on. */
  everyRow: boolean;
  totalLabel: string;
  canSelectAll: boolean;
  onClear: () => void;
  onSelectAll: () => void;
  onCopy: (format: ExportFormat) => void;
  onExport: (format: ExportFormat) => void;
}) {
  return (
    <>
      <IconButton
        size="sm"
        className="ml-2"
        label="Clear selection"
        icon={<X />}
        onClick={onClear}
      />
      <span className="px-1 text-xs text-fg">
        {everyRow
          ? `All ${totalLabel} rows selected`
          : `${count} row${count === 1 ? "" : "s"} selected`}
      </span>
      {canSelectAll && !everyRow && (
        <button
          type="button"
          onClick={onSelectAll}
          className="cursor-pointer rounded px-1.5 py-0.5 text-xs text-accent hover:bg-accent-muted"
        >
          Select all {totalLabel} rows
        </button>
      )}
      <span className="mx-1 h-4 w-px bg-border" />
      <RowsMenu icon={<Copy />} label="Copy" verb="Copy as" onPick={onCopy} />
      <RowsMenu
        icon={<Download />}
        label="Export"
        verb="Export as"
        onPick={onExport}
      />
    </>
  );
}

/** The "Insert" button: a row, a column, pasted rows or a CSV file. */
export function InsertMenu({
  table,
  onInsertRow,
  onInsertColumn,
  onPaste,
  onImport,
}: {
  table: string;
  onInsertRow: () => void;
  onInsertColumn: () => void;
  onPaste: () => void;
  onImport: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="primary"
          iconLeft={<Plus />}
          iconRight={<ChevronDown />}
        >
          Insert
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        <InsertOption
          icon={<Rows3 />}
          title="Insert row"
          description={`Add a new row to ${table}`}
          onSelect={onInsertRow}
        />
        <InsertOption
          icon={<Columns3 />}
          title="Insert column"
          description={`Add a new column to ${table}`}
          onSelect={onInsertColumn}
        />
        <InsertOption
          icon={<ClipboardPaste />}
          title="Paste rows"
          description="From Excel or Google Sheets (or press Ctrl+V)"
          onSelect={onPaste}
        />
        <InsertOption
          icon={<FileUp />}
          title="Import data from CSV"
          description="Insert rows from a .csv or .tsv file"
          onSelect={onImport}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
