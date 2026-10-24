import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorSelection, EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { cn } from "@repo/ui";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/* ── Statements ─────────────────────────────────────────────────────────── */

/**
 * The statement around `pos`: the text between the semicolons before and after it, skipping
 * semicolons inside quotes, comments and $$ bodies. On a blank line after a statement it's that
 * statement. Returns trimmed bounds, or null when the document is empty.
 */
export function statementAt(text: string, pos: number): { from: number; to: number } | null {
  const ends: number[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    const next = text[i + 1];
    if (c === "-" && next === "-") {
      const nl = text.indexOf("\n", i);
      i = nl === -1 ? text.length : nl;
    } else if (c === "/" && next === "*") {
      const close = text.indexOf("*/", i + 2);
      i = close === -1 ? text.length : close + 2;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < text.length && !(text[j] === c && text[j + 1] !== c)) j += text[j] === c ? 2 : 1;
      i = j + 1;
    } else if (c === "$") {
      const tag = /^\$[A-Za-z_]*\$/.exec(text.slice(i))?.[0];
      if (tag) {
        const close = text.indexOf(tag, i + tag.length);
        i = close === -1 ? text.length : close + tag.length;
      } else i++;
    } else {
      if (c === ";") ends.push(i + 1);
      i++;
    }
  }
  const bounds = [0, ...ends, text.length];
  const segments: { from: number; to: number }[] = [];
  for (let k = 0; k < bounds.length - 1; k++) {
    let from = bounds[k]!;
    let to = bounds[k + 1]!;
    while (from < to && /\s/.test(text[from]!)) from++;
    while (to > from && /\s/.test(text[to - 1]!)) to--;
    segments.push({ from, to });
  }
  // The segment the cursor is in, or the last non-empty one before it
  let found: { from: number; to: number } | null = null;
  for (let k = 0; k < bounds.length - 1; k++) {
    const seg = segments[k]!;
    if (seg.to > seg.from && seg.from <= pos) found = seg;
    if (pos <= bounds[k + 1]! && seg.to > seg.from && seg.from <= pos) return seg;
  }
  return found;
}

/* ── Theme: black surfaces, emerald only for the cursor and matches ─────── */

const theme = EditorView.theme(
  {
    "&": { backgroundColor: "var(--color-bg)", color: "var(--color-fg)", height: "100%", fontSize: "12.5px" },
    ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
    ".cm-content": { caretColor: "var(--color-accent)", padding: "8px 0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-accent)", borderLeftWidth: "2px" },
    "&.cm-focused": { outline: "none" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "rgb(62 207 142 / 0.18) !important",
    },
    ".cm-activeLine": { backgroundColor: "rgb(255 255 255 / 0.025)" },
    ".cm-gutters": {
      backgroundColor: "var(--color-bg)",
      color: "var(--color-fg-subtle)",
      border: "none",
      paddingRight: "4px",
    },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--color-fg-muted)" },
    ".cm-matchingBracket": { backgroundColor: "rgb(62 207 142 / 0.15)", outline: "1px solid rgb(62 207 142 / 0.4)" },
    ".cm-placeholder": { color: "var(--color-fg-subtle)" },
    ".cm-tooltip": {
      backgroundColor: "var(--color-surface-raised)",
      border: "1px solid var(--color-border-strong)",
      borderRadius: "6px",
    },
    ".cm-tooltip-autocomplete > ul > li": { padding: "2px 8px", fontFamily: "var(--font-mono)" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--color-surface-hover)",
      color: "var(--color-fg)",
    },
    ".cm-completionDetail": { color: "var(--color-fg-subtle)", marginLeft: "8px", fontStyle: "normal" },
    ".cm-errorMark": { textDecoration: "underline wavy var(--color-danger)" },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: "#c9a0f5" },
  { tag: [t.string, t.special(t.string)], color: "#a8d68a" },
  { tag: [t.number, t.bool, t.null], color: "#f2b880" },
  { tag: [t.lineComment, t.blockComment], color: "var(--color-fg-subtle)", fontStyle: "italic" },
  { tag: [t.typeName, t.standard(t.name)], color: "#7cc4f2" },
  { tag: [t.function(t.variableName), t.function(t.name)], color: "#e6d48a" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "var(--color-fg-muted)" },
  { tag: [t.special(t.name), t.quote], color: "#f0a3b8" },
]);

