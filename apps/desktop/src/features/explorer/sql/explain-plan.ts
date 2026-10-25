/** Parsing `EXPLAIN (FORMAT JSON)` output into rows for the plan view. Pure. */

export interface PlanNode {
  "Node Type": string;
  "Relation Name"?: string;
  "Index Name"?: string;
  Alias?: string;
  "Join Type"?: string;
  "Total Cost"?: number;
  "Plan Rows"?: number;
  "Actual Rows"?: number;
  "Actual Total Time"?: number;
  "Actual Loops"?: number;
  Filter?: string;
  "Index Cond"?: string;
  "Hash Cond"?: string;
  "Join Filter"?: string;
  "Rows Removed by Filter"?: number;
  "Shared Hit Blocks"?: number;
  "Shared Read Blocks"?: number;
  Plans?: PlanNode[];
}

export interface PlanRoot {
  Plan: PlanNode;
  "Planning Time"?: number;
  "Execution Time"?: number;
}

export interface FlatNode {
  node: PlanNode;
  depth: number;
  /** Time spent in this node itself (excluding children), ms. Only with ANALYZE. */
  selfTime: number | null;
}

function flatten(node: PlanNode, depth: number, out: FlatNode[]) {
  const loops = node["Actual Loops"] ?? 1;
  const total =
    node["Actual Total Time"] !== undefined
      ? node["Actual Total Time"] * loops
      : null;
  const children = (node.Plans ?? []).reduce(
    (sum, child) =>
      sum + (child["Actual Total Time"] ?? 0) * (child["Actual Loops"] ?? 1),
    0,
  );
  out.push({
    node,
    depth,
    selfTime: total === null ? null : Math.max(0, total - children),
  });
  for (const child of node.Plans ?? []) flatten(child, depth + 1, out);
}

export interface ParsedPlan {
  root: PlanRoot;
  nodes: FlatNode[];
  /** Largest self time (ANALYZE) and total cost, for scaling the bars. */
  maxSelf: number;
  maxCost: number;
}

/** The plan as rows, or null when `planJson` isn't a plan. */
export function parsePlan(planJson: string): ParsedPlan | null {
  try {
    const roots = JSON.parse(planJson) as PlanRoot[];
    const root = roots[0];
    if (!root?.Plan) return null;
    const nodes: FlatNode[] = [];
    flatten(root.Plan, 0, nodes);
    let maxSelf = 0;
    let maxCost = 1;
    for (const n of nodes) {
      maxSelf = Math.max(maxSelf, n.selfTime ?? 0);
      maxCost = Math.max(maxCost, n.node["Total Cost"] ?? 0);
    }
    return { root, nodes, maxSelf, maxCost };
  } catch {
    return null;
  }
}
