"use client";

import { useEffect, useRef, useState } from "react";
import { WindowsIcon, AppleIcon, LinuxIcon, Check } from "./Icons";
import styles from "./HowItWorks.module.css";

const STEPS = [
  { title: "Download the app", text: "Windows, macOS or Linux. No account needed." },
  { title: "Create or connect", text: "A local PostgreSQL in a minute, or your cloud database." },
  { title: "Explore your data", text: "Filter, edit and query. Press Ctrl K to jump anywhere." },
];

/* ---- The small visual at the top of each card ---- */

function DownloadVisual() {
  const files = [
    { Icon: WindowsIcon, name: "setup.exe" },
    { Icon: AppleIcon, name: ".dmg" },
    { Icon: LinuxIcon, name: ".AppImage" },
  ];
  return (
    <div className={styles.osList}>
      {files.map(({ Icon, name }, i) => (
        <div key={name} className={styles.os} style={{ ["--d" as string]: `${i * 0.12}s` }}>
          <Icon size={18} />
          <span>{name}</span>
        </div>
      ))}
    </div>
  );
}

function InstallVisual() {
  return (
    <div className={styles.install}>
      <div className={styles.installHead}>
        <span>PostgreSQL 18</span>
        <span className={styles.installState}>
          <span className={styles.stateBusy}>Installing…</span>
          <span className={styles.stateDone}>Ready</span>
        </span>
      </div>
      <div className={styles.bar}>
        <span className={styles.barFill} />
      </div>
      <div className={styles.running}>
        <span className={styles.runningDot} />
        <span>running</span>
        <span className={styles.port}>127.0.0.1:5432</span>
      </div>
    </div>
  );
}

function TableVisual() {
  const rows = [
    ["1042", "Ava Chen", "$129"],
    ["1043", "Liam Ortiz", "$48"],
    ["1044", "Noah Patel", "$310"],
  ];
  return (
    <div className={styles.table}>
      <span className={styles.filter}>
        status <b>=</b> paid
      </span>
      <div className={styles.rows}>
        {rows.map((r, i) => (
          <div key={r[0]} className={`${styles.row} ${i === 1 ? styles.rowActive : ""}`} style={{ ["--d" as string]: `${i * 0.1}s` }}>
            {r.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const VISUALS = [DownloadVisual, InstallVisual, TableVisual];

export default function HowItWorks() {
  // The cards animate once, the first time the section scrolls into view
  const listRef = useRef<HTMLOListElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="section" id="how-it-works">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">How it works</span>
          <h2 className="section-title">From download to your first query in minutes</h2>
          <p className="section-description">No Docker, no config files, nothing to babysit.</p>
        </div>

        <ol ref={listRef} className={`${styles.steps} ${shown ? styles.shown : ""}`}>
          {/* An <ol> may only hold <li>s, so the connecting line is a presentational one */}
          <li className={styles.line} role="presentation" aria-hidden="true">
            <span className={styles.lineFill} />
          </li>
          {STEPS.map((s, i) => {
            const Visual = VISUALS[i]!;
            return (
              <li key={s.title} className={styles.step} style={{ ["--s" as string]: `${i * 0.35}s` }}>
                <div className={styles.visual} aria-hidden="true">
                  <Visual />
                </div>
                <div className={styles.body}>
                  <span className={styles.number}>
                    <Check size={12} className={styles.numberCheck} />
                    0{i + 1}
                  </span>
                  <h3 className={styles.title}>{s.title}</h3>
                  <p className={styles.text}>{s.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
