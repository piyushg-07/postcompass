/**
 * Splits clipboard text into rows of cells. Excel and Google Sheets copy as tab-separated text,
 * quoting cells that contain tabs, line breaks or quotes; CSV (commas) works too.
 */
export function parseClipboard(
  text: string,
  delimiter?: "\t" | ",",
): string[][] {
  const clean = text
    // Files saved by Excel start with a byte order mark, which would stick to the first header
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n+$/, "");
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

/** Whether a parsed row has no values at all (a blank line, or `,,,`). */
export function isBlankRow(row: readonly string[]) {
  return row.every((cell) => cell === "");
}
