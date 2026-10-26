import "@xyflow/react/dist/style.css";
import { EmptyState, IconButton, Select, Spinner } from "@repo/ui";
import {
  Background,
  BackgroundVariant,
  type Edge,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import {
  KeyRound,
  Link2,
  LayoutGrid,
  Maximize,
  Network,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSchemaGraph } from "../../explorer-context";
import { LoadError } from "../../load-error";
import {
  autoLayout,
  columnLinks,
  loadPositions,
  savePositions,
  schemaRelations,
  storageKey,
} from "./layout";
import { MiniHover, MiniTable } from "./mini-table";
import { nodeTypes, type TableData, type TableNode } from "./table-node";

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
  // The minimap starts hidden; the toolbar button shows it
  const [showMap, setShowMap] = useState(false);
  const [miniHover, setMiniHover] = useState<string | null>(null);

  const tables = useMemo(() => graph.data?.tables ?? [], [graph.data]);
  // Only links inside this schema can be drawn
  const relations = useMemo(
    () => schemaRelations(tables, graph.data?.relations ?? [], schema),
    [graph.data, schema, tables],
  );

  // Nodes are built once per schema load; a ref keeps their double-click handler current
  const openTable = useRef(onOpenTable);
  useEffect(() => {
    openTable.current = onOpenTable;
  });
  const onOpen = useCallback((name: string) => openTable.current(name), []);

  const fitted = useRef(false);

  // Build nodes when the schema loads; saved positions win over the automatic layout
  useEffect(() => {
    if (!tables.length) return setNodes([]);
    const saved = loadPositions(key);
    // Dagre is the slow part; skip it when every table has a remembered position
    const auto = tables.every((t) => saved[t.name])
      ? {}
      : autoLayout(tables, relations);
    setNodes(
      tables.map((table) => ({
        id: table.name,
        type: "table",
        position: saved[table.name] ?? auto[table.name]!,
        data: {
          table,
          ...columnLinks(table.name, relations),
          dimmed: false,
          focused: false,
          onOpen,
        },
      })),
    );
    fitted.current = false;
  }, [tables, relations, key, onOpen, setNodes]);

  // Fit once React Flow has measured the tables (fitting earlier can cut some off)
  const measured = useNodesInitialized();
  useEffect(() => {
    if (measured && !fitted.current && nodes.length) {
      fitted.current = true;
      void flow.fitView({ padding: 0.15 });
    }
  }, [measured, nodes.length, flow]);

  // Focus: the hovered (or selected) table, plus everything linked to it
  const focus = hovered ?? miniHover ?? selected;
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
            // Constraint names are only unique per table
            id: `${r.fromTable}:${r.name}:${col}`,
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
  if (graph.isError) return <LoadError query={graph} />;
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
      // Soft charcoal canvas with an accent glow in the middle, darker towards the edges
      style={{
        background:
          "radial-gradient(ellipse 60% 55% at 50% 45%, color-mix(in srgb, var(--color-accent) 7%, transparent), transparent 70%), radial-gradient(ellipse 100% 100% at 50% 50%, #141416 40%, #0a0a0b 100%)",
      }}
    >
      <ReactFlow
        nodes={shownNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        // The latest positions, not the ones from the last render
        onNodeDragStop={() => savePositions(key, flow.getNodes())}
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
              <KeyRound className="size-3 text-key-primary" /> Primary key
            </span>
            <span className="flex items-center gap-1.5">
              <Link2 className="size-3 text-key-foreign" /> Foreign key
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
          <Panel position="bottom-right" className="!m-3">
            <div className="overflow-hidden rounded-card border border-border bg-surface/95 shadow-xl shadow-black/50 backdrop-blur">
              <div className="flex h-7 items-center gap-1.5 border-b border-border px-2.5 text-[10px] text-fg-subtle">
                <span className="font-medium tracking-wide uppercase">
                  Overview
                </span>
                {miniHover && (
                  <>
                    <span>·</span>
                    <span className="truncate font-mono text-[11px] text-accent">
                      {miniHover}
                    </span>
                  </>
                )}
              </div>
              <MiniHover.Provider value={setMiniHover}>
                <MiniMap
                  pannable
                  zoomable
                  // Rendered inside our own frame instead of React Flow's corner box
                  style={{
                    position: "static",
                    margin: 0,
                    width: 220,
                    height: 140,
                    background: "transparent",
                  }}
                  maskColor="rgb(10 10 11 / 0.7)"
                  maskStrokeColor="var(--color-accent)"
                  maskStrokeWidth={1.5}
                  // The colour carries the node's state; MiniTable draws it
                  nodeColor={(n) =>
                    n.id === focus
                      ? "focus"
                      : (n.data as TableData).table.kind === "table"
                        ? "table"
                        : "view"
                  }
                  nodeComponent={MiniTable}
                />
              </MiniHover.Provider>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
