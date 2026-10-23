import {
  Button,
  cn,
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  Select,
  toast,
} from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { save as saveFile } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  BarChart3,
  Bookmark,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Clock,
  Database,
  Download,
  Gauge,
  History,
  Play,
  Square,
  Table2,
  Terminal,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { format as formatSql } from "sql-formatter";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ExecuteResult, ExplainResult } from "../../../lib/bindings";
import { formatBytes } from "../../../lib/format";
import { commands, describeError, unwrap } from "../../../lib/ipc";
import { DataGrid, type GridColumn } from "../data/data-grid";
import { type ExportFormat, exportRows } from "../data/export";
import {
  newRunId,
  useDatabases,
  useExplorer,
  useSchemaGraph,
} from "../explorer-context";
import { type Tab, useQueryLibrary, useWorkspace } from "../workspace-store";
import { ChartView } from "./chart-view";
import { ExplainView } from "./explain-view";
import { SqlEditor, type SqlEditorHandle } from "./sql-editor";

type QueryTabModel = Extract<Tab, { type: "query" }>;

type Run =
  | { kind: "result"; result: ExecuteResult; offset: number }
  | { kind: "failed"; message: string };

type View = "results" | "explain" | "chart";

/** "No limit" still stops at this many rows per result, to protect memory. */
const NO_LIMIT = 100_000;
const LIMITS = [100, 500, 1000, NO_LIMIT];

/** The row limit is remembered between sessions, like Supabase's. */
const useSqlPrefs = create<{
  limit: number;
  setLimit: (limit: number) => void;
}>()(
  persist((set) => ({ limit: 100, setLimit: (limit) => set({ limit }) }), {
    name: "postcompass-sql-prefs",
  }),
);

/**
 * Statements that can lose data, found the way Supabase does it: DROP, TRUNCATE and DELETE, and
 * UPDATE without a WHERE. Comments and quoted text are ignored.
 */
function destructiveIssues(sql: string) {
  const code = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, "''");
  const issues: { title: string; text: string }[] = [];
  if (/\b(drop|truncate|delete\s+from)\b/i.test(code))
    issues.push({
      title: "Query has destructive operation",
      text: "Make sure you are not accidentally removing something important.",
    });
  const updates = code
    .split(";")
    .filter((s) => /\bupdate\s+\S+\s+set\b/i.test(s));
  if (updates.some((s) => !/\bwhere\b/i.test(s)))
    issues.push({
      title: "Query uses update without a where clause",
      text: "Without a where clause, this could update all the rows in the table.",
    });
  return issues;
}

