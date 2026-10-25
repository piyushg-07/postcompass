/**
 * A small SQL lexer for the editor: where statements end, and the text with comments and quoted
 * contents masked out so keyword checks can't be fooled by them. Pure, so it's easy to test.
 */

/** Characters that continue an identifier (PostgreSQL allows `$` after the first one). */
const IDENT_CHAR = /[\w$\u0080-￿]/;
const IDENT_START = /[A-Za-z_\u0080-￿]/;
/** `$$` or `$tag$`; a tag is an identifier without `$` (so `$1` is a parameter, not a quote). */
const DOLLAR_TAG = /\$(?:[A-Za-z_\u0080-￿][\w\u0080-￿]*)?\$/y;

export interface Scan {
  /**
   * The text, same length, with comments blanked and the contents of strings, quoted identifiers
   * and dollar-quoted bodies replaced (identifiers by `_`, so they still read as one word).
   * A `DO` block's body runs right away, so it stays visible (itself masked the same way).
   */
  masked: string;
  /** Offsets just after each top-level `;`. */
  ends: number[];
}

/**
 * Lexes `text` once. Handles `--` and nested `/* *\/` comments, '' and E'\'' strings, ""
 * identifiers, dollar quotes (`$$`, `$fn1$`), and `BEGIN ATOMIC … END` function bodies, whose
 * semicolons don't end the statement (like psql).
 */
export function scanSql(text: string): Scan {
  const out: string[] = [];
  const ends: number[] = [];
  // The first words of the current statement, to spot DO blocks and CREATE FUNCTION bodies
  let words: string[] = [];
  let routine = false;
  let depth = 0;
  let i = 0;
  const blank = (from: number, to: number) => {
    // Keep line breaks so line-based logic still lines up
    out.push(text.slice(from, to).replace(/[^\n]/g, " "));
  };

  while (i < text.length) {
    const c = text[i]!;
    const next = text[i + 1];
    const prev = i > 0 ? text[i - 1]! : "";

    if (c === "-" && next === "-") {
      const nl = text.indexOf("\n", i);
      const end = nl === -1 ? text.length : nl;
      blank(i, end);
      i = end;
    } else if (c === "/" && next === "*") {
      let level = 1;
      let j = i + 2;
      while (j < text.length && level > 0) {
        if (text[j] === "/" && text[j + 1] === "*") {
          level++;
          j += 2;
        } else if (text[j] === "*" && text[j + 1] === "/") {
          level--;
          j += 2;
        } else j++;
      }
      blank(i, j);
      i = j;
    } else if (c === "'") {
      // E'…' strings take backslash escapes; the E is the word right before the quote
      const escapes =
        /[eE]/.test(prev) && (i < 2 || !IDENT_CHAR.test(text[i - 2]!));
      let j = i + 1;
      while (j < text.length) {
        if (escapes && text[j] === "\\") j += 2;
        else if (text[j] === "'" && text[j + 1] === "'") j += 2;
        else if (text[j] === "'") break;
        else j++;
      }
      const end = Math.min(j + 1, text.length);
      out.push(`'${" ".repeat(Math.max(0, end - i - 2))}${end - i > 1 ? "'" : ""}`);
      i = end;
    } else if (c === '"') {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '"' && text[j + 1] === '"') j += 2;
        else if (text[j] === '"') break;
        else j++;
      }
      const end = Math.min(j + 1, text.length);
      out.push("_".repeat(end - i));
      if (words.length < 4) words.push("_");
      i = end;
    } else if (c === "$" && !IDENT_CHAR.test(prev)) {
      DOLLAR_TAG.lastIndex = i;
      const tag = DOLLAR_TAG.exec(text)?.[0];
      if (!tag) {
        out.push(c);
        i++;
        continue;
      }
      const close = text.indexOf(tag, i + tag.length);
      const bodyEnd = close === -1 ? text.length : close;
      const end = close === -1 ? text.length : close + tag.length;
      if (words[0] === "do") {
        out.push(tag, scanSql(text.slice(i + tag.length, bodyEnd)).masked);
        if (close !== -1) out.push(tag);
      } else {
        out.push(`'${" ".repeat(Math.max(0, end - i - 2))}${end - i > 1 ? "'" : ""}`);
      }
      i = end;
    } else if (IDENT_START.test(c) && !IDENT_CHAR.test(prev)) {
      let j = i + 1;
      while (j < text.length && IDENT_CHAR.test(text[j]!)) j++;
      const word = text.slice(i, j).toLowerCase();
      if (words.length < 4) {
        words.push(word);
        // CREATE [OR REPLACE] FUNCTION|PROCEDURE: its BEGIN ATOMIC body holds semicolons
        routine =
          words[0] === "create" &&
          (words[1] === "function" ||
            words[1] === "procedure" ||
            (words[1] === "or" &&
              words[2] === "replace" &&
              (words[3] === "function" || words[3] === "procedure")));
      }
      if (routine) {
        if (word === "begin" || word === "case") depth++;
        else if (word === "end" && depth > 0) depth--;
      }
      out.push(text.slice(i, j));
      i = j;
    } else {
      if (c === ";" && depth === 0) {
        ends.push(i + 1);
        words = [];
        routine = false;
      }
      out.push(c);
      i++;
    }
  }
  return { masked: out.join(""), ends };
}

