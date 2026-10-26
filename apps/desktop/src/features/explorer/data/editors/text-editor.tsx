import { Button, toast, Tooltip } from "@repo/ui";
import { Maximize2 } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { CellPopover, type Commit, KeyHints, useOnce } from "./cell-popover";

/** `null` when `text` parses as JSON (or is blank, which saves NULL); otherwise the problem. */
export function jsonProblem(text: string) {
  if (!text.trim()) return null;
  try {
    JSON.parse(text);
    return null;
  } catch {
    return "Please enter a valid JSON";
  }
}

export function TextEditor({
  initial,
  json,
  nullable,
  width,
  rowHeight,
  onCommit,
  onExpand,
}: {
  initial: string;
  json: boolean;
  nullable: boolean;
  width: number;
  rowHeight: number;
  onCommit: Commit;
  onExpand: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  const finish = useOnce(onCommit);

  const save = () => {
    const problem = json ? jsonProblem(text) : null;
    if (problem) {
      toast.error(problem);
      return false;
    }
    // Clearing a JSON value saves NULL
    finish(json && !text.trim() ? null : text);
    return true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      save();
    }
  };

  return (
    <CellPopover
      width={Math.max(width, 360)}
      rowHeight={rowHeight}
      onOutside={() => !save()}
      onEscape={() => finish(false)}
    >
      <textarea
        autoFocus
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          const end = e.currentTarget.value.length;
          e.currentTarget.setSelectionRange(end, end);
        }}
        className="block h-[200px] w-full resize-none bg-bg p-2.5 font-mono text-xs leading-relaxed text-fg outline-none select-text"
      />
      <div className="flex items-center gap-2 border-t border-border bg-surface px-2.5 py-1.5">
        <KeyHints />
        <span className="ml-auto flex items-center gap-1">
          <Tooltip content="Expand editor">
            <button
              type="button"
              aria-label="Expand editor"
              onClick={() => {
                finish(false);
                onExpand(text);
              }}
              className="flex size-6 cursor-pointer items-center justify-center rounded text-fg-subtle hover:bg-surface-hover hover:text-fg"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </Tooltip>
          {nullable && (
            <Button size="sm" variant="secondary" onClick={() => finish(null)}>
              Set to NULL
            </Button>
          )}
        </span>
      </div>
    </CellPopover>
  );
}
