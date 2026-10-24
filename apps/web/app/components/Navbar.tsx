"use client";

// The navbar is a live psql prompt: sections are tables, navigating runs a query.

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { PRODUCT } from "../config/product";
import { Github } from "./Icons";
import styles from "./Navbar.module.css";

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
    <header className={`${styles.bar} ${scrolled ? styles.scrolled : ""}`} role="banner">
      <nav className={styles.inner} aria-label="Main navigation">
        <a href="/" className={styles.brand} aria-label={`${PRODUCT.name} home`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={30} height={30} className={styles.mark} />
          <span className={styles.word}>
            Post<em>Compass</em>
          </span>
        </a>

        <div className={styles.prompt} role="search">
          <label className={styles.statement} htmlFor="nav-query">
            <span className={styles.kw}>SELECT</span>
            <span className={styles.star}>*</span>
            <span className={styles.kw}>FROM</span>
            <span className={styles.tokenWrap}>
              <input
                id="nav-query"
                ref={inputRef}
                className={styles.token}
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
              <span className={styles.caret} aria-hidden="true" />
            </span>
            <svg className={styles.chevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
            <span className={styles.semi}>;</span>
          </label>

          {!editing && !result && <kbd className={styles.hintKey}>/</kbd>}

          {result && (
            <span className={`${styles.result} ${result.kind === "error" ? styles.resultError : ""}`} role="status">
              {result.text}
              {result.kind === "error" && <span className={styles.resultHint}>HINT: {result.hint}</span>}
            </span>
          )}

          {editing && (
            <ul id="nav-suggest" className={styles.suggest} role="listbox">
              {matches.length === 0 ? (
                <li className={styles.suggestEmpty}>No such table. Press Enter to see what psql says.</li>
              ) : (
                matches.map(({ t, i }, k) => (
                  <li key={t.name} role="option" aria-selected={k === highlight}>
                    <button
                      type="button"
                      className={`${styles.suggestItem} ${k === highlight ? styles.suggestOn : ""}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlight(k)}
                      onClick={() => run(i)}
                    >
                      <span className={styles.suggestName}>{t.name}</span>
                      <span className={styles.suggestAbout}>{t.about}</span>
                    </button>
                  </li>
                ))
              )}
              <li className={styles.suggestFoot}>
                <kbd>↑</kbd>
                <kbd>↓</kbd> pick <kbd>Tab</kbd> complete <kbd>↵</kbd> run
              </li>
            </ul>
          )}
        </div>


        <div className={styles.actions}>
          <a
            href={PRODUCT.github}
            className={styles.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="PostCompass on GitHub"
            title="GitHub"
          >
            <Github size={16} />
          </a>
          <a href="/download" className={styles.cta} title="Download PostCompass">
            <span className={styles.ctaSlash}>\</span>download
          </a>
        </div>
      </nav>
    </header>
  );
}
