import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { cn, EmptyState, IconButton, Select, Spinner } from "@repo/ui";
import {
  Background,
  BackgroundVariant,
  type Edge,
  Handle,
  MarkerType,
  MiniMap,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import {
  KeyRound,
  LayoutGrid,
  Link2,
  Maximize,
  Network,
  Table2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GraphRelation, GraphTable } from "../../../lib/bindings";
import { describeError } from "../../../lib/ipc";
import { useSchemaGraph } from "../explorer-context";

const NODE_WIDTH = 300;
const HEADER_HEIGHT = 40;
const COLUMN_HEIGHT = 26;

interface TableData extends Record<string, unknown> {
  table: GraphTable;
  /** column → "table.column" it references */
  references: Record<string, string>;
  /** Columns other tables point at. */
  referenced: Set<string>;
  dimmed: boolean;
  focused: boolean;
  onOpen: (name: string) => void;
}

type TableNode = Node<TableData, "table">;

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
              <KeyRound className="size-3 shrink-0 text-warning" />
            ) : c.isForeignKey ? (
              <Link2 className="size-3 shrink-0 text-info" />
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
                <Tag className="bg-warning/15 text-warning">PK</Tag>
              )}
              {c.isForeignKey && <Tag className="bg-info/15 text-info">FK</Tag>}
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

const nodeTypes = { table: TableNodeView };

/* ── Layout and saved positions ─────────────────────────────────────────── */

type Positions = Record<string, { x: number; y: number }>;

/** Lays tables out left-to-right: referenced tables first, the tables pointing at them after. */
function autoLayout(
  tables: GraphTable[],
  relations: GraphRelation[],
): Positions {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 140 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const t of tables)
    g.setNode(t.name, {
      width: NODE_WIDTH,
      height: HEADER_HEIGHT + t.columns.length * COLUMN_HEIGHT,
    });
  for (const r of relations)
    if (
      g.hasNode(r.fromTable) &&
      g.hasNode(r.toTable) &&
      r.fromTable !== r.toTable
    )
      g.setEdge(r.toTable, r.fromTable);
  dagre.layout(g);
  const out: Positions = {};
  for (const t of tables) {
    const n = g.node(t.name);
    out[t.name] = { x: n.x - n.width / 2, y: n.y - n.height / 2 };
  }
  return out;
}

const storageKey = (database: string, schema: string) =>
  `postcompass-erd:${database}.${schema}`;

function loadPositions(key: string): Positions {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") as Positions;
  } catch {
    return {};
  }
}

function savePositions(key: string, nodes: TableNode[]) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(Object.fromEntries(nodes.map((n) => [n.id, n.position]))),
    );
  } catch {
    // Positions are a convenience; the diagram works without them
  }
}

/* ── Diagram ─────────────────────────────────────────────────────────────── */

/**
 * Entity-relationship diagram of a schema: tables with their keys, and a link from each
 * foreign-key column to the exact column it references. Drag tables (positions are remembered),
 * hover or click one to focus it and its relations, double-click to open it.
 */
