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
        key: "Mod-Enter",
        preventDefault: true,
        run: (v) => {
          const sel = v.state.selection.main;
          const text = sel.empty ? v.state.doc.toString() : v.state.sliceDoc(sel.from, sel.to);
          callbacks.current.onRun?.(text);
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
