"use client";

// The navbar is a live psql prompt: sections are tables, navigating runs a query.

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { PRODUCT } from "@/config/product";
import { Github } from "@/components/ui/Icons";

const KW = "font-medium text-[#c792ea]";
const SUGGEST_TEXT = "font-sans text-[0.82rem] text-fg-secondary";

interface Table {
  name: string;
  id: string; // section id on the home page
  about: string;
}

const TABLES: Table[] = [
  { name: "features", id: "features", about: "what PostCompass does" },
  { name: "how_it_works", id: "how-it-works", about: "three steps to your first query" },
  { name: "download", id: "download", about: "installers for every OS" },
  { name: "faq", id: "faq", about: "questions, answered" },
];

type Result = { kind: "ok"; text: string } | { kind: "error"; text: string; hint: string } | null;

export default function Navbar() {
  const [active, setActive] = useState<number | null>(null);
  const [shown, setShown] = useState(""); // text currently typed after FROM
  const [draft, setDraft] = useState<string | null>(null); // what the user is typing, when focused
  const [highlight, setHighlight] = useState(0);
  const [result, setResult] = useState<Result>(null);
  const [scrolled, setScrolled] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const typer = useRef<number | undefined>(undefined);
  const resultTimer = useRef<number | undefined>(undefined);
  const navigating = useRef(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  /** Retype the table name after FROM, like someone at a prompt. */
  const typeOut = useCallback((text: string, done?: () => void) => {
    window.clearInterval(typer.current);
    if (reduced.current) {
      setShown(text);
      done?.();
      return;
    }
    setShown("");
    let i = 0;
    typer.current = window.setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(typer.current);
        done?.();
      }
    }, 34);
  }, []);

  // Follow the section on screen
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      if (navigating.current) return;
      const probe = window.innerHeight * 0.35;
      let found: number | null = null;
      TABLES.forEach((t, i) => {
        const el = document.getElementById(t.id);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.top <= probe && r.bottom > probe) found = i;
      });
      setActive((prev) => (prev === found ? prev : found));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (draft !== null || navigating.current) return;
    typeOut(active === null ? "" : TABLES[active]!.name);
  }, [active, draft, typeOut]);

  // "/" or Ctrl/Cmd+K focuses the prompt
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, [contenteditable=true], [role=application]");
      if ((e.key === "/" && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const flash = (r: Result) => {
    setResult(r);
    window.clearTimeout(resultTimer.current);
    resultTimer.current = window.setTimeout(() => setResult(null), r?.kind === "error" ? 3600 : 1800);
  };

  /** "Run" SELECT * FROM <table>: type it, show a result, then go there. */
  const run = (index: number) => {
    const t = TABLES[index]!;
    navigating.current = true;
    setDraft(null);
    inputRef.current?.blur();
    setActive(index);
    typeOut(t.name, () => {
      const ms = (0.2 + ((t.name.length * 7) % 5) / 10).toFixed(1);
      flash({ kind: "ok", text: `(1 row) · ${ms} ms` });
      const el = document.getElementById(t.id);
      if (el) {
        el.scrollIntoView({ behavior: reduced.current ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", `#${t.id}`);
        window.setTimeout(() => (navigating.current = false), 900);
      } else {
        window.location.href = `/#${t.id}`;
      }
    });
  };

  const query = (draft ?? "").trim().toLowerCase();
  const matches = useMemo(
    () => TABLES.map((t, i) => ({ t, i })).filter(({ t }) => !query || t.name.includes(query.replace(/\s+/g, "_"))),
    [query],
  );

  const submit = () => {
    if (matches[highlight]) return run(matches[highlight]!.i);
    const name = (draft ?? "").trim() || "?";
    setDraft(null);
    inputRef.current?.blur();
    flash({ kind: "error", text: `ERROR:  relation "${name}" does not exist`, hint: `try ${TABLES.map((t) => t.name).join(", ")}` });
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(matches.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Tab" && matches[highlight]) {
      e.preventDefault();
      setDraft(matches[highlight]!.t.name);
    } else if (e.key === "Escape") {
      setDraft(null);
      inputRef.current?.blur();
    }
  };

  const editing = draft !== null;

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-[100] [transition:background_0.3s_ease,backdrop-filter_0.3s_ease] ${scrolled ? "bg-[rgba(9,9,11,0.78)] backdrop-blur-[14px] backdrop-saturate-150" : ""}`}
      role="banner"
    >
      <nav
        className="mx-auto flex h-[64px] max-w-[1200px] items-center gap-5 px-6 font-mono max-[560px]:gap-[0.6rem] max-[560px]:px-4"
        aria-label="Main navigation"
      >
        <a
          href="/"
          className="inline-flex shrink-0 items-center gap-[0.6rem] text-[#e4e4e7] focus-visible:rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-hover"
          aria-label={`${PRODUCT.name} home`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={30} height={30} className="block h-[30px] w-[30px] shrink-0 rounded-[8px]" />
          <span className="font-sans text-[1.08rem] font-bold tracking-[-0.035em] whitespace-nowrap text-white max-[560px]:hidden">
            Post<em className="font-display text-[1.1em] font-medium tracking-[-0.01em] text-accent-hover italic">Compass</em>
          </span>
        </a>

        <div className="relative flex min-w-0 items-center gap-3 max-[560px]:ml-2" role="search">
          <label
            className="group/stmt inline-flex h-[36px] cursor-text items-baseline gap-2 rounded-[9px] border border-transparent px-[0.8rem] text-[0.9rem] leading-[34px] text-[#d4d4d8] [transition:border-color_0.2s_ease,background_0.2s_ease] hover:border-[rgba(255,255,255,0.08)] focus-within:border-[rgb(var(--accent-light-rgb)/0.45)]! focus-within:bg-[rgb(var(--accent-rgb)/0.05)] max-[560px]:h-[32px] max-[560px]:gap-[0.35rem] max-[560px]:px-2 max-[560px]:text-[0.75rem] max-[560px]:leading-[30px]"
            htmlFor="nav-query"
          >
            <span className={KW}>SELECT</span>
            <span className="text-fg-secondary max-[560px]:hidden">*</span>
            <span className={KW}>FROM</span>
            <span className="relative inline-flex items-center">
              <input
                id="nav-query"
                ref={inputRef}
                className="min-w-[2ch] border-none bg-transparent p-0 font-semibold text-accent-hover caret-transparent outline-none placeholder:font-normal placeholder:text-fg-faint"
                value={editing ? draft! : shown}
                placeholder={editing ? "table" : "section"}
                style={{ width: `${Math.max(1, (editing ? draft! : shown).length || (editing ? 5 : 7))}ch` }}
                spellCheck={false}
                autoComplete="off"
                aria-label="Jump to a section: type a table name"
                aria-expanded={editing}
                aria-controls="nav-suggest"
                role="combobox"
                onFocus={() => {
                  setDraft("");
                  setHighlight(0);
                }}
                onBlur={() => window.setTimeout(() => setDraft(null), 120)}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onInputKey}
              />
              <span
                className="ml-px h-[16px] w-[8px] animate-[caret-blink_1.05s_steps(1)_infinite] rounded-[1px] bg-accent-hover motion-reduce:animate-none motion-reduce:transition-none max-[560px]:h-[13px] max-[560px]:w-[6px]"
                aria-hidden="true"
              />
            </span>
            <svg
              className="-ml-[0.15rem] self-center text-fg-muted [transition:transform_0.2s_ease,color_0.2s_ease] group-hover/stmt:text-fg-secondary group-focus-within/stmt:[transform:rotate(180deg)] group-focus-within/stmt:text-accent-hover!"
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
            <span className="-ml-[0.35rem] text-fg-muted">;</span>
          </label>

          {!editing && !result && (
            <kbd className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-[5px] border border-[rgba(255,255,255,0.12)] px-[5px] font-mono text-[0.7rem] text-fg-muted max-[1080px]:hidden">
              /
            </kbd>
          )}

          {result && (
            <span
              className={`absolute top-[calc(100%_+_8px)] left-0 flex w-max max-w-[min(560px,calc(100vw_-_2rem))] animate-[nav-result-in_0.25s_ease] flex-col gap-[0.2rem] rounded-[10px] border px-[0.8rem] py-[0.55rem] text-[0.78rem] shadow-[0_16px_40px_rgba(0,0,0,0.5)] ${result.kind === "error" ? "border-[rgba(248,113,113,0.35)] bg-[#161010] text-[#f87171]" : "border-[rgb(var(--accent-light-rgb)/0.3)] bg-[#0f1412] text-accent-hover"}`}
              role="status"
            >
              {result.text}
              {result.kind === "error" && <span className="text-fg-secondary">HINT: {result.hint}</span>}
            </span>
          )}

          {editing && (
            <ul
              id="nav-suggest"
              className="absolute top-[calc(100%_+_8px)] left-0 m-0 min-w-[360px] animate-[nav-result-in_0.18s_ease] list-none rounded-[12px] border border-[rgba(255,255,255,0.1)] bg-surface p-[6px] shadow-[0_24px_60px_rgba(0,0,0,0.6)] max-[560px]:fixed max-[560px]:top-[60px] max-[560px]:right-4 max-[560px]:left-4 max-[560px]:min-w-0"
              role="listbox"
            >
              {matches.length === 0 ? (
                <li className={`p-[0.7rem] ${SUGGEST_TEXT}`}>No such table. Press Enter to see what psql says.</li>
              ) : (
                matches.map(({ t, i }, k) => (
                  <li key={t.name} role="option" aria-selected={k === highlight}>
                    <button
                      type="button"
                      className={`flex w-full cursor-pointer items-baseline gap-[0.9rem] rounded-[8px] border-none px-[0.7rem] py-[0.55rem] text-left ${k === highlight ? "bg-[rgba(255,255,255,0.06)]" : "bg-transparent"}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlight(k)}
                      onClick={() => run(i)}
                    >
                      <span className="min-w-[110px] text-[0.875rem] font-semibold text-accent-hover">{t.name}</span>
                      <span className={SUGGEST_TEXT}>{t.about}</span>
                    </button>
                  </li>
                ))
              )}
              <li className="mt-[4px] flex items-center gap-[0.35rem] border-t border-[rgba(255,255,255,0.06)] px-[0.7rem] pt-2 pb-[0.2rem] font-sans text-[0.72rem] text-fg-muted [&_kbd]:rounded-[4px] [&_kbd]:border [&_kbd]:border-[rgba(255,255,255,0.12)] [&_kbd]:px-[4px] [&_kbd]:font-mono [&_kbd]:text-[0.68rem]">
                <kbd>↑</kbd>
                <kbd>↓</kbd> pick <kbd>Tab</kbd> complete <kbd>↵</kbd> run
              </li>
            </ul>
          )}
        </div>


        <div className="ml-auto flex shrink-0 items-center gap-2">
          <a
            href={PRODUCT.github}
            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[8px] text-[#8b8b94] [transition:color_0.15s_ease,background_0.15s_ease] hover:bg-[rgba(255,255,255,0.06)] hover:text-white focus-visible:bg-[rgba(255,255,255,0.06)] focus-visible:text-white focus-visible:outline-none"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="PostCompass on GitHub"
            title="GitHub"
          >
            <Github size={16} />
          </a>
          <a
            href="/download"
            className="inline-flex h-[36px] items-center rounded-[9px] bg-accent px-[0.95rem] font-mono text-[0.85rem] font-bold text-accent-fg shadow-[inset_0_0_0_1px_rgb(var(--accent-pale-rgb)/0.5)] [transition:background_0.2s_ease,transform_0.15s_ease] hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-pale)] active:[transform:scale(0.97)] max-[560px]:hidden"
            title="Download PostCompass"
          >
            <span className="mr-px opacity-55">\</span>download
          </a>
        </div>
      </nav>
    </header>
  );
}
