"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Server,
  Table,
  ArrowRightLeft,
  Code,
  Activity,
  Layers,
  Cloud,
  Search,
  Database,
  Columns,
  Shield,
  Terminal,
  Lock,
  Check,
} from "./Icons";
import styles from "./FeaturesSection.module.css";

type IconType = React.FC<{ size?: number; className?: string }>;

interface Showcase {
  id: string;
  icon: IconType;
  label: string;
  title: string;
  description: string;
  points: string[];
  image: string;
  alt: string;
}

const SHOWCASE: Showcase[] = [
  {
    id: "local",
    icon: Server,
    label: "Local PostgreSQL",
    title: "PostgreSQL in one click",
    description:
      "Pick a version and PostCompass downloads, verifies and starts a private PostgreSQL server for you. No installer wizard, no admin rights, no Docker.",
    points: [
      "PostgreSQL 14 to 18, side by side",
      "Official binaries, checksum-verified",
      "Passwords kept in your system keychain",
    ],
    image: "/screens/create-server.webp",
    alt: "A new local PostgreSQL 18 server finishing setup",
  },
  {
    id: "table",
    icon: Table,
    label: "Table editor",
    title: "A table editor you already know",
    description:
      "A Supabase-style grid where edits save instantly. Filter, sort, page through and export your data without writing SQL.",
    points: [
      "Filter pills with suggestions for enum values",
      "Undo and redo for every edit",
      "Paste rows from a spreadsheet or import CSV",
    ],
    image: "/screens/table-editor.webp",
    alt: "The orders table filtered to refunded orders",
  },
  {
    id: "relations",
    icon: ArrowRightLeft,
    label: "Foreign keys",
    title: "Follow your foreign keys",
    description:
      "Peek at the referenced record right from the cell, then jump to its table. Column headers show distinct values, NULLs and the most common values.",
    points: [
      "Inline preview of the linked record",
      "Column stats in one click",
      "Freeze, hide and reorder columns",
    ],
    image: "/screens/foreign-key-peek.webp",
    alt: "Previewing the customer referenced by an order",
  },
  {
    id: "sql",
    icon: Code,
    label: "SQL editor",
    title: "SQL that knows your schema",
    description:
      "Autocomplete for your tables and columns, multiple result sets, and a safety check before anything destructive runs.",
    points: [
      "Ctrl+Enter runs the statement under the cursor",
      "Warns before DROP, TRUNCATE or UPDATE without WHERE",
      "History, saved queries and templates",
    ],
    image: "/screens/sql-editor.webp",
    alt: "A revenue-by-category query and its results",
  },
  {
    id: "explain",
    icon: Activity,
    label: "Visual EXPLAIN",
    title: "See why a query is slow",
    description:
      "EXPLAIN ANALYZE as a readable tree with timing bars. It runs inside a transaction that's rolled back, so it's safe even on writes.",
    points: [
      "The slowest step is flagged for you",
      "Estimated vs actual rows side by side",
      "Chart any result as bars or lines",
    ],
    image: "/screens/explain-plan.webp",
    alt: "An EXPLAIN ANALYZE plan with the slowest step highlighted",
  },
  {
    id: "diagram",
    icon: Layers,
    label: "ER diagram",
    title: "Your schema, mapped",
    description:
      "An interactive diagram with column-to-column relationships. Hover a table to light up everything it's connected to.",
    points: [
      "Drag tables around, positions are remembered",
      "Auto-arrange, minimap and jump to table",
      "Double-click a table to open it",
    ],
    image: "/screens/er-diagram.webp",
    alt: "ER diagram highlighting the relationships of the orders table",
  },
  {
    id: "cloud",
    icon: Cloud,
    label: "Cloud connections",
    title: "Every cloud, one place",
    description:
      "Connect to AWS RDS, Supabase, Neon, Cloud SQL, Azure and more with provider presets, and test the connection before you save it.",
    points: [
      "Encryption up to full certificate verification",
      "Local and cloud databases side by side",
      "Credentials never written to disk in plain text",
    ],
    image: "/screens/cloud-providers.webp",
    alt: "Choosing a cloud provider for a new connection",
  },
];

