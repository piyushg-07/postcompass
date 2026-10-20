"use client";

import React, { useState } from "react";
import {
  Cloud,
  Play,
  RefreshCw,
  Check,
  Table,
  Code,
  Shield,
  Zap,
  Lock,
  Database,
  Globe,
  Server,
  Cpu,
} from "./Icons";
import styles from "./CloudDbShowcase.module.css";

type CloudProvider = "aws" | "supabase" | "neon" | "gcp" | "selfhosted";

interface CloudConfig {
  id: CloudProvider;
  name: string;
  badge: string;
  endpoint: string;
  port: number;
  authMethod: string;
  latency: string;
  handshakeLogs: string[];
}

const CLOUD_PROVIDERS: Record<CloudProvider, CloudConfig> = {
  aws: {
    id: "aws",
    name: "AWS RDS & Aurora",
    badge: "AWS IAM / Direct VPC",
    endpoint: "aurora-cluster.us-east-1.rds.amazonaws.com",
    port: 5432,
    authMethod: "AWS IAM SigV4 DB Auth & Direct SSL",
    latency: "1.8ms",
    handshakeLogs: [
      "[OK] Resolving aurora-cluster.us-east-1.rds.amazonaws.com...",
      "[OK] Establishing direct TLS 1.3 encrypted handshake...",
      "[OK] AWS IAM SigV4 token verified without third-party proxy.",
      "[OK] Connected to Aurora PostgreSQL cluster in 1.8ms.",
    ],
  },
  supabase: {
    id: "supabase",
    name: "Supabase",
    badge: "PgBouncer / Direct",
    endpoint: "db.vjkmgldufrw.supabase.co",
    port: 6543,
    authMethod: "Transaction Pooler (PgBouncer) & SSL",
    latency: "1.9ms",
    handshakeLogs: [
      "[OK] Resolving db.vjkmgldufrw.supabase.co...",
      "[OK] TLS 1.3 negotiated directly with Supabase instance...",
      "[OK] PgBouncer pooler authenticated with SCRAM-SHA-256.",
      "[OK] Connected to Supabase PostgreSQL in 1.9ms.",
    ],
  },
  neon: {
    id: "neon",
    name: "Neon Serverless",
    badge: "SNI / Zero Cold-Start",
    endpoint: "ep-fog-3912.us-east-2.aws.neon.tech",
    port: 5432,
    authMethod: "Neon SNI Token & TLS 1.3",
    latency: "2.1ms",
    handshakeLogs: [
      "[OK] Resolving ep-fog-3912.us-east-2.aws.neon.tech...",
      "[OK] SNI branch routing verified (Branch: main)...",
      "[OK] TLS 1.3 handshake established directly with compute node.",
      "[OK] Connected to Neon Serverless PostgreSQL in 2.1ms.",
    ],
  },
  gcp: {
    id: "gcp",
    name: "Google Cloud SQL",
    badge: "Private IP / IAM",
    endpoint: "10.128.0.42 (Internal VPC)",
    port: 5432,
    authMethod: "Cloud SQL Auth Proxy & Service Account",
    latency: "2.3ms",
    handshakeLogs: [
      "[OK] Direct connection established via VPC socket...",
      "[OK] Google Cloud IAM Service Account token verified...",
      "[OK] Mutual TLS channel active with zero external hops.",
      "[OK] Connected to GCP Cloud SQL PostgreSQL in 2.3ms.",
    ],
  },
  selfhosted: {
    id: "selfhosted",
    name: "Self-Hosted / Docker",
    badge: "Direct SSH Tunnel",
    endpoint: "postgres.internal.lan",
    port: 5432,
    authMethod: "SCRAM-SHA-256 & SSH Bastion Tunnel",
    latency: "1.1ms",
    handshakeLogs: [
      "[OK] Authenticating SSH bastion tunnel on port 22...",
      "[OK] Forwarding local port to postgres.internal.lan:5432...",
      "[OK] SCRAM-SHA-256 authentication verified for user 'postgres'.",
      "[OK] Connected to Bare Metal PostgreSQL in 1.1ms.",
    ],
  },
};

interface CustomerRecord {
  id: string;
  service: string;
  region: string;
  ops: string;
  status: "ACTIVE" | "IDLE";
}

const SAMPLE_DATA: CustomerRecord[] = [
  { id: "svc_01", service: "auth-gateway", region: "us-east-1", ops: "142k ops/s", status: "ACTIVE" },
  { id: "svc_02", service: "billing-worker", region: "us-east-1", ops: "84k ops/s", status: "ACTIVE" },
  { id: "svc_03", service: "analytics-pipeline", region: "eu-central-1", ops: "31k ops/s", status: "ACTIVE" },
  { id: "svc_04", service: "webhook-dispatcher", region: "us-west-2", ops: "18k ops/s", status: "IDLE" },
];

