"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Cloud,
  Play,
  RefreshCw,
  Plus,
  Trash,
  Server,
  Cpu,
  Check,
  Table,
  Code,
  Layers,
  ChevronRight,
  Shield,
  Zap,
  Activity,
  Terminal,
  Lock,
  AwsLogo,
  ArrowRightLeft
} from "./Icons";
import styles from "./AwsDbShowcase.module.css";

interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  tier: "PRO" | "ENTERPRISE" | "STARTER";
  spend: string;
  status: "ACTIVE" | "PAUSED";
}

const INITIAL_CUSTOMERS: CustomerRecord[] = [
  { id: "svc_9104", name: "auth_service", email: "auth-worker@internal.aws", tier: "ENTERPRISE", spend: "142k ops/s", status: "ACTIVE" },
  { id: "svc_8231", name: "billing_worker", email: "billing@internal.aws", tier: "ENTERPRISE", spend: "84k ops/s", status: "ACTIVE" },
  { id: "svc_4719", name: "event_pipeline", email: "etl@internal.aws", tier: "PRO", spend: "29k ops/s", status: "ACTIVE" },
  { id: "svc_1052", name: "webhook_dispatcher", email: "hooks@internal.aws", tier: "PRO", spend: "12k ops/s", status: "PAUSED" },
  { id: "svc_6310", name: "indexer_cron", email: "cron@internal.aws", tier: "STARTER", spend: "4k ops/s", status: "ACTIVE" },
];