const MORE = [
  { icon: Search, title: "Command palette", text: "Press Ctrl+K to jump to any table, query or action." },
  { icon: Database, title: "Backup and restore", text: "pg_dump and pg_restore built in, as compressed or plain SQL." },
  { icon: Columns, title: "Schema designer", text: "Tables, indexes, constraints and triggers, with a SQL preview." },
  { icon: Shield, title: "Row Level Security", text: "Turn on RLS and write policies from ready-made templates." },
  { icon: Terminal, title: "Connect snippets", text: "Connection strings and code for Prisma, Drizzle, Node, Python and Go." },
  { icon: Lock, title: "Private by default", text: "No account, no telemetry. Local servers only listen on 127.0.0.1." },
];

const ROTATE_MS = 7000;

export default function FeaturesSection() {
  const [active, setActive] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [hovered, setHovered] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setAutoplay(false);
  }, []);

  const running = autoplay && !hovered;

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % SHOWCASE.length), ROTATE_MS);
    return () => window.clearTimeout(id);
  }, [running, active]);

  const select = (i: number) => {
    setAutoplay(false);
    setActive(i);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + SHOWCASE.length) % SHOWCASE.length;
    select(next);
    tabRefs.current[next]?.focus();
  };

  const current = SHOWCASE[active]!;

  return (
    <section className={`section ${styles.section}`} id="features">
      <div className={styles.backdrop} aria-hidden="true">
        <span className={styles.dots} />
      </div>
      <div className={`container ${styles.inner}`}>
        <div className="section-header">
          <span className="section-badge">Features</span>
          <h2 className="section-title">Everything you reach for, in one app</h2>
          <p className="section-description">
            From a fresh local database to a production query plan. Every screen below is the real app.
          </p>
        </div>

        <div
          className={styles.showcase}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className={styles.tabs} role="tablist" aria-label="PostCompass features" aria-orientation="vertical">
            {SHOWCASE.map((f, i) => {
              const Icon = f.icon;
              const selected = i === active;
              return (
                <button
                  key={f.id}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`feature-tab-${f.id}`}
                  aria-selected={selected}
                  aria-controls="feature-panel"
                  tabIndex={selected ? 0 : -1}
                  className={`${styles.tab} ${selected ? styles.tabActive : ""}`}
                  onClick={() => select(i)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                >
                  <span className={styles.tabIcon}>
                    <Icon size={16} />
                  </span>
                  <span className={styles.tabText}>
                    <span className={styles.tabLabel}>{f.label}</span>
                  </span>
                  {selected && autoplay && (
                    <span
                      key={active}
                      className={styles.tabProgress}
                      style={{ animationDuration: `${ROTATE_MS}ms`, animationPlayState: running ? "running" : "paused" }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div
            className={styles.panel}
            role="tabpanel"
            id="feature-panel"
            aria-labelledby={`feature-tab-${current.id}`}
          >
            <div className={styles.frame}>
              <div className={styles.frameBar} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className={styles.shots}>
                {SHOWCASE.map((f, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={f.id}
                    src={f.image}
                    alt={i === active ? f.alt : ""}
                    width={1600}
                    height={1000}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className={`${styles.shot} ${i === active ? styles.shotActive : ""}`}
                    aria-hidden={i !== active}
                  />
                ))}
              </div>
            </div>

            <div className={styles.detail} key={current.id}>
              <h3 className={styles.detailTitle}>{current.title}</h3>
              <p className={styles.detailText}>{current.description}</p>
              <ul className={styles.points}>
                {current.points.map((p) => (
                  <li key={p}>
                    <Check size={14} className={styles.pointIcon} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.more}>
          {MORE.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.title} className={styles.moreItem}>
                <span className={styles.moreIcon}>
                  <Icon size={16} />
                </span>
                <div>
                  <h3 className={styles.moreTitle}>{m.title}</h3>
                  <p className={styles.moreText}>{m.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
