import { useState } from "react";
import type { SequenceInfo } from "../../../../lib/bindings";
import { alterSequence, createSequence } from "../../../../lib/sql";
import { NameField } from "../../run-sql-dialog";
import { isInt, isName } from "./ddl";
import { type Common, FormSheet, NumberField, Section } from "./shared";

export function NewSequence({ database, schema, onClose }: Common) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("1");
  const [increment, setIncrement] = useState("1");
  const ok =
    isName(name) && isInt(start) && isInt(increment) && Number(increment) !== 0;
  return (
    <FormSheet
      database={database}
      onClose={onClose}
      title="New sequence"
      description="A counter that hands out unique numbers, e.g. for ids."
      sql={
        ok
          ? createSequence(schema, name.trim(), start, increment)
          : "-- fill in the sequence"
      }
      confirmLabel="Create sequence"
      successMessage={`Sequence ${name.trim()} created`}
    >
      <Section title="General">
        <NameField
          value={name}
          onChange={setName}
          placeholder="invoice_number_seq"
        />
      </Section>
      <Section title="Numbers">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Start at" value={start} onChange={setStart} />
          <NumberField label="Step" value={increment} onChange={setIncrement} />
        </div>
      </Section>
    </FormSheet>
  );
}

export function EditSequence({
  database,
  schema,
  onClose,
  item,
}: Common & { item: SequenceInfo }) {
  const [increment, setIncrement] = useState(item.increment);
  const [next, setNext] = useState("");
  const incChanged =
    isInt(increment) &&
    increment.trim() !== item.increment &&
    Number(increment) !== 0;
  const nextSet = isInt(next);
  const ok = incChanged || nextSet;
  return (
    <FormSheet
      database={database}
      onClose={onClose}
      title={`Edit sequence ${item.name}`}
      description={`Last value handed out: ${item.lastValue ?? "none yet"}.`}
      sql={
        ok
          ? alterSequence(schema, item.name, {
              increment: incChanged ? increment.trim() : undefined,
              next: nextSet ? next.trim() : undefined,
            })
          : "-- change the step or the next value"
      }
      confirmLabel="Save"
      successMessage={`${item.name} updated`}
    >
      <Section title="Numbers">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Step" value={increment} onChange={setIncrement} />
          <NumberField
            label="Next value"
            value={next}
            onChange={setNext}
            placeholder="Unchanged"
          />
        </div>
      </Section>
    </FormSheet>
  );
}
