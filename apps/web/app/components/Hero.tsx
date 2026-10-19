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
  Globe
} from "./Icons";
import styles from "./Hero.module.css";

function detectPlatform(): { name: string; cmd: string } {
  if (typeof window === "undefined") {
    return { name: "macOS", cmd: "brew install --cask postcompass" };
  }
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) {
    return { name: "Windows", cmd: "winget install postcompass" };
  }
  if (ua.includes("linux")) {
    return { name: "Linux", cmd: "curl -fsSL https://postcompass.dev/install.sh | bash" };
  }
  return { name: "macOS", cmd: "brew install --cask postcompass" };
}

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
  const [platformInfo, setPlatformInfo] = useState<{ name: string; cmd: string }>({
    name: "macOS",
    cmd: "brew install --cask postcompass",
  });
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"table" | "sql" | "schema">("table");
  const [rows, setRows] = useState<UserRow[]>(INITIAL_ROWS);
  const [editingName, setEditingName] = useState("Marcus Johnson");

  useEffect(() => {
    setPlatformInfo(detectPlatform());
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(platformInfo.cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNameChange = (val: string) => {
    setEditingName(val);
    setRows((prev) =>
      prev.map((r, i) => (i === 1 ? { ...r, name: val } : r))
    );
  };

  return (
    <section className={styles.hero} id="hero">
      <div className={styles.gridBackground} />
      
      <div className={`container ${styles.content}`}>
        {/* Eyebrow / Version Pill */}
        <a href="#download" className={styles.badge}>
          <span className={styles.badgeDot} />
          <span className={styles.badgeTag}>v{PRODUCT.version}</span>
          <span>Public Beta · Native PostgreSQL Client</span>
          <ChevronRight size={13} />
        </a>

        {/* High-Impact Headline */}
        <h1 className={styles.headline}>
          The PostgreSQL client
          <br />
          <span className={styles.headlineAccent}>you&apos;ve always wanted.</span>
        </h1>

        {/* Subtitle */}
        <p className={styles.subtitle}>
          Combining the spreadsheet agility of Supabase with the deep inspection power of pgAdmin.
          A lightning-fast, local-first native desktop client with zero cloud proxies.
        </p>

        {/* Primary CTAs */}
        <div className={styles.ctas}>
          <a href="#download" className={styles.primaryDownloadBtn}>
            <Download size={18} />
            Download Free for {platformInfo.name}
          </a>
          <a
            href={PRODUCT.github}
            className={styles.secondaryBtn}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github size={18} />
            Star on GitHub
            <span className={styles.githubStarBadge}>★ 4.2k</span>
          </a>
        </div>

        {/* CLI Quick Install Command Bar */}
        <div className={styles.cliBar}>
          <span className={styles.cliPrompt}>$</span>
          <code className={styles.cliSnippet}>{platformInfo.cmd}</code>
          <button
            onClick={handleCopy}
            className={`${styles.cliCopyBtn} ${copied ? styles.cliCopied : ""}`}
            aria-label="Copy terminal command"
          >
            {copied ? (
              <>
                <Check size={13} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Trust Badges */}
        <div className={styles.metaBadges}>
          <span className={styles.metaItem}>
            <Shield size={14} />
            <span><strong>100% Local-First</strong> (No cloud proxy)</span>
          </span>
          <span className={styles.metaItem}>
            <Zap size={14} />
            <span><strong>Direct TCP/SSL</strong> (8ms latency)</span>
          </span>
          <span className={styles.metaItem}>
            <Globe size={14} />
            <span><strong>macOS · Windows · Linux</strong></span>
          </span>
          <span className={styles.metaItem}>
            <span>Free & Open Source (MIT)</span>
          </span>
        </div>

        {/* Desktop App Window Mockup */}
        <div className={styles.previewWrapper}>
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
                  Schema & DDL
                </button>
              </div>

              {/* Status info */}
              <div className={styles.titleBarStatus}>
                <div className={styles.connIndicator}>
                  <span className={styles.connDot} />
                  <span>local-pg16:5432 (8ms)</span>
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
                    <span>production-replica</span>
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
                    <span>posts</span>
                    <span className={styles.itemCount}>14.2k</span>
                  </div>
                  <div className={styles.sidebarItem}>
                    <span>orders</span>
                    <span className={styles.itemCount}>890</span>
                  </div>
                  <div className={styles.sidebarItem}>
                    <span>audit_logs</span>
                    <span className={styles.itemCount}>120k</span>
                  </div>
                  <div className={styles.sidebarItem}>
                    <span>categories</span>
                    <span className={styles.itemCount}>34</span>
                  </div>
                </div>
              </aside>

              {/* Main Work Area */}
              <main className={styles.mainArea}>
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
                        <span className={styles.toolbarBtn}>Sort</span>
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
                                  row.name
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
                      <button type="button" className={styles.runQueryBtn}>
                        <Zap size={13} />
                        Run Query (⌘↵)
                      </button>
                      <span className={styles.queryStats}>✓ Returned 5 rows in 1.8ms</span>
                    </div>

                    <pre className={styles.codeArea}>
                      <span className={styles.sqlComment}>-- Analytical aggregation with index scan</span>{"\n"}
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
                        <span className={styles.sqlKeyword}>CREATE INDEX</span> idx_users_role{"\n"}
                        <span className={styles.sqlKeyword}>ON</span> public.users(role, is_active);
                      </pre>
                    </div>
                  </div>
                )}

                {/* Bottom Status Bar */}
                <div className={styles.statusBar}>
                  <div className={styles.statusMeta}>
                    <span>Page 1 of 57</span>
                    <span>·</span>
                    <span>PostgreSQL 16.4 on aarch64</span>
                    <span>·</span>
                    <span>Auto-Save: Active (blur commit)</span>
                  </div>
                  <div style={{ color: "#34d399", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <span className={styles.connDot} />
                    Direct TCP (8ms)
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