export function QueryTab({ tab }: { tab: QueryTabModel }) {
  const { serverId, connectionId } = useExplorer();
  const { updateTab, schema } = useWorkspace(serverId);
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
    issues: { title: string; text: string }[];
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
        setRunId(null);
      }
    },
  });

  const explain = useMutation({
    mutationFn: ({ text, analyze }: { text: string; analyze: boolean }) =>
      unwrap(commands.explainSql(connectionId, tab.database, text, analyze)),
  });

  const runNow = (text: string) => {
    // When running a selection, error positions are relative to it
    const offset = Math.max(0, tab.sql.indexOf(text));
    setView("results");
    execute.mutate(text, {
      onSuccess: (result) => {
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
  const start = (text: string) => {
    if (!text.trim() || execute.isPending) return;
    const issues = destructiveIssues(text);
    if (issues.length) setConfirm({ text, issues });
    else runNow(text);
  };

  const selectionOrAll = () => editor.current?.getSelection() ?? tab.sql;

  const runExplain = (analyze: boolean) => {
    const text = selectionOrAll();
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
                onClick={() => start(selectionOrAll())}
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
                  onRevealError={(position) =>
                    editor.current?.revealPosition(position)
                  }
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
          if (confirm) runNow(confirm.text);
          setConfirm(null);
        }}
      />
    </div>
  );
}

function Running() {
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

function ViewTab({
  icon,
  active,
  onClick,
  children,
}: {
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 cursor-pointer items-center gap-1.5 rounded-control px-2.5 [&_svg]:size-3.5",
        active ? "bg-surface-hover text-fg" : "text-fg-muted hover:text-fg",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** A compact dropdown in the query toolbar. */
function ToolbarPicker({
  icon,
  label,
  mono,
  heading,
  description,
  items,
  value,
  onPick,
}: {
  icon: ReactNode;
  label: string;
  mono?: boolean;
  heading: string;
  description?: string;
  items: { value: string; label: string; hint?: string }[];
  value: string;
  onPick: (value: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-7 max-w-52 cursor-pointer items-center gap-2 rounded-control border border-border-strong bg-bg px-2 text-xs hover:border-fg-subtle data-[state=open]:border-fg-subtle [&_svg]:size-3.5 [&_svg]:shrink-0"
        >
          {icon}
          <span className={cn("truncate text-fg", mono && "font-mono")}>
            {label}
          </span>
          <ChevronsUpDown className="text-fg-subtle" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>{heading}</DropdownMenuLabel>
        {description && (
          <p className="px-2 pb-1.5 text-[11px] leading-snug text-fg-subtle">
            {description}
          </p>
        )}
        <div className="max-h-72 overflow-y-auto">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.value}
              icon={
                <Check
                  className={item.value === value ? "text-accent" : "invisible"}
                />
              }
              onSelect={() => onPick(item.value)}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="truncate font-mono">{item.label}</span>
                {item.hint && (
                  <span className="shrink-0 font-sans text-[10px] text-fg-subtle">
                    {item.hint}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ResultsPanel({
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
}

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

/** How many rows each result keeps; lives in the results bar. */
function LimitMenu({
  limit,
  onChange,
}: {
  limit: number;
  onChange: (limit: number) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 hover:text-fg"
        >
          {limit === NO_LIMIT ? "No limit" : `Limit ${limit}`}
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Limit results to</DropdownMenuLabel>
        {LIMITS.map((n) => (
          <DropdownMenuItem
            key={n}
            icon={
              <Check className={n === limit ? "text-accent" : "invisible"} />
            }
            onSelect={() => onChange(n)}
          >
            {n === NO_LIMIT ? "No limit" : `${n} rows`}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Copy or download the result, like Supabase's export menu. */
function ExportMenu({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | null)[][];
}) {
  const copy = (format: ExportFormat, label: string) =>
    void navigator.clipboard
      .writeText(exportRows(format, columns, rows))
      .then(() => toast.success(`Copied ${rows.length} rows as ${label}`));
  const download = async (format: "csv" | "json") => {
    const path = await saveFile({
      defaultPath: `results.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (!path) return;
    try {
      await unwrap(
        commands.saveTextFile(path, exportRows(format, columns, rows)),
      );
      toast.success(`Downloaded ${rows.length} rows`, { description: path });
    } catch (e) {
      toast.error("Couldn't save the file", {
        description: describeError(e).message,
      });
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 hover:text-fg"
        >
          <Download className="size-3" /> Export{" "}
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => copy("csv", "CSV")}>
          Copy as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copy("json", "JSON")}>
          Copy as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copy("markdown", "Markdown")}>
          Copy as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copy("sql", "SQL")}>
          Copy as SQL INSERT
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void download("csv")}>
          Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void download("json")}>
          Download JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LibrarySidebar({
  mode,
  onMode,
  onLoad,
}: {
  mode: "history" | "saved";
  onMode: (mode: "history" | "saved") => void;
  onLoad: (sql: string) => void;
}) {
  const { serverId } = useExplorer();
  const history = useQueryLibrary((s) => s.history[serverId]) ?? [];
  const saved = useQueryLibrary((s) => s.saved[serverId]) ?? [];
  const { clearHistory, deleteSaved } = useQueryLibrary.getState();

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2 text-xs">
        {(["history", "saved"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onMode(m)}
            className={cn(
              "h-7 cursor-pointer rounded-control px-2.5 capitalize",
              mode === m
                ? "bg-surface-hover text-fg"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {m === "history"
              ? `History (${history.length})`
              : `Saved (${saved.length})`}
          </button>
        ))}
        {mode === "history" && history.length > 0 && (
          <IconButton
            size="sm"
            label="Clear history"
            icon={<Trash2 />}
            className="ml-auto"
            onClick={() => clearHistory(serverId)}
          />
        )}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1">
        {mode === "history" &&
          (history.length === 0 ? (
            <li className="p-3 text-xs text-fg-subtle">
              Queries you run show up here.
            </li>
          ) : (
            history.map((h) => (
              <li key={`${h.at}`}>
                <button
                  type="button"
                  onClick={() => onLoad(h.sql)}
                  className="flex w-full cursor-pointer flex-col gap-1 rounded-control px-2 py-1.5 text-left hover:bg-surface-hover"
                >
                  <span className="line-clamp-2 font-mono text-[11px] text-fg">
                    {h.sql}
                  </span>
                  <span className="flex gap-2 text-[10px] text-fg-subtle">
                    <span className={h.ok ? "" : "text-danger"}>
                      {h.ok ? "ok" : "error"}
                    </span>
                    <span>{h.durationMs} ms</span>
                    <span>{h.database}</span>
                    <span>{new Date(h.at).toLocaleString()}</span>
                  </span>
                </button>
              </li>
            ))
          ))}
        {mode === "saved" &&
          (saved.length === 0 ? (
            <li className="p-3 text-xs text-fg-subtle">
              Save queries with the bookmark button to reuse them.
            </li>
          ) : (
            saved.map((q) => (
              <li
                key={q.id}
                className="group flex items-start gap-1 rounded-control hover:bg-surface-hover"
              >
                <button
                  type="button"
                  onClick={() => onLoad(q.sql)}
                  className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 px-2 py-1.5 text-left"
                >
                  <span className="text-xs font-medium text-fg">{q.name}</span>
                  <span className="line-clamp-2 font-mono text-[11px] text-fg-subtle">
                    {q.sql}
                  </span>
                </button>
                <IconButton
                  size="sm"
                  label="Delete saved query"
                  icon={<Trash2 />}
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => deleteSaved(serverId, q.id)}
                />
              </li>
            ))
          ))}
      </ul>
    </aside>
  );
}

function SaveQueryDialog({
  open,
  onOpenChange,
  sql,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sql: string;
  onSaved: (id: string, name: string) => void;
}) {
  const { serverId } = useExplorer();
  const saveQuery = useQueryLibrary((s) => s.saveQuery);
  const folders = useQueryLibrary((s) => s.folders[serverId]) ?? [];
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Save query" className="w-[420px]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const id = saveQuery(
              serverId,
              name.trim(),
              sql,
              folder || undefined,
            );
            onSaved(id, name.trim());
            toast.success("Query saved");
            setName("");
            onOpenChange(false);
          }}
        >
          <Field label="Name">
            {(p) => (
              <Input
                {...p}
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Monthly revenue"
              />
            )}
          </Field>
          {folders.length > 0 && (
            <Field label="Folder">
              {(p) => (
                <Select
                  {...p}
                  value={folder || "__none__"}
                  onValueChange={(v) => setFolder(v === "__none__" ? "" : v)}
                  options={[
                    { value: "__none__", label: "No folder" },
                    ...folders.map((f) => ({ value: f, label: f })),
                  ]}
                />
              )}
            </Field>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="primary" disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
