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
  ChevronRight,
} from "@/components/ui/Icons";
import SectionHeader from "@/components/ui/SectionHeader";

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

// Below 960px the vertical list turns into a row of chips and the details move under the screenshot (max-[961px]: is the old max-width: 960px)
const POINTS = "flex flex-col gap-[0.45rem]";
const POINT = "flex items-start gap-2 text-[0.84rem] leading-[1.45] text-fg";
const POINT_ICON = "mt-[0.15rem] shrink-0 text-accent-hover";
const FRAME_DOT = "size-[9px] rounded-full bg-[rgba(255,255,255,0.14)]";
const MONO_SMALL = "font-mono text-[0.72rem]";
// The fade and arrow at each end of the chip row on small screens, shown while more chips sit that way
const EDGE = "pointer-events-none absolute inset-y-0 z-2 hidden w-12 items-center transition-opacity duration-200 max-[961px]:flex";
// Just a quiet chevron over the fade: no circle, border or shadow
const EDGE_BUTTON = "pointer-events-auto inline-flex h-full w-6 -translate-y-[1.5px] items-center justify-center text-fg-muted hover:text-fg";

export default function FeaturesSection() {
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

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

  // Small screens: show which way more chips are, and keep the active chip in the middle of the row
  const updateEdges = useCallback(() => {
    const row = chipsRef.current;
    if (!row) return;
    const max = row.scrollWidth - row.clientWidth;
    setEdges({ left: row.scrollLeft > 4, right: row.scrollLeft < max - 4 });
  }, []);

  useEffect(() => {
    const row = chipsRef.current;
    if (!row) return;
    updateEdges();
    row.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      row.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [updateEdges]);

  useEffect(() => {
    if (pinned) return;
    const row = chipsRef.current;
    const chip = tabRefs.current[active]?.parentElement;
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2, behavior: "smooth" });
  }, [active, pinned]);

  const nudgeChips = (dir: 1 | -1) => chipsRef.current?.scrollBy({ left: dir * chipsRef.current.clientWidth * 0.6, behavior: "smooth" });

  const current = SHOWCASE[active]!;

  return (
    <section className="relative isolate overflow-x-clip pt-20 pb-24 max-lg:pb-16 max-md:pb-12" id="features">
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
        <span className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[26px_26px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_40%,black,transparent_75%)] [-webkit-mask-image:radial-gradient(ellipse_70%_55%_at_50%_40%,black,transparent_75%)]" />
      </div>
      <div className="relative z-1 mx-auto w-full max-w-[1200px] px-6 max-md:px-4">
        <SectionHeader
          badge="Features"
          title="Everything you reach for, in one app"
          description="Every screen below is the real app."
        />

        <div
          ref={trackRef}
          className={pinned ? "relative" : undefined}
          style={pinned ? { height: `calc(${SHOWCASE.length * STEP_VH}vh + 100vh - ${STICKY_TOP}px)` } : undefined}
        >
          <div className={pinned ? "sticky" : undefined} style={pinned ? { top: STICKY_TOP } : undefined}>
            <div className="grid grid-cols-[320px_minmax(0,1fr)] items-start gap-10 max-[961px]:grid-cols-[minmax(0,1fr)] max-[961px]:gap-5">
              <div className="relative pl-[22px] max-[961px]:pl-0">
                <div
                  ref={railRef}
                  className="absolute top-[18px] bottom-[18px] left-[6px] w-[2px] rounded-[2px] bg-[rgba(255,255,255,0.08)] [--p:0] max-[961px]:hidden"
                  aria-hidden="true"
                >
                  <span className="absolute inset-0 origin-top rounded-[2px] bg-[linear-gradient(180deg,#34d399,#10b981)] shadow-[0_0_10px_rgba(52,211,153,0.6)] [transform:scaleY(var(--p))]" />
                </div>
                <div className="relative">
                <div
                  className={`${EDGE} left-0 justify-start bg-[linear-gradient(90deg,var(--color-root)_20%,transparent)] ${edges.left ? "opacity-100" : "opacity-0"}`}
                  aria-hidden="true"
                >
                  <button type="button" tabIndex={-1} className={EDGE_BUTTON} onClick={() => nudgeChips(-1)}>
                    <ChevronRight size={16} strokeWidth={2.25} className="[transform:rotate(180deg)]" />
                  </button>
                </div>
                <div
                  className={`${EDGE} right-0 justify-end bg-[linear-gradient(270deg,var(--color-root)_20%,transparent)] ${edges.right ? "opacity-100" : "opacity-0"}`}
                  aria-hidden="true"
                >
                  <button type="button" tabIndex={-1} className={EDGE_BUTTON} onClick={() => nudgeChips(1)}>
                    <ChevronRight size={16} strokeWidth={2.25} />
                  </button>
                </div>
                <div
                  ref={chipsRef}
                  className="relative flex flex-col gap-[2px] max-[961px]:snap-x max-[961px]:snap-proximity max-[961px]:scroll-px-4 max-[961px]:flex-row max-[961px]:gap-2 max-[961px]:overflow-x-auto max-[961px]:pb-1 max-[961px]:[scrollbar-width:none] max-[961px]:[&::-webkit-scrollbar]:hidden max-[961px]:[&>*]:snap-start"
                  role="tablist"
                  aria-label="PostCompass features"
                  aria-orientation="vertical"
                >
                  {SHOWCASE.map((f, i) => {
                    const Icon = f.icon;
                    const selected = i === active;
                    const done = i < active;
                    return (
                      <div
                        key={f.id}
                        data-active={selected || undefined}
                        data-done={done || undefined}
                        className="group relative rounded-[12px] border border-transparent [transition:background_0.3s_ease,border-color_0.3s_ease] before:absolute before:top-[19px] before:left-[-21px] before:box-content before:size-2 before:rounded-full before:border-2 before:border-[#26262b] before:bg-root before:content-[''] before:[transition:border-color_0.3s_ease,background_0.3s_ease,box-shadow_0.3s_ease] data-done:before:border-accent data-done:before:bg-accent data-active:border-[rgba(255,255,255,0.08)] data-active:bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] data-active:before:border-accent-hover data-active:before:bg-accent-hover data-active:before:shadow-[0_0_0_4px_rgba(52,211,153,0.18),0_0_12px_rgba(52,211,153,0.8)] max-[961px]:flex-[0_0_auto] max-[961px]:rounded-full max-[961px]:border-[rgba(255,255,255,0.07)] max-[961px]:before:hidden"
                      >
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
                          className="flex w-full items-center gap-3 rounded-[12px] px-[0.85rem] py-[0.7rem] text-left text-fg-muted [transition:color_0.25s_ease] hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-hover group-data-active:text-fg group-data-done:text-fg max-[961px]:rounded-full max-[961px]:py-[0.45rem] max-[961px]:pr-[0.85rem] max-[961px]:pl-2"
                          onClick={() => select(i)}
                          onKeyDown={(e) => onKeyDown(e, i)}
                        >
                          <span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-[9px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.04)] [transition:color_0.25s_ease,background_0.25s_ease,border-color_0.25s_ease] group-data-active:border-line-accent group-data-active:bg-accent-muted group-data-active:text-accent-hover max-[961px]:size-[26px] max-[961px]:rounded-full">
                            <Icon size={16} />
                          </span>
                          <span className="flex-1 text-[0.95rem] font-semibold tracking-[-0.01em] max-[961px]:text-[0.875rem] max-[961px]:whitespace-nowrap">
                            {f.label}
                          </span>
                          <span className={`${MONO_SMALL} text-fg-faint group-data-active:text-accent-hover max-[961px]:hidden`}>0{i + 1}</span>
                        </button>
                        <div
                          className="grid grid-rows-[0fr] [transition:grid-template-rows_0.5s_cubic-bezier(0.4,0,0.2,1)] group-data-active:grid-rows-[1fr] max-[961px]:hidden motion-reduce:transition-none"
                          aria-hidden={!selected}
                        >
                          <div className="min-h-0 overflow-hidden px-[0.95rem] pb-0 opacity-0 [transition:opacity_0.3s_ease,padding_0.45s_ease] group-data-active:pb-[0.95rem] group-data-active:opacity-100 group-data-active:delay-100 motion-reduce:transition-none">
                            <h3 className="mb-[0.35rem] text-[1.05rem] font-[650] tracking-[-0.015em] text-fg">{f.title}</h3>
                            <p className="mb-[0.7rem] text-[0.875rem] leading-[1.6] text-fg-secondary">{f.description}</p>
                            <ul className={POINTS}>
                              {f.points.map((p) => (
                                <li key={p} className={POINT}>
                                  <Check size={13} className={POINT_ICON} />
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
              </div>

              <div className="min-w-0" role="tabpanel" id="feature-panel" aria-labelledby={`feature-tab-${current.id}`}>
                <div className="relative rounded-[14px] bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] p-[5px] shadow-[0_30px_80px_-24px_rgba(0,0,0,0.8)]">
                  <div className="flex items-center gap-[6px] px-[10px] pt-[7px] pb-[9px]" aria-hidden="true">
                    <span className={FRAME_DOT} />
                    <span className={FRAME_DOT} />
                    <span className={FRAME_DOT} />
                    <span className={`ml-[10px] ${MONO_SMALL} text-fg-muted`}>{current.label}</span>
                    <span className={`ml-auto ${MONO_SMALL} text-fg-faint`}>
                      {active + 1} / {SHOWCASE.length}
                    </span>
                  </div>
                  <div className="relative aspect-[1600/1000] overflow-hidden rounded-[9px] bg-black">
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
                        className={`absolute inset-0 size-full object-cover object-[top_left] will-change-[opacity,transform] motion-reduce:transition-none ${
                          i === active
                            ? "z-1 opacity-100 [transform:none] [transition:opacity_0.45s_ease,transform_0.8s_cubic-bezier(0.2,0.8,0.2,1)]"
                            : // The outgoing shot fades out only after the incoming one is mostly in, so there's no dark dip between them
                              "opacity-0 [transform:scale(1.015)] [transition:opacity_0.35s_ease_0.3s,transform_0.8s_cubic-bezier(0.2,0.8,0.2,1)]"
                        }`}
                        aria-hidden={i !== active}
                      />
                    ))}
                  </div>
                </div>

                {/* Small screens: the details sit under the screenshot */}
                <div
                  className="hidden max-[961px]:block max-[961px]:animate-[ft-fade-up_0.4s_ease_both] max-[961px]:pt-5 motion-reduce:transition-none max-[961px]:motion-reduce:animate-none"
                  key={current.id}
                >
                  <h3 className="mb-[0.4rem] text-[1.2rem] font-[650] tracking-[-0.02em] text-fg">{current.title}</h3>
                  <p className="mb-[0.8rem] text-[0.95rem] leading-[1.6] text-fg-secondary">{current.description}</p>
                  <ul className={POINTS}>
                    {current.points.map((p) => (
                      <li key={p} className={POINT}>
                        <Check size={14} className={POINT_ICON} />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="mt-20 grid grid-cols-3 gap-px overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.07)] max-[961px]:grid-cols-2 max-[641px]:mt-14 max-[641px]:grid-cols-1"
          data-reveal="stagger"
        >
          {MORE.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.title} className="flex gap-[0.9rem] bg-root px-[1.4rem] py-6 [transition:background_0.2s_ease] hover:bg-[#0d0e10]">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-[rgba(16,185,129,0.2)] bg-accent-subtle text-accent-hover">
                  <Icon size={16} />
                </span>
                <div>
                  <h3 className="my-[0.3rem] text-[0.95rem] font-semibold text-fg">{m.title}</h3>
                  <p className="text-[0.875rem] leading-[1.55] text-fg-muted">{m.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
