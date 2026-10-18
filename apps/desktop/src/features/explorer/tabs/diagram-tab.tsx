import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { EmptyState, Spinner } from "@repo/ui";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  Handle,
  MiniMap,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
import { KeyRound, Link2, Network } from "lucide-react";
import { memo, useMemo } from "react";
import type { GraphTable } from "../../../lib/bindings";
import { describeError } from "../../../lib/ipc";
import { useSchemaGraph } from "../explorer-context";

const NODE_WIDTH = 240;
const HEADER_HEIGHT = 34;
const COLUMN_HEIGHT = 22;

type TableNode = Node<{ table: GraphTable; onOpen: (name: string) => void }, "table">;

const TableNodeView = memo(function TableNodeView({ data }: NodeProps<TableNode>) {
  const { table, onOpen } = data;
  return (
    <div
      className="overflow-hidden rounded-card border border-border-strong bg-surface shadow-lg shadow-black/40"
      style={{ width: NODE_WIDTH }}
      onDoubleClick={() => onOpen(table.name)}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-accent" />
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-accent" />
      <div
        className="flex items-center justify-between border-b border-border bg-surface-raised px-3"
        style={{ height: HEADER_HEIGHT }}
      >
        <span className="truncate font-mono text-xs font-semibold text-fg">{table.name}</span>
        {table.kind !== "table" && <span className="text-[10px] text-fg-subtle">{table.kind.replace("_", " ")}</span>}
      </div>
      {table.columns.map((c) => (
        <div key={c.name} className="flex items-center gap-1.5 px-3 font-mono text-[11px]" style={{ height: COLUMN_HEIGHT }}>
          {c.isPrimaryKey ? (
            <KeyRound className="size-3 shrink-0 text-warning" />
          ) : c.isForeignKey ? (
            <Link2 className="size-3 shrink-0 text-info" />
          ) : (
            <span className="size-3 shrink-0" />
          )}
          <span className="truncate text-fg">{c.name}</span>
          <span className="ml-auto truncate text-fg-subtle">{c.dataType}</span>
        </div>
      ))}
    </div>
  );
});

const nodeTypes = { table: TableNodeView };

/** Lays tables out left-to-right so references flow in one direction. */
function layout(tables: GraphTable[], relations: { from: string; to: string }[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 90 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const t of tables) {
    g.setNode(t.name, { width: NODE_WIDTH, height: HEADER_HEIGHT + t.columns.length * COLUMN_HEIGHT });
  }
  for (const r of relations) if (g.hasNode(r.from) && g.hasNode(r.to)) g.setEdge(r.to, r.from);
  dagre.layout(g);
  return (name: string) => {
    const n = g.node(name);
    return { x: n.x - n.width / 2, y: n.y - n.height / 2 };
  };
}

/** Entity-relationship diagram of a schema. Double-click a table to open it. */
export function DiagramTab({
  database,
  schema,
  onOpenTable,
}: {
  database: string;
  schema: string;
  onOpenTable: (name: string) => void;
}) {
  const graph = useSchemaGraph(database, schema);

  const { nodes, edges } = useMemo(() => {
    if (!graph.data) return { nodes: [], edges: [] };
    const local = graph.data.relations.filter((r) => r.toSchema === schema);
    const position = layout(
      graph.data.tables,
      local.map((r) => ({ from: r.fromTable, to: r.toTable })),
    );
    const nodes: TableNode[] = graph.data.tables.map((table) => ({
      id: table.name,
      type: "table",
      position: position(table.name),
      data: { table, onOpen: onOpenTable },
    }));
    const edges: Edge[] = local.map((r) => ({
      id: `${r.fromTable}.${r.name}`,
      source: r.toTable,
      target: r.fromTable,
      label: `${r.fromColumns.join(", ")} → ${r.toColumns.join(", ")}`,
      labelStyle: { fill: "var(--color-fg-muted)", fontSize: 10, fontFamily: "var(--font-mono)" },
      labelBgStyle: { fill: "var(--color-bg)" },
      style: { stroke: "var(--color-border-strong)", strokeWidth: 1.5 },
      animated: false,
    }));
    return { nodes, edges };
  }, [graph.data, schema, onOpenTable]);

  if (graph.isPending) {
    return (
      <div className="flex h-full items-center justify-center text-fg-subtle">
        <Spinner />
      </div>
    );
  }
  if (graph.isError) return <p className="p-4 text-sm text-danger">{describeError(graph.error).message}</p>;
  if (nodes.length === 0) {
    return <EmptyState icon={<Network />} title={`${schema} has no tables`} description="Create a table to see it here." />;
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        nodesConnectable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1f1f1f" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable maskColor="rgb(2 2 2 / 0.7)" nodeColor="#171717" />
      </ReactFlow>
    </div>
  );
}
