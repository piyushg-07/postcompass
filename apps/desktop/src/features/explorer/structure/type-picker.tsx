import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
} from "@repo/ui";
import { Check, ChevronDown, ChevronsUpDown, Search } from "lucide-react";
import { useState } from "react";
import {
  baseTypeName,
  defaultSuggestions,
  PG_TYPES,
} from "../../../lib/pg-types";
import { isSafeTypeName } from "../../../lib/sql";

interface Item {
  name: string;
  description: string;
}

/**
 * Supabase's column type picker: a searchable list of Postgres types with what they hold, then
 * the schema's enums under "Other types".
 */
export function TypePicker({
  value,
  onChange,
  enums = [],
  invalid,
  className,
}: {
  value: string;
  onChange: (type: string) => void;
  enums?: string[];
  invalid?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const q = search.trim().toLowerCase();

  const builtIn: Item[] = PG_TYPES.filter(
    (t) => !q || t.name.includes(q) || t.description.toLowerCase().includes(q),
  );
  const other: Item[] = enums
    .filter((e) => !q || e.toLowerCase().includes(q))
    .map((e) => ({ name: e, description: "Enum" }));
  // Anything else (varchar(50), numeric(10,2), a type from another schema…) can be typed in
  const custom: Item[] =
    q &&
    isSafeTypeName(search) &&
    ![...builtIn, ...other].some((t) => t.name === q)
      ? [{ name: search.trim(), description: "Use this type" }]
      : [];
  const all = [...builtIn, ...other, ...custom];

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch("");
  };

  const row = (t: Item) => {
    const index = all.indexOf(t);
    return (
      <button
        key={`${t.description}:${t.name}`}
        type="button"
        onMouseEnter={() => setHighlight(index)}
        onClick={() => pick(t.name)}
        className={cn(
          "flex h-8 w-full cursor-pointer items-center gap-3 rounded px-2 text-left text-xs",
          index === highlight ? "bg-surface-hover" : undefined,
        )}
      >
        <span className="w-24 shrink-0 truncate font-mono text-fg">
          {t.name}
        </span>
        <span className="min-w-0 flex-1 truncate text-fg-subtle">
          {t.description}
        </span>
        {t.name === value && (
          <Check className="size-3.5 shrink-0 text-accent" />
        )}
      </button>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
        setHighlight(0);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-invalid={invalid || undefined}
          className={cn(
            "flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-control border border-border-strong bg-bg px-2.5 text-left font-mono text-sm text-fg outline-none hover:border-fg-subtle focus-visible:border-accent aria-invalid:border-danger data-[state=open]:border-fg-subtle",
            className,
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              !value && "font-sans text-fg-subtle",
            )}
          >
            {value || "Choose a column type…"}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-fg-subtle" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[460px] p-0" align="start">
        <div className="relative border-b border-border">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            autoFocus
            value={search}
            placeholder="Search types…"
            spellCheck={false}
            onChange={(e) => {
              setSearch(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(all.length - 1, h + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(0, h - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const t = all[highlight];
                if (t) pick(t.name);
              }
            }}
            className="h-9 w-full bg-transparent pr-3 pl-8 text-xs text-fg outline-none placeholder:text-fg-subtle"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {all.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-fg-subtle">
              Type not found.
            </p>
          )}
          {builtIn.length > 0 && (
            <>
              <GroupLabel>Postgres data types</GroupLabel>
              {builtIn.map(row)}
            </>
          )}
          {other.length > 0 && (
            <>
              <GroupLabel>Other types</GroupLabel>
              {other.map(row)}
            </>
          )}
          {custom.map(row)}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function GroupLabel({ children }: { children: string }) {
  return (
    <p className="px-2 pt-2 pb-1 text-[11px] font-medium text-fg-subtle">
      {children}
    </p>
  );
}

/**
 * Default value input with Supabase's "Suggested expressions" menu. Enum columns pick one of
 * their values instead.
 */
export function DefaultValueInput({
  value,
  onChange,
  type,
  nullable,
  enumValues,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  type: string;
  nullable: boolean;
  enumValues?: string[];
  disabled?: boolean;
  placeholder?: string;
}) {
  if (enumValues && !type.endsWith("[]")) {
    const current =
      /^'(.*)'(::.*)?$/.exec(value)?.[1]?.replaceAll("''", "'") ?? "";
    return (
      <Select
        mono
        value={current}
        disabled={disabled}
        placeholder="NULL"
        onValueChange={(v) =>
          onChange(
            v === "__null__" ? "" : `'${v.replaceAll("'", "''")}'::${type}`,
          )
        }
        options={[
          ...(nullable ? [{ value: "__null__", label: "NULL" }] : []),
          ...enumValues.map((v) => ({ value: v, label: v })),
        ]}
      />
    );
  }
  const suggestions = defaultSuggestions(type);
  const base = baseTypeName(type);
  return (
    <div className="flex">
      <Input
        className="min-w-0 flex-1 rounded-r-none font-mono"
        disabled={disabled}
        placeholder={
          placeholder ??
          (nullable
            ? base === "text" || base === "varchar"
              ? "EMPTY"
              : "NULL"
            : "")
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Suggested expressions"
            disabled={disabled || (suggestions.length === 0 && !nullable)}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-r-control border border-l-0 border-border-strong bg-bg text-fg-subtle hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Suggested expressions</DropdownMenuLabel>
          {nullable && (
            <DropdownMenuItem onSelect={() => onChange("")}>
              Set as NULL
            </DropdownMenuItem>
          )}
          {suggestions.map((s) => (
            <DropdownMenuItem key={s.value} onSelect={() => onChange(s.value)}>
              <span className={s.label === s.value ? "font-mono" : undefined}>
                {s.label}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
