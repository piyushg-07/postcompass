import {
  Button,
  Checkbox,
  Dialog,
  DialogClose,
  Select,
  SheetContent,
} from "@repo/ui";
import { AlertTriangle, ClipboardPaste, FileUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { ColumnInfo } from "../../../lib/bindings";
import {
  baseTypeName,
  INTEGER_TYPES,
  shortType,
  typeKind,
} from "../../../lib/pg-types";

/**
 * Splits clipboard text into rows of cells. Excel and Google Sheets copy as tab-separated text,
 * quoting cells that contain tabs, line breaks or quotes; CSV (commas) works too.
 */
export function parseClipboard(
  text: string,
  delimiter?: "\t" | ",",
): string[][] {
  const clean = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (!clean) return [];
  delimiter ??= clean.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

/** Whether pasted text looks like rows of a table rather than a single value. */
export function isTabular(text: string) {
  const rows = parseClipboard(text);
  return rows.length > 1 || (rows[0]?.length ?? 0) > 1;
}

const SKIP = "__skip__";

const BOOLS = new Set([
  "true",
  "false",
  "t",
  "f",
  "yes",
  "no",
  "y",
  "n",
  "on",
  "off",
  "1",
  "0",
]);
const UUID =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/**
 * Why a pasted value won't fit `column`, checked before inserting; `null` when it looks fine.
 * Mirrors what PostgreSQL accepts closely enough to catch typos like "abcd" in a number column.
 */
function cellProblem(
  value: string,
  column: ColumnInfo,
  enums: ReadonlyMap<string, string[]>,
): string | null {
  const v = value.trim();
  const kind = typeKind(column.dataType, new Set(enums.keys()));
  const base = baseTypeName(column.dataType);
  switch (kind) {
    case "number":
      if (INTEGER_TYPES.has(base))
        return /^[+-]?\d+$/.test(v) ? null : "isn't a whole number";
      return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(v)
        ? null
        : "isn't a number";
    case "bool":
      return BOOLS.has(v.toLowerCase()) ? null : "isn't true or false";
    case "date":
    case "timestamp":
    case "timestamptz":
      return Number.isNaN(Date.parse(v.replace(" ", "T"))) &&
        Number.isNaN(Date.parse(v))
        ? "isn't a date"
        : null;
    case "time":
      return /^\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?/.test(v) ? null : "isn't a time";
    case "json":
      try {
        JSON.parse(value);
        return null;
      } catch {
        return "isn't valid JSON";
      }
    case "enum": {
      const allowed = enums.get(base);
      return !allowed || allowed.includes(v)
        ? null
        : `isn't one of ${allowed.join(", ")}`;
    }
    case "array":
      return /^\{.*\}$/s.test(v) ? null : "isn't a list like {a,b}";
    default:
      if (base === "uuid" && !UUID.test(v)) return "isn't a uuid";
      return null;
  }
}
/** Rows shown in the preview; the rest are inserted too. */
const PREVIEW_ROWS = 100;

/** Columns a pasted value can go into: generated and always-identity ones fill themselves. */
const writable = (c: ColumnInfo) => !c.generated && c.identity !== "always";
/**
 * Generated ids (identity or a primary key with a default, like serial or uuid), which pasted
 * data without a header usually leaves out when matching by order.
 */
const automatic = (c: ColumnInfo) =>
  c.identity !== null || (c.isPrimaryKey && c.default !== null);

/**
 * Matches pasted columns to table columns: by header names when the first row is a header,
 * otherwise by order, skipping columns the database fills in when there are fewer values.
 */
function guessMapping(rows: string[][], columns: ColumnInfo[]) {
  const width = Math.max(...rows.map((r) => r.length));
  const targets = columns.filter(writable);
  const byName = new Map(targets.map((c) => [c.name.toLowerCase(), c.name]));
  const header = rows[0] ?? [];
  const headerHits = header.filter((h) =>
    byName.has(h.trim().toLowerCase()),
  ).length;
  if (headerHits > 0 && headerHits >= Math.ceil(header.length / 2))
    return {
      hasHeader: true,
      mapping: Array.from(
        { length: width },
        (_, i) => byName.get((header[i] ?? "").trim().toLowerCase()) ?? SKIP,
      ),
    };
  const order =
    width >= targets.length ? targets : targets.filter((c) => !automatic(c));
  const list = order.length >= width ? order : targets;
  return {
    hasHeader: false,
    mapping: Array.from({ length: width }, (_, i) => list[i]?.name ?? SKIP),
  };
}

/**
 * Side panel previewing rows pasted from a spreadsheet: which pasted column goes into which
 * table column, the rows themselves, then "Insert N rows". Empty cells use the column's default
 * (or NULL).
 */
export function PasteRowsDialog({
  text,
  fileName,
  table,
  columns,
  enums = new Map(),
  saving,
  onCancel,
  onInsert,
}: {
  /** Clipboard text or file contents, or null when closed. */
  text: string | null;
  /** The imported file, when the rows come from a CSV/TSV file rather than the clipboard. */
  fileName?: string | null;
  table: string;
  columns: ColumnInfo[];
  /** Enum values by type name, to check enum cells. */
  enums?: ReadonlyMap<string, string[]>;
  saving: boolean;
  onCancel: () => void;
  onInsert: (rows: { column: string; value: string }[][]) => void;
}) {
  return (
    <Dialog open={text !== null} onOpenChange={(o) => !o && onCancel()}>
      {text !== null && (
        <PasteBody
          key={text}
          text={text}
          fileName={fileName ?? null}
          table={table}
          columns={columns}
          enums={enums}
          saving={saving}
          onInsert={onInsert}
        />
      )}
    </Dialog>
  );
}

function PasteBody({
  text,
  fileName,
  table,
  columns,
  enums,
  saving,
  onInsert,
}: {
  text: string;
  fileName: string | null;
  table: string;
  columns: ColumnInfo[];
  enums: ReadonlyMap<string, string[]>;
  saving: boolean;
  onInsert: (rows: { column: string; value: string }[][]) => void;
}) {
  // A file's delimiter comes from its extension; a cell may hold tabs in a CSV
  const delimiter = fileName
    ? /\.(tsv|tab)$/i.test(fileName)
      ? "\t"
      : ","
    : undefined;
  const parsed = useMemo(
    () => parseClipboard(text, delimiter),
    [text, delimiter],
  );
  const guess = useMemo(() => guessMapping(parsed, columns), [parsed, columns]);
  const [hasHeader, setHasHeader] = useState(guess.hasHeader);
  const [mapping, setMapping] = useState(guess.mapping);
  const rows = hasHeader ? parsed.slice(1) : parsed;
  const used = mapping.filter((m) => m !== SKIP);
  const duplicates = used.filter((m, i) => used.indexOf(m) !== i);
  const required = columns.filter(
    (c) =>
      writable(c) && !c.nullable && c.default === null && c.identity === null,
  );
  const missing = required.filter((c) => !used.includes(c.name));
  const [skipBad, setSkipBad] = useState(false);

  // Every mapped, non-empty cell checked against its column's type
  const byName = new Map(columns.map((c) => [c.name, c]));
  const problems = rows.flatMap((r, ri) =>
    mapping.flatMap((m, i) => {
      const value = r[i] ?? "";
      const column = byName.get(m);
      if (m === SKIP || value === "" || !column) return [];
      const reason = cellProblem(value, column, enums);
      return reason ? [{ row: ri, col: i, column: m, value, reason }] : [];
    }),
  );
  const bad = new Set(problems.map((p) => `${p.row}:${p.col}`));
  const badRows = new Set(problems.map((p) => p.row));
  const toInsert = skipBad ? rows.filter((_, ri) => !badRows.has(ri)) : rows;
  const valid =
    toInsert.length > 0 &&
    used.length > 0 &&
    duplicates.length === 0 &&
    (problems.length === 0 || skipBad);

  const insert = () =>
    onInsert(
      toInsert.map((r) =>
        mapping.flatMap((column, i) =>
          // Empty cells are left out, so the column's default (or NULL) applies
          column === SKIP || (r[i] ?? "") === ""
            ? []
            : [{ column, value: r[i]! }],
        ),
      ),
    );

  const options = [
    { value: SKIP, label: "Skip" },
    ...columns.filter(writable).map((c) => ({
      value: c.name,
      label: c.name,
      hint: shortType(c.dataType),
    })),
  ];

  return (
    <SheetContent
      title={
        <span className="flex items-center gap-2">
          {fileName ? (
            <FileUp className="size-4 text-accent" />
          ) : (
            <ClipboardPaste className="size-4 text-accent" />
          )}
          {fileName ? "Import" : "Paste"} {rows.length.toLocaleString()} row
          {rows.length === 1 ? "" : "s"} into{" "}
          <span className="font-mono">{table}</span>
        </span>
      }
      description={
        fileName
          ? `From ${fileName}. Check which column each file column goes into. Empty cells use the column's default.`
          : "Check which column each pasted column goes into. Empty cells use the column's default."
      }
      className="w-[860px]"
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="primary"
            loading={saving}
            disabled={!valid}
            onClick={insert}
          >
            Insert {toInsert.length.toLocaleString()} row
            {toInsert.length === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-fg-muted">
          <Checkbox
            checked={hasHeader}
            onCheckedChange={(v) => setHasHeader(v === true)}
          />
          First row is a header
        </label>
        <div className="min-h-0 flex-1 overflow-auto rounded-card border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr>
                {mapping.map((m, i) => (
                  <th
                    key={i}
                    className="min-w-36 border-r border-b border-border p-1.5 font-normal"
                  >
                    <Select
                      size="sm"
                      mono
                      aria-label={`Column for pasted column ${i + 1}`}
                      value={m}
                      onValueChange={(v) =>
                        setMapping((all) =>
                          all.map((x, j) => (j === i ? v : x)),
                        )
                      }
                      options={options}
                    />
                    {hasHeader && (
                      <p className="mt-1 truncate px-1 text-[10px] text-fg-subtle">
                        from “{parsed[0]?.[i] ?? ""}”
                      </p>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, PREVIEW_ROWS).map((r, ri) => (
                <tr
                  key={ri}
                  className={
                    skipBad && badRows.has(ri) ? "opacity-40" : undefined
                  }
                >
                  {mapping.map((m, i) => (
                    <td
                      key={i}
                      className={
                        "max-w-48 truncate border-r border-b border-border px-2.5 py-1.5 " +
                        (m === SKIP
                          ? "text-fg-subtle line-through"
                          : bad.has(`${ri}:${i}`)
                            ? "bg-danger/10 text-danger ring-1 ring-danger/60 ring-inset"
                            : "text-fg")
                      }
                    >
                      {r[i] === undefined || r[i] === "" ? (
                        <span className="text-fg/40">DEFAULT</span>
                      ) : (
                        r[i]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > PREVIEW_ROWS && (
          <p className="text-xs text-fg-subtle">
            …and {(rows.length - PREVIEW_ROWS).toLocaleString()} more row
            {rows.length - PREVIEW_ROWS === 1 ? "" : "s"}
          </p>
        )}
        {problems.length > 0 && (
          <div className="flex flex-col gap-2 rounded-control border border-danger/30 bg-danger/5 p-2.5 text-xs">
            <span className="flex items-center gap-2 text-fg">
              <AlertTriangle className="size-3.5 shrink-0 text-danger" />
              {problems.length} cell{problems.length === 1 ? "" : "s"} in{" "}
              {badRows.size} row{badRows.size === 1 ? "" : "s"} won&apos;t fit
              their column
            </span>
            <ul className="flex flex-col gap-0.5 pl-5.5 text-fg-muted">
              {problems.slice(0, 5).map((p) => (
                <li key={`${p.row}:${p.col}`}>
                  Row {p.row + 1}, <span className="font-mono">{p.column}</span>
                  : “<span className="text-fg">{p.value}</span>” {p.reason}
                </li>
              ))}
              {problems.length > 5 && <li>…and {problems.length - 5} more</li>}
            </ul>
            <label className="flex w-fit cursor-pointer items-center gap-2 pl-5.5 text-fg">
              <Checkbox
                checked={skipBad}
                onCheckedChange={(v) => setSkipBad(v === true)}
              />
              Skip the {badRows.size} row{badRows.size === 1 ? "" : "s"} with
              problems and insert the rest
            </label>
          </div>
        )}
        {(duplicates.length > 0 || missing.length > 0) && (
          <div className="flex items-start gap-2 rounded-control border border-warning/30 bg-warning/5 p-2.5 text-xs">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span className="text-fg">
              {duplicates.length > 0
                ? `${duplicates[0]} is chosen for more than one pasted column.`
                : `Required column${missing.length === 1 ? "" : "s"} not filled: ${missing.map((c) => c.name).join(", ")}. The insert will fail unless you map ${missing.length === 1 ? "it" : "them"}.`}
            </span>
          </div>
        )}
      </div>
    </SheetContent>
  );
}