export function DiagramTab(props: {
  database: string;
  schema: string;
  onOpenTable: (name: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <Diagram {...props} />
    </ReactFlowProvider>
  );
}

function Diagram({
  database,
  schema,
  onOpenTable,
}: {
  database: string;
  schema: string;
  onOpenTable: (name: string) => void;
}) {
  const graph = useSchemaGraph(database, schema);
  const flow = useReactFlow();
  const key = storageKey(database, schema);
  const [nodes, setNodes, onNodesChange] = useNodesState<TableNode>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);

  const tables = useMemo(() => graph.data?.tables ?? [], [graph.data]);
  // Only links inside this schema can be drawn
  const relations = useMemo(
    () =>
      (graph.data?.relations ?? []).filter(
        (r) =>
          r.toSchema === schema && tables.some((t) => t.name === r.toTable),
      ),
    [graph.data, schema, tables],
  );

  // Build nodes when the schema loads; saved positions win over the automatic layout
  useEffect(() => {
    if (!tables.length) return setNodes([]);
    const saved = loadPositions(key);
    const auto = autoLayout(tables, relations);
    setNodes(
      tables.map((table) => {
        const refs: Record<string, string> = {};
        for (const r of relations)
          if (r.fromTable === table.name)
            r.fromColumns.forEach(
              (col, i) => (refs[col] = `${r.toTable}.${r.toColumns[i] ?? ""}`),
            );
        const referenced = new Set(
          relations
            .filter((r) => r.toTable === table.name)
            .flatMap((r) => r.toColumns),
        );
        return {
          id: table.name,
          type: "table",
          position: saved[table.name] ?? auto[table.name]!,
          data: {
            table,
            references: refs,
            referenced,
            dimmed: false,
            focused: false,
            onOpen: onOpenTable,
          },
        };
      }),
    );
    fitted.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, relations, key]);

  // Fit once React Flow has measured the tables (fitting earlier can cut some off)
  const measured = useNodesInitialized();
  const fitted = useRef(false);
  useEffect(() => {
    if (measured && !fitted.current && nodes.length) {
      fitted.current = true;
      void flow.fitView({ padding: 0.15 });
    }
  }, [measured, nodes.length, flow]);

  // Focus: the hovered (or selected) table, plus everything linked to it
  const focus = hovered ?? selected;
  const related = useMemo(() => {
    if (!focus) return null;
    const set = new Set([focus]);
    for (const r of relations) {
      if (r.fromTable === focus) set.add(r.toTable);
      if (r.toTable === focus) set.add(r.fromTable);
    }
    return set;
  }, [focus, relations]);

  const shownNodes = useMemo(
    () =>
      nodes.map((n) => {
        const dimmed = related !== null && !related.has(n.id);
        const focused = n.id === focus;
        return n.data.dimmed === dimmed && n.data.focused === focused
          ? n
          : { ...n, data: { ...n.data, dimmed, focused } };
      }),
    [nodes, related, focus],
  );

  const edges: Edge[] = useMemo(
    () =>
      relations.flatMap((r) =>
        r.fromColumns.map((col, i) => {
          const active =
            focus !== null && (r.fromTable === focus || r.toTable === focus);
          const dim = focus !== null && !active;
          const color = active
            ? "var(--color-accent)"
            : "var(--color-border-strong)";
          return {
            id: `${r.name}:${col}`,
            // From the referenced (primary key) column to the foreign-key column pointing at it
            source: r.toTable,
            sourceHandle: `${r.toColumns[i]}-out`,
            target: r.fromTable,
            targetHandle: `${col}-in`,
            type: "smoothstep",
            animated: active,
            label: active
              ? `${r.fromTable}.${col} → ${r.toTable}.${r.toColumns[i]}`
              : undefined,
            labelStyle: {
              fill: "var(--color-fg)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            },
            labelBgStyle: {
              fill: "var(--color-surface-raised)",
              stroke: "var(--color-border-strong)",
            },
            labelBgPadding: [6, 3] as [number, number],
            labelBgBorderRadius: 4,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color,
              width: 14,
              height: 14,
            },
            style: {
              stroke: color,
              strokeWidth: active ? 2 : 1.4,
              opacity: dim ? 0.15 : 1,
            },
            zIndex: active ? 10 : 0,
          } satisfies Edge;
        }),
      ),
    [relations, focus],
  );

  // Re-run the automatic layout and forget saved positions
  const arrange = useCallback(() => {
    const auto = autoLayout(tables, relations);
    setNodes((ns) =>
      ns.map((n) => ({ ...n, position: auto[n.id] ?? n.position })),
    );
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    requestAnimationFrame(
      () => void flow.fitView({ padding: 0.15, duration: 300 }),
    );
  }, [tables, relations, key, setNodes, flow]);

  if (graph.isPending)
    return (
      <div className="flex h-full items-center justify-center text-fg-subtle">
        <Spinner />
      </div>
    );
  if (graph.isError)
    return (
      <p className="p-4 text-sm text-danger">
        {describeError(graph.error).message}
      </p>
    );
  if (tables.length === 0)
    return (
      <EmptyState
        className="h-full"
        icon={<Network />}
        title={`${schema} has no tables`}
        description="Create a table to see it here."
      />
    );

  return (
    <div
      className="relative h-full w-full"
      // Soft charcoal canvas with an emerald glow in the middle, darker towards the edges
      style={{
        background:
          "radial-gradient(ellipse 60% 55% at 50% 45%, rgb(62 207 142 / 0.07), transparent 70%), radial-gradient(ellipse 100% 100% at 50% 50%, #141416 40%, #0a0a0b 100%)",
      }}
    >
      <ReactFlow
        nodes={shownNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={() =>
          // Read the latest positions, not the ones from the last render
          setNodes((ns) => {
            savePositions(key, ns);
            return ns;
          })
        }
        onNodeMouseEnter={(_, n) => setHovered(n.id)}
        onNodeMouseLeave={() => setHovered(null)}
        onNodeClick={(_, n) => setSelected((s) => (s === n.id ? null : n.id))}
        onPaneClick={() => setSelected(null)}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        // Let the canvas gradient show through
        style={{ background: "transparent" }}
        nodesConnectable={false}
        edgesFocusable={false}
        elevateEdgesOnSelect
      >
        {/* n8n-style canvas: evenly spaced, clearly visible dots */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.6}
          color="#3a3a3c"
        />

        {/* Legend */}
        <Panel position="top-left">
          <div className="flex items-center gap-4 rounded-control border border-border bg-surface/90 px-3 py-2 text-[11px] text-fg-muted backdrop-blur">
            <span className="text-fg">
              {tables.length} {tables.length === 1 ? "table" : "tables"} ·{" "}
              {relations.length}{" "}
              {relations.length === 1 ? "relation" : "relations"}
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1.5">
              <KeyRound className="size-3 text-warning" /> Primary key
            </span>
            <span className="flex items-center gap-1.5">
              <Link2 className="size-3 text-info" /> Foreign key
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-fg-subtle">?</span> Nullable
            </span>
          </div>
        </Panel>

        {/* Jump to a table */}
        <Panel position="top-right">
          <Select
            size="sm"
            mono
            aria-label="Jump to table"
            placeholder="Jump to table…"
            className="w-52 bg-surface/90 backdrop-blur"
            value=""
            align="end"
            onValueChange={(name) => {
              setSelected(name);
              void flow.fitView({
                nodes: [{ id: name }],
                padding: 0.6,
                duration: 400,
                maxZoom: 1.2,
              });
            }}
            options={tables.map((t) => ({ value: t.name, label: t.name }))}
          />
        </Panel>

        {/* Toolbar */}
        <Panel position="bottom-left">
          <div className="flex items-center gap-0.5 rounded-control border border-border bg-surface/90 p-1 backdrop-blur">
            <IconButton
              size="sm"
              label="Zoom in"
              icon={<ZoomIn />}
              onClick={() => void flow.zoomIn({ duration: 200 })}
            />
            <IconButton
              size="sm"
              label="Zoom out"
              icon={<ZoomOut />}
              onClick={() => void flow.zoomOut({ duration: 200 })}
            />
            <IconButton
              size="sm"
              label="Fit to screen"
              icon={<Maximize />}
              onClick={() =>
                void flow.fitView({ padding: 0.15, duration: 300 })
              }
            />
            <span className="mx-0.5 h-4 w-px bg-border" />
            <IconButton
              size="sm"
              label="Auto-arrange"
              icon={<LayoutGrid />}
              onClick={arrange}
            />
            <IconButton
              size="sm"
              label={showMap ? "Hide minimap" : "Show minimap"}
              icon={<Network />}
              className={showMap ? "text-accent" : undefined}
              onClick={() => setShowMap((v) => !v)}
            />
          </div>
        </Panel>

        {showMap && (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            className="!rounded-card !border !border-border !bg-surface"
            maskColor="rgb(2 2 2 / 0.65)"
            nodeColor={(n) => (n.id === focus ? "#3ecf8e" : "#2a2a2a")}
            nodeStrokeColor={(n) => (n.id === focus ? "#3ecf8e" : "#3a3a3a")}
            nodeStrokeWidth={2}
            nodeBorderRadius={4}
          />
        )}
      </ReactFlow>
    </div>
  );
}
