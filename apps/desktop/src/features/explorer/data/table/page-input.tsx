import { useState } from "react";

/** The page number box in the footer; Enter jumps to that page. */
export function PageInput({
  page,
  max,
  disabled,
  onChange,
}: {
  page: number;
  max: number | null;
  disabled: boolean;
  onChange: (page: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const go = () => {
    const n = Number(text);
    if (Number.isInteger(n) && n >= 1) onChange(Math.min(n, max ?? n) - 1);
    setText(null);
  };
  return (
    <input
      aria-label="Page"
      disabled={disabled}
      value={text ?? String(page + 1)}
      onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
      onKeyDown={(e) => {
        if (e.key === "Enter") go();
        if (e.key === "Escape") setText(null);
      }}
      onBlur={() => setText(null)}
      className="h-6 w-12 rounded-control border border-border-strong bg-bg px-1.5 text-center font-mono text-xs text-fg outline-none focus:border-accent disabled:opacity-50"
    />
  );
}
