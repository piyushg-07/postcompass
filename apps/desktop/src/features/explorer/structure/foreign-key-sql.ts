/** Foreign keys in a form, and the SQL they become. Pure, so the forms stay thin. */
import type { ForeignKeyInfo } from "../../../lib/bindings";
import { ident, qualified } from "../../../lib/sql";

/** A foreign key being set up in a form, before any SQL runs. */
export interface ForeignKeyDraft {
  schema: string;
  table: string;
  pairs: { column: string; refColumn: string }[];
  onUpdate: string;
  onDelete: string;
}

/**
 * A foreign key in a form's list: new ones have no `name`; existing ones keep their constraint
 * name and the values they started with, so changes become DROP + ADD.
 */
export interface ForeignKeyEntry extends ForeignKeyDraft {
  name?: string;
  original?: ForeignKeyDraft;
  toRemove?: boolean;
}

/** An existing constraint as a list entry. */
export function foreignKeyEntry(fk: ForeignKeyInfo): ForeignKeyEntry {
  const draft: ForeignKeyDraft = {
    schema: fk.referencedSchema,
    table: fk.referencedTable,
    pairs: fk.columns.map((column, i) => ({
      column,
      refColumn: fk.referencedColumns[i] ?? "",
    })),
    onUpdate: fk.onUpdate,
    onDelete: fk.onDelete,
  };
  return { ...draft, name: fk.name, original: draft };
}

/** Field by field, so key order (which spreads don't guarantee) can't make an edit appear. */
function sameDraft(a: ForeignKeyDraft, b: ForeignKeyDraft) {
  return (
    a.schema === b.schema &&
    a.table === b.table &&
    a.onUpdate === b.onUpdate &&
    a.onDelete === b.onDelete &&
    a.pairs.length === b.pairs.length &&
    a.pairs.every(
      (p, i) =>
        p.column === b.pairs[i]!.column && p.refColumn === b.pairs[i]!.refColumn,
    )
  );
}

export type ForeignKeyStatus = "ADD" | "UPDATE" | "REMOVE" | undefined;

export function foreignKeyStatus(fk: ForeignKeyEntry): ForeignKeyStatus {
  if (fk.toRemove) return "REMOVE";
  if (!fk.name) return "ADD";
  return fk.original && !sameDraft(fk, fk.original) ? "UPDATE" : undefined;
}

/** `FOREIGN KEY (…) REFERENCES … ON UPDATE … ON DELETE …`, for CREATE or ALTER TABLE. */
export function foreignKeyClause(fk: ForeignKeyDraft) {
  return (
    `FOREIGN KEY (${fk.pairs.map((p) => ident(p.column)).join(", ")}) ` +
    `REFERENCES ${qualified(fk.schema, fk.table)} (${fk.pairs.map((p) => ident(p.refColumn)).join(", ")})` +
    `${fk.onUpdate !== "NO ACTION" ? ` ON UPDATE ${fk.onUpdate}` : ""}` +
    `${fk.onDelete !== "NO ACTION" ? ` ON DELETE ${fk.onDelete}` : ""}`
  );
}

/**
 * SQL for a list of foreign keys on `schema.table`: `drops` run before column changes (so a
 * dropped or retyped column isn't blocked), `adds` after them.
 */
export function foreignKeyStatements(
  schema: string,
  table: string,
  entries: ForeignKeyEntry[],
) {
  const target = `ALTER TABLE ${qualified(schema, table)}`;
  const drops: string[] = [];
  const adds: string[] = [];
  for (const fk of entries) {
    const status = foreignKeyStatus(fk);
    if ((status === "REMOVE" || status === "UPDATE") && fk.name)
      drops.push(`${target} DROP CONSTRAINT ${ident(fk.name)};`);
    if (status === "ADD") adds.push(`${target} ADD ${foreignKeyClause(fk)};`);
    if (status === "UPDATE" && fk.name)
      adds.push(
        `${target} ADD CONSTRAINT ${ident(fk.name)} ${foreignKeyClause(fk)};`,
      );
  }
  return { drops, adds };
}

/** List state helpers shared by the table and column panels. */
export function removeForeignKey(list: ForeignKeyEntry[], index: number) {
  // A new one just disappears; an existing one is marked until saved
  return list[index]?.name
    ? list.map((x, i) => (i === index ? { ...x, toRemove: true } : x))
    : list.filter((_, i) => i !== index);
}

export function undoRemoveForeignKey(list: ForeignKeyEntry[], index: number) {
  return list.map((x, i) => (i === index ? { ...x, toRemove: false } : x));
}

export function saveForeignKey(
  list: ForeignKeyEntry[],
  index: number,
  fk: ForeignKeyDraft,
): ForeignKeyEntry[] {
  // Only the draft's fields: the form's copy may carry the entry's name/original along
  const draft: ForeignKeyDraft = {
    schema: fk.schema,
    table: fk.table,
    pairs: fk.pairs,
    onUpdate: fk.onUpdate,
    onDelete: fk.onDelete,
  };
  return index >= 0
    ? list.map((x, i) => (i === index ? { ...x, ...draft } : x))
    : [...list, draft];
}