export default function CloudDbShowcase() {
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider>("aws");
  const [activeTab, setActiveTab] = useState<"connect" | "table" | "query">("connect");
  const [isPinging, setIsPinging] = useState(false);
  const [pingSuccess, setPingSuccess] = useState(false);
  const [data, setData] = useState<CustomerRecord[]>(SAMPLE_DATA);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [queryRunning, setQueryRunning] = useState(false);
  const [queryTime, setQueryTime] = useState("1.8ms");

  const currentConfig = CLOUD_PROVIDERS[selectedProvider];

  const handleTestPing = () => {
    setIsPinging(true);
    setPingSuccess(false);
    setTimeout(() => {
      setIsPinging(false);
      setPingSuccess(true);
    }, 450);
  };

  const handleRunQuery = () => {
    setQueryRunning(true);
    setTimeout(() => {
      setQueryRunning(false);
      setQueryTime(`${(1.2 + Math.random() * 0.8).toFixed(1)}ms`);
    }, 380);
  };

  const handleSaveCell = (id: string) => {
    if (editValue.trim()) {
      setData((prev) =>
        prev.map((row) => (row.id === id ? { ...row, service: editValue } : row))
      );
    }
    setEditingId(null);
  };

  return (
    <section className={styles.section} id="cloud-postgres">
      <div className={styles.ambientGlow} />

      <div className={`container ${styles.inner}`}>
        {/* Simple & Clean Header */}
        <div className={styles.header}>
          <div className={styles.eyebrow}>
            <Globe size={14} />
            <span>Direct Database Connection</span>
          </div>
          <h2 className={styles.title}>
            Connect Any Cloud PostgreSQL
          </h2>
          <p className={styles.subtitle}>
            Direct TCP connection from your local workstation with zero third-party proxy.
            Enjoy native speed, sub-2ms queries, and total data privacy.
          </p>
        </div>

        {/* Clean Cloud Provider Switcher */}
        <div className={styles.providerRow}>
          {(Object.keys(CLOUD_PROVIDERS) as CloudProvider[]).map((key) => {
            const prov = CLOUD_PROVIDERS[key];
            const isActive = selectedProvider === key;
            return (
              <button
                key={prov.id}
                type="button"
                onClick={() => {
                  setSelectedProvider(key);
                  setPingSuccess(false);
                }}
                className={`${styles.providerBtn} ${isActive ? styles.providerBtnActive : ""}`}
              >
                <span className={styles.providerDot} />
                <span className={styles.providerName}>{prov.name}</span>
                <span className={styles.providerBadge}>{prov.badge}</span>
              </button>
            );
          })}
        </div>

        {/* Spacious Showcase Card */}
        <div className={styles.showcaseCard}>
          {/* Top Window Bar */}
          <div className={styles.windowHeader}>
            <div className={styles.windowDots}>
              <span className={styles.dotRed} />
              <span className={styles.dotYellow} />
              <span className={styles.dotGreen} />
            </div>

            <div className={styles.windowEndpoint}>
              <Server size={14} className={styles.serverIcon} />
              <span className={styles.endpointText}>
                {currentConfig.endpoint}:{currentConfig.port}
              </span>
            </div>

            <div className={styles.windowStatus}>
              <span className={styles.statusDot} />
              <span className={styles.statusText}>Connected · {currentConfig.latency}</span>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className={styles.cardTabs}>
            <button
              type="button"
              onClick={() => setActiveTab("connect")}
              className={`${styles.tabBtn} ${activeTab === "connect" ? styles.tabBtnActive : ""}`}
            >
              <Cloud size={15} />
              <span>Connection &amp; Topology</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("table")}
              className={`${styles.tabBtn} ${activeTab === "table" ? styles.tabBtnActive : ""}`}
            >
              <Table size={15} />
              <span>Live Data Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("query")}
              className={`${styles.tabBtn} ${activeTab === "query" ? styles.tabBtnActive : ""}`}
            >
              <Code size={15} />
              <span>Sub-2ms SQL Runner</span>
            </button>
          </div>

          {/* Main Interactive Stage */}
          <div className={styles.stageBody}>
            {/* TAB 1: Direct Connection & Handshake */}
            {activeTab === "connect" && (
              <div className={styles.connectStage}>
                {/* Visual Topology Diagram */}
                <div className={styles.topologyCard}>
                  <div className={styles.topoNode}>
                    <Cpu size={16} className={styles.nodeIconPrimary} />
                    <span className={styles.nodeTitle}>Local PostCompass</span>
                    <span className={styles.nodeSub}>Your Desktop</span>
                  </div>

                  <div className={styles.topoLine}>
                    <div className={styles.topoPulse} />
                    <span className={styles.topoLabel}>Direct TLS 1.3 (Zero Proxy)</span>
                  </div>

                  <div className={styles.topoNode}>
                    <Database size={16} className={styles.nodeIconPrimary} />
                    <span className={styles.nodeTitle}>{currentConfig.name}</span>
                    <span className={styles.nodeSub}>{currentConfig.latency} latency</span>
                  </div>
                </div>

                {/* Handshake Logs & Ping Test */}
                <div className={styles.logsBox}>
                  <div className={styles.logsHeader}>
                    <div className={styles.logsTitleGroup}>
                      <span className={styles.logPrompt}>$</span>
                      <span>TCP/SSL Handshake Diagnostic</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestPing}
                      disabled={isPinging}
                      className={styles.pingBtn}
                    >
                      <RefreshCw size={13} className={isPinging ? styles.spinIcon : ""} />
                      <span>{isPinging ? "Testing Ping..." : "Test Latency"}</span>
                    </button>
                  </div>

                  <div className={styles.logsList}>
                    {currentConfig.handshakeLogs.map((log, idx) => (
                      <div key={idx} className={styles.logItem}>
                        <span className={styles.logArrow}>&gt;</span>
                        <span>{log}</span>
                      </div>
                    ))}
                    {pingSuccess && (
                      <div className={styles.logSuccess}>
                        <Check size={14} />
                        <span>Roundtrip verified: Direct SSL packet completed in {currentConfig.latency}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Live Data Editor */}
            {activeTab === "table" && (
              <div className={styles.tableStage}>
                <div className={styles.tableInfoBar}>
                  <span className={styles.tableTag}>table: cloud_services</span>
                  <span className={styles.tableHint}>Double-click any cell to edit &amp; mutate directly on {currentConfig.name}</span>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>SERVICE NAME</th>
                        <th>REGION</th>
                        <th>THROUGHPUT</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row) => {
                        const isEditing = editingId === row.id;
                        return (
                          <tr key={row.id}>
                            <td className={styles.idCell}>{row.id}</td>
                            <td
                              className={styles.editableCell}
                              onDoubleClick={() => {
                                setEditingId(row.id);
                                setEditValue(row.service);
                              }}
                            >
                              {isEditing ? (
                                <div className={styles.editRow}>
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveCell(row.id);
                                      if (e.key === "Escape") setEditingId(null);
                                    }}
                                    autoFocus
                                    className={styles.cellInput}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveCell(row.id)}
                                    className={styles.cellSaveBtn}
                                  >
                                    Save
                                  </button>
                                </div>
                              ) : (
                                <div className={styles.cellTextWrapper}>
                                  <span>{row.service}</span>
                                  <span className={styles.cellEditHint}>edit</span>
                                </div>
                              )}
                            </td>
                            <td>{row.region}</td>
                            <td className={styles.opsCell}>{row.ops}</td>
                            <td>
                              <span
                                className={`${styles.statusBadge} ${
                                  row.status === "ACTIVE" ? styles.statusActive : styles.statusIdle
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: Instant SQL Execution */}
            {activeTab === "query" && (
              <div className={styles.queryStage}>
                <div className={styles.queryEditorBox}>
                  <div className={styles.queryEditorHeader}>
                    <span className={styles.queryLabel}>Query Editor</span>
                    <button
                      type="button"
                      onClick={handleRunQuery}
                      disabled={queryRunning}
                      className={styles.runQueryBtn}
                    >
                      <Play size={13} />
                      <span>{queryRunning ? "Executing..." : "Execute (Ctrl+Enter)"}</span>
                    </button>
                  </div>
                  <pre className={styles.sqlCode}>
                    <code>
                      <span className={styles.sqlKeyword}>SELECT</span> id, service, region, ops{"\n"}
                      <span className={styles.sqlKeyword}>FROM</span> cloud_services{"\n"}
                      <span className={styles.sqlKeyword}>WHERE</span> status = <span className={styles.sqlString}>&apos;ACTIVE&apos;</span>{"\n"}
                      <span className={styles.sqlKeyword}>ORDER BY</span> ops <span className={styles.sqlKeyword}>DESC</span>;
                    </code>
                  </pre>
                </div>

                <div className={styles.queryResultBar}>
                  <span className={styles.resultBadge}>
                    <Check size={13} style={{ color: "#10b981" }} />
                    <span>3 rows returned in <strong>{queryTime}</strong></span>
                  </span>
                  <span className={styles.resultMeta}>Direct TCP connection · Zero proxy overhead</span>
                </div>
              </div>
            )}
          </div>

          {/* Simple Bottom Trust Badges */}
          <div className={styles.cardFooter}>
            <div className={styles.footerItem}>
              <Zap size={14} className={styles.footerIcon} />
              <span>Direct TCP/SSL (&lt;2ms latency)</span>
            </div>
            <div className={styles.footerItem}>
              <Lock size={14} className={styles.footerIcon} />
              <span>Zero Proxy (Direct client-to-DB)</span>
            </div>
            <div className={styles.footerItem}>
              <Shield size={14} className={styles.footerIcon} />
              <span>End-to-End Encrypted (TLS 1.3)</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
