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
  Cpu,
  Lock,
} from "./Icons";
import styles from "./HowItWorks.module.css";

type WorkflowStepId = "step-1" | "step-2" | "step-3";
type InstallPlatform = "windows" | "mac" | "linux" | "cargo";
type CloudProvider = "aws" | "supabase" | "neon" | "local";

interface StepData {
  id: WorkflowStepId;
  stepNum: string;
  badge: string;
  title: string;
  summary: string;
  metric: string;
}

const STEPS: StepData[] = [
  {
    id: "step-1",
    stepNum: "01",
    badge: "10-Second Launch",
    title: "Download Single Binary",
    summary: "A pure Rust executable with zero runtime dependencies. No Java JRE, no Python envs, and no daemon bloat.",
    metric: "14.2 MB · <90ms Cold Boot",
  },
  {
    id: "step-2",
    stepNum: "02",
    badge: "Direct TLS 1.3 Socket",
    title: "Instant Database Handshake",
    summary: "Direct workstation socket connection to AWS RDS, Supabase, Neon, or Docker. Zero cloud proxy interception.",
    metric: "Sub-2ms Direct TCP",
  },
  {
    id: "step-3",
    stepNum: "03",
    badge: "Native Velocity",
    title: "Mutate, Query & Chart",
    summary: "Double-click spreadsheet cell editing with optimistic auto-save, GPU ERD canvas, and visual EXPLAIN tree.",
    metric: "0.9ms Auto-commit",
  },
];

const INSTALL_COMMANDS: Record<InstallPlatform, { cmd: string; tool: string }> = {
  windows: { cmd: "winget install postcompass", tool: "Windows Package Manager" },
  mac: { cmd: "brew install --cask postcompass", tool: "Homebrew Cask" },
  linux: { cmd: "sudo pacman -S postcompass", tool: "Arch / Snap / AppImage" },
  cargo: { cmd: "cargo install postcompass-cli", tool: "Rust Crates.io" },
};

