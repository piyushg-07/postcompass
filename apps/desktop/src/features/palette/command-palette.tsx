import { cn, Kbd } from "@repo/ui";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Search } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigation } from "../../app/navigation";
import { fuzzyScore } from "./fuzzy";
import type { Command } from "./types";
import { useCommands } from "./use-commands";

const MAX_RESULTS = 60;
const LISTBOX_ID = "command-palette-list";
const optionId = (index: number) => `command-palette-option-${index}`;

/**
 * Results grouped by kind, in the order each group first appears, with every command numbered
 * in the order it is shown.
 */
function groupResults(results: Command[]) {
  const groups: { name: string; items: { command: Command; index: number }[] }[] = [];
  for (const command of results) {
    let group = groups.find((g) => g.name === command.group);
    if (!group) groups.push((group = { name: command.group, items: [] }));
    group.items.push({ command, index: -1 });
  }
  const ordered: Command[] = [];
  for (const group of groups)
    for (const item of group.items) {
      item.index = ordered.length;
      ordered.push(item.command);
    }
  return { groups, ordered };
}

/** Ctrl/⌘+K: jump anywhere and run any action. */
export function CommandPalette() {
  const open = useNavigation((s) => s.paletteOpen);
  const setOpen = useNavigation((s) => s.setPaletteOpen);
  useHotkey("Mod+K", () => setOpen((o) => !o), { ignoreInputs: false });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[14%] left-1/2 z-50 flex w-[620px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-card border border-border-strong bg-surface-raised shadow-2xl shadow-black/70 data-[state=open]:animate-fade-in"
        >
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>
          {open && <PaletteBody onClose={() => setOpen(false)} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const commandsList = useCommands();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const haystacks = useMemo(
    () =>
      commandsList.map((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase()),
    [commandsList],
  );
  const results = useMemo(() => {
    if (!query.trim()) return commandsList.slice(0, MAX_RESULTS);
    return commandsList
      .map((c, i) => ({ c, score: fuzzyScore(query, haystacks[i]!) }))
      .filter((r): r is { c: Command; score: number } => r.score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((r) => r.c);
  }, [commandsList, haystacks, query]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Grouped for display; `ordered` is the same commands in on-screen order, which keyboard
  // navigation follows (score order would jump between groups).
  const { groups, ordered } = useMemo(() => groupResults(results), [results]);
  // The list can shrink under the selection (e.g. tables finish loading), so clamp it
  const activeIndex = Math.min(active, Math.max(ordered.length - 1, 0));
  const activeId = ordered[activeIndex] ? optionId(activeIndex) : undefined;

  const runCommand = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    // Let the dialog close before running, so focus lands where the command sends it
    setTimeout(command.run, 0);
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 text-fg-subtle" />
        <input
          autoFocus
          role="combobox"
          aria-label="Search commands"
          aria-expanded
          aria-controls={LISTBOX_ID}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            // Enter that confirms an IME composition isn't a "run"
            if (e.nativeEvent.isComposing) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive(Math.min(activeIndex + 1, Math.max(ordered.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive(Math.max(activeIndex - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              runCommand(ordered[activeIndex]);
            }
          }}
          placeholder="Search tables, servers, actions…"
          className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div
        ref={listRef}
        id={LISTBOX_ID}
        className="max-h-[420px] overflow-y-auto p-1.5"
        role="listbox"
        aria-label="Commands"
      >
        {results.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-fg-subtle">
            No matches
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.name} role="group" aria-label={group.name} className="mb-1">
              <div aria-hidden className="px-2.5 pt-2 pb-1 text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
                {group.name}
              </div>
              {group.items.map(({ command, index }) => (
                <button
                  key={command.id}
                  id={optionId(index)}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === activeIndex}
                  data-index={index}
                  onMouseMove={() => setActive(index)}
                  onClick={() => runCommand(command)}
                  className={cn(
                    "flex h-9 w-full cursor-pointer items-center gap-3 rounded-control px-2.5 text-left text-sm [&_svg]:size-4",
                    index === activeIndex
                      ? "bg-surface-hover text-fg"
                      : "text-fg-muted",
                  )}
                >
                  <span
                    className={
                      index === activeIndex ? "text-accent" : "text-fg-subtle"
                    }
                  >
                    {command.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {command.label}
                  </span>
                  {command.hint && (
                    <span className="max-w-[40%] shrink-0 truncate font-mono text-[11px] text-fg-subtle">
                      {command.hint}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
      <div className="flex items-center gap-4 border-t border-border px-3 py-2 text-[11px] text-fg-subtle">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> move
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> run
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd> toggle
        </span>
      </div>
    </>
  );
}