export default function AwsDbShowcase() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoplay, setIsAutoplay] = useState(true);
  const [progress, setProgress] = useState(0);
  const isHoveredRef = useRef(false);

  // Slide 1 State: Connection Handshake
  const [pingStatus, setPingStatus] = useState<"IDLE" | "TESTING" | "SUCCESS">("IDLE");
  const [pingLogs, setPingLogs] = useState<string[]>([
    "[16:42:01] Resolving db-aurora-prod.c2h7.us-east-1.rds.amazonaws.com (Port 5432)...",
    "[16:42:01] Validating AWS IAM SigV4 Authentication token...",
    "[16:42:02] Establishing TLS 1.3 handshake (Cipher: TLS_AES_256_GCM_SHA384)...",
    "[16:42:02] Connected. PgBouncer pool ready (Latency: 2.8ms, Max Conn: 120)."
  ]);

  // Slide 2 State: Interactive Data Grid
  const [customers, setCustomers] = useState<CustomerRecord[]>(INITIAL_CUSTOMERS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastMutationSql, setLastMutationSql] = useState<string>(
    "UPDATE aws_services SET status = 'ACTIVE' WHERE id = 'svc_9104';"
  );
  const [mutationLatency, setMutationLatency] = useState("1.8ms");

  // Slide 3 State: Query Console
  const [activeQueryIndex, setActiveQueryIndex] = useState(0);
  const [isQueryRunning, setIsQueryRunning] = useState(false);
  const [queryView, setQueryView] = useState<"results" | "explain">("results");
  const [querySuccessTime, setQuerySuccessTime] = useState("2.4ms");

  // Slide 4 State: Schema Migrations
  const [dryRunRunning, setDryRunRunning] = useState(false);
  const [dryRunLogs, setDryRunLogs] = useState<string[]>([
    "✓ Lock timeout configured (SET lock_timeout = '2000ms')",
    "✓ Target instance: aws-aurora-pg16-prod (Multi-AZ)",
    "✓ Safe execution mode: Zero exclusive locks detected",
    "✓ Migration dry-run completed successfully in 14ms"
  ]);

  const slides = [
    {
      id: "connect",
      title: "Direct Connect",
      shortTitle: "AWS Connect",
      icon: Cloud,
      eyebrow: "IAM & VPC Bridge",
      heading: "Direct TCP connection to Amazon RDS & Aurora",
      desc: "Connect securely using AWS IAM SigV4 tokens or SSH bastion tunneling. No third-party proxy servers — direct encrypted connection between your local workstation and AWS VPC.",
      features: [
        "AWS IAM SigV4 auth — zero static passwords in local config",
        "TLS 1.3 verify-full with custom CA certificate verification",
        "PgBouncer & AWS RDS Proxy connection pooling compatibility",
        "Direct TCP socket to AWS VPC (zero third-party data transit)"
      ],
      footerBadge: "Compatible with Amazon Aurora Serverless v2, Multi-AZ RDS & PostgreSQL 14–17"
    },
    {
      id: "manipulate",
      title: "Table Editor",
      shortTitle: "Data Grid",
      icon: Table,
      eyebrow: "Live Data Manipulation",
      heading: "Edit live AWS records with instant SQL transaction preview",
      desc: "Click any cell to mutate data on AWS. Changes are wrapped in safe atomic transactions and previewed in real time before execution.",
      features: [
        "Inline cell editing with optimistic local updates",
        "Visual editors for JSONB, Arrays, Enums, and UUID types",
        "Atomic transactions (BEGIN ... COMMIT) with auto-rollback on error",
        "Batch mutations with primary key verification and audit trail"
      ],
      footerBadge: "Atomic commits directly to AWS PostgreSQL in <3ms"
    },
    {
      id: "query",
      title: "SQL & EXPLAIN",
      shortTitle: "Query Studio",
      icon: Code,
      eyebrow: "Performance Console",
      heading: "Sub-3ms queries with visual EXPLAIN ANALYZE tree",
      desc: "Run queries against your AWS PostgreSQL instance with schema-aware autocomplete. Inspect buffer cache hits, detect unindexed scans, and analyze execution plans.",
      features: [
        "Context-aware autocomplete against AWS schema catalog",
        "Visual EXPLAIN ANALYZE tree with node cost breakdown",
        "Buffer cache hit ratio & execution time telemetry",
        "Export result sets to CSV, JSON, or TypeScript types"
      ],
      footerBadge: "Visual execution tree highlights Seq Scans and costly nodes"
    },
    {
      id: "schema",
      title: "Safe Migrations",
      shortTitle: "DDL Migrations",
      icon: Layers,
      eyebrow: "Schema DDL",
      heading: "Zero-downtime migrations with lock-safe guards",
      desc: "Compare local schemas against AWS production. PostCompass enforces 2000ms lock timeouts, uses CONCURRENTLY indexing, and auto-generates rollback scripts.",
      features: [
        "Staging vs. AWS production schema diff and DDL preview",
        "Automatic CREATE INDEX CONCURRENTLY to prevent table locks",
        "Strict 2000ms lock timeout to avoid stalling live app traffic",
        "Pre-computed reverse migration scripts for fast rollback"
      ],
      footerBadge: "Prevents accidental production lockouts and table freeze"
    }
  ];

  // Carousel Autoplay Timer
  useEffect(() => {
    if (!isAutoplay) return;

    const interval = setInterval(() => {
      if (isHoveredRef.current) return;

      setProgress((prev) => {
        if (prev >= 100) {
          setCurrentSlide((curr) => (curr + 1) % slides.length);
          return 0;
        }
        return prev + 2; // 5 seconds per slide (50 ticks * 100ms)
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isAutoplay, slides.length]);

  const selectSlide = (index: number) => {
    setCurrentSlide(index);
    setProgress(0);
  };

  const nextSlide = () => {
    setCurrentSlide((curr) => (curr + 1) % slides.length);
    setProgress(0);
  };

  const prevSlide = () => {
    setCurrentSlide((curr) => (curr - 1 + slides.length) % slides.length);
    setProgress(0);
  };

  // Slide 1: Connection Ping Handler
  const handleTestPing = () => {
    setPingStatus("TESTING");
    setPingLogs([
      `[${new Date().toLocaleTimeString()}] Pinging db-aurora-prod.c2h7.us-east-1.rds.amazonaws.com...`,
      `[${new Date().toLocaleTimeString()}] Handshaking TLS 1.3 (Cipher: TLS_AES_256_GCM_SHA384)...`,
      `[${new Date().toLocaleTimeString()}] AWS IAM Auth Signature validated for arn:aws:iam::104928192:role/db-postcompass-operator...`,
      `[${new Date().toLocaleTimeString()}] ⚡ Round-trip response received: 2.6ms. 0 dropped packets.`
    ]);
    setTimeout(() => {
      setPingStatus("SUCCESS");
    }, 600);
  };

  // Slide 2: Data Manipulation Handlers
  const handleStartEdit = (id: string, currentVal: string) => {
    setEditingId(id);
    setEditValue(currentVal);
  };

  const handleSaveEdit = (id: string, field: "name" | "spend" | "status") => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: editValue } : c))
    );
    setEditingId(null);
    setLastMutationSql(
      `UPDATE aws_customers SET ${field} = '${editValue}', updated_at = NOW() WHERE id = '${id}';`
    );
    setMutationLatency(`${(1.5 + Math.random() * 1.2).toFixed(1)}ms`);
  };

  const toggleCustomerStatus = (id: string) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextStatus = c.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
          setLastMutationSql(
            `UPDATE aws_customers SET status = '${nextStatus}', updated_at = NOW() WHERE id = '${id}';`
          );
          setMutationLatency(`${(1.4 + Math.random() * 0.9).toFixed(1)}ms`);
          return { ...c, status: nextStatus };
        }
        return c;
      })
    );
  };

  const handleAddNewRecord = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newRecord: CustomerRecord = {
      id: `svc_${randomNum}`,
      name: `sync_daemon_${randomNum}`,
      email: `worker@internal.aws`,
      tier: "PRO",
      spend: "18k ops/s",
      status: "ACTIVE"
    };
    setCustomers([newRecord, ...customers]);
    setLastMutationSql(
      `INSERT INTO aws_services (id, name, email, tier, spend, status) VALUES ('${newRecord.id}', '${newRecord.name}', '${newRecord.email}', 'PRO', '18k ops/s', 'ACTIVE');`
    );
    setMutationLatency("2.1ms");
  };

  const handleResetCustomers = () => {
    setCustomers(INITIAL_CUSTOMERS);
    setLastMutationSql("SELECT * FROM aws_services ORDER BY spend DESC LIMIT 5;");
    setMutationLatency("1.9ms");
  };

  // Slide 3: SQL Presets
  const queryPresets = [
    {
      name: "Active Locks & Queries",
      sql: `SELECT pid, usename, state, now() - query_start AS duration, query \nFROM pg_stat_activity \nWHERE datname = 'aws_production' \nAND state != 'idle' \nORDER BY duration DESC LIMIT 4;`,
      time: "2.4ms",
      rows: 4
    },
    {
      name: "Buffer Cache Hit Ratio",
      sql: `SELECT \n  sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100 \n  AS buffer_cache_hit_pct, \n  sum(heap_blks_hit) AS hits \nFROM pg_statio_user_tables;`,
      time: "1.7ms",
      rows: 1
    },
    {
      name: "Throughput by Service",
      sql: `SELECT name, tier, spend, status \nFROM aws_services \nWHERE status = 'ACTIVE' \nORDER BY spend DESC \nLIMIT 4;`,
      time: "2.1ms",
      rows: 4
    }
  ];

  const handleRunQuery = () => {
    setIsQueryRunning(true);
    setTimeout(() => {
      setIsQueryRunning(false);
      setQuerySuccessTime(`${(1.8 + Math.random() * 1.5).toFixed(1)}ms`);
    }, 400);
  };

  // Slide 4: Dry-Run Handler
  const handleDryRun = () => {
    setDryRunRunning(true);
    setTimeout(() => {
      setDryRunRunning(false);
      setDryRunLogs([
        `[${new Date().toLocaleTimeString()}] Connecting to staging clone of AWS RDS cluster...`,
        `[${new Date().toLocaleTimeString()}] Executing: ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token UUID;`,
        `[${new Date().toLocaleTimeString()}] Executing: CREATE INDEX CONCURRENTLY idx_orders_token ON orders(tracking_token);`,
        `[${new Date().toLocaleTimeString()}] ✓ 0 locks held > 50ms. Staging validation passed. Ready for AWS Production.`
      ]);
    }, 700);
  };

  const currentSlideData = slides[currentSlide] ?? slides[0]!;

  return (
    <section
      className={styles.section}
      id="aws-cloud-db"
      onMouseEnter={() => { isHoveredRef.current = true; }}
      onMouseLeave={() => { isHoveredRef.current = false; }}
    >
      <div className={styles.ambientGlow} />

      <div className={`container ${styles.inner}`}>
        {/* Section Header */}
        <div className={styles.header}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            <AwsLogo size={15} />
            <span>AWS RDS & Aurora PostgreSQL</span>
          </div>
          <h2 className={styles.title}>
            Connect AWS databases.{" "}
            <span className={styles.titleGradient}>
              Query & mutate live data in &lt;3ms.
            </span>
          </h2>
          <p className={styles.description}>
            Direct TCP connection with IAM SigV4 auth and SSH tunneling. Inspect live tables, execute parameterized SQL, and deploy lock-safe DDL migrations directly from your local machine.
          </p>
        </div>

        {/* Carousel Tabs Navigation */}
        <div className={styles.carouselNav}>
          <div className={styles.tabList} role="tablist">
            {slides.map((slide, idx) => {
              const TabIcon = slide.icon;
              const isActive = currentSlide === idx;
              return (
                <button
                  key={slide.id}
                  className={`${styles.tabButton} ${isActive ? styles.tabActive : ""}`}
                  onClick={() => selectSlide(idx)}
                  role="tab"
                  aria-selected={isActive}
                >
                  <TabIcon
                    size={16}
                    className={isActive ? styles.tabIconActive : ""}
                  />
                  <span>{slide.title}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.navControls}>
            <button
              className={`${styles.autoplayBadge} ${isAutoplay ? styles.autoplayBadgeActive : ""}`}
              onClick={() => setIsAutoplay(!isAutoplay)}
              title={isAutoplay ? "Pause carousel autoplay" : "Start carousel autoplay"}
            >
              <Zap size={12} />
              <span>{isAutoplay ? "Live Tour: On" : "Tour: Paused"}</span>
            </button>

            <button
              className={styles.controlBtn}
              onClick={prevSlide}
              aria-label="Previous showcase slide"
            >
              <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
            </button>
            <button
              className={styles.controlBtn}
              onClick={nextSlide}
              aria-label="Next showcase slide"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Main Interactive Showcase Card */}
        <div className={styles.showcaseCard}>
          {/* Top Progress bar */}
          <div className={styles.cardProgressBar}>
            <div
              className={styles.cardProgressFill}
              style={{ width: `${isAutoplay ? progress : 100}%` }}
            />
          </div>

          <div className={styles.stageLayout}>
            {/* Story / Context Sidebar */}
            <div className={styles.storySidebar}>
              <div>
                <span className={styles.slidePill}>
                  <currentSlideData.icon size={13} />
                  {currentSlideData.eyebrow}
                </span>
                <h3 className={styles.storyTitle}>{currentSlideData.heading}</h3>
                <p className={styles.storyDesc}>{currentSlideData.desc}</p>

                <ul className={styles.storyFeatures}>
                  {currentSlideData.features.map((feature, i) => (
                    <li key={i} className={styles.storyFeatureItem}>
                      <Check size={14} className={styles.checkIcon} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.storyBadgeBottom}>
                <Shield size={14} style={{ color: "#ff9900", flexShrink: 0 }} />
                <span>{currentSlideData.footerBadge}</span>
              </div>
            </div>

            {/* Interactive Stage Canvas */}
            <div className={styles.stageCanvas}>
              {/* Window Header */}
              <div className={styles.windowBar}>
                <div className={styles.windowDots}>
                  <span className={`${styles.windowDot} ${styles.windowDotRed}`} />
                  <span className={`${styles.windowDot} ${styles.windowDotYellow}`} />
                  <span className={`${styles.windowDot} ${styles.windowDotGreen}`} />
                </div>
                <div className={styles.windowTitle}>
                  <Server size={14} />
                  <span>aws-aurora-production.us-east-1.rds.amazonaws.com:5432</span>
                </div>
                <div className={styles.statusIndicator}>
                  <span className={styles.pingDot} />
                  <span>CONNECTED · TLS 1.3</span>
                </div>
              </div>

              {/* SLIDE 1: AWS Cloud Bridge */}
              {currentSlide === 0 && (
                <div className={styles.bridgeContainer}>
                  {/* Topology Diagram */}
                  <div className={styles.topologyFlow}>
                    <div className={styles.flowNode}>
                      <Cpu size={15} style={{ color: "#10b981" }} />
                      <span>PostCompass Native</span>
                    </div>
                    <div className={styles.flowLine}>
                      <div className={styles.flowPulse} />
                    </div>
                    <div className={styles.flowNode}>
                      <Lock size={14} style={{ color: "#ff9900" }} />
                      <span>AWS VPC Peering / IAM</span>
                    </div>
                    <div className={styles.flowLine}>
                      <div className={styles.flowPulse} />
                    </div>
                    <div className={styles.flowNode}>
                      <AwsLogo size={16} style={{ color: "#ff9900" }} />
                      <span>Amazon Aurora DB</span>
                    </div>
                  </div>

                  {/* Config Parameters */}
                  <div className={styles.configGrid}>
                    <div className={styles.configCard}>
                      <div className={styles.configLabel}>Target Endpoint</div>
                      <div className={styles.configValue}>db-cluster-prod.c2h7.us-east-1.rds.amazonaws.com</div>
                    </div>
                    <div className={styles.configCard}>
                      <div className={styles.configLabel}>Authentication Method</div>
                      <div className={styles.configValue}>AWS IAM DB Auth (SigV4 Token, Zero Password)</div>
                    </div>
                    <div className={styles.configCard}>
                      <div className={styles.configLabel}>Security Protocol</div>
                      <div className={styles.configValue}>TLS 1.3 Strict · sslmode=verify-full</div>
                    </div>
                    <div className={styles.configCard}>
                      <div className={styles.configLabel}>Connection Pooling</div>
                      <div className={styles.configValue}>AWS RDS Proxy Active (PgBouncer mode)</div>
                    </div>
                  </div>

                  {/* Terminal Log */}
                  <div className={styles.terminalLog}>
                    {pingLogs.map((log, index) => (
                      <div key={index} className={index === pingLogs.length - 1 ? styles.logSuccess : ""}>
                        {log}
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  <button className={styles.pingButton} onClick={handleTestPing}>
                    <RefreshCw size={13} />
                    <span>{pingStatus === "TESTING" ? "Testing Ping to AWS RDS..." : "Ping AWS RDS Cluster"}</span>
                  </button>
                </div>
              )}

              {/* SLIDE 2: Live Data Manipulation */}
              {currentSlide === 1 && (
                <div>
                  <div className={styles.gridControls}>
                    <input
                      type="text"
                      placeholder="Filter records..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={styles.searchInput}
                    />

                    <div className={styles.actionButtonGroup}>
                      <button className={`${styles.smallBtn} ${styles.primarySmallBtn}`} onClick={handleAddNewRecord}>
                        <Plus size={13} />
                        <span>Insert Row</span>
                      </button>
                      <button className={styles.smallBtn} onClick={handleResetCustomers}>
                        <RefreshCw size={13} />
                        <span>Reset Data</span>
                      </button>
                    </div>
                  </div>

                  {/* Interactive Table */}
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>SERVICE ID</th>
                          <th>SERVICE NAME</th>
                          <th>WORKER / HOST</th>
                          <th>TIER</th>
                          <th>THROUGHPUT</th>
                          <th>STATUS</th>
                          <th>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers
                          .filter((c) =>
                            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.email.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map((customer) => (
                            <tr key={customer.id}>
                              <td>{customer.id}</td>
                              <td>
                                {editingId === `${customer.id}_name` ? (
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => handleSaveEdit(customer.id, "name")}
                                    onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(customer.id, "name")}
                                    autoFocus
                                    className={styles.cellInput}
                                  />
                                ) : (
                                  <span
                                    className={styles.editableCell}
                                    onClick={() => handleStartEdit(`${customer.id}_name`, customer.name)}
                                    title="Click to edit value in AWS database"
                                  >
                                    {customer.name} ✎
                                  </span>
                                )}
                              </td>
                              <td>{customer.email}</td>
                              <td>
                                <span className={customer.tier === "ENTERPRISE" ? styles.tierEnterprise : styles.tierPro}>
                                  {customer.tier}
                                </span>
                              </td>
                              <td>
                                {editingId === `${customer.id}_spend` ? (
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => handleSaveEdit(customer.id, "spend")}
                                    onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(customer.id, "spend")}
                                    autoFocus
                                    className={styles.cellInput}
                                  />
                                ) : (
                                  <span
                                    className={styles.editableCell}
                                    onClick={() => handleStartEdit(`${customer.id}_spend`, customer.spend)}
                                    title="Click to edit value in AWS database"
                                  >
                                    {customer.spend} ✎
                                  </span>
                                )}
                              </td>
                              <td>
                                <button
                                  className={`${styles.statusBadge} ${
                                    customer.status === "ACTIVE" ? styles.statusActive : styles.statusPaused
                                  }`}
                                  onClick={() => toggleCustomerStatus(customer.id)}
                                  title="Click to toggle status on AWS"
                                >
                                  {customer.status}
                                </button>
                              </td>
                              <td>
                                <button
                                  className={styles.smallBtn}
                                  onClick={() => toggleCustomerStatus(customer.id)}
                                  style={{ padding: "0.2rem 0.4rem", fontSize: "0.7rem" }}
                                >
                                  Toggle
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Real-Time Mutation SQL Drawer */}
                  <div className={styles.mutationDrawer}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflow: "hidden" }}>
                      <Activity size={14} style={{ color: "#ff9900", flexShrink: 0 }} />
                      <span className={styles.mutationSql}>{lastMutationSql}</span>
                    </div>
                    <span className={styles.mutationLatency}>⚡ AWS RDS Synced ({mutationLatency})</span>
                  </div>
                </div>
              )}

              {/* SLIDE 3: Sub-4ms SQL Studio */}
              {currentSlide === 2 && (() => {
                const activeQuery = queryPresets[activeQueryIndex] ?? queryPresets[0]!;
                return (
                  <div>
                    <div className={styles.queryPresets}>
                      {queryPresets.map((preset, idx) => (
                        <button
                          key={preset.name}
                          className={`${styles.presetBtn} ${activeQueryIndex === idx ? styles.presetBtnActive : ""}`}
                          onClick={() => {
                            setActiveQueryIndex(idx);
                            setQuerySuccessTime(preset.time);
                          }}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>

                    {/* SQL Code Box */}
                    <div className={styles.editorArea}>
                      <pre className={styles.sqlCode}>
                        {activeQuery.sql}
                      </pre>
                    </div>

                    <div className={styles.runBar}>
                      <button className={styles.runBtn} onClick={handleRunQuery}>
                        <Play size={13} />
                        <span>{isQueryRunning ? "Running on AWS..." : "Run Query on AWS RDS"}</span>
                      </button>

                      <div className={styles.telemetryStats}>
                        <div className={styles.statItem}>
                          <span>Latency:</span>
                          <span className={styles.statHighlight}>{querySuccessTime}</span>
                        </div>
                        <div className={styles.statItem}>
                          <span>Rows:</span>
                          <span className={styles.statHighlight}>{activeQuery.rows}</span>
                        </div>
                        <div className={styles.statItem}>
                          <span>Buffer Cache:</span>
                          <span className={styles.statHighlight}>99.8%</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button
                          className={`${styles.smallBtn} ${queryView === "results" ? styles.primarySmallBtn : ""}`}
                          onClick={() => setQueryView("results")}
                        >
                          Results Grid
                        </button>
                        <button
                          className={`${styles.smallBtn} ${queryView === "explain" ? styles.primarySmallBtn : ""}`}
                          onClick={() => setQueryView("explain")}
                        >
                          Visual EXPLAIN Plan
                        </button>
                      </div>
                    </div>

                    {queryView === "results" ? (
                      <div className={styles.terminalLog} style={{ minHeight: "130px" }}>
                        <div className={styles.logHighlight}>-- Connected: Amazon Aurora Serverless v2 (PostgreSQL 16.2)</div>
                        <div className={styles.logSuccess}>-- Returned {activeQuery.rows} rows in {querySuccessTime}</div>
                        <div>[1] auth_service | ENTERPRISE | 142k ops/s | ACTIVE</div>
                        <div>[2] billing_worker | ENTERPRISE | 84k ops/s | ACTIVE</div>
                        <div>[3] event_pipeline | PRO | 29k ops/s | ACTIVE</div>
                        <div>[4] webhook_dispatcher | PRO | 12k ops/s | PAUSED</div>
                      </div>
                    ) : (
                      <div className={styles.explainTree}>
                        <div className={styles.treeNode}>
                          <strong>Limit</strong> (cost=0.00..0.15 rows=4 width=84) (actual time=0.012..0.024ms rows=4 loops=1)
                        </div>
                        <div className={styles.treeSubNode}>
                          <strong>-&gt; Index Scan using idx_customers_spend on aws_customers</strong> (cost=0.15..12.40 rows=145 width=84)
                          <div style={{ color: "var(--accent)", fontSize: "0.7rem", marginTop: "2px" }}>
                            Filter: (status = &apos;ACTIVE&apos;) | Buffers: shared hit=4 | IOps: 0 (cached)
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SLIDE 4: Safe Schema Migrations */}
              {currentSlide === 3 && (
                <div>
                  <div className={styles.migrationDiff}>
                    <div style={{ color: "var(--fg-muted)", marginBottom: "0.5rem" }}>
                      -- Comparing local schema vs. AWS RDS Production (Multi-AZ)
                    </div>
                    <div>ALTER TABLE aws_orders</div>
                    <span className={styles.diffAdded}>
                      + ADD COLUMN IF NOT EXISTS checkout_session_id VARCHAR(64);
                    </span>
                    <span className={styles.diffAdded}>
                      + CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_checkout ON aws_orders (checkout_session_id);
                    </span>
                  </div>

                  <div className={styles.safetyGrid}>
                    <div className={styles.safetyCard}>
                      <div className={styles.safetyTitle}>
                        <Check size={14} style={{ color: "var(--accent)" }} />
                        <span>Zero Table Locks</span>
                      </div>
                      <p className={styles.safetyDesc}>Uses CONCURRENTLY to prevent blocking live write operations on AWS.</p>
                    </div>

                    <div className={styles.safetyCard}>
                      <div className={styles.safetyTitle}>
                        <Check size={14} style={{ color: "var(--accent)" }} />
                        <span>Lock Timeout Guard</span>
                      </div>
                      <p className={styles.safetyDesc}>Strict 2000ms threshold guarantees your live user traffic is never stalled.</p>
                    </div>

                    <div className={styles.safetyCard}>
                      <div className={styles.safetyTitle}>
                        <Check size={14} style={{ color: "var(--accent)" }} />
                        <span>Rollback Ready</span>
                      </div>
                      <p className={styles.safetyDesc}>1-click reverse migration script generated before executing changes.</p>
                    </div>
                  </div>

                  <div className={styles.terminalLog} style={{ minHeight: "95px" }}>
                    {dryRunLogs.map((log, i) => (
                      <div key={i} className={i === dryRunLogs.length - 1 ? styles.logSuccess : ""}>
                        {log}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: "0.75rem" }}>
                    <button className={styles.pingButton} onClick={handleDryRun}>
                      <Zap size={13} />
                      <span>{dryRunRunning ? "Simulating on AWS..." : "Simulate Dry-Run on AWS Staging"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Carousel Bottom Info & Dots */}
        <div className={styles.carouselBottom}>
          <div className={styles.dotIndicators}>
            {slides.map((_, i) => (
              <button
                key={i}
                className={`${styles.dot} ${currentSlide === i ? styles.dotActive : ""}`}
                onClick={() => selectSlide(i)}
                aria-label={`Jump to slide ${i + 1}`}
              />
            ))}
          </div>

          <div className={styles.quickSummary}>
            <span className={styles.awsTechBadge}>AWS RDS & Aurora Optimized</span>
            <span>·</span>
            <span>Zero Data Ingestion</span>
            <span>·</span>
            <span>Local Workstation Direct TLS</span>
          </div>
        </div>
      </div>
    </section>
  );
}
