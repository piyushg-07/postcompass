"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { PRODUCT } from "../config/product";
import { 
  Download, 
  Github, 
  ChevronRight, 
  ChevronDown,
  Table, 
  Code, 
  Database,
  WindowsIcon,
  AppleIcon,
  LinuxIcon,
  Zap,
  Play,
  Check,
  Search,
  Sparkles,
  RefreshCw,
  Compass,
  Settings,
  Layers,
  Activity,
  ArrowRightLeft,
  Eye,
} from "./Icons";
import Hyperspeed from "./Hyperspeed";
import styles from "./Hero.module.css";

type SupportedOs = "macos" | "windows" | "linux" | "cargo";
type ActiveDocTab = "customers" | "diagram" | "query";
type SidebarSection = "tables" | "sql" | "database";

interface RealCustomerRow {
  id: number;
  name: string;
  email: string;
  city: string;
  country: string;
  created_at: string;
}

const REAL_CUSTOMERS: RealCustomerRow[] = [
  { id: 1, name: "Diya Sharma", email: "customer1@example.com", city: "Delhi", country: "India", created_at: "2026-10-17 13:33:00.913188+05:30" },
  { id: 2, name: "Vihaan Sharma", email: "customer2@example.com", city: "Bengaluru", country: "India", created_at: "2026-10-16 13:33:00.913188+05:30" },
  { id: 3, name: "Ananya Sharma", email: "customer3@example.com", city: "Pune", country: "India", created_at: "2026-10-15 13:33:00.913188+05:30" },
  { id: 4, name: "Arjun Sharma", email: "customer4@example.com", city: "Chennai", country: "India", created_at: "2026-10-14 13:33:00.913188+05:30" },
  { id: 5, name: "Isha Sharma", email: "customer5@example.com", city: "Hyderabad", country: "India", created_at: "2026-10-13 13:33:00.913188+05:30" },
  { id: 6, name: "Kabir Sharma", email: "customer6@example.com", city: "Kolkata", country: "India", created_at: "2026-10-12 13:33:00.913188+05:30" },
  { id: 7, name: "Meera Sharma", email: "customer7@example.com", city: "Jaipur", country: "India", created_at: "2026-10-11 13:33:00.913188+05:30" },
  { id: 8, name: "Rohan Sharma", email: "customer8@example.com", city: "Mumbai", country: "India", created_at: "2026-10-10 13:33:00.913188+05:30" },
];

