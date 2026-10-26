import { Button, cn, EmptyState } from "@repo/ui";
import { AlertTriangle, Terminal } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import type { ExecuteResult } from "../../../../lib/bindings";
import { DataGrid, type GridColumn } from "../../data/data-grid";

export type Run =
  | { kind: "result"; result: ExecuteResult; offset: number }
  | { kind: "failed"; message: string };

export function Running() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 100);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-fg-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
      Running… {(elapsed / 1000).toFixed(1)}s
    </div>
  );
}

/** Memoized: typing in the editor re-renders the tab, but not a large result grid. */
export const ResultsPanel = memo(function ResultsPanel({
  run,
  activeResult,
  onActiveResult,
  onRevealError,
}: {
  run: Run | null;
  activeResult: number;
  onActiveResult: (index: number) => void;
  onRevealError: (position: number) => void;
}) {
  if (!run) {
    return (
      <EmptyState
        icon={<Terminal />}
        title="Run a query to see results"
        description="Results, messages and errors show up here."
      />
    );
  }
  if (run.kind === "failed")
    return <p className="p-4 text-sm text-danger">{run.message}</p>;

  const { result, offset } = run;
  const statements = result.statements;
  const current = statements[activeResult];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {statements.length > 1 && (
        <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-2 text-xs">
          {statements.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onActiveResult(i)}
              className={cn(
                "h-6 cursor-pointer rounded-control px-2",
                i === activeResult
                  ? "bg-surface-hover text-fg"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              {s.type === "rows" ? `Result ${i + 1}` : `Statement ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {result.notices.length > 0 && (
        <div className="flex max-h-24 shrink-0 flex-col gap-0.5 overflow-y-auto border-b border-border bg-surface px-3 py-2 font-mono text-[11px] text-fg-muted">
          {result.notices.map((n, i) => (
            <span key={i}>{n}</span>
          ))}
        </div>
      )}

      {result.error && (
        <div className="flex shrink-0 items-start gap-2 border-b border-danger/30 bg-danger/5 px-3 py-2.5 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium text-fg">
              {result.cancelled ? "Query cancelled" : result.error.message}
              {result.error.code && !result.cancelled && (
                <span className="ml-2 font-mono text-fg-subtle">
                  {result.error.code}
                </span>
              )}
            </span>
            {result.error.detail && (
              <span className="text-fg-muted">{result.error.detail}</span>
            )}
            {result.error.hint && (
              <span className="text-fg-muted">Hint: {result.error.hint}</span>
            )}
            {statements.length > 0 && (
              <span className="text-fg-subtle">
                {statements.length} statement(s) before the error completed.
              </span>
            )}
          </div>
          {result.error.position !== null && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRevealError(result.error!.position! + offset)}
            >
              Go to error
            </Button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {!current ? (
          !result.error && (
            <p className="p-4 text-sm text-fg-muted">
              Success. No rows returned.
            </p>
          )
        ) : current.type === "command" ? (
          <p className="p-4 text-sm text-fg-muted">
            Success.{" "}
            <span className="font-mono text-fg">
              {(current.rowsAffected ?? 0).toLocaleString()}
            </span>{" "}
            row(s) affected.
          </p>
        ) : (
          <ResultGrid columns={current.columns} rows={current.rows} />
        )}
      </div>
    </div>
  );
});

function ResultGrid({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | null)[][];
}) {
  // Duplicate column names (e.g. two "id"s from a join) need unique ids
  const gridColumns: GridColumn[] = useMemo(
    () => columns.map((name, i) => ({ id: `${i}:${name}`, name })),
    [columns],
  );
  const gridRows = useMemo(
    () => rows.map((cells, i) => ({ id: String(i), cells })),
    [rows],
  );
  return (
    <DataGrid
      columns={gridColumns}
      rows={gridRows}
      empty={
        <p className="text-sm text-fg-muted">The query returned no rows</p>
      }
    />
  );
}
