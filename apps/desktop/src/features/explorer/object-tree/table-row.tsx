import { DropdownMenu, DropdownMenuTrigger } from "@repo/ui";
import { Eye, Globe, Layers, MoreHorizontal, SquareStack, Table2 } from "lucide-react";
import { memo, type ReactNode } from "react";
import type { TableInfo, TableKind } from "../../../lib/bindings";
import { formatCount } from "../../../lib/format";
import { qualified } from "../../../lib/sql";
import type { TableAction } from "../tabs/table-actions";
import type { TableView } from "../workspace-store";
import { TableMenu } from "./table-menu";
import { Item } from "./tree-item";

/** What a row can do; the handlers are stable so unchanged rows skip re-rendering. */
export interface TableRowHandlers {
  open: (name: string, kind: TableKind, view: TableView) => void;
  query: (sql: string) => void;
  refresh: () => void;
  tableSheet: (name: string, mode: "edit" | "duplicate") => void;
  action: (name: string, kind: TableKind, action: TableAction) => void;
}

const ICONS: Record<TableKind, ReactNode> = {
  table: <Table2 />,
  view: <Eye />,
  materialized_view: <Layers />,
  partitioned_table: <SquareStack />,
  foreign_table: <Globe />,
};

/** One table or view in the sidebar list, with its right-click and ⋯ menus. */
export const TableRow = memo(function TableRow({
  table: t,
  schema,
  active,
  query,
  top,
  handlers: h,
}: {
  table: TableInfo;
  schema: string;
  active: boolean;
  /** Search text to mark in the name. */
  query: string;
  /** Offset in a virtual list, or `null` in a plain one. */
  top: number | null;
  handlers: TableRowHandlers;
}) {
  const menuProps = {
    name: t.name,
    kind: t.kind,
    isView: t.kind === "view" || t.kind === "materialized_view",
    select: `SELECT *\nFROM ${qualified(schema, t.name)}\nLIMIT 100;`,
    onAction: (action: TableAction) => h.action(t.name, t.kind, action),
    onView: (view: TableView) => h.open(t.name, t.kind, view),
    onQuery: h.query,
    onRefresh: h.refresh,
    onTableSheet: (mode: "edit" | "duplicate") => h.tableSheet(t.name, mode),
  };
  return (
    <Item
      style={
        top === null
          ? undefined
          : {
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${top + 4}px)`,
            }
      }
      icon={ICONS[t.kind] ?? <Table2 />}
      label={t.name}
      highlight={query}
      meta={t.kind === "view" ? "view" : formatCount(t.rowEstimate)}
      active={active}
      onClick={() => h.open(t.name, t.kind, "data")}
      menu={<TableMenu {...menuProps} />}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`${t.name} actions`}
              className="flex size-5 cursor-pointer items-center justify-center rounded text-fg-subtle hover:bg-border hover:text-fg"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <TableMenu {...menuProps} as="dropdown" />
        </DropdownMenu>
      }
    />
  );
});
