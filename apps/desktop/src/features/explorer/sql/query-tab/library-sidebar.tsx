import {
  Button,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  Field,
  IconButton,
  Input,
  Select,
  toast,
} from "@repo/ui";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useExplorer } from "../../explorer-context";
import { useQueryLibrary } from "../../workspace-store";

export function LibrarySidebar({
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
            history.map((h, i) => (
              // Two runs can finish in the same millisecond
              <li key={`${h.at}:${i}`}>
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

export function SaveQueryDialog({
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