export interface StatementRange {
  /** Trimmed bounds of the statement text. */
  from: number;
  to: number;
  /** Where its raw segment ends (just after its `;`, or the end of the text). */
  end: number;
  /** False for a segment with only whitespace and comments. */
  hasCode: boolean;
}

/** Every segment between top-level semicolons, trimmed of surrounding whitespace. */
export function splitStatements(text: string, scan = scanSql(text)) {
  const bounds = [0, ...scan.ends, text.length];
  const out: StatementRange[] = [];
  for (let k = 0; k < bounds.length - 1; k++) {
    let from = bounds[k]!;
    let to = bounds[k + 1]!;
    if (from === to) continue;
    while (from < to && /\s/.test(text[from]!)) from++;
    while (to > from && /\s/.test(text[to - 1]!)) to--;
    out.push({
      from,
      to,
      end: bounds[k + 1]!,
      hasCode: /[^\s;]/.test(scan.masked.slice(from, to)),
    });
  }
  return out;
}

/**
 * The statement around `pos`: the text between the semicolons before and after it, skipping
 * semicolons inside quotes, comments and $$ bodies. On a blank line (or a comment) after a
 * statement it's that statement; before the first one, the first. Returns trimmed bounds, or
 * null when there is no SQL.
 */
export function statementAt(
  text: string,
  pos: number,
): { from: number; to: number } | null {
  let before: StatementRange | null = null;
  for (const s of splitStatements(text)) {
    if (!s.hasCode) continue;
    if (s.from > pos) return pick(before ?? s);
    before = s;
    if (pos <= s.end) break;
  }
  return before && pick(before);
}

const pick = (s: StatementRange) => ({ from: s.from, to: s.to });

export interface SqlIssue {
  title: string;
  text: string;
}

/**
 * Statements that can lose data, found the way Supabase does it: DROP, TRUNCATE and DELETE, and
 * UPDATE without a WHERE. Comments, quoted text and function bodies are ignored; DO blocks are
 * checked, since they run right away.
 */
export function destructiveIssues(sql: string): SqlIssue[] {
  const scan = scanSql(sql);
  const code = scan.masked;
  const issues: SqlIssue[] = [];
  if (/\b(drop|truncate|delete\s+from)\b/i.test(code))
    issues.push({
      title: "Query has destructive operation",
      text: "Make sure you are not accidentally removing something important.",
    });
  const updateWithoutWhere = splitStatements(sql, scan).some((s) => {
    const statement = code.slice(s.from, s.to);
    // UPDATE [ONLY] table [[AS] alias] SET, but not ON CONFLICT DO UPDATE SET
    const update =
      /\bupdate\s+(?:only\s+)?(?!set\b)\S+(?:\s+(?:as\s+)?(?!set\b)\w+)?\s+set\b/i.exec(
        statement,
      );
    return update && !/\bwhere\b/i.test(statement.slice(update.index));
  });
  if (updateWithoutWhere)
    issues.push({
      title: "Query uses update without a where clause",
      text: "Without a where clause, this could update all the rows in the table.",
    });
  return issues;
}

const WRITES = new Set([
  "create",
  "alter",
  "drop",
  "truncate",
  "comment",
  "grant",
  "revoke",
  "insert",
  "update",
  "delete",
  "merge",
  "copy",
  "refresh",
  "import",
  "reindex",
  "cluster",
  "call",
  "do",
  "security",
]);

/**
 * Whether running `sql` may change what the explorer shows (tables, columns, rows, functions…):
 * "server" for database-level changes, "database" for any other statement that writes, else null.
 * Judged by each statement's first word (and data-modifying CTEs), erring on the side of refreshing.
 */
export function changeScope(sql: string): "server" | "database" | null {
  const scan = scanSql(sql);
  let scope: "server" | "database" | null = null;
  for (const s of splitStatements(sql, scan)) {
    const code = scan.masked.slice(s.from, s.to);
    if (/^\s*(create|alter|drop)\s+database\b/i.test(code)) return "server";
    const first = /^\s*([a-z]+)/i.exec(code)?.[1]?.toLowerCase();
    if (
      (first && WRITES.has(first)) ||
      (first === "with" && /\b(insert|update|delete|merge)\b/i.test(code))
    )
      scope = "database";
  }
  return scope;
}