export default function Hero() {
  const [selectedOs, setSelectedOs] = useState<SupportedOs>("windows");
  
  // Desktop IDE active state
  const [activeDocTab, setActiveDocTab] = useState<ActiveDocTab>("customers");
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>("tables");
  const [selectedTable, setSelectedTable] = useState("customers");

  // Table editor live state
  const [customers, setCustomers] = useState<RealCustomerRow[]>(REAL_CUSTOMERS);
  const [searchFilter, setSearchFilter] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [lastMutated, setLastMutated] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  // SQL Studio live state
  const [isQueryRunning, setIsQueryRunning] = useState(false);
  const [queryLatency, setQueryLatency] = useState("1.8ms");
  const [queryRows, setQueryRows] = useState([
    { name: "Arjun Singh", city: "Kolkata", orders: 11, revenue: "1092176.48" },
    { name: "Meera Nair", city: "Delhi", orders: 11, revenue: "879790.40" },
    { name: "Meera Das", city: "Pune", orders: 12, revenue: "867482.46" },
    { name: "Vihaan Khan", city: "Chennai", orders: 9, revenue: "848044.23" },
    { name: "Diya Reddy", city: "Pune", orders: 10, revenue: "804938.35" },
    { name: "Kabir Nair", city: "Mumbai", orders: 7, revenue: "782428.70" },
    { name: "Rohan Khan", city: "Kolkata", orders: 9, revenue: "768098.55" },
  ]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("win")) setSelectedOs("windows");
      else if (ua.includes("linux")) setSelectedOs("linux");
      else if (ua.includes("mac")) setSelectedOs("macos");
    }
  }, []);

  const currentOsLabel =
    selectedOs === "windows"
      ? "Windows"
      : selectedOs === "linux"
      ? "Linux"
      : "macOS";

  const PlatformIcon =
    selectedOs === "windows"
      ? WindowsIcon
      : selectedOs === "macos"
      ? AppleIcon
      : LinuxIcon;

  const handleSaveCell = (id: number) => {
    if (editName.trim()) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: editName.trim() } : c))
      );
      setLastMutated(`Auto-saved row #${id} to database in 1.4ms`);
      setTimeout(() => setLastMutated(null), 3000);
    }
    setEditingId(null);
  };

  const handleRunQuery = () => {
    setIsQueryRunning(true);
    setTimeout(() => {
      setIsQueryRunning(false);
      setQueryLatency(`${(1.2 + Math.random() * 0.7).toFixed(1)}ms`);
    }, 280);
  };

  const toggleSelectRow = (id: number) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.email.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.city.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <section className={styles.hero} id="hero">
      {/* Interactive Hyperspeed 3D Warp Canvas — Behind Headline & Actions */}
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
          tailColors={['#10b981', '#059669', '#34d399']}
          headColors={['#06b6d4', '#0284c7', '#38bdf8']}
          poleColors={['#10b981']}
          interactive
        />
        <div className={styles.hyperspeedFadeTop} />
        <div className={styles.hyperspeedFadeBottom} />
      </div>

      <div className={styles.auroraOrb} />
      <div className={styles.gridBackground} />

      <div className={`container ${styles.content}`}>
        {/* Version Pill Badge */}
        <a href="/download" className={styles.badge}>
          <span className={styles.badgeDot} />
          <span className={styles.badgeTag}>v{PRODUCT.version}</span>
          <span>Native PostgreSQL Desktop Studio</span>
          <ChevronRight size={13} />
        </a>

        {/* Headline with Google Font: Fraunces */}
        <h1 className={styles.headline}>
          The Local-First PostgreSQL Studio
          <br />
          <span className={styles.headlineAccent}>
            Chart Your Database at Native Speed.
          </span>
        </h1>

        {/* Compact, Professional Action Buttons */}
        <div className={styles.ctaWrapper}>
          <div className={styles.ctas}>
            <a
              href="/download"
              className={styles.primaryDownloadBtn}
              suppressHydrationWarning
              aria-label={`Download PostCompass for ${currentOsLabel}`}
            >
              <PlatformIcon size={15} />
              <span>Download for {currentOsLabel}</span>
            </a>

            <a
              href={PRODUCT.github}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.secondaryBtn}
              aria-label="Star PostCompass on GitHub"
            >
              <Github size={14} />
              <span>Star on GitHub</span>
              <span className={styles.githubStarPill}>4.2k</span>
            </a>
          </div>

          {/* Platform Switcher */}
          <div className={styles.osSelectorRow}>
            <span className={styles.osSelectorPrompt}>Also available for:</span>
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

        {/* ============================================================
            Authentic PostCompass Desktop Studio Mockup (Pixel-for-Pixel)
            ============================================================ */}
        <div className={styles.previewContainer}>
          <div className={styles.previewWrapper}>
            <div className={styles.borderBeam} />
            <div className={styles.previewGlow} />

            <div className={styles.preview}>
              {/* Desktop Window Title Bar matching real App */}
              <div className={styles.titleBar}>
                <div className={styles.titleBarLeft}>
                  <div className={styles.trafficLights}>
                    <span className={styles.dot} data-color="red" />
                    <span className={styles.dot} data-color="yellow" />
                    <span className={styles.dot} data-color="green" />
                  </div>
                  <div className={styles.appBrandTitle}>
                    <Compass size={14} style={{ color: "var(--accent)" }} />
                    <span className={styles.appBrandName}>PostCompass</span>
                  </div>
                  <div className={styles.connBreadcrumb}>
                    <span className={styles.connDot} />
                    <span className={styles.connDb}>Local PostgreSQL 18</span>
                    <span className={styles.connSep}>›</span>
                    <span className={styles.connUser}>piyushgres</span>
                    <span className={styles.connSep}>›</span>
                    <span className={styles.connSchema}>public</span>
                  </div>
                </div>

                <div className={styles.titleBarRight}>
                  <div className={styles.connectStatusBadge}>
                    <span className={styles.plugIcon}>🔌</span>
                    <span>Connect</span>
                  </div>
                  <span className={styles.disconnectLink}>Disconnect</span>
                  <div className={styles.windowControls}>
                    <span>—</span>
                    <span>□</span>
                    <span>✕</span>
                  </div>
                </div>
              </div>

              {/* IDE Workspace Layout (Dock + Sidebar + Document Canvas) */}
              <div className={styles.ideWorkspace}>
                {/* 1. Left-most Narrow Vertical Dock */}
                <div className={styles.ideDock}>
                  <div className={styles.dockTop}>
                    <button type="button" className={styles.dockIconBtn} title="Home">
                      <span className={styles.dockIcon}>🏠</span>
                    </button>
                    <button type="button" className={styles.dockIconBtn} title="Databases">
                      <Database size={15} />
                    </button>
                    <button type="button" className={styles.dockIconBtn} title="Search">
                      <Search size={14} />
                    </button>
                    <button 
                      type="button" 
                      className={`${styles.dockIconBtn} ${activeDocTab === "customers" ? styles.dockIconActive : ""}`}
                      onClick={() => {
                        setActiveDocTab("customers");
                        setSidebarSection("tables");
                      }}
                      title="Tables"
                    >
                      <Table size={15} />
                    </button>
                    <button 
                      type="button" 
                      className={`${styles.dockIconBtn} ${activeDocTab === "query" ? styles.dockIconActive : ""}`}
                      onClick={() => {
                        setActiveDocTab("query");
                        setSidebarSection("sql");
                      }}
                      title="SQL Studio"
                    >
                      <Code size={15} />
                    </button>
                  </div>
                  <div className={styles.dockBottom}>
                    <button type="button" className={styles.dockIconBtn} title="Settings">
                      <Settings size={14} />
                    </button>
                  </div>
                </div>

                {/* 2. Collapsible Navigation Sidebar */}
                <div className={styles.ideSidebar}>
                  {/* Segmented Switcher: Tables / SQL / Database */}
                  <div className={styles.sidebarSegmented}>
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarSection("tables");
                        setActiveDocTab("customers");
                      }}
                      className={`${styles.sidebarTabBtn} ${sidebarSection === "tables" ? styles.sidebarTabActive : ""}`}
                    >
                      Tables
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarSection("sql");
                        setActiveDocTab("query");
                      }}
                      className={`${styles.sidebarTabBtn} ${sidebarSection === "sql" ? styles.sidebarTabActive : ""}`}
                    >
                      SQL
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarSection("database")}
                      className={`${styles.sidebarTabBtn} ${sidebarSection === "database" ? styles.sidebarTabActive : ""}`}
                    >
                      Database
                    </button>
                  </div>

                  {/* Sidebar View when 'Tables' is active */}
                  {sidebarSection === "tables" && (
                    <div className={styles.sidebarSectionBody}>
                      <div className={styles.schemaRow}>
                        <span className={styles.schemaPrompt}>schema</span>
                        <span className={styles.schemaName}>public</span>
                        <ChevronDown size={12} className={styles.schemaChevron} />
                        <span className={styles.schemaMore}>···</span>
                      </div>

                      <button type="button" className={styles.newTableBtn}>
                        <span>+ New table</span>
                      </button>

                      <div className={styles.searchTablesBox}>
                        <Search size={11} className={styles.searchTableIcon} />
                        <span className={styles.searchTablePlaceholder}>Search tables</span>
                        <RefreshCw size={11} className={styles.refreshIcon} />
                      </div>

                      <div className={styles.tableItemsList}>
                        <div 
                          className={`${styles.tableListItem} ${selectedTable === "customers" ? styles.tableListItemSelected : ""}`}
                          onClick={() => {
                            setSelectedTable("customers");
                            setActiveDocTab("customers");
                          }}
                        >
                          <div className={styles.tableItemLeft}>
                            <Table size={12} className={styles.tableIconActive} />
                            <span>customers</span>
                          </div>
                          <span className={styles.tableCount}>200</span>
                        </div>

                        <div className={styles.tableListItem} onClick={() => setSelectedTable("order_items")}>
                          <div className={styles.tableItemLeft}>
                            <Table size={12} style={{ color: "#71717a" }} />
                            <span>order_items</span>
                          </div>
                          <span className={styles.tableCount}>2.4K</span>
                        </div>

                        <div className={styles.tableListItem} onClick={() => setSelectedTable("order_summary")}>
                          <div className={styles.tableItemLeft}>
                            <Eye size={12} style={{ color: "#71717a" }} />
                            <span>order_summary</span>
                          </div>
                          <span className={styles.tableCountView}>view</span>
                        </div>

                        <div className={styles.tableListItem} onClick={() => setSelectedTable("orders")}>
                          <div className={styles.tableItemLeft}>
                            <Table size={12} style={{ color: "#71717a" }} />
                            <span>orders</span>
                          </div>
                          <span className={styles.tableCount}>1K</span>
                        </div>

                        <div className={styles.tableListItem} onClick={() => setSelectedTable("products")}>
                          <div className={styles.tableItemLeft}>
                            <Table size={12} style={{ color: "#71717a" }} />
                            <span>products</span>
                          </div>
                          <span className={styles.tableCount}>40</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sidebar View when 'SQL' is active */}
                  {sidebarSection === "sql" && (
                    <div className={styles.sidebarSectionBody}>
                      <button type="button" className={styles.newQueryBtn}>
                        <span>+ New query</span>
                        <span className={styles.ctrlShortcut}>Ctrl+T</span>
                      </button>

                      <div className={styles.queryGroupLabel}>Open 1</div>
                      <div 
                        className={`${styles.tableListItem} ${activeDocTab === "query" ? styles.tableListItemSelected : ""}`}
                        onClick={() => setActiveDocTab("query")}
                      >
                        <div className={styles.tableItemLeft}>
                          <Code size={12} className={styles.tableIconActive} />
                          <span>Query 20</span>
                        </div>
                        <span className={styles.queryDbTag}>piyushgres</span>
                      </div>

                      <div className={styles.queryGroupLabel}>Saved 0</div>
                      <div className={styles.savedEmptyNotice}>Save a query from its tab to keep it here.</div>

                      <div className={styles.queryGroupLabel}>Recent 3</div>
                      <div className={styles.recentQueryItem}>-- Top customers by ...</div>
                      <div className={styles.recentQueryItem}>SELECT * FROM public...</div>
                      <div className={styles.recentQueryItem}>select now() as serv...</div>
                    </div>
                  )}

                  {/* Sidebar View when 'Database' is active */}
                  {sidebarSection === "database" && (
                    <div className={styles.sidebarSectionBody}>
                      <div className={styles.queryGroupLabel}>Connections</div>
                      <div className={styles.tableListItemSelected}>
                        <div className={styles.tableItemLeft}>
                          <span className={styles.connDot} />
                          <span>Local PostgreSQL 18</span>
                        </div>
                      </div>
                      <div className={styles.dbInfoBox}>
                        <span>Server: PostgreSQL 18.0</span>
                        <span>Host: localhost:5432</span>
                        <span>User: piyushgres</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Document Canvas Area */}
                <div className={styles.ideCanvas}>
                  {/* Document Tabs Row matching actual App */}
                  <div className={styles.docTabsRow}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDocTab("customers");
                        setSidebarSection("tables");
                      }}
                      className={`${styles.docTab} ${activeDocTab === "customers" ? styles.docTabActive : ""}`}
                    >
                      <Table size={12} className={activeDocTab === "customers" ? styles.docTabIconActive : ""} />
                      <span>customers</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveDocTab("diagram")}
                      className={`${styles.docTab} ${activeDocTab === "diagram" ? styles.docTabActive : ""}`}
                    >
                      <Layers size={12} className={activeDocTab === "diagram" ? styles.docTabIconActive : ""} />
                      <span>Diagram · public</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveDocTab("query");
                        setSidebarSection("sql");
                      }}
                      className={`${styles.docTab} ${activeDocTab === "query" ? styles.docTabActive : ""}`}
                    >
                      <Code size={12} className={activeDocTab === "query" ? styles.docTabIconActive : ""} />
                      <span>Query 20</span>
                    </button>

                    <span className={styles.addTabBtn}>+</span>

                    <div className={styles.canvasRightStatus}>
                      <Zap size={11} style={{ color: "var(--accent)" }} />
                      <span>Direct TCP &lt;2ms</span>
                    </div>
                  </div>

                  {/* Document Content A: TABLE EDITOR */}
                  {activeDocTab === "customers" && (
                    <div className={styles.tableEditorContainer}>
                      {/* Sub-toolbar */}
                      <div className={styles.tableToolbar}>
                        <div className={styles.tableFilterBox}>
                          <Search size={12} className={styles.searchIcon} />
                          <input
                            type="text"
                            placeholder="Search or filter rows..."
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            className={styles.filterInput}
                          />
                        </div>

                        <div className={styles.tableToolbarActions}>
                          {lastMutated && (
                            <span className={styles.liveAutoSaveToast}>
                              <Check size={11} />
                              {lastMutated}
                            </span>
                          )}
                          <button type="button" className={styles.sortBtn}>
                            <span>↑↓ Sort</span>
                          </button>
                          <button type="button" className={styles.insertBtn}>
                            <span>+ Insert</span>
                            <span className={styles.btnCaret}>▾</span>
                          </button>
                        </div>
                      </div>

                      {/* Spreadsheet Grid */}
                      <div className={styles.gridViewport}>
                        <table className={styles.nativeTable}>
                          <thead>
                            <tr>
                              <th className={styles.thCheck}><input type="checkbox" readOnly /></th>
                              <th className={styles.thCol}>
                                <div className={styles.colHeaderWrapper}>
                                  <span className={styles.pkKeyIcon}>🔑</span>
                                  <span className={styles.colName}>id</span>
                                  <span className={styles.colType}>bigint</span>
                                </div>
                              </th>
                              <th className={styles.thCol}>
                                <div className={styles.colHeaderWrapper}>
                                  <span className={styles.colName}>name</span>
                                  <span className={styles.colType}>text</span>
                                </div>
                              </th>
                              <th className={styles.thCol}>
                                <div className={styles.colHeaderWrapper}>
                                  <span className={styles.colName}>email</span>
                                  <span className={styles.colType}>text</span>
                                </div>
                              </th>
                              <th className={styles.thCol}>
                                <div className={styles.colHeaderWrapper}>
                                  <span className={styles.colName}>city</span>
                                  <span className={styles.colType}>text</span>
                                </div>
                              </th>
                              <th className={styles.thCol}>
                                <div className={styles.colHeaderWrapper}>
                                  <span className={styles.colName}>country</span>
                                  <span className={styles.colType}>text</span>
                                </div>
                              </th>
                              <th className={styles.thCol}>
                                <div className={styles.colHeaderWrapper}>
                                  <span className={styles.colName}>created_at</span>
                                  <span className={styles.colType}>timestamp with time zone</span>
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCustomers.map((c) => {
                              const isEditing = editingId === c.id;
                              const isChecked = selectedRows.includes(c.id);
                              return (
                                <tr key={c.id} className={isChecked ? styles.rowSelected : ""}>
                                  <td className={styles.tdCheck}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleSelectRow(c.id)}
                                    />
                                  </td>
                                  <td className={styles.tdId}>{c.id}</td>
                                  <td
                                    className={styles.tdName}
                                    onDoubleClick={() => {
                                      setEditingId(c.id);
                                      setEditName(c.name);
                                    }}
                                  >
                                    {isEditing ? (
                                      <div className={styles.inlineEditWrapper}>
                                        <input
                                          type="text"
                                          value={editName}
                                          onChange={(e) => setEditName(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSaveCell(c.id);
                                            if (e.key === "Escape") setEditingId(null);
                                          }}
                                          autoFocus
                                          className={styles.liveCellInput}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSaveCell(c.id)}
                                          className={styles.cellSaveBtn}
                                        >
                                          Save
                                        </button>
                                      </div>
                                    ) : (
                                      <div className={styles.cellContent}>
                                        <span>{c.name}</span>
                                        <span className={styles.hoverEditCue}>edit</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className={styles.tdEmail}>{c.email}</td>
                                  <td>{c.city}</td>
                                  <td>{c.country}</td>
                                  <td className={styles.tdDate}>{c.created_at}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Table Status Footer Bar */}
                      <div className={styles.tableFooterBar}>
                        <div className={styles.tableFooterLeft}>
                          <span className={styles.pageNav}>‹ Page 1 of 2 ›</span>
                          <span className={styles.pageSizePill}>100 rows ▾</span>
                          <span className={styles.recordCountPill}>200 records</span>
                        </div>
                        <div className={styles.tableFooterRight}>
                          <span className={styles.activeViewTag}>Data</span>
                          <span className={styles.subViewTag}>Structure</span>
                          <span className={styles.subViewTag}>Definition</span>
                          <span className={styles.subViewTag}>···</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Document Content B: SQL STUDIO */}
                  {activeDocTab === "query" && (
                    <div className={styles.sqlStudioContainer}>
                      {/* SQL Toolbar */}
                      <div className={styles.sqlToolbar}>
                        <div className={styles.sqlToolbarLeft}>
                          <span className={styles.sqlConnDropdown}>
                            <Database size={11} style={{ color: "var(--accent)" }} />
                            <span>piyushgres</span>
                            <ChevronDown size={11} />
                          </span>
                          <span className={styles.explainDropdown}>
                            <span>Explain</span>
                            <ChevronDown size={11} />
                          </span>
                        </div>

                        <div className={styles.sqlToolbarRight}>
                          <span className={styles.toolIcon}>🔖</span>
                          <span className={styles.toolIcon}>🕒</span>
                          <button
                            type="button"
                            onClick={handleRunQuery}
                            disabled={isQueryRunning}
                            className={styles.sqlRunBtn}
                          >
                            <Play size={11} />
                            <span>{isQueryRunning ? "Running..." : "Run"}</span>
                            <span className={styles.runShortcut}>Ctrl ↵</span>
                          </button>
                        </div>
                      </div>

                      {/* Code Editor Pane */}
                      <div className={styles.sqlCodeEditorPane}>
                        <div className={styles.lineNumbers}>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                            <div key={n}>{n}</div>
                          ))}
                        </div>
                        <pre className={styles.sqlCodeText}>
                          <code>
                            <span className={styles.cComment}>-- Top customers by revenue</span>{"\n"}
                            <span className={styles.cKeyword}>SELECT</span> c.name, c.city,{"\n"}
                            {"       "}<span className={styles.cFunc}>count</span>(<span className={styles.cKeyword}>DISTINCT</span> o.id) <span className={styles.cKeyword}>AS</span> orders,{"\n"}
                            {"       "}<span className={styles.cFunc}>sum</span>(oi.quantity * oi.unit_price) <span className={styles.cKeyword}>AS</span> revenue{"\n"}
                            <span className={styles.cKeyword}>FROM</span> customers c{"\n"}
                            <span className={styles.cKeyword}>JOIN</span> orders o <span className={styles.cKeyword}>ON</span> o.customer_id = c.id{"\n"}
                            <span className={styles.cKeyword}>JOIN</span> order_items oi <span className={styles.cKeyword}>ON</span> oi.order_id = o.id{"\n"}
                            <span className={styles.cKeyword}>GROUP BY</span> c.id{"\n"}
                            <span className={styles.cKeyword}>ORDER BY</span> revenue <span className={styles.cKeyword}>DESC</span>{"\n"}
                            <span className={styles.cKeyword}>LIMIT</span> 10;
                          </code>
                        </pre>
                      </div>

                      {/* Results Pane */}
                      <div className={styles.sqlResultsPane}>
                        <div className={styles.resultsTabBar}>
                          <div className={styles.resultTabActive}>Result 1</div>
                          <div className={styles.resultMetaRow}>
                            <span>10 rows</span>
                            <span className={styles.metaAction}>Copy</span>
                            <span className={styles.metaTiming}>⏱ {queryLatency}</span>
                          </div>
                        </div>

                        <div className={styles.resultsTableWrapper}>
                          <table className={styles.resultsGrid}>
                            <thead>
                              <tr>
                                <th>name</th>
                                <th>city</th>
                                <th>orders</th>
                                <th>revenue</th>
                              </tr>
                            </thead>
                            <tbody>
                              {queryRows.map((r, i) => (
                                <tr key={i}>
                                  <td style={{ color: "#ffffff", fontWeight: 600 }}>{r.name}</td>
                                  <td>{r.city}</td>
                                  <td>{r.orders}</td>
                                  <td style={{ color: "#34d399", fontFamily: "var(--font-mono)" }}>{r.revenue}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Document Content C: SCHEMA DIAGRAM ERD */}
                  {activeDocTab === "diagram" && (
                    <div className={styles.diagramContainer}>
                      <div className={styles.diagramToolbar}>
                        <span className={styles.diagramStat}>5 tables · 3 relations</span>
                        <span className={styles.diagramLegend}><span className={styles.pkIconSmall}>🔑</span> Primary key</span>
                        <span className={styles.diagramLegend}>↔ Foreign key</span>
                        <span className={styles.diagramLegend}>? Nullable</span>
                        <span className={styles.diagramJump}>Jump to table... ▾</span>
                      </div>
                      <div className={styles.diagramCanvasWrapper}>
                        <Image
                          src="/screenshots/erd-diagram.png"
                          alt="PostCompass GPU-accelerated interactive Schema ERD canvas"
                          width={1100}
                          height={580}
                          unoptimized
                          priority
                          className={styles.diagramImage}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
