import {
  Checkbox,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from "@repo/ui";
import { Settings2 } from "lucide-react";
import { canIdentity, type ColumnRow } from "./table-sql";

/** The gear popover on a column row: Supabase's "Extra options". */
export function ExtraOptions({
  column: c,
  count,
  onChange,
}: {
  column: ColumnRow;
  count: number;
  onChange: (p: Partial<ColumnRow>) => void;
}) {
  const option = (
    label: string,
    description: string,
    checked: boolean,
    set: (v: boolean) => void,
    disabled = false,
  ) => (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <Checkbox
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => set(v === true)}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-xs text-fg">{label}</span>
        <span className="text-[11px] text-fg-subtle">{description}</span>
      </span>
    </label>
  );
  return (
    <Popover>
      <Tooltip content="Set column constraints and array options">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Extra options"
            className="relative flex size-8 cursor-pointer items-center justify-center rounded-control border border-border-strong text-fg-subtle hover:text-fg data-[state=open]:text-fg"
          >
            <Settings2 className="size-3.5" />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-medium text-black">
                {count}
              </span>
            )}
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="flex w-80 flex-col gap-3 p-3">
        <p className="text-xs font-medium text-fg">Extra options</p>
        {option(
          "Is nullable",
          "Specify if the column can assume a NULL value if no value is provided",
          c.nullable && !c.primaryKey,
          (v) => onChange({ nullable: v }),
          c.primaryKey,
        )}
        {option(
          "Is unique",
          "Enforce if values in the column should be unique across rows",
          c.unique,
          (v) => onChange({ unique: v }),
        )}
        {canIdentity(c) &&
          !c.original &&
          option(
            "Is Identity",
            "Automatically assign a sequential unique number to the column",
            c.identity,
            (v) => onChange({ identity: v }),
          )}
        {option(
          "Define as array",
          "Allow the column to be defined as variable-length multidimensional arrays",
          c.isArray,
          (v) => onChange({ isArray: v, identity: v ? false : c.identity }),
        )}
      </PopoverContent>
    </Popover>
  );
}
