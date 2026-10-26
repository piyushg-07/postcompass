import { HighlightStyle } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/* ── Theme: black surfaces, accent only for the cursor and matches ─────── */

export const theme = EditorView.theme(
  {
    "&": { backgroundColor: "var(--color-bg)", color: "var(--color-fg)", height: "100%", fontSize: "12.5px" },
    ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
    ".cm-content": { caretColor: "var(--color-accent)", padding: "8px 0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-accent)", borderLeftWidth: "2px" },
    "&.cm-focused": { outline: "none" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "color-mix(in srgb, var(--color-accent) 18%, transparent) !important",
    },
    ".cm-activeLine": { backgroundColor: "rgb(255 255 255 / 0.025)" },
    ".cm-gutters": {
      backgroundColor: "var(--color-bg)",
      color: "var(--color-fg-subtle)",
      border: "none",
      paddingRight: "4px",
    },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--color-fg-muted)" },
    ".cm-matchingBracket": {
      backgroundColor: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
      outline: "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)",
    },
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

export const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: "#c9a0f5" },
  { tag: [t.string, t.special(t.string)], color: "#a8d68a" },
  { tag: [t.number, t.bool, t.null], color: "#f2b880" },
  { tag: [t.lineComment, t.blockComment], color: "var(--color-fg-subtle)", fontStyle: "italic" },
  { tag: [t.typeName, t.standard(t.name)], color: "#7cc4f2" },
  { tag: [t.function(t.variableName), t.function(t.name)], color: "#e6d48a" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "var(--color-fg-muted)" },
  { tag: [t.special(t.name), t.quote], color: "#f0a3b8" },
]);
