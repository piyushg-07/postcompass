import { Select } from "@repo/ui";
import { type Commit, useOnce } from "./cell-popover";

const NULL_OPTION = "__null__";

/** Booleans and enums: the value list opens right away over the cell. */
export function ListEditor({
  value,
  options,
  nullable,
  onCommit,
}: {
  value: string | null;
  options: { value: string; label: string }[];
  nullable: boolean;
  onCommit: Commit;
}) {
  const finish = useOnce(onCommit);
  return (
    <div
      className="absolute inset-0 z-10"
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Select
        defaultOpen
        value={value ?? NULL_OPTION}
        onValueChange={(v) => finish(v === NULL_OPTION ? null : v)}
        // Closing cancels a tick later, so a pick (which also closes the list) lands first
        onOpenChange={(open) => !open && setTimeout(() => finish(false))}
        className="h-full rounded-[3px] border-0 bg-surface-raised text-[13px] ring-[1.5px] ring-accent ring-inset"
        options={[
          ...(nullable ? [{ value: NULL_OPTION, label: "NULL" }] : []),
          ...options,
        ]}
      />
    </div>
  );
}
