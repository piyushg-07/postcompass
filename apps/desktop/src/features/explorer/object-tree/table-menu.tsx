import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  toast,
} from "@repo/ui";
import {
  Code,
  Copy,
  CopyPlus,
  Eraser,
  Layers,
  Pencil,
  RefreshCw,
  Settings2,
  Table2,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import type { TableAction } from "../tabs/table-actions";

const CONTEXT_PARTS = {
  Content: ContextMenuContent,
  Item: ContextMenuItem,
  Label: ContextMenuLabel,
  Separator: ContextMenuSeparator,
};
const DROPDOWN_PARTS = {
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  Label: DropdownMenuLabel,
  Separator: DropdownMenuSeparator,
};

/** Actions of a table or view in the sidebar: its right-click menu, or the row's ⋯ menu. */
export function TableMenu({
  as = "context",
  name,
  kind,
  isView,
  select,
  onView,
  onQuery,
  onRefresh,
  onTableSheet,
  onAction,
}: {
  name: string;
  kind: string;
  isView: boolean;
  select: string;
  onView: (view: "data" | "structure" | "definition") => void;
  onQuery: (sql: string) => void;
  onRefresh: () => void;
  onTableSheet: (mode: "edit" | "duplicate") => void;
  onAction: (action: TableAction) => void;
  as?: "context" | "dropdown";
}) {
  const M = as === "dropdown" ? DROPDOWN_PARTS : CONTEXT_PARTS;
  const copy = (text: string, what: string) =>
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${what} copied`));
  return (
    <M.Content>
      <M.Label>{name}</M.Label>
      <M.Item icon={<Table2 />} onSelect={() => onView("data")}>
        View data
      </M.Item>
      {!isView && (
        <M.Item icon={<Layers />} onSelect={() => onView("structure")}>
          View structure
        </M.Item>
      )}
      {isView && (
        <M.Item icon={<Code />} onSelect={() => onView("definition")}>
          View definition
        </M.Item>
      )}
      <M.Item icon={<TerminalSquare />} onSelect={() => onQuery(select)}>
        Query in SQL editor
      </M.Item>
      {!isView && (
        <>
          <M.Separator />
          <M.Item icon={<Settings2 />} onSelect={() => onTableSheet("edit")}>
            Edit table
          </M.Item>
          <M.Item
            icon={<CopyPlus />}
            onSelect={() => onTableSheet("duplicate")}
          >
            Duplicate table
          </M.Item>
        </>
      )}
      <M.Separator />
      <M.Item icon={<Copy />} onSelect={() => copy(name, "Name")}>
        Copy name
      </M.Item>
      <M.Item icon={<Copy />} onSelect={() => copy(select, "SELECT statement")}>
        Copy SELECT statement
      </M.Item>
      <M.Separator />
      {kind === "materialized_view" && (
        <M.Item icon={<RefreshCw />} onSelect={() => onAction("refresh")}>
          Refresh materialized view…
        </M.Item>
      )}
      <M.Item icon={<Pencil />} onSelect={() => onAction("rename")}>
        Rename…
      </M.Item>
      {!isView && (
        <M.Item icon={<Eraser />} onSelect={() => onAction("truncate")}>
          Empty table (truncate)…
        </M.Item>
      )}
      <M.Item icon={<Trash2 />} danger onSelect={() => onAction("drop")}>
        Drop{" "}
        {kind === "view"
          ? "view"
          : kind === "materialized_view"
            ? "materialized view"
            : "table"}
        …
      </M.Item>
      <M.Separator />
      <M.Item icon={<RefreshCw />} onSelect={onRefresh}>
        Refresh list
      </M.Item>
    </M.Content>
  );
}
