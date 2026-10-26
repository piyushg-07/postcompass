import { cn } from "@repo/ui";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { KeyRound, Link2, Table2 } from "lucide-react";
import { memo } from "react";
import type { GraphTable } from "../../../../lib/bindings";
import { COLUMN_HEIGHT, HEADER_HEIGHT, NODE_WIDTH } from "./layout";

export interface TableData extends Record<string, unknown> {
  table: GraphTable;
  /** column → "table.column" it references */
  references: Record<string, string>;
  /** Columns other tables point at. */
  referenced: Set<string>;
  dimmed: boolean;
  focused: boolean;
  onOpen: (name: string) => void;
}

export type TableNode = Node<TableData, "table">;

/* ── Table card ─────────────────────────────────────────────────────────── */

const TableNodeView = memo(function TableNodeView({
  data,
}: NodeProps<TableNode>) {
  const { table, references, referenced, dimmed, focused, onOpen } = data;
  return (
    <div
      onDoubleClick={() => onOpen(table.name)}
      className={cn(
        "overflow-hidden rounded-card border bg-surface shadow-xl shadow-black/50 transition-[opacity,border-color,box-shadow] duration-150",
        focused ? "border-accent shadow-accent/10" : "border-border-strong",
        dimmed && "opacity-30",
      )}
      style={{ width: NODE_WIDTH }}
    >
      <div
        className="flex items-center gap-2 border-b border-border bg-surface-raised px-3"
        style={{ height: HEADER_HEIGHT }}
      >
        <Table2
          className={cn(
            "size-3.5 shrink-0",
            focused ? "text-accent" : "text-fg-subtle",
          )}
        />
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-fg">
          {table.name}
        </span>
        <span className="shrink-0 text-[10px] text-fg-subtle">
          {table.kind === "table"
            ? `${table.columns.length} cols`
            : table.kind.replace("_", " ")}
        </span>
      </div>
      {table.columns.map((c) => {
        const ref = references[c.name];
        return (
          <div
            key={c.name}
            className="relative flex items-center gap-2 border-b border-border/40 px-3 font-mono text-[11px] last:border-b-0"
            style={{ height: COLUMN_HEIGHT }}
          >
            {/* Every column can be the end of a link; handles sit on both sides */}
            <Handle
              id={`${c.name}-in`}
              type="target"
              position={Position.Left}
              className={cn(
                "!size-1.5 !min-h-0 !min-w-0 !border-0",
                referenced.has(c.name) ? "!bg-warning" : "!bg-transparent",
              )}
            />
            <Handle
              id={`${c.name}-out`}
              type="source"
              position={Position.Right}
              className={cn(
                "!size-1.5 !min-h-0 !min-w-0 !border-0",
                ref ? "!bg-info" : "!bg-transparent",
              )}
            />
            {c.isPrimaryKey ? (
              <KeyRound className="size-3 shrink-0 text-key-primary" />
            ) : c.isForeignKey ? (
              <Link2 className="size-3 shrink-0 text-key-foreign" />
            ) : (
              <span className="size-3 shrink-0" />
            )}
            <span
              className={cn(
                // The name wins the space; type / reference text truncates first
                "max-w-[60%] shrink-0 truncate",
                c.isPrimaryKey ? "font-semibold text-fg" : "text-fg",
              )}
            >
              {c.name}
            </span>
            {c.nullable && !c.isPrimaryKey && (
              <span className="shrink-0 text-fg-subtle">?</span>
            )}
            <span className="ml-auto flex min-w-0 shrink items-center gap-1.5">
              {ref && <span className="truncate text-info/80">→ {ref}</span>}
              {!ref && (
                <span className="truncate text-fg-subtle">{c.dataType}</span>
              )}
              {c.isPrimaryKey && (
                <Tag className="bg-key-primary/15 text-key-primary">PK</Tag>
              )}
              {c.isForeignKey && <Tag className="bg-key-foreign/15 text-key-foreign">FK</Tag>}
            </span>
          </div>
        );
      })}
    </div>
  );
});

function Tag({ className, children }: { className: string; children: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1 py-px font-sans text-[9px] font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

export const nodeTypes = { table: TableNodeView };
