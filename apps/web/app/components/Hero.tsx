"use client";

import { useEffect, useState } from "react";
import { PRODUCT } from "../config/product";
import { ArrowRight, WindowsIcon, AppleIcon, LinuxIcon } from "./Icons";
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
        <a href="/download" className={styles.badge}>
          <span className={styles.badgeVersion}>v{PRODUCT.version}</span>
          <span>Free and open source</span>
          <ArrowRight size={13} className={styles.badgeArrow} />
        </a>

        <h1 className={styles.headline}>
          Your PostgreSQL, <em className={styles.headlineAccent}>charted.</em>
        </h1>

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
          <span>Windows, macOS and Linux</span>
          <span className={styles.metaDot} aria-hidden="true" />
          <span>~3 MB installer</span>
          <span className={styles.metaDot} aria-hidden="true" />
          <span>No sign-up</span>
        </p>

        <div className={styles.preview}>
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
