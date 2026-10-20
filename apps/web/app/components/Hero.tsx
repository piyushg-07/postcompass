"use client";

import { useEffect, useState } from "react";
import { PRODUCT } from "../config/product";
import { 
  Download, 
  Github, 
  ChevronRight, 
  Copy, 
  Check, 
  Table, 
  Code, 
  Database,
  Filter,
  Zap,
  Shield,
  Globe,
  Cpu,
  Server,
  WindowsIcon,
  AppleIcon,
  LinuxIcon,
  Sparkles,
} from "./Icons";
import styles from "./Hero.module.css";

type SupportedOs = "macos" | "windows" | "linux" | "cargo";

const CLI_COMMANDS: Record<SupportedOs, string> = {
  macos: "brew install --cask postcompass",
  windows: "winget install postcompass",
  linux: "curl -fsSL https://postcompass.dev/install.sh | bash",
  cargo: "cargo install postcompass-cli",
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "ENGINEER" | "VIEWER";
  active: boolean;
}

const INITIAL_ROWS: UserRow[] = [
  { id: "e2b7a4c9", name: "Sarah Chen", email: "sarah@acme.dev", role: "ADMIN", active: true },
  { id: "a8f1d392", name: "Marcus Johnson", email: "marcus@acme.dev", role: "ENGINEER", active: true },
  { id: "c49e7821", name: "Priya Patel", email: "priya@acme.dev", role: "ENGINEER", active: true },
  { id: "f0284e11", name: "Alex Rivera", email: "alex@acme.dev", role: "VIEWER", active: false },
  { id: "9b3c5a77", name: "Elena Rostova", email: "elena@acme.dev", role: "ADMIN", active: true },
];

