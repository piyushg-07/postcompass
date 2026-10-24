"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
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
    description: "Pick a version. PostCompass downloads, verifies and starts it.",
    points: [
      "PostgreSQL 14 to 18, side by side",
      "No admin rights, no Docker",
    ],
    image: "/screens/create-server.webp",
    alt: "A new local PostgreSQL 18 server finishing setup",
  },
  {
    id: "table",
    icon: Table,
    label: "Table editor",
    title: "A table editor you already know",
    description: "Edit like a spreadsheet. Every change saves instantly.",
    points: [
      "Filters, sorting and undo",
      "Paste from Excel or import CSV",
    ],
    image: "/screens/table-editor.webp",
    alt: "The orders table filtered to refunded orders",
  },
  {
    id: "relations",
    icon: ArrowRightLeft,
    label: "Foreign keys",
    title: "Follow your foreign keys",
    description: "Peek at any linked record, then jump straight to its table.",
    points: [
      "Inline record preview",
      "Column stats in one click",
    ],
    image: "/screens/foreign-key-peek.webp",
    alt: "Previewing the customer referenced by an order",
  },
  {
    id: "sql",
    icon: Code,
    label: "SQL editor",
    title: "SQL that knows your schema",
    description: "Autocomplete for your tables, with a safety net built in.",
    points: [
      "Ctrl+Enter runs the current statement",
      "Warns before risky queries run",
    ],
    image: "/screens/sql-editor.webp",
    alt: "A revenue-by-category query and its results",
  },
  {
    id: "explain",
    icon: Activity,
    label: "Visual EXPLAIN",
    title: "See why a query is slow",
    description: "EXPLAIN ANALYZE as a clear tree, with the slowest step flagged.",
    points: [
      "Safe on writes, always rolled back",
      "Chart any result",
    ],
    image: "/screens/explain-plan.webp",
    alt: "An EXPLAIN ANALYZE plan with the slowest step highlighted",
  },
  {
    id: "diagram",
    icon: Layers,
    label: "ER diagram",
    title: "Your schema, mapped",
    description: "Hover a table to light up everything it connects to.",
    points: [
      "Drag, auto-arrange and minimap",
      "Double-click to open a table",
    ],
    image: "/screens/er-diagram.webp",
    alt: "ER diagram highlighting the relationships of the orders table",
  },
  {
    id: "cloud",
    icon: Cloud,
    label: "Cloud connections",
    title: "Every cloud, one place",
    description: "RDS, Supabase, Neon, Cloud SQL and more, with presets.",
    points: [
      "Test before you save",
      "Passwords stay in your OS keychain",
    ],
    image: "/screens/cloud-providers.webp",
    alt: "Choosing a cloud provider for a new connection",
  },
];

const MORE = [
  { icon: Search, title: "Command palette", text: "Ctrl+K to jump anywhere." },
  { icon: Database, title: "Backup and restore", text: "pg_dump and pg_restore built in." },
  { icon: Columns, title: "Schema designer", text: "Tables, indexes and triggers, visually." },
  { icon: Shield, title: "Row Level Security", text: "Policies from ready-made templates." },
  { icon: Terminal, title: "Connect snippets", text: "Prisma, Drizzle, Node, Python and Go." },
  { icon: Lock, title: "Private by default", text: "No account. No telemetry." },
];

const STICKY_TOP = 96; // px below the fixed navbar
const STEP_VH = 72; // scroll distance per feature while pinned

export default function FeaturesSection() {
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // Pin the showcase and let scrolling drive it on wide screens
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 961px)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPinned(wide.matches && !calm.matches);
    update();
    wide.addEventListener("change", update);
    calm.addEventListener("change", update);
    return () => {
      wide.removeEventListener("change", update);
      calm.removeEventListener("change", update);
    };
  }, []);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return null;
    const r = track.getBoundingClientRect();
    const total = Math.max(1, track.offsetHeight - (window.innerHeight - STICKY_TOP));
    return { top: r.top + window.scrollY, total, progress: Math.min(1, Math.max(0, (STICKY_TOP - r.top) / total)) };
  }, []);

  useEffect(() => {
    if (!pinned) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const m = measure();
      if (!m) return;
      railRef.current?.style.setProperty("--p", m.progress.toFixed(4));
      setActive(Math.min(SHOWCASE.length - 1, Math.floor(m.progress * SHOWCASE.length)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pinned, measure]);

  const select = (i: number) => {
    if (!pinned) return setActive(i);
    const m = measure();
    if (!m) return;
    // Land a little into the feature's slice of the scroll track
    window.scrollTo({ top: m.top - STICKY_TOP + ((i + 0.3) / SHOWCASE.length) * m.total, behavior: "smooth" });
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
            Every screen below is the real app.
          </p>
        </div>

        <div
          ref={trackRef}
          className={pinned ? styles.track : undefined}
          style={pinned ? { height: `calc(${SHOWCASE.length * STEP_VH}vh + 100vh - ${STICKY_TOP}px)` } : undefined}
        >
          <div className={pinned ? styles.sticky : undefined} style={pinned ? { top: STICKY_TOP } : undefined}>
            <div className={styles.showcase}>
              <div className={styles.list}>
                <div ref={railRef} className={styles.rail} aria-hidden="true">
                  <span className={styles.railFill} />
                </div>
                <div className={styles.tabs} role="tablist" aria-label="PostCompass features" aria-orientation="vertical">
                  {SHOWCASE.map((f, i) => {
                    const Icon = f.icon;
                    const selected = i === active;
                    const done = i < active;
                    return (
                      <div key={f.id} className={`${styles.item} ${selected ? styles.itemActive : ""} ${done ? styles.itemDone : ""}`}>
                        <button
                          ref={(el) => {
                            tabRefs.current[i] = el;
                          }}
                          type="button"
                          role="tab"
                          id={`feature-tab-${f.id}`}
                          aria-selected={selected}
                          aria-controls="feature-panel"
                          tabIndex={selected ? 0 : -1}
                          className={styles.tab}
                          onClick={() => select(i)}
                          onKeyDown={(e) => onKeyDown(e, i)}
                        >
                          <span className={styles.tabIcon}>
                            <Icon size={16} />
                          </span>
                          <span className={styles.tabLabel}>{f.label}</span>
                          <span className={styles.tabIndex}>0{i + 1}</span>
                        </button>
                        <div className={styles.expand} aria-hidden={!selected}>
                          <div className={styles.expandInner}>
                            <h3 className={styles.expandTitle}>{f.title}</h3>
                            <p className={styles.expandText}>{f.description}</p>
                            <ul className={styles.points}>
                              {f.points.map((p) => (
                                <li key={p}>
                                  <Check size={13} className={styles.pointIcon} />
                                  <span>{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={styles.panel} role="tabpanel" id="feature-panel" aria-labelledby={`feature-tab-${current.id}`}>
                <div className={styles.frame}>
                  <div className={styles.frameBar} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span className={styles.frameTitle}>{current.label}</span>
                    <span className={styles.frameCount}>
                      {active + 1} / {SHOWCASE.length}
                    </span>
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
                        loading={i < 2 ? "eager" : "lazy"}
                        decoding="async"
                        className={`${styles.shot} ${i === active ? styles.shotActive : ""}`}
                        aria-hidden={i !== active}
                      />
                    ))}
                  </div>
                </div>

                {/* Small screens: the details sit under the screenshot */}
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
          </div>
        </div>

        <div className={styles.more} data-reveal="stagger">
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
