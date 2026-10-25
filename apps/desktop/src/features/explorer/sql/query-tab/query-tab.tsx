import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  toast,
} from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Bookmark,
  Clock,
  Database,
  Gauge,
  History,
  Play,
  Square,
  Table2,
  WandSparkles,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { format as formatSql } from "sql-formatter";
import type { ExplainResult } from "../../../../lib/bindings";
import { formatBytes } from "../../../../lib/format";
import { commands, describeError, unwrap } from "../../../../lib/ipc";
import { queryKeys } from "../../../../lib/query";
import {
  newRunId,
  useDatabases,
  useExplorer,
  useSchemaGraph,
} from "../../explorer-context";
import { type Tab, useQueryLibrary, useWorkspaceActions, useWorkspaceStore } from "../../workspace-store";
import { ChartView } from "../chart-view";
import { ExplainView } from "../explain-view";
import { SqlEditor, type SqlEditorHandle } from "../sql-editor";
import { changeScope, destructiveIssues, type SqlIssue } from "../statements";
import { LibrarySidebar, SaveQueryDialog } from "./library-sidebar";
import { useSqlPrefs } from "./prefs";
import { ResultsPanel, type Run, Running } from "./results-panel";
import { ExportMenu, LimitMenu, ToolbarPicker, ViewTab } from "./toolbar";

type QueryTabModel = Extract<Tab, { type: "query" }>;

type View = "results" | "explain" | "chart";