export default function Hero() {
  const [selectedOs, setSelectedOs] = useState<SupportedOs>("windows");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"table" | "sql" | "schema">("table");
  const [rows, setRows] = useState<UserRow[]>(INITIAL_ROWS);
  const [editingName, setEditingName] = useState("Marcus Johnson");
  const [isExecutingQuery, setIsExecutingQuery] = useState(false);
  const [queryDuration, setQueryDuration] = useState("1.8ms");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("win")) setSelectedOs("windows");
      else if (ua.includes("linux")) setSelectedOs("linux");
      else if (ua.includes("mac")) setSelectedOs("macos");
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(CLI_COMMANDS[selectedOs]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNameChange = (val: string) => {
    setEditingName(val);
    setRows((prev) =>
      prev.map((r, i) => (i === 1 ? { ...r, name: val } : r))
    );
  };

  const handleRunQuery = () => {
    setIsExecutingQuery(true);
    setTimeout(() => {
      setIsExecutingQuery(false);
      setQueryDuration(`${(1.2 + Math.random() * 0.8).toFixed(1)}ms`);
    }, 450);
  };

  const currentOsLabel = selectedOs === "windows" ? "Windows" : selectedOs === "linux" ? "Linux" : "macOS";

  return (
    <section className={styles.hero} id="hero">
      <div className={styles.auroraOrb} />
      <div className={styles.gridBackground} />
      
      <div className={`container ${styles.content}`}>
        {/* Eyebrow / Version Pill */}
        <a href="/download" className={styles.badge}>
          <span className={styles.badgeDot} />
          <span className={styles.badgeTag}>v{PRODUCT.version}</span>
          <span>Native PostgreSQL Desktop Studio</span>
          <ChevronRight size={13} />
        </a>

        {/* Clean, High-Impact Headline */}
        <h1 className={styles.headline}>
          The Local-First PostgreSQL Studio.
          <br />
          <span className={styles.headlineAccent}>Connect Any Cloud. Query in Milliseconds.</span>
        </h1>

        {/* Primary CTAs with OS Auto-Detection */}
        <div className={styles.ctaWrapper}>
          <div className={styles.ctas}>
            <a href="/download" className={styles.primaryDownloadBtn} suppressHydrationWarning>
              <div className={styles.primaryDownloadIcon}>
                {selectedOs === "windows" && <WindowsIcon size={20} />}
                {selectedOs === "macos" && <AppleIcon size={20} />}
                {selectedOs === "linux" && <LinuxIcon size={20} />}
                {selectedOs === "cargo" && <Code size={20} />}
              </div>
              <div className={styles.primaryDownloadText}>
                <span className={styles.primaryDownloadMain} suppressHydrationWarning>
                  {selectedOs === "cargo" ? "Install via Cargo CLI" : `Download for ${currentOsLabel}`}
                </span>
                <span className={styles.primaryDownloadSub} suppressHydrationWarning>
                  {selectedOs === "windows" && ".exe · 64-bit & ARM64 · 14.2 MB"}
                  {selectedOs === "macos" && "Universal .dmg · Apple Silicon & Intel"}
                  {selectedOs === "linux" && ".AppImage / .deb · x64 · 14.2 MB"}
                  {selectedOs === "cargo" && "cargo install postcompass-cli"}
                </span>
              </div>
            </a>

            <a
              href="#waitlist"
              className={styles.secondaryBtn}
            >
              <Sparkles size={18} className={styles.earlyAccessIcon} />
              <span>Get Early Access</span>
              <span className={styles.earlyAccessArrow}>↓</span>
            </a>
          </div>

          {/* Quick Platform Switcher */}
          <div className={styles.osSelectorRow}>
            <span className={styles.osSelectorPrompt}>Other platforms:</span>
            <button
              type="button"
              onClick={() => setSelectedOs("windows")}
              className={`${styles.osPill} ${selectedOs === "windows" ? styles.osPillActive : ""}`}
              suppressHydrationWarning
            >
              <WindowsIcon size={12} />
              <span>Windows</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedOs("macos")}
              className={`${styles.osPill} ${selectedOs === "macos" ? styles.osPillActive : ""}`}
              suppressHydrationWarning
            >
              <AppleIcon size={12} />
              <span>macOS</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedOs("linux")}
              className={`${styles.osPill} ${selectedOs === "linux" ? styles.osPillActive : ""}`}
              suppressHydrationWarning
            >
              <LinuxIcon size={12} />
              <span>Linux</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedOs("cargo")}
              className={`${styles.osPill} ${selectedOs === "cargo" ? styles.osPillActive : ""}`}
              suppressHydrationWarning
            >
              <span>Cargo</span>
            </button>
          </div>
        </div>

        {/* Trust Badges */}
        <div className={styles.metaBadges}>
          <span className={styles.metaItem}>
            <Shield size={14} />
            <span><strong>100% Local-First</strong> (No cloud proxy)</span>
          </span>
          <span className={styles.metaItem}>
            <Zap size={14} />
            <span><strong>Direct TCP/SSL</strong> (&lt;2ms latency)</span>
          </span>
          <span className={styles.metaItem}>
            <Cpu size={14} />
            <span><strong>Tauri + Rust</strong> (14.2 MB RAM)</span>
          </span>
          <span className={styles.metaItem}>
            <Globe size={14} />
            <span><strong>AWS RDS · Aurora · Supabase · Neon</strong></span>
          </span>
        </div>

        {/* Desktop App Window Mockup Container */}
        <div className={styles.previewContainer}>
          {/* App Window with Traveling Laser Border-Beam */}
          <div className={styles.previewWrapper}>
            <div className={styles.borderBeam} />
            <div className={styles.previewGlow} />

            <div className={styles.preview}>
              {/* Title Bar with Traffic Lights & Mode Switcher */}
              <div className={styles.titleBar}>
                <div className={styles.trafficLights}>
                  <span className={styles.dot} data-color="red" />
                  <span className={styles.dot} data-color="yellow" />
                  <span className={styles.dot} data-color="green" />
                </div>

                {/* Interactive Mode Tabs */}
                <div className={styles.modeTabs}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("table")}
                    className={`${styles.modeTabBtn} ${activeTab === "table" ? styles.modeTabActive : ""}`}
                  >
                    <Table size={13} />
                    Table Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("sql")}
                    className={`${styles.modeTabBtn} ${activeTab === "sql" ? styles.modeTabActive : ""}`}
                  >
                    <Code size={13} />
                    SQL Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("schema")}
                    className={`${styles.modeTabBtn} ${activeTab === "schema" ? styles.modeTabActive : ""}`}
                  >
                    <Database size={13} />
                    Schema &amp; DDL
                  </button>
                </div>

                {/* Status info */}
                <div className={styles.titleBarStatus}>
                  <div className={styles.connIndicator}>
                    <span className={styles.connDot} />
                    <span>aws-aurora-pg16:5432 (1.8ms)</span>
                  </div>
                </div>
              </div>

              {/* App Body */}
              <div className={styles.appLayout}>
                {/* Left Tree Sidebar */}
                <aside className={styles.sidebar}>
                  <div className={styles.sidebarSection}>
                    <span className={styles.sidebarLabel}>CONNECTIONS</span>
                    <div className={`${styles.sidebarItem} ${styles.sidebarItemActive}`}>
                      <span>production-cluster</span>
                      <span className={styles.itemCount}>5432</span>
                    </div>
                    <div className={styles.sidebarItem}>
                      <span>aws-rds-staging</span>
                      <span className={styles.itemCount}>5432</span>
                    </div>
                    <div className={styles.sidebarItem}>
                      <span>local-docker</span>
                      <span className={styles.itemCount}>5433</span>
                    </div>
                  </div>

                  <div className={styles.sidebarSection}>
                    <span className={styles.sidebarLabel}>TABLES (public)</span>
                    <div className={`${styles.sidebarItem} ${activeTab === "table" ? styles.sidebarItemActive : ""}`}>
                      <span>users</span>
                      <span className={styles.itemCount}>2.8k</span>
                    </div>
                    <div className={styles.sidebarItem}>
                      <span>orders</span>
                      <span className={styles.itemCount}>14.2k</span>
                    </div>
                    <div className={styles.sidebarItem}>
                      <span>transactions</span>
                      <span className={styles.itemCount}>890k</span>
                    </div>
                    <div className={styles.sidebarItem}>
                      <span>audit_logs</span>
                      <span className={styles.itemCount}>1.2M</span>
                    </div>
                  </div>
                </aside>

                {/* Main Work Area */}
                <main className={styles.mainArea}>
                  {/* Laser scanbeam sweep on SQL query run */}
                  {isExecutingQuery && <div className={styles.scanbeam} />}

                  {/* View 1: Interactive Spreadsheet Table */}
                  {activeTab === "table" && (
                    <>
                      <div className={styles.toolbar}>
                        <div className={styles.toolbarLeft}>
                          <span className={styles.tableName}>public.users</span>
                          <span className={styles.rowCountBadge}>2,847 rows</span>
                        </div>
                        <div className={styles.toolbarRight}>
                          <span className={styles.toolbarBtn}>+ Add Row</span>
                          <span className={`${styles.toolbarBtn} ${styles.filterActive}`}>
                            <Filter size={11} /> role = &apos;ENGINEER&apos;
                          </span>
                          <span className={styles.toolbarBtn}>Export CSV</span>
                        </div>
                      </div>

                      <div className={styles.tableContainer}>
                        <table className={styles.dataGrid}>
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}>#</th>
                              <th>id <span className={styles.colType}>uuid</span></th>
                              <th>full_name <span className={styles.colType}>text</span></th>
                              <th>email <span className={styles.colType}>text</span></th>
                              <th>role <span className={styles.colType}>enum</span></th>
                              <th>is_active <span className={styles.colType}>bool</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, idx) => (
                              <tr key={row.id}>
                                <td style={{ color: "#52525b" }}>{idx + 1}</td>
                                <td className={styles.uuidCode}>{row.id}</td>
                                <td className={idx === 1 ? styles.editingCell : undefined}>
                                  {idx === 1 ? (
                                    <div style={{ display: "flex", alignItems: "center" }}>
                                      <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => handleNameChange(e.target.value)}
                                        className={styles.cellInput}
                                        autoFocus
                                      />
                                      <span className={styles.cursorBlink} />
                                    </div>
                                  ) : (
                                    <span
                                      onClick={() => {
                                        setEditingName(row.name);
                                      }}
                                      style={{ cursor: "pointer" }}
                                      title="Click to edit value inline"
                                    >
                                      {row.name}
                                    </span>
                                  )}
                                </td>
                                <td style={{ color: "#a1a1aa" }}>{row.email}</td>
                                <td>
                                  <span
                                    className={`${styles.roleBadge} ${
                                      row.role === "ADMIN"
                                        ? styles.roleAdmin
                                        : row.role === "ENGINEER"
                                        ? styles.roleEngineer
                                        : styles.roleViewer
                                    }`}
                                  >
                                    {row.role}
                                  </span>
                                </td>
                                <td>
                                  <span className={styles.boolBadge}>
                                    <span
                                      className={styles.boolDot}
                                      style={{
                                        background: row.active ? "#10b981" : "#71717a",
                                        boxShadow: row.active ? "0 0 6px #10b981" : "none",
                                      }}
                                    />
                                    <span style={{ color: row.active ? "#34d399" : "#71717a" }}>
                                      {row.active ? "true" : "false"}
                                    </span>
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* View 2: SQL Studio */}
                  {activeTab === "sql" && (
                    <div className={styles.sqlStudio}>
                      <div className={styles.sqlEditorHeader}>
                        <button
                          type="button"
                          className={styles.runQueryBtn}
                          onClick={handleRunQuery}
                        >
                          <Zap size={13} />
                          {isExecutingQuery ? "Executing..." : "Run Query (⌘↵)"}
                        </button>
                        <span className={styles.queryStats}>
                          ✓ Returned 5 rows in {queryDuration} (100% cache hit)
                        </span>
                      </div>

                      <pre className={styles.codeArea}>
                        <span className={styles.sqlComment}>-- Analytical aggregation with index scan on AWS Aurora</span>{"\n"}
                        <span className={styles.sqlKeyword}>SELECT</span> u.id, u.full_name, u.role,{"\n"}
                        {"  "}<span className={styles.sqlFunction}>COUNT</span>(p.id) <span className={styles.sqlKeyword}>AS</span> total_posts,{"\n"}
                        {"  "}<span className={styles.sqlFunction}>MAX</span>(p.created_at) <span className={styles.sqlKeyword}>AS</span> last_active{"\n"}
                        <span className={styles.sqlKeyword}>FROM</span> public.users u{"\n"}
                        <span className={styles.sqlKeyword}>LEFT JOIN</span> public.posts p <span className={styles.sqlKeyword}>ON</span> p.author_id = u.id{"\n"}
                        <span className={styles.sqlKeyword}>WHERE</span> u.is_active = <span className={styles.sqlString}>true</span>{"\n"}
                        <span className={styles.sqlKeyword}>GROUP BY</span> u.id, u.full_name, u.role{"\n"}
                        <span className={styles.sqlKeyword}>ORDER BY</span> total_posts <span className={styles.sqlKeyword}>DESC LIMIT</span> 5;
                      </pre>

                      <div className={styles.sqlResultsTable}>
                        <table className={styles.dataGrid}>
                          <thead>
                            <tr>
                              <th>id</th>
                              <th>full_name</th>
                              <th>role</th>
                              <th>total_posts</th>
                              <th>last_active</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className={styles.uuidCode}>e2b7a4c9</td>
                              <td>Sarah Chen</td>
                              <td><span className={`${styles.roleBadge} ${styles.roleAdmin}`}>ADMIN</span></td>
                              <td style={{ color: "#34d399", fontWeight: 700 }}>42</td>
                              <td style={{ color: "#71717a", fontFamily: "monospace" }}>2 mins ago</td>
                            </tr>
                            <tr>
                              <td className={styles.uuidCode}>a8f1d392</td>
                              <td>Marcus Johnson</td>
                              <td><span className={`${styles.roleBadge} ${styles.roleEngineer}`}>ENGINEER</span></td>
                              <td style={{ color: "#34d399", fontWeight: 700 }}>38</td>
                              <td style={{ color: "#71717a", fontFamily: "monospace" }}>15 mins ago</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* View 3: Visual Schema & DDL */}
                  {activeTab === "schema" && (
                    <div className={styles.schemaViewer}>
                      <div className={styles.schemaCard}>
                        <div className={styles.schemaCardTitle}>
                          <Database size={15} />
                          <span>Table Definition: public.users</span>
                        </div>
                        <div className={styles.schemaColsList}>
                          <div className={styles.schemaColItem}>
                            <span><strong>id</strong> UUID</span>
                            <span className={styles.keyBadge}>PRIMARY KEY</span>
                          </div>
                          <div className={styles.schemaColItem}>
                            <span><strong>full_name</strong> TEXT NOT NULL</span>
                            <span style={{ color: "#71717a" }}>varchar</span>
                          </div>
                          <div className={styles.schemaColItem}>
                            <span><strong>email</strong> TEXT NOT NULL</span>
                            <span className={styles.keyBadge} style={{ background: "rgba(56,189,248,0.15)", color: "#38bdf8" }}>UNIQUE</span>
                          </div>
                          <div className={styles.schemaColItem}>
                            <span><strong>role</strong> user_role</span>
                            <span style={{ color: "#71717a" }}>DEFAULT &apos;ENGINEER&apos;</span>
                          </div>
                          <div className={styles.schemaColItem}>
                            <span><strong>is_active</strong> BOOLEAN</span>
                            <span style={{ color: "#71717a" }}>DEFAULT true</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.schemaCard}>
                        <div className={styles.schemaCardTitle}>
                          <Code size={15} />
                          <span>Generated PostgreSQL DDL</span>
                        </div>
                        <pre className={styles.codeArea} style={{ fontSize: "0.72rem" }}>
                          <span className={styles.sqlKeyword}>CREATE TABLE</span> public.users ({"\n"}
                          {"  "}id <span className={styles.sqlFunction}>UUID</span> PRIMARY KEY DEFAULT gen_random_uuid(),{"\n"}
                          {"  "}full_name <span className={styles.sqlFunction}>TEXT</span> NOT NULL,{"\n"}
                          {"  "}email <span className={styles.sqlFunction}>TEXT</span> UNIQUE NOT NULL,{"\n"}
                          {"  "}role <span className={styles.sqlFunction}>user_role</span> DEFAULT &apos;ENGINEER&apos;,{"\n"}
                          {"  "}is_active <span className={styles.sqlFunction}>BOOLEAN</span> DEFAULT true{"\n"}
                          );{"\n"}
                          <span className={styles.sqlKeyword}>CREATE INDEX CONCURRENTLY</span> idx_users_role{"\n"}
                          <span className={styles.sqlKeyword}>ON</span> public.users(role, is_active);
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Bottom Status Bar */}
                  <div className={styles.statusBar}>
                    <div className={styles.statusMeta}>
                      <span>PostgreSQL 16.4 on AWS RDS</span>
                      <span>·</span>
                      <span>Auto-Save: Instant blur commit</span>
                      <span>·</span>
                      <span>SSL: TLS 1.3 verify-full</span>
                    </div>
                    <div style={{ color: "#34d399", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span className={styles.connDot} />
                      Direct Socket ({queryDuration})
                    </div>
                  </div>
                </main>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
