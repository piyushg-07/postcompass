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
  ArrowRightLeft,
  Database,
  Globe,
  Sparkles,
} from "./Icons";
import styles from "./CloudDbShowcase.module.css";

type CloudProvider = "supabase" | "neon" | "aws" | "gcp" | "selfhosted";

interface CloudConfig {
  id: CloudProvider;
  name: string;
  badge: string;
  endpoint: string;
  port: number;
  authMethod: string;
  protocol: string;
  latency: string;
  features: string[];
  handshakeLogs: string[];
}

const CLOUD_PROVIDERS: Record<CloudProvider, CloudConfig> = {
  supabase: {
    id: "supabase",
    name: "Supabase",
    badge: "Managed Postgres",
    endpoint: "db.vjkmgldufrw.supabase.co",
    port: 6543,
    authMethod: "Transaction Pooler (PgBouncer) · Role-Based Auth",
    protocol: "TLS 1.3 Strict · verify-full (Port 6543 / 5432)",
    latency: "1.9ms",
    features: [
      "Direct connection to Supabase PgBouncer pool",
      "Native Row-Level Security (RLS) policy inspection",
      "Real-time schema introspection & UUID generation",
      "Zero SaaS proxy — connects straight to Supabase instance",
    ],
    handshakeLogs: [
      "[17:21:04] Resolving db.vjkmgldufrw.supabase.co (IPv4/IPv6)...",
      "[17:21:04] Negotiating TLS 1.3 session (TLS_AES_256_GCM_SHA384)...",
      "[17:21:05] PgBouncer transaction pool authenticated (Max Conn: 150).",
      "[17:21:05] Connected to Supabase PostgreSQL 15.6. Roundtrip: 1.9ms.",
    ],
  },
  neon: {
    id: "neon",
    name: "Neon Serverless",
    badge: "Serverless Postgres",
    endpoint: "ep-fog-3912.us-east-2.aws.neon.tech",
    port: 5432,
    authMethod: "Neon SNI Token · Passwordless & Scram-SHA-256",
    protocol: "TLS 1.3 verify-full with SNI routing",
    latency: "2.1ms",
    features: [
      "Instant serverless branch switching (main / dev / preview)",
      "Zero cold-start delay direct connection",
      "Copy-on-write database sandbox testing",
      "Compute autoscaling telemetry monitoring",
    ],
    handshakeLogs: [
      "[17:21:04] Resolving ep-fog-3912.us-east-2.aws.neon.tech...",
      "[17:21:04] SNI routing verified for endpoint (Branch: main)...",
      "[17:21:05] Establishing TLS 1.3 handshake with Neon proxy gateway...",
      "[17:21:05] Connected to Neon PostgreSQL 16.2. Roundtrip: 2.1ms.",
    ],
  },
  aws: {
    id: "aws",
    name: "AWS RDS & Aurora",
    badge: "Enterprise Cloud",
    endpoint: "aurora-prod-cluster.c2h7.us-east-1.rds.amazonaws.com",
    port: 5432,
    authMethod: "AWS IAM SigV4 DB Auth / IAM Role Token",
    protocol: "TLS 1.3 Strict · AWS RDS Proxy Pooling",
    latency: "2.4ms",
    features: [
      "AWS IAM SigV4 token auth — zero passwords in local configs",
      "Multi-AZ failover and read-replica routing",
      "VPC Peering, AWS Direct Connect, or SSH Bastion tunneling",
      "PgBouncer / AWS RDS Proxy connection pooling compatibility",
    ],
    handshakeLogs: [
      "[17:21:04] Resolving aurora-prod-cluster.c2h7.us-east-1.rds.amazonaws.com...",
      "[17:21:04] Generating AWS IAM SigV4 authentication token...",
      "[17:21:05] Verifying Amazon Root CA certificate & TLS 1.3 cipher...",
      "[17:21:05] Connected to Amazon Aurora PostgreSQL 16.4. Roundtrip: 2.4ms.",
    ],
  },
  gcp: {
    id: "gcp",
    name: "Google Cloud SQL",
    badge: "Cloud SQL",
    endpoint: "10.128.0.42 (Internal VPC) / Cloud SQL Auth",
    port: 5432,
    authMethod: "Cloud SQL IAM DB Auth · Service Account Key",
    protocol: "TLS 1.3 with Cloud SQL Auth Proxy / Private IP",
    latency: "2.6ms",
    features: [
      "Direct private IP VPC connectivity & Cloud SQL Proxy",
      "Automatic failover replica discovery",
      "Enterprise IAM authentication tokens",
      "Point-in-time recovery and snapshot inspection",
    ],
    handshakeLogs: [
      "[17:21:04] Connecting through Cloud SQL Auth Proxy socket...",
      "[17:21:04] Validating GCP Service Account credentials...",
      "[17:21:05] Establishing mutual TLS (mTLS) encrypted channel...",
      "[17:21:05] Connected to GCP Cloud SQL PostgreSQL 16. Roundtrip: 2.6ms.",
    ],
  },
  selfhosted: {
    id: "selfhosted",
    name: "Self-Hosted / Docker",
    badge: "VPS / Bare Metal",
    endpoint: "postgres.internal.devops.net",
    port: 5432,
    authMethod: "SCRAM-SHA-256 · SSH Bastion Keyed Tunnel",
    protocol: "TLS 1.3 Encrypted or Direct SSH Tunnel",
    latency: "1.2ms",
    features: [
      "Direct connection to any Linux VPS, Docker, or Kubernetes pod",
      "Built-in SSH Bastion Tunnel (Key & Passphrase supported)",
      "Full superuser capabilities: VACUUM, REINDEX, Extension install",
      "100% private: zero data leaves your local machine",
    ],
    handshakeLogs: [
      "[17:21:04] Establishing encrypted SSH tunnel to bastion.internal:22...",
      "[17:21:04] Forwarding local port to postgres.internal.devops.net:5432...",
      "[17:21:05] Authenticating SCRAM-SHA-256 for user 'postgres'...",
      "[17:21:05] Connected to Native PostgreSQL 17.0. Roundtrip: 1.2ms.",
    ],
  },
};

interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  tier: "PRO" | "ENTERPRISE" | "STARTER";
  spend: string;
  status: "ACTIVE" | "PAUSED";
}

const INITIAL_CUSTOMERS: CustomerRecord[] = [
  { id: "svc_9104", name: "auth_service", email: "auth@prod.cloud", tier: "ENTERPRISE", spend: "142k ops/s", status: "ACTIVE" },
  { id: "svc_8231", name: "billing_worker", email: "billing@prod.cloud", tier: "ENTERPRISE", spend: "84k ops/s", status: "ACTIVE" },
  { id: "svc_4719", name: "event_pipeline", email: "etl@prod.cloud", tier: "PRO", spend: "29k ops/s", status: "ACTIVE" },
  { id: "svc_1052", name: "webhook_dispatcher", email: "hooks@prod.cloud", tier: "PRO", spend: "12k ops/s", status: "PAUSED" },
  { id: "svc_6310", name: "indexer_cron", email: "cron@prod.cloud", tier: "STARTER", spend: "4k ops/s", status: "ACTIVE" },
];

export default function CloudDbShowcase() {
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider>("supabase");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [progress, setProgress] = useState(0);
  const isHoveredRef = useRef(false);

  // Slide 1 State: Connection Ping
  const [pingStatus, setPingStatus] = useState<"IDLE" | "TESTING" | "SUCCESS">("IDLE");
  const [pingLogs, setPingLogs] = useState<string[]>(CLOUD_PROVIDERS.supabase.handshakeLogs);

  // Slide 2 State: Live Data Grid
  const [customers, setCustomers] = useState<CustomerRecord[]>(INITIAL_CUSTOMERS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastMutationSql, setLastMutationSql] = useState<string>(
    "UPDATE cloud_services SET status = 'ACTIVE' WHERE id = 'svc_9104';"
  );
  const [mutationLatency, setMutationLatency] = useState("1.8ms");

  // Slide 3 State: Query Console
  const [activeQueryIndex, setActiveQueryIndex] = useState(0);
  const [isQueryRunning, setIsQueryRunning] = useState(false);
  const [queryView, setQueryView] = useState<"results" | "explain">("results");
  const [querySuccessTime, setQuerySuccessTime] = useState("2.1ms");

  // Slide 4 State: Schema Migrations
  const [dryRunRunning, setDryRunRunning] = useState(false);
  const [dryRunLogs, setDryRunLogs] = useState<string[]>([
    "✓ Lock timeout configured (SET lock_timeout = '2000ms')",
    "✓ Target: Cloud Production (Zero exclusive table locks detected)",
    "✓ Safe execution mode: Index builds concurrently",
    "✓ Migration dry-run completed successfully in 12ms",
  ]);

  const activeConfig = CLOUD_PROVIDERS[selectedProvider];

  // Update logs when provider changes
  const handleSelectProvider = (prov: CloudProvider) => {
    setSelectedProvider(prov);
    setPingLogs(CLOUD_PROVIDERS[prov].handshakeLogs);
    setPingStatus("IDLE");
  };

  const slides = [
    {
      id: "connect",
      title: "Direct Connect",
      icon: Cloud,
      eyebrow: "Universal Cloud Bridge",
      heading: `Connect to ${activeConfig.name} directly`,
      desc: `Direct encrypted TCP/SSL connection without proxy latency. Supports ${activeConfig.authMethod}.`,
      features: activeConfig.features,
      footerBadge: `Direct connection to ${activeConfig.name} in ${activeConfig.latency}`,
    },
    {
      id: "manipulate",
      title: "Table Editor",
      icon: Table,
      eyebrow: "Live Data Manipulation",
      heading: "Inline data editing with atomic commits",
      desc: "Click any cell to edit live. Instant preview of generated SQL before atomic commit.",
      features: [
        "Inline cell editing with optimistic local updates",
        "Visual editors for JSONB, Arrays, Enums, and UUID types",
        "Safe transactions with instant rollback on error",
        "Instant audit log of all generated UPDATE and INSERT queries",
      ],
      footerBadge: "Sub-2ms atomic commits executed directly on cloud database",
    },
    {
      id: "query",
      title: "SQL & EXPLAIN",
      icon: Code,
      eyebrow: "Performance Studio",
      heading: "Sub-3ms queries with visual EXPLAIN ANALYZE",
      desc: "Run queries with catalog autocomplete, cache metrics, and visual EXPLAIN tree.",
      features: [
        "Catalog-aware autocomplete against your cloud schema",
        "Visual EXPLAIN execution tree with cost hotspots",
        "Buffer cache hit ratio & latency telemetry",
        "Export result sets to JSON, CSV, or TypeScript interfaces",
      ],
      footerBadge: "Visual execution tree highlights sequential scans instantly",
    },
    {
      id: "schema",
      title: "Safe Migrations",
      icon: Layers,
      eyebrow: "Zero-Downtime DDL",
      heading: "Deploy migrations with lock timeout guards",
      desc: "Enforces 2000ms lock timeouts and builds indexes concurrently to prevent downtime.",
      features: [
        "Local vs. Cloud production schema diff inspection",
        "Automatic CREATE INDEX CONCURRENTLY to prevent locks",
        "Strict 2000ms lock timeout to protect active app traffic",
        "Pre-computed reverse migration rollback scripts",
      ],
      footerBadge: "Guards production databases against unexpected table freezes",
    },
  ];

  // Carousel Autoplay
  useEffect(() => {
    if (!isAutoplay) return;

    const interval = setInterval(() => {
      if (isHoveredRef.current) return;

      setProgress((prev) => {
        if (prev >= 100) {
          setCurrentSlide((curr) => (curr + 1) % slides.length);
          return 0;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isAutoplay, slides.length]);

  const selectSlide = (index: number) => {
    setCurrentSlide(index);
    setProgress(0);
  };

  const handleTestPing = () => {
    setPingStatus("TESTING");
    setTimeout(() => {
      setPingStatus("SUCCESS");
      setPingLogs([
        ...activeConfig.handshakeLogs,
        `[${new Date().toLocaleTimeString()}] Ping roundtrip verified: ${activeConfig.latency} (Zero packet loss).`,
      ]);
    }, 450);
  };

  const handleCellClick = (id: string, currentVal: string) => {
    setEditingId(id);
    setEditValue(currentVal);
  };

  const handleCellBlur = (id: string) => {
    if (editingId === id && editValue) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: editValue } : c))
      );
      setLastMutationSql(
        `UPDATE cloud_services SET name = '${editValue}', updated_at = NOW() WHERE id = '${id}';`
      );
      setMutationLatency(`${(1.2 + Math.random() * 0.8).toFixed(1)}ms`);
    }
    setEditingId(null);
  };

  const handleToggleStatus = (id: string) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextStatus = c.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
          setLastMutationSql(
            `UPDATE cloud_services SET status = '${nextStatus}', updated_at = NOW() WHERE id = '${id}';`
          );
          setMutationLatency(`${(1.4 + Math.random() * 0.6).toFixed(1)}ms`);
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
      name: `worker_cluster_${randomNum}`,
      email: `daemon@prod.cloud`,
      tier: "PRO",
      spend: "19k ops/s",
      status: "ACTIVE",
    };
    setCustomers([newRecord, ...customers]);
    setLastMutationSql(
      `INSERT INTO cloud_services (id, name, email, tier, spend, status) VALUES ('${newRecord.id}', '${newRecord.name}', '${newRecord.email}', 'PRO', '19k ops/s', 'ACTIVE');`
    );
    setMutationLatency("2.1ms");
  };

  const queryPresets = [
    {
      name: "Active Locks & Transactions",
      sql: `SELECT pid, usename, state, now() - query_start AS duration, query\nFROM pg_stat_activity\nWHERE state != 'idle'\nORDER BY duration DESC LIMIT 4;`,
      time: "2.1ms",
      rows: 4,
    },
    {
      name: "Buffer Cache Hit Ratio",
      sql: `SELECT\n  sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100\n  AS buffer_cache_hit_pct,\n  sum(heap_blks_hit) AS hits\nFROM pg_statio_user_tables;`,
      time: "1.7ms",
      rows: 1,
    },
    {
      name: "Throughput by Service",
      sql: `SELECT name, tier, spend, status\nFROM cloud_services\nWHERE status = 'ACTIVE'\nORDER BY spend DESC\nLIMIT 4;`,
      time: "2.2ms",
      rows: 4,
    },
  ];

  const handleRunQuery = () => {
    setIsQueryRunning(true);
    setTimeout(() => {
      setIsQueryRunning(false);
      setQuerySuccessTime(`${(1.6 + Math.random() * 1.2).toFixed(1)}ms`);
    }, 380);
  };

  const handleDryRun = () => {
    setDryRunRunning(true);
    setTimeout(() => {
      setDryRunRunning(false);
      setDryRunLogs([
        `[${new Date().toLocaleTimeString()}] Target: ${activeConfig.name} instance...`,
        `[${new Date().toLocaleTimeString()}] Executing: ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token UUID;`,
        `[${new Date().toLocaleTimeString()}] Executing: CREATE INDEX CONCURRENTLY idx_orders_token ON orders(tracking_token);`,
        `[${new Date().toLocaleTimeString()}] ✓ 0 locks held > 50ms. Staging validation passed. Ready for Cloud Production.`,
      ]);
    }, 600);
  };

  const currentSlideData = slides[currentSlide] ?? slides[0]!;

  return (
    <section
      className={styles.section}
      id="cloud-postgres"
      onMouseEnter={() => { isHoveredRef.current = true; }}
      onMouseLeave={() => { isHoveredRef.current = false; }}
    >
      <div className={styles.ambientGlow} />

      <div className={`container ${styles.inner}`}>
        {/* Section Header */}
        <div className={styles.header}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            <Globe size={14} />
            <span>Multi-Cloud PostgreSQL Studio</span>
          </div>
          <h2 className={styles.title}>
            Connect Any Cloud PostgreSQL
          </h2>

          {/* Cloud Provider Switcher Pills */}
          <div className={styles.providerPicker}>
            <span className={styles.providerPickerLabel}>Choose Database Platform:</span>
            <div className={styles.providerPills}>
              {(Object.keys(CLOUD_PROVIDERS) as CloudProvider[]).map((provKey) => {
                const prov = CLOUD_PROVIDERS[provKey];
                const isSelected = selectedProvider === provKey;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => handleSelectProvider(provKey)}
                    className={`${styles.providerPill} ${isSelected ? styles.providerPillActive : ""}`}
                  >
                    <span className={styles.providerDot} />
                    <span className={styles.providerName}>{prov.name}</span>
                    <span className={styles.providerBadge}>{prov.badge}</span>
                  </button>
                );
              })}
            </div>
          </div>
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
                  <TabIcon size={16} className={isActive ? styles.tabIconActive : ""} />
                  <span>{slide.title}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.navControls}>
            <button
              className={`${styles.autoplayBadge} ${isAutoplay ? styles.autoplayBadgeActive : ""}`}
              onClick={() => setIsAutoplay(!isAutoplay)}
            >
              <Zap size={12} />
              <span>{isAutoplay ? "Tour: On" : "Auto-Tour"}</span>
            </button>
          </div>
        </div>

        {/* Main Interactive Showcase Card */}
        <div className={styles.showcaseCard}>
          {isAutoplay && (
            <div className={styles.cardProgressBar}>
              <div className={styles.cardProgressFill} style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className={styles.stageLayout}>
            {/* Story Sidebar */}
            <div className={styles.storySidebar}>
              <div>
                <div className={styles.slidePill}>
                  <Sparkles size={13} />
                  <span>{currentSlideData.eyebrow}</span>
                </div>
                <h3 className={styles.storyTitle}>{currentSlideData.heading}</h3>
                <p className={styles.storyDesc}>{currentSlideData.desc}</p>

                <ul className={styles.storyFeatures}>
                  {currentSlideData.features.map((feat, i) => (
                    <li key={i} className={styles.storyFeatureItem}>
                      <Check size={14} className={styles.checkIcon} />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.storyBadgeBottom}>
                <Shield size={14} style={{ color: "#10b981" }} />
                <span>{currentSlideData.footerBadge}</span>
              </div>
            </div>

            {/* Interactive Stage Canvas */}
            <div className={styles.stageCanvas}>
              {/* Window Bar */}
              <div className={styles.windowBar}>
                <div className={styles.windowDots}>
                  <span className={`${styles.windowDot} ${styles.windowDotRed}`} />
                  <span className={`${styles.windowDot} ${styles.windowDotYellow}`} />
                  <span className={`${styles.windowDot} ${styles.windowDotGreen}`} />
                </div>
                <div className={styles.windowTitle}>
                  <Server size={14} />
                  <span>{activeConfig.endpoint}:{activeConfig.port}</span>
                </div>
                <div className={styles.statusIndicator}>
                  <span className={styles.pingDot} />
                  <span>CONNECTED · {activeConfig.latency}</span>
                </div>
              </div>

              {/* SLIDE 1: Direct Cloud Connect */}
              {currentSlide === 0 && (
                <div className={styles.bridgeContainer}>
                  {/* Dynamic Topology Flow */}
                  <div className={styles.topologyFlow}>
                    <div className={styles.flowNode}>
                      <Cpu size={15} style={{ color: "#10b981" }} />
                      <span>PostCompass Native</span>
                    </div>
                    <div className={styles.flowLine}>
                      <div className={styles.flowPulse} />
                    </div>
                    <div className={styles.flowNode}>
                      <Lock size={14} style={{ color: "#38bdf8" }} />
                      <span>Direct TLS 1.3 SSL</span>
                    </div>
                    <div className={styles.flowLine}>
                      <div className={styles.flowPulse} />
                    </div>
                    <div className={styles.flowNode}>
                      <Database size={15} style={{ color: "#10b981" }} />
                      <span>{activeConfig.name}</span>
                    </div>
                  </div>

                  {/* Config Specs */}
                  <div className={styles.configGrid}>
                    <div className={styles.configCard}>
                      <div className={styles.configLabel}>Target Cloud Endpoint</div>
                      <div className={styles.configValue}>{activeConfig.endpoint}</div>
                    </div>
                    <div className={styles.configCard}>
                      <div className={styles.configLabel}>Authentication Mode</div>
                      <div className={styles.configValue}>{activeConfig.authMethod}</div>
                    </div>
                    <div className={styles.configCard}>
                      <div className={styles.configLabel}>Encryption Protocol</div>
                      <div className={styles.configValue}>{activeConfig.protocol}</div>
                    </div>
                    <div className={styles.configCard}>
                      <div className={styles.configLabel}>Local Direct Latency</div>
                      <div className={styles.configValue}>{activeConfig.latency} roundtrip</div>
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
                    <span>{pingStatus === "TESTING" ? "Pinging Cloud Database..." : `Ping ${activeConfig.name}`}</span>
                  </button>
                </div>
              )}

              {/* SLIDE 2: Live Data Manipulation */}
              {currentSlide === 1 && (
                <div>
                  <div className={styles.gridControls}>
                    <input
                      type="text"
                      placeholder="Search cloud records..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={styles.searchInput}
                    />
                    <div className={styles.actionButtonGroup}>
                      <button className={`${styles.smallBtn} ${styles.primarySmallBtn}`} onClick={handleAddNewRecord}>
                        <Plus size={13} /> Add Service
                      </button>
                      <button className={styles.smallBtn} onClick={() => setCustomers(INITIAL_CUSTOMERS)}>
                        <RefreshCw size={12} /> Reset
                      </button>
                    </div>
                  </div>

                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>SERVICE NAME (CLICK TO EDIT)</th>
                          <th>EMAIL</th>
                          <th>STATUS</th>
                          <th>OPS RATE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers
                          .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.id.includes(searchQuery))
                          .map((row) => (
                            <tr key={row.id}>
                              <td style={{ color: "#71717a" }}>{row.id}</td>
                              <td>
                                {editingId === row.id ? (
                                  <input
                                    autoFocus
                                    className={styles.cellInput}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(row.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleCellBlur(row.id);
                                    }}
                                  />
                                ) : (
                                  <span
                                    className={styles.editableCell}
                                    onClick={() => handleCellClick(row.id, row.name)}
                                    title="Click to edit value"
                                  >
                                    {row.name} ✎
                                  </span>
                                )}
                              </td>
                              <td style={{ color: "#a1a1aa" }}>{row.email}</td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(row.id)}
                                  className={`${styles.statusBadge} ${row.status === "ACTIVE" ? styles.statusActive : styles.statusPaused}`}
                                >
                                  {row.status}
                                </button>
                              </td>
                              <td style={{ color: "#38bdf8" }}>{row.spend}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.mutationDrawer}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                      <Terminal size={14} style={{ color: "#10b981", flexShrink: 0 }} />
                      <span className={styles.mutationSql}>{lastMutationSql}</span>
                    </div>
                    <span className={styles.mutationLatency}>Executed: {mutationLatency}</span>
                  </div>
                </div>
              )}

              {/* SLIDE 3: SQL & EXPLAIN Tree */}
              {currentSlide === 2 && (
                <div>
                  <div className={styles.queryPresets}>
                    {queryPresets.map((preset, idx) => (
                      <button
                        key={preset.name}
                        className={`${styles.presetBtn} ${activeQueryIndex === idx ? styles.presetBtnActive : ""}`}
                        onClick={() => setActiveQueryIndex(idx)}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>

                  <div className={styles.editorArea}>
                    <pre className={styles.sqlCode}>
                      {queryPresets[activeQueryIndex]?.sql}
                    </pre>
                  </div>

                  <div className={styles.runBar}>
                    <button className={styles.runBtn} onClick={handleRunQuery} disabled={isQueryRunning}>
                      <Play size={13} />
                      <span>{isQueryRunning ? "Running on Cloud..." : `Execute on ${activeConfig.name}`}</span>
                    </button>
                    <div className={styles.telemetryStats}>
                      <span className={styles.statItem}>
                        Latency: <strong className={styles.statHighlight}>{querySuccessTime}</strong>
                      </span>
                      <span className={styles.statItem}>
                        Cache Hit: <strong className={styles.statHighlight}>99.4%</strong>
                      </span>
                    </div>
                  </div>

                  <div className={styles.explainTree}>
                    <div className={styles.treeNode}>
                      ▶ Limit (cost=0.00..0.15 rows=4 width=128)
                    </div>
                    <div className={styles.treeSubNode}>
                      ↳ Index Scan using idx_services_status on cloud_services (cost=0.00..0.15 rows=4)
                    </div>
                    <div className={styles.treeSubNode} style={{ color: "#10b981", borderColor: "#10b981" }}>
                      ✓ Zero Sequential Scans · Fully indexed on cloud
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 4: Safe Migrations */}
              {currentSlide === 3 && (
                <div>
                  <div className={styles.safetyGrid}>
                    <div className={styles.safetyCard}>
                      <div className={styles.safetyTitle}>
                        <Shield size={13} style={{ color: "#10b981" }} />
                        <span>Lock Timeout Protection</span>
                      </div>
                      <p className={styles.safetyDesc}>
                        Automatically sets <code>lock_timeout = 2000ms</code> to prevent holding locks that freeze live user web traffic.
                      </p>
                    </div>
                    <div className={styles.safetyCard}>
                      <div className={styles.safetyTitle}>
                        <Zap size={13} style={{ color: "#38bdf8" }} />
                        <span>Concurrent Indexing</span>
                      </div>
                      <p className={styles.safetyDesc}>
                        Injects <code>CONCURRENTLY</code> on all cloud index creations so tables remain read/write during builds.
                      </p>
                    </div>
                    <div className={styles.safetyCard}>
                      <div className={styles.safetyTitle}>
                        <ArrowRightLeft size={13} style={{ color: "#ff9900" }} />
                        <span>Rollback Scripts</span>
                      </div>
                      <p className={styles.safetyDesc}>
                        Auto-generates pre-computed reverse SQL scripts to revert schema mutations in emergencies.
                      </p>
                    </div>
                  </div>

                  <div className={styles.migrationDiff}>
                    <div>-- Target: {activeConfig.name} ({activeConfig.endpoint})</div>
                    <span className={styles.diffAdded}>+ ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token UUID;</span>
                    <span className={styles.diffAdded}>+ CREATE INDEX CONCURRENTLY idx_orders_token ON orders(tracking_token);</span>
                  </div>

                  <div className={styles.terminalLog} style={{ marginBottom: "1rem" }}>
                    {dryRunLogs.map((log, i) => (
                      <div key={i} className={styles.logSuccess}>{log}</div>
                    ))}
                  </div>

                  <button className={styles.pingButton} onClick={handleDryRun} disabled={dryRunRunning}>
                    <Play size={13} />
                    <span>{dryRunRunning ? "Validating Lock Safety..." : `Validate Dry-Run on ${activeConfig.name}`}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
