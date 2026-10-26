import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { bracketMatching, indentOnInput, syntaxHighlighting } from "@codemirror/language";
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
import { cn } from "@repo/ui";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { highlight, theme } from "./sql-editor-theme";
import { statementAt } from "./statements";

// Kept here too: callers import it from the editor
export { statementAt };

/* ── Component ────────────────────────────────────────────────────────── */

export interface SqlEditorHandle {
  /** Selected text, or `null` when nothing is selected. */
  getSelection: () => string | null;
  /** The selection with where it starts, else the statement under the cursor; `null` if neither. */
  getSelectionOrStatement: () => { text: string; from: number } | null;
  focus: () => void;
  /** Places the cursor at a 1-based character offset (e.g. an error position) and scrolls to it. */
  revealPosition: (position: number) => void;
}

export interface SqlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  /**
   * Ctrl/⌘+Enter runs the selection or the statement under the cursor, Ctrl/⌘+Shift+Enter
   * everything. `from` is where `sql` starts in the document (error positions are relative to it).
   */
  onRun?: (sql: string, from: number) => void;
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
  // Updated after render, not during it (writing refs while rendering breaks concurrent rendering)
  useLayoutEffect(() => {
    callbacks.current = { onChange, onRun };
  });

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
            callbacks.current.onRun?.(v.state.sliceDoc(sel.from, sel.to), sel.from);
            return true;
          }
          const statement = statementAt(v.state.doc.toString(), sel.head);
          if (!statement) return true;
          v.dispatch({ selection: EditorSelection.range(statement.from, statement.to) });
          callbacks.current.onRun?.(v.state.sliceDoc(statement.from, statement.to), statement.from);
          return true;
        },
      },
      {
        // Everything in the editor
        key: "Mod-Shift-Enter",
        preventDefault: true,
        run: (v) => {
          callbacks.current.onRun?.(v.state.doc.toString(), 0);
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
    getSelectionOrStatement: () => {
      const v = view.current;
      if (!v) return null;
      const sel = v.state.selection.main;
      if (!sel.empty) return { text: v.state.sliceDoc(sel.from, sel.to), from: sel.from };
      const statement = statementAt(v.state.doc.toString(), sel.head);
      return statement && { text: v.state.sliceDoc(statement.from, statement.to), from: statement.from };
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
