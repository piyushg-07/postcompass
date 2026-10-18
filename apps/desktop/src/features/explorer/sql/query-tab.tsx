import {
  Button,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  Kbd,
  NativeSelect,
  toast,
} from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bookmark,
  ChevronDown,
  Clock,
  Copy,
  Gauge,
  History,
  Play,
  Square,
  Terminal,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ExecuteResult, ExplainResult } from "../../../lib/bindings";
import { commands, describeError, unwrap } from "../../../lib/ipc";
import { DataGrid, type GridColumn } from "../data/data-grid";
import { type ExportFormat, exportRows } from "../data/export";
import { newRunId, useDatabases, useExplorer, useSchemaGraph } from "../explorer-context";
import { type Tab, useQueryLibrary, useWorkspace } from "../workspace-store";
import { ExplainView } from "./explain-view";
import { SqlEditor, type SqlEditorHandle } from "./sql-editor";

type QueryTabModel = Extract<Tab, { type: "query" }>;

type Output =
  | { kind: "result"; result: ExecuteResult; offset: number }
  | { kind: "plan"; plan: ExplainResult }
  | { kind: "failed"; message: string };

export function QueryTab({ tab }: { tab: QueryTabModel }) {
  const { serverId, connectionId } = useExplorer();
  const { updateTab, schema } = useWorkspace(serverId);
  const databases = useDatabases();
  const graph = useSchemaGraph(tab.database, schema);
  const addHistory = useQueryLibrary((s) => s.addHistory);
  const editor = useRef<SqlEditorHandle>(null);
  const [output, setOutput] = useState<Output | null>(null);
  const [activeResult, setActiveResult] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [sidebar, setSidebar] = useState<"history" | "saved" | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [editorHeight, setEditorHeight] = useState(45);

  // Autocomplete: tables and columns of the current schema
  const completion = useMemo(
    () => Object.fromEntries((graph.data?.tables ?? []).map((t) => [t.name, t.columns.map((c) => c.name)])),
    [graph.data],
  );

  const execute = useMutation({
    mutationFn: async (text: string) => {
      const id = newRunId();
      setRunId(id);
      try {
        return await unwrap(commands.executeSql(connectionId, tab.database, text, id));
      } finally {
        setRunId(null);
      }
    },
  });

  const explain = useMutation({
    mutationFn: ({ text, analyze }: { text: string; analyze: boolean }) =>
      unwrap(commands.explainSql(connectionId, tab.database, text, analyze)),
  });

  const run = (text: string) => {
    if (!text.trim() || execute.isPending) return;
    // When running a selection, error positions are relative to it
    const offset = Math.max(0, tab.sql.indexOf(text));
    execute.mutate(text, {
      onSuccess: (result) => {
        setOutput({ kind: "result", result, offset });
        setActiveResult(Math.max(0, result.statements.findIndex((s) => s.type === "rows")));
        addHistory(serverId, {
          sql: text.trim(),
          database: tab.database,
          at: Date.now(),
          durationMs: result.durationMs,
          ok: !result.error,
        });
      },
      onError: (e) => setOutput({ kind: "failed", message: describeError(e).message }),
    });
  };

  const runCurrent = () => run(editor.current?.getSelection() ?? tab.sql);

  const runExplain = (analyze: boolean) => {
    const text = editor.current?.getSelection() ?? tab.sql;
    if (!text.trim()) return;
    explain.mutate(
      { text, analyze },
      {
        onSuccess: (plan) => setOutput({ kind: "plan", plan }),
        onError: (e) => setOutput({ kind: "failed", message: describeError(e).message }),
      },
    );
  };

  const cancel = () => runId && void commands.cancelSql(runId);

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault();
    const container = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const move = (e: MouseEvent) =>
      setEditorHeight(Math.min(80, Math.max(15, ((e.clientY - container.top) / container.height) * 100)));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const busy = execute.isPending || explain.isPending;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border px-2">
          {execute.isPending ? (
            <Button size="sm" variant="danger" iconLeft={<Square />} onClick={cancel}>
              Cancel
            </Button>
          ) : (
            <Button size="sm" variant="primary" iconLeft={<Play />} disabled={busy} onClick={runCurrent}>
              Run
            </Button>
          )}
          <span className="hidden items-center gap-0.5 text-[10px] text-fg-subtle lg:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>↵</Kbd>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" iconLeft={<Gauge />} iconRight={<ChevronDown />} disabled={busy}>
                Explain
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => runExplain(false)}>Explain (estimate only)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => runExplain(true)}>Explain analyze (runs, then rolls back)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="mx-1 h-4 w-px bg-border" />
          <NativeSelect
            aria-label="Database"
            className="h-7 w-44 font-mono text-xs"
            value={tab.database}
            onChange={(e) => updateTab(tab.id, { database: e.target.value })}
          >
            {(databases.data ?? [{ name: tab.database }]).map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
          <div className="ml-auto flex items-center gap-0.5">
            <IconButton size="sm" label="Save query" icon={<Bookmark />} onClick={() => setSaveOpen(true)} disabled={!tab.sql.trim()} />
            <IconButton
              size="sm"
              label="History & saved queries"
              icon={<History />}
              className={sidebar ? "text-accent" : undefined}
              onClick={() => setSidebar((s) => (s ? null : "history"))}
            />
          </div>
        </div>

        {/* Editor + results */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div style={{ height: `${editorHeight}%` }} className="min-h-0">
            <SqlEditor
              ref={editor}
              value={tab.sql}
              onChange={(sql) => updateTab(tab.id, { sql })}
              onRun={run}
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
          <div className="min-h-0 flex-1">
            <OutputPanel
              output={output}
              busy={busy}
              activeResult={activeResult}
              onActiveResult={setActiveResult}
              onRevealError={(position) => editor.current?.revealPosition(position)}
            />
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

      <SaveQueryDialog open={saveOpen} onOpenChange={setSaveOpen} sql={tab.sql} />
    </div>
  );
}

