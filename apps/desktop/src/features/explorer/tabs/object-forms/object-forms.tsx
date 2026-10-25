import type {
  EnumInfo,
  FunctionInfo,
  SchemaTriggerInfo,
  SequenceInfo,
} from "../../../../lib/bindings";
import {
  dropRoutine,
  dropSequence,
  dropTrigger,
  dropType,
  renameRoutine,
  renameSequence,
  renameTrigger,
  restartSequence,
} from "../../../../lib/sql";
import { RunSqlDialog } from "../../run-sql-dialog";
import { EnumSheet } from "./enum-sheet";
import { EditFunction } from "./function-editor";
import { fitsFunctionForm, FunctionSheet } from "./function-sheet";
import { EditSequence, NewSequence } from "./sequence-forms";
import { Drop, Rename } from "./shared";
import { NewTrigger } from "./trigger-forms";

/** Which form is open on a Database page. */
export type ObjectAction =
  | { kind: "enum-new" }
  | { kind: "enum-edit"; item: EnumInfo }
  | { kind: "enum-drop"; item: EnumInfo }
  | { kind: "trigger-new" }
  | { kind: "trigger-rename"; item: SchemaTriggerInfo }
  | { kind: "trigger-drop"; item: SchemaTriggerInfo }
  | { kind: "function-new" }
  | { kind: "function-edit"; item: FunctionInfo }
  | { kind: "function-rename"; item: FunctionInfo }
  | { kind: "function-drop"; item: FunctionInfo }
  | { kind: "sequence-new" }
  | { kind: "sequence-edit"; item: SequenceInfo }
  | { kind: "sequence-restart"; item: SequenceInfo }
  | { kind: "sequence-rename"; item: SequenceInfo }
  | { kind: "sequence-drop"; item: SequenceInfo };

/** Renders the form for `action`; `onClose` closes it. */
export function ObjectForms({
  action,
  onClose,
  database,
  schema,
  functions,
}: {
  action: ObjectAction | null;
  onClose: () => void;
  database: string;
  schema: string;
  functions: FunctionInfo[];
}) {
  if (!action) return null;
  const common = { database, schema, onClose };
  switch (action.kind) {
    case "enum-new":
      return <EnumSheet {...common} />;
    case "enum-edit":
      return <EnumSheet {...common} item={action.item} />;
    case "enum-drop":
      return (
        <Drop
          {...common}
          title={`Delete enum ${action.item.name}?`}
          what="enum"
          build={(cascade) => dropType(schema, action.item.name, cascade)}
          cascadeLabel="Also delete columns that use it"
        />
      );
    case "trigger-new":
      return <NewTrigger {...common} functions={functions} />;
    case "trigger-rename":
      return (
        <Rename
          {...common}
          title={`Rename trigger ${action.item.name}`}
          current={action.item.name}
          build={(n) =>
            renameTrigger(schema, action.item.table, action.item.name, n)
          }
        />
      );
    case "trigger-drop":
      return (
        <Drop
          {...common}
          title={`Delete trigger ${action.item.name}?`}
          what="trigger"
          detail={`It stops running on ${action.item.table}. The table and its data aren't changed.`}
          build={() => dropTrigger(schema, action.item.table, action.item.name)}
        />
      );
    case "function-new":
      return <FunctionSheet {...common} />;
    case "function-edit":
      return fitsFunctionForm(action.item) ? (
        <FunctionSheet {...common} item={action.item} />
      ) : (
        <EditFunction {...common} item={action.item} />
      );
    case "function-rename":
      return (
        <Rename
          {...common}
          title={`Rename ${action.item.kind} ${action.item.name}`}
          current={action.item.name}
          build={(n) =>
            renameRoutine(
              schema,
              action.item.name,
              action.item.arguments,
              action.item.kind,
              n,
            )
          }
        />
      );
    case "function-drop":
      return (
        <Drop
          {...common}
          title={`Delete ${action.item.kind} ${action.item.name}?`}
          what={action.item.kind}
          build={(cascade) =>
            dropRoutine(
              schema,
              action.item.name,
              action.item.arguments,
              action.item.kind,
              cascade,
            )
          }
          cascadeLabel="Also delete triggers and other objects that use it"
        />
      );
    case "sequence-new":
      return <NewSequence {...common} />;
    case "sequence-edit":
      return <EditSequence {...common} item={action.item} />;
    case "sequence-restart":
      return (
        <RunSqlDialog
          open
          onOpenChange={(o) => !o && onClose()}
          title={`Restart sequence ${action.item.name}?`}
          description="The next value goes back to the sequence's start value. New rows could clash with existing ids."
          sql={restartSequence(schema, action.item.name)}
          database={database}
          confirmLabel="Restart"
          destructive
          successMessage={`${action.item.name} restarted`}
        />
      );
    case "sequence-rename":
      return (
        <Rename
          {...common}
          title={`Rename sequence ${action.item.name}`}
          current={action.item.name}
          build={(n) => renameSequence(schema, action.item.name, n)}
        />
      );
    case "sequence-drop":
      return (
        <Drop
          {...common}
          title={`Delete sequence ${action.item.name}?`}
          what="sequence"
          build={(cascade) => dropSequence(schema, action.item.name, cascade)}
          cascadeLabel="Also remove column defaults that use it"
        />
      );
  }
}
