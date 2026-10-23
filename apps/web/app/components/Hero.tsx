"use client";

import { useEffect, useRef, useState } from "react";
import { PRODUCT } from "../config/product";
import { WindowsIcon, AppleIcon, LinuxIcon } from "./Icons";
import Hyperspeed from "./Hyperspeed";
import AppPreview from "./AppPreview";
import styles from "./Hero.module.css";

type Os = "windows" | "macos" | "linux";

const OS_LABEL: Record<Os, string> = { windows: "Windows", macos: "macOS", linux: "Linux" };
const OS_ICON = { windows: WindowsIcon, macos: AppleIcon, linux: LinuxIcon };

export default function Hero() {
  const [os, setOs] = useState<Os>("windows");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) setOs("macos");
    else if (ua.includes("linux") && !ua.includes("android")) setOs("linux");
  }, []);

  const OsIcon = OS_ICON[os];

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
        <p className={styles.query} aria-hidden="true">
          <span className={styles.queryPrompt}>=#</span>
          <span className={styles.queryText}>
            <span className={styles.qKw}>SELECT</span> tagline <span className={styles.qKw}>FROM</span> postcompass;
          </span>
          <span className={styles.queryCaret} />
        </p>

        <h1 className={styles.headline}>
          <span className={styles.word} style={{ ["--i" as string]: 0 }}>Your</span>{" "}
          <span className={styles.word} style={{ ["--i" as string]: 1 }}>PostgreSQL,</span>{" "}
          <em className={`${styles.word} ${styles.headlineAccent}`} style={{ ["--i" as string]: 2 }}>charted.</em>
        </h1>
        <p className={styles.rowCount} aria-hidden="true">(1 row)</p>

        <p className={styles.subhead}>
          Run PostgreSQL locally in one click, connect to any cloud, and browse, edit and
          query your data in one fast, native app.
        </p>

        <div className={styles.ctas}>
          <a href="#download" className={styles.primaryBtn} suppressHydrationWarning>
            <OsIcon size={15} />
            <span>Download for {OS_LABEL[os]}</span>
          </a>
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
