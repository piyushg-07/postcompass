import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from "@repo/ui";
import { save as saveFile } from "@tauri-apps/plugin-dialog";
import { Check, ChevronDown, ChevronsUpDown, Download } from "lucide-react";
import type { ReactNode } from "react";
import { commands, describeError, unwrap } from "../../../../lib/ipc";
import { type ExportFormat, exportRows } from "../../data/export";
import { LIMITS, NO_LIMIT } from "./prefs";

export function ViewTab({
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
      aria-pressed={active}
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
export function ToolbarPicker({
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

/** How many rows each result keeps; lives in the results bar. */
export function LimitMenu({
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
export function ExportMenu({
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
