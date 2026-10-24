"use client";

import { useEffect, useRef, useState } from "react";
import { PRODUCT } from "../config/product";
import { WindowsIcon, AppleIcon, LinuxIcon } from "./Icons";
import Hyperspeed from "./Hyperspeed";
import AppPreview from "./AppPreview";
import DemoVideo from "./DemoVideo";
import styles from "./Hero.module.css";

type Os = "windows" | "macos" | "linux";

const OS_LABEL: Record<Os, string> = { windows: "Windows", macos: "macOS", linux: "Linux" };
const OS_ICON = { windows: WindowsIcon, macos: AppleIcon, linux: LinuxIcon };

// The headline is "returned" by a query; the hero cycles through a few, each with its own row
const QUERIES = [
  { column: "tagline", table: "postcompass", lead: ["Your", "PostgreSQL,"], accent: "charted.", ms: "0.4" },
  { column: "setup", table: "local_db", lead: ["One", "click."], accent: "Zero setup.", ms: "0.3" },
  { column: "clouds", table: "connections", lead: ["Every", "cloud,"], accent: "one place.", ms: "1.2" },
  { column: "size", table: "installer", lead: ["3 MB.", "Fully"], accent: "native.", ms: "0.2" },
];
const QUERY_INTERVAL_MS = 4800;

export default function Hero() {
  const [os, setOs] = useState<Os>("windows");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) setOs("macos");
    else if (ua.includes("linux") && !ua.includes("android")) setOs("linux");
  }, []);

  const OsIcon = OS_ICON[os];

  const [queryIndex, setQueryIndex] = useState(0);
  const [hasCycled, setHasCycled] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setHasCycled(true);
      setQueryIndex((i) => (i + 1) % QUERIES.length);
    }, QUERY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, queryIndex]);

  const query = QUERIES[queryIndex] ?? QUERIES[0]!;
  const queryLength = `SELECT ${query.column} FROM ${query.table};`.length;
  // The first run waits for the page to settle; later runs start right away
  const timing = hasCycled
    ? { ["--type-delay" as string]: "0s", ["--row-delay" as string]: "0.65s" }
    : { ["--type-delay" as string]: "0.4s", ["--row-delay" as string]: "1.1s" };

  // The preview lies back in 3D and stands up as it scrolls into view
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = previewRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the top of the preview sits near the bottom of the screen, 1 once it's well in view
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.75)));
      el.style.setProperty("--lift", p >= 0.995 ? "1" : p.toFixed(4));
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
  }, []);

  return (
    <section className={styles.hero} id="hero">
      <div className={styles.hyperspeedBackdrop}>
        <Hyperspeed
          curve="winding"
          curvature={0.8}
          speed={1.2}
          boost={3.5}
          fov={85}
          boostFov={125}
          lanes={3}
          roadWidth={10}
          medianWidth={2}
          density={45}
          trailLength={1.3}
          lightSize={1.3}
          poles={18}
          dust={140}
          glow={0.7}
          reflections={0.5}
          roadOpacity={0.18}
          steer={0.3}
          cameraYOffset={-1.5}
          lookAtYOffset={1.8}
          tailColors={["#10b981", "#059669", "#34d399"]}
          headColors={["#06b6d4", "#0284c7", "#38bdf8"]}
          poleColors={["#10b981"]}
          interactive
        />
      </div>

      <div className={styles.gridBackground} />

      <div className={`container ${styles.content}`}>
        {/* The page opens by "running" a query; the headline is its result */}
        <h1 className="visually-hidden">Your PostgreSQL, charted.</h1>
        <div
          className={styles.result}
          style={timing}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <p className={styles.queryLine} aria-hidden="true">
            <span className={styles.queryPrompt}>=#</span>
            <span key={queryIndex} className={styles.queryText} style={{ ["--len" as string]: queryLength }}>
              <span className={styles.qKw}>SELECT</span> {query.column} <span className={styles.qKw}>FROM</span> {query.table};
            </span>
            <span className={styles.queryCaret} />
          </p>
          <div className={styles.resultCell} aria-hidden="true">
            {QUERIES.map((q, i) => (
              <p
                key={i === queryIndex ? `on-${queryIndex}` : i}
                className={`${styles.headline} ${i === queryIndex ? "" : styles.headlineHidden}`}
              >
                {q.lead.map((word, w) => (
                  <span key={w}>
                    <span className={styles.word} style={{ ["--i" as string]: w }}>{word}</span>{" "}
                  </span>
                ))}
                <em className={`${styles.word} ${styles.headlineAccent}`} style={{ ["--i" as string]: q.lead.length }}>
                  {q.accent}
                </em>
              </p>
            ))}
          </div>
          <div className={styles.resultFoot}>
            <span key={queryIndex} className={styles.resultFootText} aria-hidden="true">
              (1 row) · {query.ms} ms
            </span>
          </div>
        </div>

        <p className={styles.subhead}>
          Run PostgreSQL locally in one click, connect to any cloud, and browse, edit and
          query your data in one fast, native app.
        </p>

        <div className={styles.ctas}>
          <a
            href="#download"
            className={styles.primaryBtn}
            aria-label={`Download for ${OS_LABEL[os]}`}
            suppressHydrationWarning
          >
            <OsIcon size={15} />
            <span>Download</span>
          </a>
          <DemoVideo />
        </div>

        <p className={styles.meta}>
          <span>Free and open source · v{PRODUCT.version}</span>
          <span className={styles.metaDot} aria-hidden="true" />
          <span>Windows, macOS and Linux</span>
        </p>

        <div className={styles.preview} ref={previewRef}>
          <div className={styles.previewGlow} aria-hidden="true" />
          <div className={styles.previewFrame}>
            <AppPreview />
          </div>
          <p className={styles.previewHint}>
            <span className={styles.liveDot} aria-hidden="true" />
            <span>Interactive preview with sample data.</span>
            <span className={styles.hintTry}>
              Try: open a table, filter by <code>status</code>, double-click a cell, run a query, or press <kbd>Ctrl</kbd> <kbd>K</kbd>
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
