import {
  Button,
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  toast,
} from "@repo/ui";
import {
  Bookmark,
  Copy,
  CopyPlus,
  History,
  Play,
  Plus,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useExplorer } from "./explorer-context";
import { useQueryLibrary, useWorkspace } from "./workspace-store";

const MAX_RECENT = 20;

const copySql = (sql: string) =>
  void navigator.clipboard
    .writeText(sql)
    .then(() => toast.success("SQL copied"));

/** The sidebar's "SQL" section, like Supabase's SQL editor: new query, open queries, saved, recent. */
export function SqlPanel({ database }: { database: string }) {
  const { serverId } = useExplorer();
  const ws = useWorkspace(serverId);
  const saved = useQueryLibrary((s) => s.saved[serverId]) ?? [];
  const history = useQueryLibrary((s) => s.history[serverId]) ?? [];
  const { deleteSaved, clearHistory } = useQueryLibrary.getState();
  const openQueries = ws.tabs.filter((t) => t.type === "query");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border p-2">
        <Button
          size="sm"
          variant="secondary"
          iconLeft={<Plus />}
          className="w-full"
          title="New query (Ctrl+T)"
          onClick={() => ws.newQuery(database)}
        >
          <span className="flex-1 text-left">New query</span>
          <span className="font-mono text-[10px] font-normal text-fg-subtle">
            Ctrl+T
          </span>
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        <Section
          title="Open"
          count={openQueries.length}
          empty="No open queries."
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
          title="Saved"
          count={saved.length}
          empty="Save a query from its tab to keep it here."
        >
          {saved.map((q) => (
            <Row
              key={q.id}
              icon={<Bookmark />}
              label={q.name}
              onClick={() => ws.newQuery(database, q.sql)}
              menu={
                <>
                  <ContextMenuItem
                    icon={<Play />}
                    onSelect={() => ws.newQuery(database, q.sql)}
                  >
                    Open in new tab
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<Copy />}
                    onSelect={() => copySql(q.sql)}
                  >
                    Copy SQL
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    icon={<Trash2 />}
                    danger
                    onSelect={() => deleteSaved(serverId, q.id)}
                  >
                    Delete
                  </ContextMenuItem>
                </>
              }
            />
          ))}
        </Section>
        <Section
          title="Recent"
          count={Math.min(history.length, MAX_RECENT)}
          empty="Queries you run show up here."
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
                    onSelect={() => clearHistory(serverId)}
                  >
                    Clear history
                  </ContextMenuItem>
                </>
              }
            />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col pb-2">
      <h3 className="flex h-7 items-center gap-1.5 px-3 text-[11px] font-medium text-fg-subtle">
        {title} <span>{count}</span>
      </h3>
      {count === 0 ? (
        <p className="px-3 pb-1 text-xs text-fg-subtle">{empty}</p>
      ) : (
        <ul className="flex flex-col">{children}</ul>
      )}
    </section>
  );
}

function Row({
  icon,
  label,
  meta,
  mono,
  active,
  onClick,
  menu,
}: {
  icon: ReactNode;
  label: string;
  meta?: string;
  mono?: boolean;
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
              "flex h-7 w-full cursor-pointer items-center gap-2 pr-2 pl-4 text-left text-xs text-fg-muted hover:bg-surface-hover hover:text-fg data-[state=open]:bg-surface-hover [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-subtle",
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
