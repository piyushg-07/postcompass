import { Button, Input } from "@repo/ui";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { EnumInfo } from "../../../../lib/bindings";
import { NameField } from "../../run-sql-dialog";
import { type EnumRow, enumChanges } from "./ddl";
import { type Common, FormSheet, Section } from "./shared";

/**
 * Create or edit an enum, like Supabase: the name plus its values as a list. Values can be
 * renamed in place, removed, or added at the end.
 */
export function EnumSheet({
  database,
  schema,
  onClose,
  item,
}: Common & { item?: EnumInfo }) {
  const [name, setName] = useState(item?.name ?? "");
  const [rows, setRows] = useState<EnumRow[]>(
    item
      ? item.values.map((v, i) => ({ key: i, original: v, value: v }))
      : [{ key: 0, value: "" }],
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const [focusKey, setFocusKey] = useState<number | null>(null);

  const addRow = () => {
    setRows((rs) => [...rs, { key: nextKey, value: "" }]);
    setFocusKey(nextKey);
    setNextKey((k) => k + 1);
  };
  const setValue = (key: number, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, value } : r)));
  const removeRow = (key: number) =>
    setRows((rs) => rs.filter((r) => r.key !== key));

  const { sql, removed } = enumChanges(schema, name, rows, item);
  const duplicate = (r: EnumRow) =>
    !!r.value.trim() &&
    rows.some((o) => o.key !== r.key && o.value.trim() === r.value.trim());

  return (
    <FormSheet
      database={database}
      onClose={onClose}
      title={item ? `Edit enum ${item.name}` : "New enum"}
      description="A fixed list of allowed values, like order status."
      sql={sql}
      confirmLabel={item ? "Save" : "Create enum"}
      successMessage={
        item ? `${name.trim()} saved` : `Enum ${name.trim()} created`
      }
    >
      <Section title="General">
        <NameField value={name} onChange={setName} placeholder="order_status" />
      </Section>
      <Section title="Values">
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-2">
              <Input
                aria-label="Value"
                className="font-mono"
                spellCheck={false}
                placeholder="e.g. pending"
                value={r.value}
                autoFocus={r.key === focusKey}
                aria-invalid={
                  duplicate(r) ||
                  (r.original !== undefined && !r.value.trim()) ||
                  undefined
                }
                onChange={(e) => setValue(r.key, e.target.value)}
                onKeyDown={(e) => {
                  // Enter moves on to a new value instead of saving
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRow();
                  }
                }}
              />
              <button
                type="button"
                aria-label={`Remove ${r.value || "value"}`}
                disabled={rows.length === 1}
                onClick={() => removeRow(r.key)}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-fg-subtle hover:bg-surface-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            iconLeft={<Plus />}
            className="self-start"
            onClick={addRow}
          >
            Add value
          </Button>
        </div>
        {removed.length > 0 && (
          <p className="text-xs text-fg-muted">
            Removing a value rebuilds the enum. It fails, changing nothing, if a
            row still uses{" "}
            <span className="font-mono text-fg">{removed.join(", ")}</span>.
          </p>
        )}
      </Section>
    </FormSheet>
  );
}
