"use client";

import { useState } from "react";
import Image from "next/image";
import { 
  Zap, 
  Cpu, 
  Shield, 
  Check, 
  X, 
  Table, 
  Database,
  Layers, 
  Activity,
  Sparkles,
  ArrowRight,
} from "./Icons";
import styles from "./CompareSection.module.css";

interface BenchmarkMetric {
  title: string;
  category: string;
  dbeaverVal: string;
  dbeaverBarWidth: string;
  postcompassVal: string;
  postcompassBarWidth: string;
  improvementTag: string;
}

const BENCHMARK_METRICS: BenchmarkMetric[] = [
  {
    title: "Idle Memory Usage (RAM)",
    category: "System Resource Efficiency",
    dbeaverVal: "920 MB (JVM Heap)",
    dbeaverBarWidth: "92%",
    postcompassVal: "14.2 MB (Native)",
    postcompassBarWidth: "3.5%",
    improvementTag: "98% Less RAM",
  },
  {
    title: "Cold Launch Startup Speed",
    category: "Workflow Agility",
    dbeaverVal: "12.4s (Bundle Scan)",
    dbeaverBarWidth: "88%",
    postcompassVal: "<90ms (Instant)",
    postcompassBarWidth: "4%",
    improvementTag: "137x Faster Launch",
  },
  {
    title: "Binary & Runtime Footprint",
    category: "Installation & Maintenance",
    dbeaverVal: "340 MB + Java JRE",
    dbeaverBarWidth: "85%",
    postcompassVal: "14.2 MB Single Executable",
    postcompassBarWidth: "5%",
    improvementTag: "Zero Dependencies",
  },
];

interface MatrixRow {
  capability: string;
  category: string;
  dbeaver: string;
  postcompass: string;
  highlight?: boolean;
}

const MATRIX_ROWS: MatrixRow[] = [
  {
    capability: "Cold Launch Startup Time",
    category: "Performance",
    dbeaver: "8 – 15 seconds (JVM warmup & classloader)",
    postcompass: "<90 milliseconds (Instant launch)",
    highlight: true,
  },
  {
    capability: "Idle Memory Footprint (RAM)",
    category: "Performance",
    dbeaver: "850 MB – 1.5 GB background memory",
    postcompass: "14.2 MB (98% lighter footprint)",
    highlight: true,
  },
  {
    capability: "Architecture & Runtime",
    category: "Core Engine",
    dbeaver: "Java (Eclipse RCP IDE framework)",
    postcompass: "Native Rust + Tauri + WebKit",
  },
  {
    capability: "Inline Data Editing",
    category: "UX & Workflow",
    dbeaver: "Multi-step modal commit workflow with confirmation popups",
    postcompass: "Spreadsheet-style 1-click edit with optimistic auto-save",
  },
  {
    capability: "Schema ERD & Relations",
    category: "Visual Tools",
    dbeaver: "Static slow SVG layout with high render lag",
    postcompass: "GPU-accelerated interactive canvas with live relationship tracking",
  },
  {
    capability: "Visual EXPLAIN ANALYZE",
    category: "Visual Tools",
    dbeaver: "Plain text console dump or basic tabular tree",
    postcompass: "Interactive execution plan tree with automatic bottleneck alerts",
  },
  {
    capability: "External Runtime Dependencies",
    category: "DevOps",
    dbeaver: "Requires Java Runtime Environment (JRE 17+)",
    postcompass: "Zero runtime dependencies (Single self-contained binary)",
  },
  {
    capability: "Local Data Privacy",
    category: "Security",
    dbeaver: "Local (contains optional usage analytics)",
    postcompass: "100% Local-First direct TCP socket (Zero telemetry, zero proxy)",
    highlight: true,
  },
];

