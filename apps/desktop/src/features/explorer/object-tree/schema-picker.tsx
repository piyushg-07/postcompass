import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/ui";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { useState } from "react";

/** Schema dropdown like Supabase's: "schema  public", a search box, the schemas, then "Create a new schema". */
export function SchemaPicker({
  schema,
  userSchemas,
  systemSchemas,
  onSelect,
  onCreate,
}: {
  schema: string | null;
  userSchemas: string[];
  systemSchemas: string[];
  onSelect: (schema: string) => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();
  const item = (name: string) => (
    <DropdownMenuItem
      key={name}
      icon={<Check className={name === schema ? "text-accent" : "invisible"} />}
      onSelect={() => onSelect(name)}
    >
      <span className="font-mono">{name}</span>
    </DropdownMenuItem>
  );
  // Case-insensitive, like the table search (schema names can have capitals)
  const users = userSchemas.filter((n) => n.toLowerCase().includes(q));
  const system = systemSchemas.filter((n) => n.toLowerCase().includes(q));
  return (
    <DropdownMenu onOpenChange={(o) => !o && setFilter("")}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-7 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control border border-border-strong bg-bg px-2 text-xs hover:border-fg-subtle data-[state=open]:border-fg-subtle"
        >
          <span className="shrink-0 text-fg-subtle">schema</span>
          <span className="min-w-0 flex-1 truncate text-left font-mono text-fg">
            {schema ?? "…"}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-fg-subtle" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60 p-0">
        <div className="relative border-b border-border p-1">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            // Keep typing in the box instead of the menu's type-to-select
            onKeyDown={(e) => e.key !== "Escape" && e.stopPropagation()}
            placeholder="Find schema…"
            className="h-7 w-full bg-transparent pr-2 pl-7 text-xs text-fg outline-none placeholder:text-fg-subtle"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {users.map(item)}
          {system.length > 0 && (
            <>
              <DropdownMenuLabel>System</DropdownMenuLabel>
              {system.map(item)}
            </>
          )}
          {users.length + system.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-fg-subtle">
              No schemas found
            </p>
          )}
        </div>
        <div className="border-t border-border p-1">
          <DropdownMenuItem icon={<Plus />} onSelect={onCreate}>
            Create a new schema
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
