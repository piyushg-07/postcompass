import {
  Button,
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  Input,
  Select,
  toast,
} from "@repo/ui";
import {
  ChevronRight,
  Copy,
  CopyPlus,
  FileCode2,
  Folder,
  FolderInput,
  FolderPlus,
  History,
  Pencil,
  Play,
  Plus,
  Star,
  StarOff,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useExplorer } from "./explorer-context";
import { SQL_TEMPLATES } from "./sql/templates";
import {
  type SavedQuery,
  useQueryLibrary,
  useWorkspace,
} from "./workspace-store";

const MAX_RECENT = 20;

const copySql = (sql: string) =>
  void navigator.clipboard
    .writeText(sql)
    .then(() => toast.success("SQL copied"));

type Prompt =
  | { kind: "rename"; query: SavedQuery }
  | { kind: "move"; query: SavedQuery }
  | { kind: "new-folder" }
  | { kind: "rename-folder"; folder: string };

/**
 * The sidebar's "SQL" section, like Supabase's SQL editor: favorites, snippets in folders,
 * open queries, recent runs and templates.
 */
export function SqlPanel({ database }: { database: string }) {
  const { serverId } = useExplorer();
  const ws = useWorkspace(serverId);
  const saved = useQueryLibrary((s) => s.saved[serverId]) ?? [];
  const folderList = useQueryLibrary((s) => s.folders[serverId]) ?? [];
  const history = useQueryLibrary((s) => s.history[serverId]) ?? [];
  const lib = useQueryLibrary.getState();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set(["Templates"]));
  const openQueries = ws.tabs.filter((t) => t.type === "query");

  // Folders that exist, plus any a snippet still names
  const folders = [
    ...new Set([
      ...folderList,
      ...saved.flatMap((q) => (q.folder ? [q.folder] : [])),
    ]),
  ].sort((a, b) => a.localeCompare(b));
  const favorites = saved.filter((q) => q.favorite);
  const toggle = (key: string) =>
    setClosed((c) => {
      const next = new Set(c);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const open = (q: SavedQuery) => ws.openSnippet(database, q);

  const snippetMenu = (q: SavedQuery) => (
    <>
      <ContextMenuItem icon={<Play />} onSelect={() => open(q)}>
        Open
      </ContextMenuItem>
      <ContextMenuItem
        icon={<Pencil />}
        onSelect={() => setPrompt({ kind: "rename", query: q })}
      >
        Rename
      </ContextMenuItem>
      <ContextMenuItem
        icon={<CopyPlus />}
        onSelect={() =>
          lib.saveQuery(serverId, `${q.name} (copy)`, q.sql, q.folder)
        }
      >
        Duplicate
      </ContextMenuItem>
      <ContextMenuItem
        icon={q.favorite ? <StarOff /> : <Star />}
        onSelect={() =>
          lib.updateSaved(serverId, q.id, { favorite: !q.favorite })
        }
      >
        {q.favorite ? "Remove from favorites" : "Add to favorites"}
      </ContextMenuItem>
      <ContextMenuItem
        icon={<FolderInput />}
        onSelect={() => setPrompt({ kind: "move", query: q })}
      >
        Move to folder…
      </ContextMenuItem>
      <ContextMenuItem icon={<Copy />} onSelect={() => copySql(q.sql)}>
        Copy SQL
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        icon={<Trash2 />}
        danger
        onSelect={() => lib.deleteSaved(serverId, q.id)}
      >
        Delete
      </ContextMenuItem>
    </>
  );

  const snippetRow = (q: SavedQuery, indent = false) => (
    <Row
      key={q.id}
      icon={<FileCode2 />}
      label={q.name}
      indent={indent}
      active={ws.tabs.some(
        (t) =>
          t.id === ws.activeTabId && t.type === "query" && t.savedId === q.id,
      )}
      onClick={() => open(q)}
      menu={snippetMenu(q)}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-1.5 border-b border-border p-2">
        <Button
          size="sm"
          variant="secondary"
          iconLeft={<Plus />}
          className="flex-1"
          onClick={() => ws.newQuery(database)}
        >
          <span className="flex-1 text-left">New query</span>
          <span className="font-mono text-[10px] font-normal text-fg-subtle">
            Ctrl+T
          </span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="secondary" aria-label="More">
              <FolderPlus />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              icon={<FolderPlus />}
              onSelect={() => setPrompt({ kind: "new-folder" })}
            >
              New folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {favorites.length > 0 && (
          <Section
            title="Favorites"
            count={favorites.length}
            closed={closed.has("Favorites")}
            onToggle={() => toggle("Favorites")}
          >
            {favorites.map((q) => snippetRow(q))}
          </Section>
        )}

        <Section
          title="Snippets"
          count={saved.length}
          empty="Save a query from its tab to keep it here."
          closed={closed.has("Snippets")}
          onToggle={() => toggle("Snippets")}
        >
          {folders.map((f) => {
            const inFolder = saved.filter((q) => q.folder === f);
            const key = `folder:${f}`;
            return (
              <li key={key}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="flex h-7 w-full cursor-pointer items-center gap-1.5 pr-2 pl-3 text-left text-xs text-fg-muted hover:bg-surface-hover hover:text-fg data-[state=open]:bg-surface-hover [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-subtle"
                    >
                      <ChevronRight
                        className={cn(
                          "transition-transform",
                          !closed.has(key) && "rotate-90",
                        )}
                      />
                      <Folder />
                      <span className="min-w-0 flex-1 truncate">{f}</span>
                      <span className="text-[10px] text-fg-subtle">
                        {inFolder.length}
                      </span>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      icon={<Pencil />}
                      onSelect={() =>
                        setPrompt({ kind: "rename-folder", folder: f })
                      }
                    >
                      Rename folder
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      icon={<Trash2 />}
                      danger
                      onSelect={() => lib.deleteFolder(serverId, f)}
                    >
                      Delete folder
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                {!closed.has(key) && (
                  <ul>
                    {inFolder.length === 0 ? (
                      <li className="py-1 pl-10 text-[11px] text-fg-subtle">
                        Empty folder
                      </li>
                    ) : (
                      inFolder.map((q) => snippetRow(q, true))
                    )}
                  </ul>
                )}
              </li>
            );
          })}
          {saved.filter((q) => !q.folder).map((q) => snippetRow(q))}
          {saved.length === 0 && folders.length > 0 && (
            <li className="px-3 py-1 text-xs text-fg-subtle">
              No snippets yet.
            </li>
          )}
        </Section>

        <Section
          title="Open"
          count={openQueries.length}
          empty="No open queries."
          closed={closed.has("Open")}
          onToggle={() => toggle("Open")}
        >
          {openQueries.map(
            (t) =>
              t.type === "query" && (
                <Row
                  key={t.id}
                  icon={<TerminalSquare />}
                  label={t.title}
                  meta={t.database}
                  active={t.id === ws.activeTabId}
                  onClick={() => ws.setActive(t.id)}
                  menu={
                    <>
                      <ContextMenuItem
                        icon={<Play />}
                        onSelect={() => ws.setActive(t.id)}
                      >
                        Go to query
                      </ContextMenuItem>
                      <ContextMenuItem
                        icon={<CopyPlus />}
                        onSelect={() => ws.newQuery(t.database, t.sql)}
                      >
                        Duplicate
                      </ContextMenuItem>
                      <ContextMenuItem
                        icon={<Copy />}
                        onSelect={() => copySql(t.sql)}
                      >
                        Copy SQL
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        icon={<X />}
                        onSelect={() => ws.closeTab(t.id)}
                      >
                        Close
                      </ContextMenuItem>
                    </>
                  }
                />
              ),
          )}
        </Section>

        <Section
          title="Recent"
          count={Math.min(history.length, MAX_RECENT)}
          empty="Queries you run show up here."
          closed={closed.has("Recent")}
          onToggle={() => toggle("Recent")}
        >
          {history.slice(0, MAX_RECENT).map((h) => (
            <Row
              key={`${h.at}`}
              icon={<History className={h.ok ? undefined : "text-danger"} />}
              label={h.sql.replace(/\s+/g, " ").trim()}
              meta={h.database === database ? undefined : h.database}
              mono
              onClick={() => ws.newQuery(h.database, h.sql)}
              menu={
                <>
                  <ContextMenuItem
                    icon={<Play />}
                    onSelect={() => ws.newQuery(h.database, h.sql)}
                  >
                    Open in new tab
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<Copy />}
                    onSelect={() => copySql(h.sql)}
                  >
                    Copy SQL
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    icon={<Trash2 />}
                    danger
                    onSelect={() => lib.clearHistory(serverId)}
                  >
                    Clear history
                  </ContextMenuItem>
                </>
              }
            />
          ))}
        </Section>

        <Section
          title="Templates"
          count={SQL_TEMPLATES.length}
          closed={closed.has("Templates")}
          onToggle={() => toggle("Templates")}
        >
          {SQL_TEMPLATES.map((t) => (
            <li key={t.title}>
              <button
                type="button"
                onClick={() => ws.newQuery(database, t.sql)}
                className="flex w-full cursor-pointer flex-col gap-0.5 py-1.5 pr-2 pl-4 text-left hover:bg-surface-hover"
              >
                <span className="flex items-center gap-2 text-xs text-fg">
                  {t.title}
                  <span className="text-[10px] text-fg-subtle">{t.group}</span>
                </span>
                <span className="truncate text-[11px] text-fg-subtle">
                  {t.description}
                </span>
              </button>
            </li>
          ))}
        </Section>
      </div>

      <PromptDialog
        prompt={prompt}
        folders={folders}
        onClose={() => setPrompt(null)}
      />
    </div>
  );
}

