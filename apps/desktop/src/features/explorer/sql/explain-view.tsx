import { Badge, cn } from "@repo/ui";
import { useMemo } from "react";

interface PlanNode {
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

interface PlanRoot {
  Plan: PlanNode;
  "Planning Time"?: number;
  "Execution Time"?: number;
}

interface FlatNode {
  node: PlanNode;
  depth: number;
  /** Time spent in this node itself (excluding children), ms. Only with ANALYZE. */
  selfTime: number | null;
}

function flatten(node: PlanNode, depth: number, out: FlatNode[]) {
  const loops = node["Actual Loops"] ?? 1;
  const total = node["Actual Total Time"] !== undefined ? node["Actual Total Time"] * loops : null;
  const children = (node.Plans ?? []).reduce(
    (sum, child) => sum + (child["Actual Total Time"] ?? 0) * (child["Actual Loops"] ?? 1),
    0,
  );
  out.push({ node, depth, selfTime: total === null ? null : Math.max(0, total - children) });
  for (const child of node.Plans ?? []) flatten(child, depth + 1, out);
}

/** Visual EXPLAIN plan: an indented tree with time bars; the slowest step is highlighted. */
export function ExplainView({ planJson, analyzed }: { planJson: string; analyzed: boolean }) {
  const parsed = useMemo(() => {
    try {
      const roots = JSON.parse(planJson) as PlanRoot[];
      const root = roots[0]!;
      const nodes: FlatNode[] = [];
      flatten(root.Plan, 0, nodes);
      return { root, nodes };
    } catch {
      return null;
    }
  }, [planJson]);

  if (!parsed) return <pre className="p-4 font-mono text-xs text-fg-muted">{planJson}</pre>;

  const { root, nodes } = parsed;
  const maxSelf = Math.max(0, ...nodes.map((n) => n.selfTime ?? 0));
  const maxCost = Math.max(1, ...nodes.map((n) => n.node["Total Cost"] ?? 0));

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex shrink-0 items-center gap-4 border-b border-border px-4 py-2 text-xs text-fg-muted">
        <Badge variant={analyzed ? "accent" : "neutral"}>{analyzed ? "EXPLAIN ANALYZE" : "EXPLAIN"}</Badge>
        {root["Planning Time"] !== undefined && <span>Planning {root["Planning Time"].toFixed(2)} ms</span>}
        {root["Execution Time"] !== undefined && (
          <span className="text-fg">Execution {root["Execution Time"].toFixed(2)} ms</span>
        )}
        {analyzed && <span className="text-fg-subtle">The statement ran inside a transaction that was rolled back.</span>}
      </div>
      <div className="flex flex-col py-2">
        {nodes.map(({ node, depth, selfTime }, index) => {
          const hottest = analyzed && selfTime !== null && selfTime === maxSelf && maxSelf > 0;
          const share = analyzed ? (maxSelf ? (selfTime ?? 0) / maxSelf : 0) : (node["Total Cost"] ?? 0) / maxCost;
          const target = node["Relation Name"]
            ? `${node["Relation Name"]}${node.Alias && node.Alias !== node["Relation Name"] ? ` ${node.Alias}` : ""}`
            : null;
          const condition = node["Index Cond"] ?? node["Hash Cond"] ?? node["Join Filter"] ?? node.Filter;
          const misestimate =
            node["Actual Rows"] !== undefined && node["Plan Rows"] !== undefined && node["Plan Rows"] > 0
              ? node["Actual Rows"] / node["Plan Rows"]
              : null;
          return (
            <div
              key={index}
              className={cn("flex items-start gap-3 px-4 py-1.5 hover:bg-surface-hover/50", hottest && "bg-warning/5")}
              style={{ paddingLeft: 16 + depth * 20 }}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2 text-xs">
                  {depth > 0 && <span className="text-fg-subtle">└</span>}
                  <span className={cn("font-medium", hottest ? "text-warning" : "text-fg")}>
                    {node["Join Type"] ? `${node["Join Type"]} ` : ""}
                    {node["Node Type"]}
                  </span>
                  {target && <span className="font-mono text-fg-muted">on {target}</span>}
                  {node["Index Name"] && <span className="font-mono text-fg-muted">using {node["Index Name"]}</span>}
                  {hottest && <Badge variant="warning">slowest step</Badge>}
                </div>
                {condition && <span className="truncate font-mono text-[11px] text-fg-subtle">{condition}</span>}
                {node["Rows Removed by Filter"] !== undefined && node["Rows Removed by Filter"] > 0 && (
                  <span className="text-[11px] text-fg-subtle">
                    {node["Rows Removed by Filter"].toLocaleString()} rows removed by filter
                  </span>
                )}
              </div>
              <div className="flex w-[360px] shrink-0 items-center gap-3 font-mono text-[11px] text-fg-muted">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className={cn("h-full rounded-full", hottest ? "bg-warning" : "bg-accent/70")}
                    style={{ width: `${Math.max(2, share * 100)}%` }}
                  />
                </div>
                {analyzed ? (
                  <>
                    <span className="w-20 text-right">{(selfTime ?? 0).toFixed(2)} ms</span>
                    <span
                      className={cn(
                        "w-28 text-right",
                        misestimate !== null && (misestimate > 10 || misestimate < 0.1) && "text-warning",
                      )}
                      title="Actual rows / estimated rows"
                    >
                      {node["Actual Rows"]?.toLocaleString()} / {node["Plan Rows"]?.toLocaleString()} rows
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-20 text-right">cost {node["Total Cost"]?.toFixed(1)}</span>
                    <span className="w-28 text-right">{node["Plan Rows"]?.toLocaleString()} rows</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