export default function CompareSection() {
  const [activeTab, setActiveTab] = useState<"table" | "visual">("table");

  return (
    <section className="section" id="compare">
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <span className="section-badge">Technical Benchmark</span>
          <h2 className="section-title">
            Engineered to Replace Legacy Java Database Tools
          </h2>
          <p className="section-description">
            Side-by-side performance audit tested on Windows 11 &amp; macOS M2.
            Experience native Rust execution with sub-90ms boot times and 14MB RAM.
          </p>
        </div>

        {/* Top 3 Visual Benchmark Performance Meters */}
        <div className={styles.benchmarkCardsGrid}>
          {BENCHMARK_METRICS.map((metric, idx) => (
            <div key={idx} className={styles.benchmarkCard}>
              <div className={styles.cardTopRow}>
                <span className={styles.categoryBadge}>{metric.category}</span>
                <span className={styles.improvementPill}>
                  <Sparkles size={11} />
                  {metric.improvementTag}
                </span>
              </div>

              <h3 className={styles.metricTitle}>{metric.title}</h3>

              {/* Graphical Bars Comparison */}
              <div className={styles.metersContainer}>
                {/* DBeaver Meter */}
                <div className={styles.meterRow}>
                  <div className={styles.meterMeta}>
                    <span className={styles.meterToolName}>DBeaver (Java)</span>
                    <span className={styles.meterValLegacy}>{metric.dbeaverVal}</span>
                  </div>
                  <div className={styles.track}>
                    <div 
                      className={styles.barLegacy} 
                      style={{ width: metric.dbeaverBarWidth }} 
                    />
                  </div>
                </div>

                {/* PostCompass Meter */}
                <div className={styles.meterRow}>
                  <div className={styles.meterMeta}>
                    <span className={styles.meterToolNameModern}>
                      <span className={styles.modernDot} />
                      PostCompass (Rust)
                    </span>
                    <span className={styles.meterValModern}>{metric.postcompassVal}</span>
                  </div>
                  <div className={styles.track}>
                    <div 
                      className={styles.barModern} 
                      style={{ width: metric.postcompassBarWidth }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Benchmark Matrix Card */}
        <div className={styles.matrixContainer}>
          <div className={styles.matrixToolbar}>
            <div className={styles.matrixToolbarLeft}>
              <h3 className={styles.matrixHeading}>Comprehensive Capability Matrix</h3>
              <span className={styles.matrixSubtitle}>Verified hardware audit · Real PostgreSQL 18 testbed</span>
            </div>
            <div className={styles.matrixBadges}>
              <span className={styles.auditPill}>Tested on Windows 11 &amp; macOS M2</span>
            </div>
          </div>

          <div className={styles.tableResponsive}>
            <table className={styles.matrixTable}>
              <thead>
                <tr>
                  <th className={styles.colFeature}>CAPABILITY / WORKFLOW</th>
                  <th className={styles.colDbeaver}>
                    <div className={styles.thWrapper}>
                      <span>DBEAVER (JAVA / ECLIPSE)</span>
                      <span className={styles.thBadgeLegacy}>Legacy</span>
                    </div>
                  </th>
                  <th className={styles.colPostcompass}>
                    <div className={styles.thWrapper}>
                      <span className={styles.thModernText}>POSTCOMPASS (NATIVE RUST)</span>
                      <span className={styles.thBadgeModern}>Recommended</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {MATRIX_ROWS.map((row, idx) => (
                  <tr 
                    key={idx} 
                    className={`${styles.matrixRow} ${row.highlight ? styles.matrixRowHighlight : ""}`}
                  >
                    <td className={styles.cellFeature}>
                      <div className={styles.featureTitle}>{row.capability}</div>
                      <div className={styles.featureCategory}>{row.category}</div>
                    </td>
                    <td className={styles.cellDbeaver}>
                      <div className={styles.dbeaverContent}>
                        <span className={styles.crossIcon}>✕</span>
                        <span className={styles.cellTextLegacy}>{row.dbeaver}</span>
                      </div>
                    </td>
                    <td className={styles.cellPostcompass}>
                      <div className={styles.postcompassContent}>
                        <span className={styles.checkIcon}>✓</span>
                        <span className={styles.cellTextModern}>{row.postcompass}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Matrix Footer Callout */}
          <div className={styles.matrixFooter}>
            <div className={styles.matrixFooterText}>
              <Zap size={14} style={{ color: "var(--accent)" }} />
              <span>Ready to upgrade your PostgreSQL workflow? PostCompass launches in &lt;90ms and never freezes your IDE.</span>
            </div>
            <a href="/download" className={styles.matrixFooterCta}>
              <span>Try PostCompass Free</span>
              <ArrowRight size={13} />
            </a>
          </div>
        </div>

        {/* Side-by-Side UI Comparison Preview */}
        <div className={styles.uiCompareContainer}>
          <div className={styles.uiCompareHeader}>
            <h3 className={styles.uiCompareTitle}>Visual Interface Philosophy</h3>
            <p className={styles.uiCompareDesc}>
              Compare the cluttered 2004-era Eclipse toolbars with PostCompass&apos;s clean, keyboard-first desktop studio.
            </p>
          </div>

          <div className={styles.uiGrid}>
            {/* DBeaver UI Preview Card */}
            <div className={styles.uiCard}>
              <div className={styles.uiCardBar}>
                <span className={styles.uiCardTagLegacy}>DBeaver Community</span>
                <span className={styles.uiCardNote}>Eclipse Toolbar &amp; Heavy Modals</span>
              </div>
              <div className={styles.uiImageWrapper}>
                <Image
                  src="/screenshots/dbeaver-comparison.jpg"
                  alt="DBeaver legacy user interface screenshot"
                  width={640}
                  height={380}
                  className={styles.uiScreenshot}
                />
              </div>
              <div className={styles.uiFooterLegacy}>
                <span>Multi-window popups, slow table rendering, 850MB+ memory usage</span>
              </div>
            </div>

            {/* PostCompass UI Preview Card */}
            <div className={`${styles.uiCard} ${styles.uiCardModern}`}>
              <div className={styles.uiCardBarModern}>
                <div className={styles.modernCardTitle}>
                  <Sparkles size={12} style={{ color: "#34d399" }} />
                  <span className={styles.uiCardTagModern}>PostCompass Studio</span>
                </div>
                <span className={styles.uiCardNoteModern}>Clean, High-Density Studio</span>
              </div>
              <div className={styles.uiImageWrapper}>
                <Image
                  src="/screenshots/table-editor.png"
                  alt="PostCompass modern developer user interface screenshot"
                  width={640}
                  height={380}
                  unoptimized
                  className={styles.uiScreenshot}
                />
              </div>
              <div className={styles.uiFooterModern}>
                <span>Instant spreadsheet editing, GPU ERD canvas, 14.2MB RAM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