/** Rename a snippet or folder, create a folder, or move a snippet to one. */
function PromptDialog({
  prompt,
  folders,
  onClose,
}: {
  prompt: Prompt | null;
  folders: string[];
  onClose: () => void;
}) {
  return (
    <Dialog open={prompt !== null} onOpenChange={(o) => !o && onClose()}>
      {prompt && (
        <PromptBody
          key={JSON.stringify(prompt)}
          prompt={prompt}
          folders={folders}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function PromptBody({
  prompt,
  folders,
  onClose,
}: {
  prompt: Prompt;
  folders: string[];
  onClose: () => void;
}) {
  const { serverId } = useExplorer();
  const lib = useQueryLibrary.getState();
  const [text, setText] = useState(
    prompt.kind === "rename"
      ? prompt.query.name
      : prompt.kind === "rename-folder"
        ? prompt.folder
        : "",
  );
  const [folder, setFolder] = useState(
    prompt.kind === "move" ? (prompt.query.folder ?? "") : "",
  );
  const title =
    prompt.kind === "rename"
      ? "Rename snippet"
      : prompt.kind === "move"
        ? `Move ${prompt.query.name}`
        : prompt.kind === "new-folder"
          ? "New folder"
          : "Rename folder";
  const valid = prompt.kind === "move" || text.trim().length > 0;

  const submit = () => {
    if (!valid) return;
    const name = text.trim();
    if (prompt.kind === "rename")
      lib.updateSaved(serverId, prompt.query.id, { name });
    if (prompt.kind === "move")
      lib.updateSaved(serverId, prompt.query.id, {
        folder: folder || undefined,
      });
    if (prompt.kind === "new-folder") lib.addFolder(serverId, name);
    if (prompt.kind === "rename-folder")
      lib.renameFolder(serverId, prompt.folder, name);
    onClose();
  };

  return (
    <DialogContent title={title} className="w-[400px]">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {prompt.kind === "move" ? (
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
        ) : (
          <Field label="Name">
            {(p) => (
              <Input
                {...p}
                autoFocus
                value={text}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setText(e.target.value)}
              />
            )}
          </Field>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button type="submit" variant="primary" disabled={!valid}>
            {prompt.kind === "move"
              ? "Move"
              : prompt.kind === "new-folder"
                ? "Create"
                : "Rename"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Section({
  title,
  count,
  empty,
  closed,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  empty?: string;
  closed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col pb-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-7 cursor-pointer items-center gap-1 px-2 text-[11px] font-medium text-fg-subtle hover:text-fg-muted"
      >
        <ChevronRight
          className={cn("size-3 transition-transform", !closed && "rotate-90")}
        />
        {title} <span>{count}</span>
      </button>
      {!closed &&
        (count === 0 && empty ? (
          <p className="px-3 pb-1 text-xs text-fg-subtle">{empty}</p>
        ) : (
          <ul className="flex flex-col">{children}</ul>
        ))}
    </section>
  );
}

function Row({
  icon,
  label,
  meta,
  mono,
  indent,
  active,
  onClick,
  menu,
}: {
  icon: ReactNode;
  label: string;
  meta?: string;
  mono?: boolean;
  indent?: boolean;
  active?: boolean;
  onClick: () => void;
  /** Right-click menu items. */
  menu: ReactNode;
}) {
  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className={cn(
              "flex h-7 w-full cursor-pointer items-center gap-2 pr-2 text-left text-xs text-fg-muted hover:bg-surface-hover hover:text-fg data-[state=open]:bg-surface-hover [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-subtle",
              indent ? "pl-9" : "pl-4",
              active && "bg-surface-hover text-fg [&_svg]:text-accent",
            )}
          >
            {icon}
            <span
              className={cn("min-w-0 flex-1 truncate", mono && "font-mono")}
            >
              {label}
            </span>
            {meta && (
              <span className="shrink-0 font-mono text-[10px] text-fg-subtle">
                {meta}
              </span>
            )}
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>{menu}</ContextMenuContent>
      </ContextMenu>
    </li>
  );
}
