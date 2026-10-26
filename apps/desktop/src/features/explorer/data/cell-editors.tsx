import type { TypeKind } from "../../../lib/pg-types";
import type { Commit } from "./editors/cell-popover";
import { DateEditor } from "./editors/date-editor";
import { ListEditor } from "./editors/list-editor";
import { TextEditor } from "./editors/text-editor";
import { ValueEditor } from "./editors/value-editor";

export type { Commit } from "./editors/cell-popover";
export { ExpandEditor } from "./editors/expand-editor";

export interface EditorColumn {
  name: string;
  kind: TypeKind;
  nullable: boolean;
  enumValues?: string[];
  /** Short type, e.g. `int8`; `money` skips the number check (it prints with `$` and commas). */
  format?: string;
}

const BOOL_OPTIONS = [
  { value: "true", label: "TRUE" },
  { value: "false", label: "FALSE" },
];

/**
 * The editor for one grid cell, chosen by type like Supabase's: numbers and times inline, text
 * and JSON in a popover over the cell, booleans and enums in a list, dates in a small popover.
 */
export function CellEditor({
  column,
  value,
  initial,
  width,
  rowHeight,
  onCommit,
  onExpand,
}: {
  column: EditorColumn;
  value: string | null | undefined;
  /** A key typed to start editing; replaces the value. */
  initial?: string;
  width: number;
  rowHeight: number;
  onCommit: Commit;
  /** Opens the full-size editor with the current text. */
  onExpand: (text: string) => void;
}) {
  const start = initial ?? value ?? "";
  switch (column.kind) {
    case "number":
    case "time":
      return (
        <ValueEditor
          kind={column.kind}
          format={column.format}
          initial={start}
          nullable={column.nullable}
          width={width}
          rowHeight={rowHeight}
          onCommit={onCommit}
        />
      );
    case "bool":
      return (
        <ListEditor
          value={value ?? null}
          options={BOOL_OPTIONS}
          nullable={column.nullable}
          onCommit={onCommit}
        />
      );
    case "enum":
      return (
        <ListEditor
          value={value ?? null}
          options={(column.enumValues ?? []).map((v) => ({
            value: v,
            label: v,
          }))}
          nullable={column.nullable}
          onCommit={onCommit}
        />
      );
    case "date":
    case "timestamp":
    case "timestamptz":
      return (
        <DateEditor
          kind={column.kind}
          initial={start}
          nullable={column.nullable}
          rowHeight={rowHeight}
          onCommit={onCommit}
        />
      );
    default:
      return (
        <TextEditor
          initial={start}
          json={column.kind === "json"}
          // JSON and arrays are cleared to NULL instead
          nullable={
            column.nullable && column.kind !== "json" && column.kind !== "array"
          }
          width={width}
          rowHeight={rowHeight}
          onCommit={onCommit}
          onExpand={onExpand}
        />
      );
  }
}