const CLOUD_CONFIGS: Record<CloudProvider, { name: string; host: string; ping: string; ssl: string }> = {
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
  local: {
    name: "Local PostgreSQL 18",
    host: "localhost:5432 / var/run/postgresql/.s.PGSQL.5432",
    ping: "0.4ms",
    ssl: "UNIX Socket / Localhost Direct",
  },
};

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState<WorkflowStepId>("step-1");
  const [platform, setPlatform] = useState<InstallPlatform>("windows");
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>("aws");
  const [copied, setCopied] = useState(false);

  // Step 3 interactive mutation state
  const [demoValue, setDemoValue] = useState("Enterprise Tier");
  const [isMutating, setIsMutating] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const handleCopyCmd = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const handleSimulateMutation = () => {
    setIsMutating(true);
    setTimeout(() => {
      setIsMutating(false);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);
    }, 250);
  };

  return (
    <section className="section" id="how-it-works">
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <span className="section-badge">Fast Workflow</span>
          <h2 className="section-title">From install to insight in minutes</h2>
          <p className="section-description">
            PostCompass removes all setup friction. Three seamless steps from download to live SQL analysis with zero configuration rituals.
          </p>
        </div>

        {/* Interactive 3-Stage Pipeline Bento Station */}
        <div className={styles.pipelineContainer}>
          {/* Left Column: Interactive Step Selector Cards */}
          <div className={styles.stepsRail}>
            {STEPS.map((step) => {
              const isActive = activeStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={`${styles.stepCard} ${isActive ? styles.stepCardActive : ""}`}
                >
                  <div className={styles.stepCardHeader}>
                    <div className={styles.stepBadgeGroup}>
                      <span className={styles.stepNum}>{step.stepNum}</span>
                      <span className={styles.stepBadge}>{step.badge}</span>
                    </div>
                    {isActive && (
                      <span className={styles.activePulse}>
                        <span className={styles.activePulseDot} />
                        Active Station
                      </span>
                    )}
                  </div>

                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepSummary}>{step.summary}</p>

                  <div className={styles.stepFooter}>
                    <span className={styles.stepMetric}>
                      <Zap size={11} style={{ color: "var(--accent)" }} />
                      {step.metric}
                    </span>
                    <span className={styles.cardArrow}>→</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Dynamic Live Preview Sandbox Stage */}
          <div className={styles.sandboxStage}>
            {/* Top Stage Header */}
            <div className={styles.sandboxTopBar}>
              <div className={styles.sandboxDots}>
                <span className={styles.sDot} data-color="red" />
                <span className={styles.sDot} data-color="yellow" />
                <span className={styles.sDot} data-color="green" />
              </div>
              <div className={styles.sandboxTitle}>
                <Sparkles size={12} style={{ color: "var(--accent)" }} />
                <span>
                  {activeStep === "step-1"
                    ? "Interactive CLI & Binary Installer"
                    : activeStep === "step-2"
                    ? "Live Multi-Cloud TCP Handshake Simulator"
                    : "Instant Mutation & Visual EXPLAIN Engine"}
                </span>
              </div>
              <div className={styles.sandboxStatus}>
                <span className={styles.sandboxLiveDot} />
                <span>Live Interactive</span>
              </div>
            </div>

            {/* Stage Body */}
            <div className={styles.sandboxBody}>
              {/* STAGE 1: CLI & Binary Installer */}
              {activeStep === "step-1" && (
                <div className={styles.stageContent}>
                  <div className={styles.platformTabs}>
                    {(["windows", "mac", "linux", "cargo"] as InstallPlatform[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlatform(p)}
                        className={`${styles.platformTab} ${platform === p ? styles.platformTabActive : ""}`}
                      >
                        <span>{p === "windows" ? "Windows" : p === "mac" ? "macOS" : p === "linux" ? "Linux" : "Cargo"}</span>
                      </button>
                    ))}
                  </div>

                  <div className={styles.terminalBox}>
                    <div className={styles.terminalHeader}>
                      <span>bash / powershell</span>
                      <span className={styles.installerMeta}>{INSTALL_COMMANDS[platform].tool}</span>
                    </div>
                    <div className={styles.terminalContent}>
                      <div className={styles.terminalLine}>
                        <span className={styles.termPrompt}>$</span>
                        <span className={styles.termCmd}>{INSTALL_COMMANDS[platform].cmd}</span>
                      </div>
                      <div className={styles.terminalLog}>
                        <span className={styles.termMuted}>Downloading PostCompass-v0.1.0-x64...</span>
                        <div className={styles.termProgressBar}>
                          <div className={styles.termProgressFill} />
                        </div>
                        <span className={styles.termSuccess}>[✓] Package verified: SHA-256 e8f3a9b1c0 (14.2 MB)</span>
                        <span className={styles.termSuccess}>[✓] Desktop studio spawned in 84ms. Zero JRE required.</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.stageActionRow}>
                    <button
                      type="button"
                      onClick={() => handleCopyCmd(INSTALL_COMMANDS[platform].cmd)}
                      className={styles.copyCmdBtn}
                    >
                      {copied ? (
                        <>
                          <Check size={13} style={{ color: "#34d399" }} />
                          <span>Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy Install Command</span>
                        </>
                      )}
                    </button>
                    <a href="/download" className={styles.directDlLink}>
                      <Download size={13} />
                      <span>Or download installer file (.exe / .dmg / .deb)</span>
                    </a>
                  </div>
                </div>
              )}

              {/* STAGE 2: Multi-Cloud Handshake Tester */}
              {activeStep === "step-2" && (
                <div className={styles.stageContent}>
                  <div className={styles.cloudSelectorRow}>
                    {(["aws", "supabase", "neon", "local"] as CloudProvider[]).map((cp) => (
                      <button
                        key={cp}
                        type="button"
                        onClick={() => setCloudProvider(cp)}
                        className={`${styles.cloudBtn} ${cloudProvider === cp ? styles.cloudBtnActive : ""}`}
                      >
                        <Server size={12} />
                        <span>{CLOUD_CONFIGS[cp].name}</span>
                      </button>
                    ))}
                  </div>

                  <div className={styles.connectionCard}>
                    <div className={styles.connectionCardHeader}>
                      <div className={styles.connTargetInfo}>
                        <span className={styles.connDbIcon}>🐘</span>
                        <div>
                          <div className={styles.connDbTitle}>{CLOUD_CONFIGS[cloudProvider].name}</div>
                          <code className={styles.connHostText}>{CLOUD_CONFIGS[cloudProvider].host}</code>
                        </div>
                      </div>
                      <div className={styles.connPingBadge}>
                        <Zap size={11} style={{ color: "var(--accent)" }} />
                        <span>{CLOUD_CONFIGS[cloudProvider].ping} direct</span>
                      </div>
                    </div>

                    <div className={styles.socketMetricsGrid}>
                      <div className={styles.socketMetric}>
                        <span className={styles.sMetricLabel}>Transport Layer:</span>
                        <span className={styles.sMetricValGood}>Direct Workstation TCP Socket</span>
                      </div>
                      <div className={styles.socketMetric}>
                        <span className={styles.sMetricLabel}>Encryption:</span>
                        <span className={styles.sMetricValGood}>{CLOUD_CONFIGS[cloudProvider].ssl}</span>
                      </div>
                      <div className={styles.socketMetric}>
                        <span className={styles.sMetricLabel}>Third-Party Proxy:</span>
                        <span className={styles.sMetricValHighlight}>ZERO (100% Client-Side Privacy)</span>
                      </div>
                      <div className={styles.socketMetric}>
                        <span className={styles.sMetricLabel}>Authentication:</span>
                        <span className={styles.sMetricValGood}>SCRAM-SHA-256 / MD5 Passphrase</span>
                      </div>
                    </div>

                    <div className={styles.handshakeVisual}>
                      <div className={styles.nodeBox}>
                        <span className={styles.nodeIcon}>💻</span>
                        <span>Your Workstation</span>
                      </div>
                      <div className={styles.handshakeLine}>
                        <span className={styles.handshakeBadge}>
                          <Lock size={10} />
                          TLS 1.3 Encrypted Socket
                        </span>
                      </div>
                      <div className={styles.nodeBox}>
                        <span className={styles.nodeIcon}>☁️</span>
                        <span>{CLOUD_CONFIGS[cloudProvider].name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 3: Instant Mutation & Visual Engine */}
              {activeStep === "step-3" && (
                <div className={styles.stageContent}>
                  <div className={styles.mutationSandboxCard}>
                    <div className={styles.mutationCardTop}>
                      <span className={styles.mutationTitle}>
                        <Table size={13} style={{ color: "var(--accent)" }} />
                        <span>Live Database Mutation Simulator</span>
                      </span>
                      {savedToast && (
                        <span className={styles.toastAutoSaved}>
                          <Check size={12} />
                          Auto-saved to PostgreSQL in 0.9ms!
                        </span>
                      )}
                    </div>

                    <div className={styles.interactiveRowEdit}>
                      <div className={styles.rowItemLabel}>Record #1 · customers.tier:</div>
                      <div className={styles.inputButtonRow}>
                        <input
                          type="text"
                          value={demoValue}
                          onChange={(e) => setDemoValue(e.target.value)}
                          className={styles.simInput}
                        />
                        <button
                          type="button"
                          onClick={handleSimulateMutation}
                          disabled={isMutating}
                          className={styles.simSaveBtn}
                        >
                          <Play size={11} />
                          <span>{isMutating ? "Writing..." : "Save Mutation"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Miniature live query terminal */}
                    <div className={styles.miniLogBox}>
                      <div className={styles.logLine}>
                        <span className={styles.logKeyword}>UPDATE</span> public.customers{" "}
                        <span className={styles.logKeyword}>SET</span> tier ={" "}
                        <span className={styles.logString}>&apos;{demoValue}&apos;</span>{" "}
                        <span className={styles.logKeyword}>WHERE</span> id = 1;
                      </div>
                      <div className={styles.logMeta}>
                        <span>Query Status: COMMIT SUCCESS</span>
                        <span className={styles.logSpeed}>
                          <Zap size={11} />
                          Round-trip TCP: <strong>0.9ms</strong>
                        </span>
                      </div>
                    </div>

                    {/* Capabilities bullets */}
                    <div className={styles.stage3Pills}>
                      <span className={styles.stage3Pill}>
                        <Check size={12} style={{ color: "var(--accent)" }} />
                        Optimistic instant UI update
                      </span>
                      <span className={styles.stage3Pill}>
                        <Check size={12} style={{ color: "var(--accent)" }} />
                        Rollback on network exception
                      </span>
                      <span className={styles.stage3Pill}>
                        <Check size={12} style={{ color: "var(--accent)" }} />
                        Zero confirmation popups
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sandbox Bottom Bar */}
            <div className={styles.sandboxBottomBar}>
              <div className={styles.sandboxBottomLeft}>
                <Activity size={12} style={{ color: "var(--accent)" }} />
                <span>Next Station: <strong>{activeStep === "step-1" ? "Step 02 / Direct Socket" : activeStep === "step-2" ? "Step 03 / Native Velocity" : "Download & Get Started"}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (activeStep === "step-1") setActiveStep("step-2");
                  else if (activeStep === "step-2") setActiveStep("step-3");
                  else setActiveStep("step-1");
                }}
                className={styles.nextStageBtn}
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