export function QueryTab({ tab }: { tab: QueryTabModel }) {
  const { serverId, connectionId } = useExplorer();
  const queryClient = useQueryClient();
  // Only the schema and actions: subscribing to the whole workspace re-rendered this tab on every keystroke elsewhere
  const { updateTab } = useWorkspaceActions(serverId);
  const schema = useWorkspaceStore((s) => s.workspaces[serverId]?.schema ?? null);
  const databases = useDatabases();
  const graph = useSchemaGraph(tab.database, schema);
  const addHistory = useQueryLibrary((s) => s.addHistory);
  const updateSaved = useQueryLibrary((s) => s.updateSaved);
  const savedName = useQueryLibrary(
    (s) => s.saved[serverId]?.find((q) => q.id === tab.savedId)?.name,
  );
  const limit = useSqlPrefs((s) => s.limit);
  const setLimit = useSqlPrefs((s) => s.setLimit);
  const editor = useRef<SqlEditorHandle>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [plan, setPlan] = useState<ExplainResult | null>(null);
  const [view, setView] = useState<View>("results");
  const [activeResult, setActiveResult] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [sidebar, setSidebar] = useState<"history" | "saved" | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    text: string;
    offset: number;
    issues: SqlIssue[];
  } | null>(null);
  const [editorHeight, setEditorHeight] = useState(45);

  // Autocomplete: tables and columns of the current schema
  const completion = useMemo(
    () =>
      Object.fromEntries(
        (graph.data?.tables ?? []).map((t) => [
          t.name,
          t.columns.map((c) => c.name),
        ]),
      ),
    [graph.data],
  );

  // Set synchronously: two quick Ctrl+Enters would otherwise both start before isPending updates
  const running = useRef(false);
  const execute = useMutation({
    mutationFn: async (text: string) => {
      const id = newRunId();
      setRunId(id);
      try {
        return await unwrap(
          commands.executeSql(
            connectionId,
            tab.database,
            text,
            id,
            limit,
            null,
          ),
        );
      } finally {
        running.current = false;
        setRunId(null);
      }
    },
  });

  const explain = useMutation({
    mutationFn: ({ text, analyze }: { text: string; analyze: boolean }) =>
      unwrap(commands.explainSql(connectionId, tab.database, text, analyze)),
  });

  /** `offset`: where `text` starts in the editor, since error positions are relative to it. */
  const runNow = (text: string, offset: number) => {
    if (running.current) return;
    running.current = true;
    setView("results");
    execute.mutate(text, {
      onSuccess: (result) => {
        // DDL / writes from the editor: refresh the tree, open tables and autocomplete
        const scope = result.statements.length ? changeScope(text) : null;
        if (scope)
          void queryClient.invalidateQueries({
            queryKey:
              scope === "server"
                ? queryKeys.explorer.all(connectionId)
                : queryKeys.explorer.database(connectionId, tab.database),
          });
        setRun({ kind: "result", result, offset });
        setActiveResult(
          Math.max(
            0,
            result.statements.findIndex((s) => s.type === "rows"),
          ),
        );
        addHistory(serverId, {
          sql: text.trim(),
          database: tab.database,
          at: Date.now(),
          durationMs: result.durationMs,
          ok: !result.error,
        });
      },
      onError: (e) =>
        setRun({ kind: "failed", message: describeError(e).message }),
    });
  };

  /** Runs `text`, asking first if it could lose data. */
  const start = (text: string, offset: number) => {
    if (!text.trim() || running.current) return;
    const issues = destructiveIssues(text);
    if (issues.length) setConfirm({ text, offset, issues });
    else runNow(text, offset);
  };

  /** The Run button: the selection (with its offset), else everything. */
  const runSelectionOrAll = () => {
    const selection = editor.current?.getSelection()
      ? editor.current.getSelectionOrStatement()
      : null;
    if (selection) start(selection.text, selection.from);
    else start(tab.sql, 0);
  };

  const runExplain = (analyze: boolean) => {
    // EXPLAIN takes one statement: the selection, else the one under the cursor
    const text =
      editor.current?.getSelectionOrStatement()?.text ??
      (editor.current ? "" : tab.sql);
    if (!text.trim()) return;
    setView("explain");
    explain.mutate(
      { text, analyze },
      {
        onSuccess: setPlan,
        onError: (e) => {
          setPlan(null);
          toast.error("Couldn't explain the query", {
            description: describeError(e).message,
          });
        },
      },
    );
  };

  const revealError = useCallback(
    (position: number) => editor.current?.revealPosition(position),
    [],
  );

  const cancel = () => runId && void commands.cancelSql(runId);

  const prettify = () => {
    try {
      updateTab(tab.id, {
        sql: formatSql(tab.sql, {
          language: "postgresql",
          keywordCase: "preserve",
        }),
      });
    } catch (e) {
      toast.error("Couldn't format this SQL", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const save = () => {
    if (tab.savedId) {
      updateSaved(serverId, tab.savedId, { sql: tab.sql });
      toast.success(`Saved ${savedName ?? "query"}`);
    } else setSaveOpen(true);
  };

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault();
    const container = (
      event.currentTarget.parentElement as HTMLElement
    ).getBoundingClientRect();
    const move = (e: MouseEvent) =>
      setEditorHeight(
        Math.min(
          80,
          Math.max(15, ((e.clientY - container.top) / container.height) * 100),
        ),
      );
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const busy = execute.isPending || explain.isPending;
  const current =
    run?.kind === "result" ? run.result.statements[activeResult] : undefined;

  return (
    <div
      className="flex h-full min-h-0"
      onKeyDown={(e) => {
        if (e.key.toLowerCase() === "s" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          if (tab.sql.trim()) save();
        }
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar: where and how it runs on the left, actions on the right */}
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-2">
          <ToolbarPicker
            icon={<Database className="text-accent" />}
            label={tab.database}
            mono
            heading="Run in database"
            items={(
              databases.data ?? [
                { name: tab.database, sizeBytes: null, allowConnections: true },
              ]
            )
              .filter((d) => d.allowConnections)
              .map((d) => ({
                value: d.name,
                label: d.name,
                hint: d.sizeBytes ? formatBytes(d.sizeBytes) : undefined,
              }))}
            value={tab.database}
            onPick={(database) => updateTab(tab.id, { database })}
          />

          <div className="ml-auto flex items-center gap-1">
            <IconButton
              size="sm"
              label="Prettify SQL"
              icon={<WandSparkles />}
              onClick={prettify}
              disabled={!tab.sql.trim()}
            />
            <IconButton
              size="sm"
              label={tab.savedId ? "Save (Ctrl+S)" : "Save query (Ctrl+S)"}
              icon={
                <Bookmark
                  className={tab.savedId ? "fill-current" : undefined}
                />
              }
              onClick={save}
              disabled={!tab.sql.trim()}
            />
            <IconButton
              size="sm"
              label="History & saved queries"
              icon={<History />}
              className={sidebar ? "text-accent" : undefined}
              onClick={() => setSidebar((s) => (s ? null : "history"))}
            />
            <span className="mx-1 h-4 w-px bg-border" />
            {execute.isPending ? (
              <Button
                size="sm"
                variant="danger"
                iconLeft={<Square />}
                onClick={cancel}
              >
                Cancel
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                iconLeft={<Play />}
                disabled={busy}
                onClick={runSelectionOrAll}
              >
                Run
                <span className="ml-1 font-mono text-[10px] font-normal opacity-60">
                  Ctrl ↵
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* Editor + results */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div style={{ height: `${editorHeight}%` }} className="min-h-0">
            <SqlEditor
              ref={editor}
              value={tab.sql}
              onChange={(sql) => updateTab(tab.id, { sql })}
              onRun={start}
              schema={completion}
              defaultSchema={schema ?? undefined}
              placeholder="Write SQL here. Ctrl+Enter runs it (or just the selected part)."
              autoFocus
            />
          </div>
          <div
            className="h-1.5 shrink-0 cursor-row-resize border-y border-border bg-surface hover:bg-accent/30"
            onMouseDown={startResize}
          />
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Results / Explain / Chart, like Supabase */}
            <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2 text-xs">
              <ViewTab
                icon={<Table2 />}
                active={view === "results"}
                onClick={() => setView("results")}
              >
                Results
              </ViewTab>
              <ViewTab
                icon={<Gauge />}
                active={view === "explain"}
                onClick={() => {
                  setView("explain");
                  if (!plan && !explain.isPending && tab.sql.trim())
                    runExplain(false);
                }}
              >
                Explain
              </ViewTab>
              <ViewTab
                icon={<BarChart3 />}
                active={view === "chart"}
                onClick={() => setView("chart")}
              >
                Chart
              </ViewTab>
              <span className="ml-auto flex items-center gap-3 text-fg-subtle">
                {view === "explain" ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => runExplain(false)}
                    >
                      Explain
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => runExplain(true)}
                    >
                      Explain analyze
                    </Button>
                  </>
                ) : (
                  <>
                    <LimitMenu limit={limit} onChange={setLimit} />
                    {current?.type === "rows" && (
                      <>
                        <span className="font-mono">
                          {(current.rowCount ?? 0).toLocaleString()} row
                          {current.rowCount === 1 ? "" : "s"}
                          {current.truncated &&
                            ` (showing first ${current.rows.length.toLocaleString()})`}
                        </span>
                        <ExportMenu
                          columns={current.columns}
                          rows={current.rows}
                        />
                      </>
                    )}
                    {run?.kind === "result" && (
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="size-3" />
                        {run.result.durationMs} ms
                      </span>
                    )}
                  </>
                )}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              {view === "explain" ? (
                explain.isPending ? (
                  <Running />
                ) : plan ? (
                  <ExplainView
                    planJson={plan.planJson}
                    analyzed={plan.analyzed}
                  />
                ) : (
                  <EmptyState
                    icon={<Gauge />}
                    title="See how Postgres runs your query"
                    description="Explain shows the plan with estimated costs. Explain analyze runs it for real timings, then rolls back."
                  />
                )
              ) : execute.isPending ? (
                <Running />
              ) : view === "chart" ? (
                current?.type === "rows" ? (
                  <ChartView
                    key={current.columns.join(",")}
                    columns={current.columns}
                    rows={current.rows}
                  />
                ) : (
                  <EmptyState
                    icon={<BarChart3 />}
                    title="Run a query that returns rows to chart it"
                    description="Pick a column for the X axis and a number column for the Y axis."
                  />
                )
              ) : (
                <ResultsPanel
                  run={run}
                  activeResult={activeResult}
                  onActiveResult={setActiveResult}
                  onRevealError={revealError}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {sidebar && (
        <LibrarySidebar
          mode={sidebar}
          onMode={setSidebar}
          onLoad={(sql) => {
            updateTab(tab.id, { sql });
            editor.current?.focus();
          }}
        />
      )}

      <SaveQueryDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        sql={tab.sql}
        onSaved={(id, name) => updateTab(tab.id, { savedId: id, title: name })}
      />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Potential issue detected with your query"
        description={
          <span className="flex flex-col gap-3 pt-1">
            {confirm?.issues.map((issue) => (
              <span key={issue.title} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-fg">{issue.title}</span>
                  <span>{issue.text}</span>
                </span>
              </span>
            ))}
            <span>
              Please confirm that you would like to execute this query.
            </span>
          </span>
        }
        confirmLabel="Run this query"
        destructive
        onConfirm={() => {
          if (confirm) runNow(confirm.text, confirm.offset);
          setConfirm(null);
        }}
      />
    </div>
  );
}
