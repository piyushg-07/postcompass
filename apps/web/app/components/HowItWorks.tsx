"use client";

import { useState, useEffect } from "react";
import { 
  Download, 
  Terminal, 
  Server, 
  Table, 
  Check, 
  Copy, 
  Zap, 
  Shield, 
  Database,
  ArrowRight,
  Sparkles,
  Play,
  Activity,
  Layers,
  Lock,
} from "./Icons";
import styles from "./HowItWorks.module.css";

type StepId = "step-1" | "step-2" | "step-3";
type OsPlatform = "windows" | "mac" | "linux" | "cargo";
type CloudDb = "aws" | "supabase" | "neon" | "docker";

interface StepMeta {
  id: StepId;
  stepNum: string;
  badge: string;
  title: string;
  subtitle: string;
  metric: string;
}

const WORKFLOW_STEPS: StepMeta[] = [
  {
    id: "step-1",
    stepNum: "01",
    badge: "10-Second Setup",
    title: "Download & Instant Launch",
    subtitle: "A self-contained 14.2 MB native Rust binary. Zero Java runtime, zero Python dependencies, zero background daemons.",
    metric: "<90ms Cold Boot",
  },
  {
    id: "step-2",
    stepNum: "02",
    badge: "Direct TLS 1.3",
    title: "Connect Any PostgreSQL",
    subtitle: "Direct TCP socket to AWS RDS, Supabase, Neon, or Docker. 100% private with zero third-party proxy interception.",
    metric: "<2ms Direct Socket",
  },
  {
    id: "step-3",
    stepNum: "03",
    badge: "Native Velocity",
    title: "Mutate, Query & Chart",
    subtitle: "Spreadsheet-style inline editing with optimistic auto-save in 1.4ms, GPU ERD canvas, and visual EXPLAIN tree.",
    metric: "1.4ms Auto-commit",
  },
];

const INSTALL_OPTIONS: Record<OsPlatform, { label: string; cmd: string; tool: string }> = {
  windows: { label: "Windows", cmd: "winget install postcompass", tool: "Windows Package Manager" },
  mac: { label: "macOS", cmd: "brew install --cask postcompass", tool: "Homebrew Cask" },
  linux: { label: "Linux", cmd: "sudo pacman -S postcompass", tool: "Arch / Snap / AppImage" },
  cargo: { label: "Cargo", cmd: "cargo install postcompass", tool: "Rust Crates.io" },
};

