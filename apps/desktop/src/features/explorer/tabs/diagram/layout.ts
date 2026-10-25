/** ER diagram layout and remembered positions. Pure apart from localStorage. */
import dagre from "@dagrejs/dagre";
import type { GraphRelation, GraphTable } from "../../../../lib/bindings";

export const NODE_WIDTH = 300;
export const HEADER_HEIGHT = 40;
export const COLUMN_HEIGHT = 26;

export type Positions = Record<string, { x: number; y: number }>;

/** Lays tables out left-to-right: referenced tables first, the tables pointing at them after. */
export function autoLayout(
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

export const storageKey = (database: string, schema: string) =>
  `postcompass-erd:${database}.${schema}`;

export function loadPositions(key: string): Positions {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") as Positions;
  } catch {
    return {};
  }
}

export function savePositions(
  key: string,
  nodes: { id: string; position: { x: number; y: number } }[],
) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(Object.fromEntries(nodes.map((n) => [n.id, n.position]))),
    );
  } catch {
    // Positions are a convenience; the diagram works without them
  }
}


/** Links drawable inside `schema`: those whose target table is in it. */
export function schemaRelations(
  tables: GraphTable[],
  relations: GraphRelation[],
  schema: string,
) {
  const names = new Set(tables.map((t) => t.name));
  return relations.filter((r) => r.toSchema === schema && names.has(r.toTable));
}

/** Per table: column → "table.column" it references, and the columns others point at. */
export function columnLinks(table: string, relations: GraphRelation[]) {
  const references: Record<string, string> = {};
  const referenced = new Set<string>();
  for (const r of relations) {
    if (r.fromTable === table)
      r.fromColumns.forEach(
        (col, i) => (references[col] = `${r.toTable}.${r.toColumns[i] ?? ""}`),
      );
    if (r.toTable === table) for (const c of r.toColumns) referenced.add(c);
  }
  return { references, referenced };
}