/* ── Component ────────────────────────────────────────────────────────── */

export interface SqlEditorHandle {
  /** Selected text, or `null` when nothing is selected. */
  getSelection: () => string | null;
  focus: () => void;
  /** Places the cursor at a 1-based character offset (e.g. an error position) and scrolls to it. */
  revealPosition: (position: number) => void;
}

export interface SqlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  /** Ctrl/⌘+Enter. Receives the selection if there is one, else the whole text. */
  onRun?: (sql: string) => void;
  readOnly?: boolean;
  /** Table → columns, for autocomplete. */
  schema?: Record<string, string[]>;
  defaultSchema?: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export const SqlEditor = forwardRef<SqlEditorHandle, SqlEditorProps>(function SqlEditor(
  { value, onChange, onRun, readOnly = false, schema, defaultSchema, placeholder, className, autoFocus },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const language = useRef(new Compartment());
  const editable = useRef(new Compartment());
  // Latest callbacks without recreating the editor
  const callbacks = useRef({ onChange, onRun });
  callbacks.current = { onChange, onRun };

  useEffect(() => {
    if (!host.current) return;
    const runKeymap = keymap.of([
      {
        // The selection, or just the statement under the cursor (selected, so you see what ran)
        key: "Mod-Enter",
        preventDefault: true,
        run: (v) => {
          const sel = v.state.selection.main;
          if (!sel.empty) {
            callbacks.current.onRun?.(v.state.sliceDoc(sel.from, sel.to));
            return true;
          }
          const statement = statementAt(v.state.doc.toString(), sel.head);
          if (!statement) return true;
          v.dispatch({ selection: EditorSelection.range(statement.from, statement.to) });
          callbacks.current.onRun?.(v.state.sliceDoc(statement.from, statement.to));
          return true;
        },
      },
      {
        // Everything in the editor
        key: "Mod-Shift-Enter",
        preventDefault: true,
        run: (v) => {
          callbacks.current.onRun?.(v.state.doc.toString());
          return true;
        },
      },
    ]);
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion({ activateOnTyping: true }),
      syntaxHighlighting(highlight),
      runKeymap,
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
      language.current.of(sql({ dialect: PostgreSQL, upperCaseKeywords: true })),
      editable.current.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
      theme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) callbacks.current.onChange?.(update.state.doc.toString());
      }),
    ];
    if (placeholder) extensions.push(placeholderExt(placeholder));

    view.current = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: value, extensions }),
    });
    if (autoFocus) view.current.focus();
    return () => {
      view.current?.destroy();
      view.current = null;
    };
    // The editor is created once; props below are synced by the effects that follow
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value changes (loading from history, switching tabs)
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: language.current.reconfigure(
        sql({ dialect: PostgreSQL, upperCaseKeywords: true, schema, defaultSchema }),
      ),
    });
  }, [schema, defaultSchema]);

  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
    });
  }, [readOnly]);

  useImperativeHandle(ref, () => ({
    getSelection: () => {
      const v = view.current;
      if (!v) return null;
      const sel = v.state.selection.main;
      return sel.empty ? null : v.state.sliceDoc(sel.from, sel.to);
    },
    focus: () => view.current?.focus(),
    revealPosition: (position) => {
      const v = view.current;
      if (!v) return;
      const pos = Math.max(0, Math.min(position - 1, v.state.doc.length));
      v.dispatch({ selection: EditorSelection.cursor(pos), scrollIntoView: true });
      v.focus();
    },
  }));

  return <div ref={host} className={cn("h-full min-h-0 overflow-hidden", className)} />;
});

/** Read-only, highlighted SQL, e.g. for previews and definitions. */
export function SqlBlock({ sql, className }: { sql: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-control border border-border", className)}>
      <SqlEditor value={sql} readOnly />
    </div>
  );
}