const CLOUD_SERVERS: Record<CloudDb, { name: string; host: string; ping: string; ssl: string }> = {
  aws: {
    name: "AWS Aurora RDS",
    host: "aurora-db.cluster-ro-c3x.us-east-1.rds.amazonaws.com:5432",
    ping: "1.8ms",
    ssl: "TLSv1.3 AES-256-GCM Direct",
  },
  supabase: {
    name: "Supabase Dedicated",
    host: "db.xkjdfwkqjwefh.supabase.co:5432/postgres",
    ping: "2.1ms",
    ssl: "TLSv1.3 Direct TCP (Zero Proxy)",
  },
  neon: {
    name: "Neon Serverless",
    host: "ep-hidden-sea-39482.us-east-2.aws.neon.tech/neondb",
    ping: "1.9ms",
    ssl: "TLSv1.3 SSL Connection",
  },
  docker: {
    name: "Docker / Localhost",
    host: "localhost:5432 / UNIX domain socket",
    ping: "0.4ms",
    ssl: "Local Direct Socket Connection",
  },
};

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState<StepId>("step-1");
  const [os, setOs] = useState<OsPlatform>("windows");
  const [cloud, setCloud] = useState<CloudDb>("aws");
  const [copied, setCopied] = useState(false);

  // Step 3 live simulation
  const [editedPlan, setEditedPlan] = useState("Enterprise Tier");
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitToast, setCommitToast] = useState(false);

  const handleCopyCmd = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const handleCommitSimulation = () => {
    setIsCommitting(true);
    setTimeout(() => {
      setIsCommitting(false);
      setCommitToast(true);
      setTimeout(() => setCommitToast(false), 2800);
    }, 220);
  };

  return (
    <section className="section" id="how-it-works">
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <span className="section-badge">Workflow Velocity</span>
          <h2 className="section-title">From install to insight in minutes</h2>
          <p className="section-description">
            Three straightforward steps from download to live SQL analysis. Zero configuration ceremony, zero background services.
          </p>
        </div>

        {/* Crazy Interactive Workflow Engine Cockpit */}
        <div className={styles.engineContainer}>
          {/* Top Step Selector Track */}
          <div className={styles.stepTrack}>
            {WORKFLOW_STEPS.map((step) => {
              const isActive = activeStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={`${styles.trackCard} ${isActive ? styles.trackCardActive : ""}`}
                >
                  <div className={styles.trackCardTop}>
                    <span className={styles.trackStepNum}>{step.stepNum}</span>
                    <span className={styles.trackBadge}>{step.badge}</span>
                  </div>

                  <h3 className={styles.trackTitle}>{step.title}</h3>
                  <p className={styles.trackSubtitle}>{step.subtitle}</p>

                  <div className={styles.trackFooter}>
                    <span className={styles.trackMetric}>
                      <Zap size={11} style={{ color: "var(--accent)" }} />
                      {step.metric}
                    </span>
                    <span className={styles.trackIndicator}>
                      {isActive ? "● Active" : "Click to View"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Interactive Simulation Cockpit Stage */}
          <div className={styles.cockpitStage}>
            {/* Cockpit Window Header */}
            <div className={styles.cockpitHeader}>
              <div className={styles.cockpitDots}>
                <span className={styles.cDot} data-color="red" />
                <span className={styles.cDot} data-color="yellow" />
                <span className={styles.cDot} data-color="green" />
              </div>
              <div className={styles.cockpitTitle}>
                <Sparkles size={13} style={{ color: "var(--accent)" }} />
                <span>
                  {activeStep === "step-1"
                    ? "Interactive CLI & Binary Spawn Engine"
                    : activeStep === "step-2"
                    ? "Direct TCP Multi-Cloud Socket Handshake"
                    : "Instant In-Memory Mutation & Auto-Save Sandbox"}
                </span>
              </div>
              <div className={styles.cockpitLiveTag}>
                <span className={styles.livePulseDot} />
                <span>Live Interactive</span>
              </div>
            </div>

            {/* Cockpit Body */}
            <div className={styles.cockpitBody}>
              {/* STAGE 1: CLI & Binary Spawn */}
              {activeStep === "step-1" && (
                <div className={styles.stagePanel}>
                  {/* OS Switcher */}
                  <div className={styles.osTabRow}>
                    {(["windows", "mac", "linux", "cargo"] as OsPlatform[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setOs(p)}
                        className={`${styles.osTabBtn} ${os === p ? styles.osTabBtnActive : ""}`}
                      >
                        <span>{INSTALL_OPTIONS[p].label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Terminal Box */}
                  <div className={styles.terminalContainer}>
                    <div className={styles.terminalBar}>
                      <span>terminal ({INSTALL_OPTIONS[os].tool})</span>
                      <span className={styles.termLatency}>Spawn Time: 84ms</span>
                    </div>
                    <div className={styles.terminalCodeArea}>
                      <div className={styles.termCommandLine}>
                        <span className={styles.termPrompt}>$</span>
                        <code className={styles.termCode}>{INSTALL_OPTIONS[os].cmd}</code>
                      </div>
                      <div className={styles.termLogList}>
                        <div className={styles.termLogMuted}>
                          <span>[1/3] Downloading single native executable (14.2 MB)...</span>
                          <div className={styles.termFillBar}>
                            <div className={styles.termFillProgress} />
                          </div>
                        </div>
                        <div className={styles.termLogSuccess}>
                          <Check size={12} />
                          <span>[2/3] Verified cryptographic checksum: SHA-256 e8f3a9b1c0</span>
                        </div>
                        <div className={styles.termLogSuccess}>
                          <Check size={12} />
                          <span>[3/3] Native desktop process launched in 84ms · Zero JRE required</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={styles.terminalActionRow}>
                    <button
                      type="button"
                      onClick={() => handleCopyCmd(INSTALL_OPTIONS[os].cmd)}
                      className={styles.copyCommandBtn}
                    >
                      {copied ? (
                        <>
                          <Check size={13} style={{ color: "#34d399" }} />
                          <span>Command Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy Install Command</span>
                        </>
                      )}
                    </button>
                    <a href="/download" className={styles.installerLink}>
                      <Download size={13} />
                      <span>Or download installer file (.exe / .dmg / .deb)</span>
                    </a>
                  </div>
                </div>
              )}

              {/* STAGE 2: Multi-Cloud Direct Socket Handshake */}
              {activeStep === "step-2" && (
                <div className={styles.stagePanel}>
                  {/* Cloud Provider Tabs */}
                  <div className={styles.cloudTabsRow}>
                    {(["aws", "supabase", "neon", "docker"] as CloudDb[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCloud(c)}
                        className={`${styles.cloudTabBtn} ${cloud === c ? styles.cloudTabBtnActive : ""}`}
                      >
                        <Server size={12} />
                        <span>{CLOUD_SERVERS[c].name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Live Socket Card */}
                  <div className={styles.cloudSocketCard}>
                    <div className={styles.cloudSocketTop}>
                      <div className={styles.cloudInfoGroup}>
                        <span className={styles.cloudElephant}>🐘</span>
                        <div>
                          <div className={styles.cloudProviderTitle}>{CLOUD_SERVERS[cloud].name}</div>
                          <code className={styles.cloudHostCode}>{CLOUD_SERVERS[cloud].host}</code>
                        </div>
                      </div>
                      <div className={styles.cloudPingPill}>
                        <Zap size={12} style={{ color: "var(--accent)" }} />
                        <span>{CLOUD_SERVERS[cloud].ping} Direct Socket</span>
                      </div>
                    </div>

                    <div className={styles.cloudSpecsGrid}>
                      <div className={styles.specBox}>
                        <span className={styles.specLabel}>SOCKET PROTOCOL</span>
                        <span className={styles.specValueGood}>Direct Client-to-DB TCP</span>
                      </div>
                      <div className={styles.specBox}>
                        <span className={styles.specLabel}>ENCRYPTION</span>
                        <span className={styles.specValueGood}>{CLOUD_SERVERS[cloud].ssl}</span>
                      </div>
                      <div className={styles.specBox}>
                        <span className={styles.specLabel}>THIRD-PARTY CLOUD PROXY</span>
                        <span className={styles.specValueEmerald}>ZERO (100% Workstation Privacy)</span>
                      </div>
                      <div className={styles.specBox}>
                        <span className={styles.specLabel}>AUTHENTICATION</span>
                        <span className={styles.specValueGood}>SCRAM-SHA-256 / SSL Passphrase</span>
                      </div>
                    </div>

                    <div className={styles.socketVisualLine}>
                      <div className={styles.visualNode}>
                        <span className={styles.nodeIcon}>💻</span>
                        <span>Your Workstation</span>
                      </div>
                      <div className={styles.visualConnection}>
                        <span className={styles.visualBeamBadge}>
                          <Lock size={10} />
                          Direct TLS 1.3 Socket ({CLOUD_SERVERS[cloud].ping})
                        </span>
                      </div>
                      <div className={styles.visualNode}>
                        <span className={styles.nodeIcon}>☁️</span>
                        <span>{CLOUD_SERVERS[cloud].name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 3: Instant Mutation & Auto-Save Sandbox */}
              {activeStep === "step-3" && (
                <div className={styles.stagePanel}>
                  <div className={styles.sandboxMutationBox}>
                    <div className={styles.sandboxMutationTop}>
                      <span className={styles.mutationHeaderTitle}>
                        <Table size={13} style={{ color: "var(--accent)" }} />
                        <span>Live Database Cell Auto-Save Tester</span>
                      </span>
                      {commitToast && (
                        <span className={styles.mutationAutoToast}>
                          <Check size={12} />
                          Auto-committed to PostgreSQL in 1.4ms!
                        </span>
                      )}
                    </div>

                    <div className={styles.mutationInputGroup}>
                      <span className={styles.mutationFieldPrompt}>
                        Record #1 · customers.subscription_tier:
                      </span>
                      <div className={styles.mutationInputRow}>
                        <input
                          type="text"
                          value={editedPlan}
                          onChange={(e) => setEditedPlan(e.target.value)}
                          className={styles.mutationFieldInput}
                          placeholder="Type any value..."
                        />
                        <button
                          type="button"
                          onClick={handleCommitSimulation}
                          disabled={isCommitting}
                          className={styles.mutationCommitBtn}
                        >
                          <Play size={11} />
                          <span>{isCommitting ? "Writing..." : "Commit Mutation"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Query Execution Trace */}
                    <div className={styles.mutationQueryTrace}>
                      <div className={styles.queryCodeLine}>
                        <span className={styles.sqlKw}>UPDATE</span> public.customers{" "}
                        <span className={styles.sqlKw}>SET</span> subscription_tier ={" "}
                        <span className={styles.sqlStr}>&apos;{editedPlan}&apos;</span>{" "}
                        <span className={styles.sqlKw}>WHERE</span> id = 1;
                      </div>
                      <div className={styles.queryTraceMeta}>
                        <span>Status: TRANSACTION COMMITTED</span>
                        <span className={styles.queryTiming}>
                          <Zap size={11} />
                          Round-trip TCP: <strong>1.4ms</strong>
                        </span>
                      </div>
                    </div>

                    {/* Capability Points */}
                    <div className={styles.sandboxPillsRow}>
                      <span className={styles.sandboxPill}>
                        <Check size={11} style={{ color: "var(--accent)" }} />
                        Optimistic instant UI update
                      </span>
                      <span className={styles.sandboxPill}>
                        <Check size={11} style={{ color: "var(--accent)" }} />
                        Rollback on network exception
                      </span>
                      <span className={styles.sandboxPill}>
                        <Check size={11} style={{ color: "var(--accent)" }} />
                        Zero confirmation popups
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cockpit Bottom Navigation Bar */}
            <div className={styles.cockpitFooter}>
              <div className={styles.cockpitFooterLeft}>
                <Activity size={12} style={{ color: "var(--accent)" }} />
                <span>
                  Next Step:{" "}
                  <strong>
                    {activeStep === "step-1"
                      ? "Step 02 / Direct TLS 1.3 Socket"
                      : activeStep === "step-2"
                      ? "Step 03 / Native Velocity"
                      : "Step 01 / Download & Launch"}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (activeStep === "step-1") setActiveStep("step-2");
                  else if (activeStep === "step-2") setActiveStep("step-3");
                  else setActiveStep("step-1");
                }}
                className={styles.nextStepBtn}
              >
                <span>{activeStep === "step-3" ? "Restart Tour" : "Next Station"}</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