function OutputPanel({
  output,
  busy,
  activeResult,
  onActiveResult,
  onRevealError,
}: {
  output: Output | null;
  busy: boolean;
  activeResult: number;
  onActiveResult: (index: number) => void;
  onRevealError: (position: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Date.now() - started), 100);
    return () => clearInterval(timer);
  }, [busy]);

  if (busy) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-fg-muted">
        <span className="size-4 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
        Running… {(elapsed / 1000).toFixed(1)}s
      </div>
    );
  }
  if (!output) {
    return <EmptyState icon={<Terminal />} title="Run a query to see results" description="Results, messages and errors show up here." />;
  }
  if (output.kind === "failed") {
    return <p className="p-4 text-sm text-danger">{output.message}</p>;
  }
  if (output.kind === "plan") {
    return <ExplainView planJson={output.plan.planJson} analyzed={output.plan.analyzed} />;
  }

  const { result, offset } = output;
  const statements = result.statements;
  const current = statements[activeResult];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2 text-xs">
        {statements.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onActiveResult(i)}
            className={cn(
              "h-7 cursor-pointer rounded-control px-2.5",
              i === activeResult ? "bg-surface-hover text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {s.type === "rows" ? `Result ${i + 1}` : `Statement ${i + 1}`}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-3 text-fg-subtle">
          {current?.type === "rows" && (
            <>
              <span className="font-mono">
                {(current.rowCount ?? 0).toLocaleString()} row{current.rowCount === 1 ? "" : "s"}
                {current.truncated && ` (showing first ${current.rows.length.toLocaleString()})`}
              </span>
              <ResultCopy columns={current.columns} rows={current.rows} />
            </>
          )}
          <span className="flex items-center gap-1 font-mono">
            <Clock className="size-3" />
            {result.durationMs} ms
          </span>
        </span>
      </div>

      {result.error && (
        <div className="flex shrink-0 items-start gap-2 border-b border-danger/30 bg-danger/5 px-3 py-2.5 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium text-fg">
              {result.cancelled ? "Query cancelled" : result.error.message}
              {result.error.code && !result.cancelled && (
                <span className="ml-2 font-mono text-fg-subtle">{result.error.code}</span>
              )}
            </span>
            {result.error.detail && <span className="text-fg-muted">{result.error.detail}</span>}
            {result.error.hint && <span className="text-fg-muted">Hint: {result.error.hint}</span>}
            {statements.length > 0 && (
              <span className="text-fg-subtle">{statements.length} statement(s) before the error completed.</span>
            )}
          </div>
          {result.error.position !== null && (
            <Button size="sm" variant="ghost" onClick={() => onRevealError(result.error!.position! + offset)}>
              Go to error
            </Button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {!current ? (
          !result.error && <p className="p-4 text-sm text-fg-muted">Done. No results.</p>
        ) : current.type === "command" ? (
          <p className="p-4 text-sm text-fg-muted">
            Statement completed. <span className="font-mono text-fg">{(current.rowsAffected ?? 0).toLocaleString()}</span> row(s)
            affected.
          </p>
        ) : (
          <ResultGrid columns={current.columns} rows={current.rows} />
        )}
      </div>
    </div>
  );
}

function ResultGrid({ columns, rows }: { columns: string[]; rows: (string | null)[][] }) {
  // Duplicate column names (e.g. two "id"s from a join) need unique ids
  const gridColumns: GridColumn[] = useMemo(() => columns.map((name, i) => ({ id: `${i}:${name}`, name })), [columns]);
  const gridRows = useMemo(() => rows.map((cells, i) => ({ id: String(i), cells })), [rows]);
  return <DataGrid columns={gridColumns} rows={gridRows} emptyText="The query returned no rows" />;
}

function ResultCopy({ columns, rows }: { columns: string[]; rows: (string | null)[][] }) {
  const copy = (format: ExportFormat) =>
    void navigator.clipboard
      .writeText(exportRows(format, columns, rows))
      .then(() => toast.success(`Copied ${rows.length} rows as ${format.toUpperCase()}`));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex cursor-pointer items-center gap-1 hover:text-fg">
          <Copy className="size-3" /> Copy
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => copy("csv")}>As CSV</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copy("json")}>As JSON</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copy("sql")}>As SQL INSERT</DropdownMenuItem>
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
              mode === m ? "bg-surface-hover text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {m === "history" ? `History (${history.length})` : `Saved (${saved.length})`}
          </button>
        ))}
        {mode === "history" && history.length > 0 && (
          <IconButton size="sm" label="Clear history" icon={<Trash2 />} className="ml-auto" onClick={() => clearHistory(serverId)} />
        )}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1">
        {mode === "history" &&
          (history.length === 0 ? (
            <li className="p-3 text-xs text-fg-subtle">Queries you run show up here.</li>
          ) : (
            history.map((h) => (
              <li key={`${h.at}`}>
                <button
                  type="button"
                  onClick={() => onLoad(h.sql)}
                  className="flex w-full cursor-pointer flex-col gap-1 rounded-control px-2 py-1.5 text-left hover:bg-surface-hover"
                >
                  <span className="line-clamp-2 font-mono text-[11px] text-fg">{h.sql}</span>
                  <span className="flex gap-2 text-[10px] text-fg-subtle">
                    <span className={h.ok ? "" : "text-danger"}>{h.ok ? "ok" : "error"}</span>
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
            <li className="p-3 text-xs text-fg-subtle">Save queries with the bookmark button to reuse them.</li>
          ) : (
            saved.map((q) => (
              <li key={q.id} className="group flex items-start gap-1 rounded-control hover:bg-surface-hover">
                <button type="button" onClick={() => onLoad(q.sql)} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 px-2 py-1.5 text-left">
                  <span className="text-xs font-medium text-fg">{q.name}</span>
                  <span className="line-clamp-2 font-mono text-[11px] text-fg-subtle">{q.sql}</span>
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

function SaveQueryDialog({ open, onOpenChange, sql }: { open: boolean; onOpenChange: (open: boolean) => void; sql: string }) {
  const { serverId } = useExplorer();
  const saveQuery = useQueryLibrary((s) => s.saveQuery);
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Save query">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            saveQuery(serverId, name.trim(), sql);
            toast.success("Query saved");
            setName("");
            onOpenChange(false);
          }}
        >
          <Field label="Name">
            {(p) => <Input {...p} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly revenue" />}
          </Field>
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
