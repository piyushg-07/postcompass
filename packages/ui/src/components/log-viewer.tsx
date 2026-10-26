import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

/** Monospace log output that follows new lines unless the user has scrolled up. */
export function LogViewer({ lines, className, emptyText = "No output yet." }: { lines: string[]; className?: string; emptyText?: string }) {
  const ref = useRef<HTMLPreElement>(null);
  const stickToBottom = useRef(true);
  const [copied, setCopied] = useState(false);

  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lines]);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch {
      return; // Clipboard unavailable: leave the icon as it is
    }
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("relative rounded-control border border-border bg-bg", className)}>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label="Copy log"
        className="absolute top-2 right-2 cursor-pointer rounded p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg"
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
      <pre
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        className="max-h-56 overflow-auto p-3 pr-9 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-fg-muted select-text"
      >
        {lines.length ? lines.join("\n") : <span className="text-fg-subtle">{emptyText}</span>}
      </pre>
    </div>
  );
}
