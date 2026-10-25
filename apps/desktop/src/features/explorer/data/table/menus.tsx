import {
  Button,
  cn,
  ContextMenuItem,
  ContextMenuSeparator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from "@repo/ui";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Filter,
  Lock,
  LockOpen,
  Maximize2,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { SortSpec } from "../../../../lib/bindings";
import type { ExportFormat } from "../export";
import type { CellTarget } from "../grid/types";

export function RowsMenu({
  icon,
  label,
  verb,
  onPick,
}: {
  icon: ReactNode;
  label: string;
  verb: string;
  onPick: (format: ExportFormat) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          iconLeft={icon}
          iconRight={<ChevronDown />}
        >
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => onPick("csv")}>
          {verb} CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick("json")}>
          {verb} JSON
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick("sql")}>
          {verb} SQL
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function InsertOption({
  icon,
  title,
  description,
  onSelect,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      icon={icon}
      className="h-auto items-start py-2 [&_svg]:mt-0.5"
      onSelect={onSelect}
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-fg">{title}</span>
        <span className="text-[11px] text-fg-subtle">{description}</span>
      </span>
    </DropdownMenuItem>
  );
}

/** "3 hidden": brings hidden columns back, one at a time or all at once. */
export function HiddenColumnsMenu({
  hidden,
  onShow,
  onShowAll,
}: {
  hidden: string[];
  onShow: (column: string) => void;
  onShowAll: () => void;
}) {
  if (hidden.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" iconLeft={<EyeOff />}>
          {hidden.length} hidden
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {hidden.map((c) => (
          <DropdownMenuItem key={c} icon={<Eye />} onSelect={() => onShow(c)}>
            <span className="font-mono">{c}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onShowAll}>
          Show all columns
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The menu behind each column header's button, in Supabase's order. */
export function ColumnMenu({
  name,
  sort,
  disabled,
  editable,
  onSort,
  onEdit,
  onDrop,
  onCopy,
  frozen,
  onFreeze,
  onHide,
  onResetOrder,
}: {
  name: string;
  sort?: SortSpec;
  disabled: boolean;
  editable: boolean;
  onSort: (descending: boolean | null) => void;
  onEdit: () => void;
  onDrop: () => void;
  onCopy: () => void;
  frozen: boolean;
  onFreeze: () => void;
  onHide: () => void;
  /** Set when the columns were dragged out of table order. */
  onResetOrder?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${name} column options`}
          className="flex size-5 cursor-pointer items-center justify-center rounded text-fg-subtle opacity-50 hover:bg-surface-hover hover:text-fg hover:opacity-100 data-[state=open]:bg-surface-hover data-[state=open]:opacity-100"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Picking the active sort again removes it */}
        <DropdownMenuItem
          icon={<ArrowUp />}
          disabled={disabled}
          className={cn(sort && !sort.descending && "bg-surface-hover text-fg")}
          onSelect={() => onSort(sort && !sort.descending ? null : false)}
        >
          Sort Ascending
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<ArrowDown />}
          disabled={disabled}
          className={cn(sort?.descending && "bg-surface-hover text-fg")}
          onSelect={() => onSort(sort?.descending ? null : true)}
        >
          Sort Descending
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Copy />} onSelect={onCopy}>
          Copy name
        </DropdownMenuItem>
        {editable && (
          <DropdownMenuItem icon={<Pencil />} onSelect={onEdit}>
            Edit column
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          icon={frozen ? <LockOpen /> : <Lock />}
          onSelect={onFreeze}
        >
          {frozen ? "Unfreeze columns" : "Freeze column"}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<EyeOff />} onSelect={onHide}>
          Hide column
        </DropdownMenuItem>
        {onResetOrder && (
          <DropdownMenuItem icon={<RotateCcw />} onSelect={onResetOrder}>
            Reset column order
          </DropdownMenuItem>
        )}
        {editable && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={<Trash2 />} danger onSelect={onDrop}>
              Delete column
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Right-click menu on a cell, like Supabase's. */
export function CellMenu({
  target,
  editable,
  onCopyRow,
  onFilter,
  onEditRow,
  onDeleteRow,
}: {
  target: CellTarget;
  editable: boolean;
  onCopyRow: () => void;
  onFilter: () => void;
  onEditRow: () => void;
  onDeleteRow: () => void;
}) {
  // Long or structured values make poor filters
  const simple =
    target.value === null ||
    (target.value !== undefined &&
      target.value.length <= 200 &&
      !/^[[{]/.test(target.value.trim()));
  return (
    <>
      <ContextMenuItem
        icon={<Copy />}
        onSelect={() =>
          void navigator.clipboard
            .writeText(target.value ?? "")
            .then(() => toast.success("Copied cell value to clipboard"))
        }
      >
        Copy cell
      </ContextMenuItem>
      <ContextMenuItem icon={<Copy />} onSelect={onCopyRow}>
        Copy row
      </ContextMenuItem>
      {simple && (
        <ContextMenuItem icon={<Filter />} onSelect={onFilter}>
          Filter by value
        </ContextMenuItem>
      )}
      {editable && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem icon={<Maximize2 />} onSelect={onEditRow}>
            Edit row
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem icon={<Trash2 />} danger onSelect={onDeleteRow}>
            Delete row
          </ContextMenuItem>
        </>
      )}
    </>
  );
}
